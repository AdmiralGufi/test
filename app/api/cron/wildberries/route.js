import {NextResponse} from 'next/server';
import {sql} from '../../../../lib/db';
import {syncWildberriesIntegration} from '../../../../lib/wildberries';
import {logError,logInfo,requestContext} from '../../../../lib/observability';

export const runtime='nodejs';
export const maxDuration=60;
const respond=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'private, no-store, max-age=0'}});

export async function GET(request){
  const context=requestContext(request,'/api/cron/wildberries');
  const secret=process.env.CRON_SECRET;
  if(!secret){
    logError('wb_cron_secret_missing',new Error('CRON_SECRET is not configured'),context);
    return respond({error:'CRON_NOT_CONFIGURED'},503);
  }
  const authorized=request.headers.get('authorization')===`Bearer ${secret}`;
  if(!authorized)return respond({error:'UNAUTHORIZED'},401);
  const integrations=await sql`update wb_integrations set last_sync_at=now()
    where id in (
      select i.id from wb_integrations i join organizations o on o.id=i.organization_id
      where i.active=true and o.status in ('ACTIVE','TRIAL') and o.archived_at is null
        and (i.last_sync_at is null or i.last_sync_at<now()-interval '45 seconds')
      order by i.last_sync_at nulls first limit 50 for update of i skip locked
    ) returning *`;
  let imported=0,failed=0;
  for(const integration of integrations){
    try{imported+=(await syncWildberriesIntegration(integration)).imported}
    catch(error){failed+=1;logError('wb_cron_integration_failed',error,{...context,integrationId:integration.id})}
  }
  logInfo('wb_cron_completed',{...context,integrations:integrations.length,imported,failed});
  return respond({ok:true,integrations:integrations.length,imported,failed});
}
