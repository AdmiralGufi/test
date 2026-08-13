import {NextResponse} from 'next/server';
import {getCurrentUser} from '../../../../lib/auth';
import {sql} from '../../../../lib/db';
import {cleanText} from '../../../../lib/wms-contract';
import {requireSeller} from '../../../../lib/tenant';
import {encryptSecret} from '../../../../lib/secrets';
import {syncWildberriesIntegration,validateWildberriesToken} from '../../../../lib/wildberries';
import {logError,logInfo,requestContext} from '../../../../lib/observability';

export const runtime='nodejs';
export const maxDuration=60;

const fail=(error,status=400)=>NextResponse.json({error},{status});
const managers=['ADMIN','MANAGER'];

function wbError(error){
  const raw=String(error?.message||error);
  if(raw.includes('WB_API_401'))return 'Токен Wildberries не принят. Проверьте токен и доступ «Маркетплейс».';
  if(raw.includes('WB_API_403'))return 'В токене нет доступа к категории «Маркетплейс».';
  if(raw.includes('WB_API_429'))return 'Wildberries временно ограничил частоту запросов. Повторите через минуту.';
  return 'Не удалось связаться с Wildberries. Проверьте токен и повторите попытку.';
}

async function ownedIntegrations(user,{onlyDue=false,id=null}={}){
  if(id)return sql`select * from wb_integrations where id=${id} and organization_id=${user.organization_id} and active=true limit 1`;
  if(onlyDue)return sql`update wb_integrations set last_sync_at=now()
    where id in (
      select id from wb_integrations
      where organization_id=${user.organization_id} and active=true
        and (last_sync_at is null or last_sync_at<now()-interval '45 seconds')
      order by last_sync_at nulls first limit 10 for update skip locked
    ) returning *`;
  return sql`select * from wb_integrations where organization_id=${user.organization_id} and active=true order by created_at`;
}

export async function POST(request){
  const context=requestContext(request,'/api/integrations/wildberries');
  const user=await getCurrentUser();
  if(!user)return fail('UNAUTHORIZED',401);
  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=='object')return fail('Некорректный запрос');
  try{
    if(input.action==='SAVE'){
      if(!managers.includes(user.role))return fail('Недостаточно прав',403);
      const token=String(input.token||'').trim().replace(/^Bearer\s+/i,'');
      if(!input.seller_id||token.length<20)return fail('Выберите клиента и вставьте полный API-токен Wildberries');
      await requireSeller(user,input.seller_id);
      await validateWildberriesToken(token);
      const hint=`•••• ${token.slice(-4)}`;
      const encrypted=encryptSecret(token);
      const rows=await sql`insert into wb_integrations(organization_id,seller_id,name,token_encrypted,token_hint,active,created_by)
        values(${user.organization_id},${input.seller_id},${cleanText(input.name,120)||'Wildberries FBS'},${encrypted},${hint},true,${user.id})
        on conflict(organization_id,seller_id) do update set name=excluded.name,token_encrypted=excluded.token_encrypted,token_hint=excluded.token_hint,active=true,last_error=null,updated_at=now()
        returning *`;
      const result=await syncWildberriesIntegration(rows[0],user.id);
      logInfo('wb_integration_connected',{...context,actorId:user.id,sellerId:input.seller_id,imported:result.imported});
      return NextResponse.json({ok:true,integration:{id:rows[0].id,token_hint:hint},sync:result});
    }
    if(input.action==='SYNC'||input.action==='SYNC_ALL'){
      if(!managers.includes(user.role))return fail('Недостаточно прав',403);
      const rows=await ownedIntegrations(user,{onlyDue:input.action==='SYNC_ALL',id:input.integration_id||null});
      const results=[];
      for(const integration of rows){
        try{results.push({id:integration.id,ok:true,...await syncWildberriesIntegration(integration,user.id)})}
        catch(error){results.push({id:integration.id,ok:false,error:wbError(error)})}
      }
      return NextResponse.json({ok:true,results,imported:results.reduce((sum,item)=>sum+(item.imported||0),0)});
    }
    if(input.action==='DISCONNECT'){
      if(!managers.includes(user.role))return fail('Недостаточно прав',403);
      await sql`delete from wb_integrations where id=${input.integration_id} and organization_id=${user.organization_id}`;
      return NextResponse.json({ok:true});
    }
    return fail('Неизвестная операция');
  }catch(error){
    logError('wb_integration_failed',error,{...context,actorId:user.id,action:cleanText(input.action,40)||'UNKNOWN'});
    return fail(wbError(error),error?.status===401?401:400);
  }
}
