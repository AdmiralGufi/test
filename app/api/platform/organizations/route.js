import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getCurrentUser} from '../../../../lib/auth';
import {transaction} from '../../../../lib/db';
import {cleanText,validEmail} from '../../../../lib/wms-contract';
import {logError,logInfo,requestContext} from '../../../../lib/observability';

export const runtime='nodejs';

const ZONES=[
  ['RCV','Приёмка','RECEIVING',10],
  ['QC','QC / карантин','QC',20],
  ['SRT','Сортировка','SORTING',30],
  ['STG','Хранение','STORAGE',40],
  ['PCK','Picking','PICKING',50],
  ['PAK','Packing','PACKING',60],
  ['RDY','Готово к отгрузке','READY',70],
  ['SHP','Отгрузка','SHIPPING',80],
  ['RET','Возвраты','RETURNS',90]
];

const fail=(error,status=400)=>NextResponse.json({error},{status});

export async function POST(request){
  const context=requestContext(request,'/api/platform/organizations');
  const actor=await getCurrentUser();
  if(!actor)return fail('UNAUTHORIZED',401);
  if(!actor.is_platform_admin)return fail('Эта операция доступна только владельцу платформы',403);

  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=='object')return fail('Некорректный запрос');

  const name=cleanText(input.name,200);
  const slug=cleanText(input.slug,80).toLowerCase();
  const warehouseName=cleanText(input.warehouse_name,200)||'Основной склад';
  const warehouseCode=(cleanText(input.warehouse_code,40)||'MAIN').toUpperCase();
  const timezone=cleanText(input.timezone,80)||'Asia/Bishkek';
  const adminName=cleanText(input.admin_name,160);
  const adminEmail=cleanText(input.admin_email,254).toLowerCase();
  const password=String(input.admin_password||'');

  if(!name||!slug||!adminName||!adminEmail||!password)return fail('Заполните данные компании, склада и администратора');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return fail('Короткий адрес: только латинские буквы, цифры и дефисы');
  if(!/^[A-Z0-9_-]+$/.test(warehouseCode))return fail('Код склада: латинские буквы, цифры, дефис или подчёркивание');
  if(!validEmail(adminEmail))return fail('Проверьте email администратора');
  if(password.length<8)return fail('Пароль должен содержать минимум 8 символов');

  const organizationId=randomUUID();
  const warehouseId=randomUUID();
  const adminId=randomUUID();

  try{
    await transaction(tx=>[
      tx`insert into organizations(id,name,slug,status,plan) values(${organizationId},${name},${slug},'TRIAL','PILOT')`,
      tx`insert into warehouses(id,organization_id,code,name,timezone,active) values(${warehouseId},${organizationId},${warehouseCode},${warehouseName},${timezone},true)`,
      ...ZONES.map(([code,zoneName,type,sortOrder])=>tx`insert into zones(id,warehouse_id,code,name,zone_type,sort_order) values(${randomUUID()},${warehouseId},${code},${zoneName},${type},${sortOrder})`),
      tx`insert into users(id,email,name,password_hash,role,active,is_platform_admin) values(${adminId},${adminEmail},${adminName},crypt(${password},gen_salt('bf',10)),'ADMIN',true,false)`,
      tx`insert into organization_members(organization_id,user_id,role,active) values(${organizationId},${adminId},'ADMIN',true)`,
      tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${actor.id},'ONBOARD_ORGANIZATION','organization',${organizationId},jsonb_build_object('name',${name}::text,'slug',${slug}::text,'warehouse_code',${warehouseCode}::text,'admin_email',${adminEmail}::text))`
    ],{isolationLevel:'Serializable'});
    logInfo('organization_onboarded',{...context,actorId:actor.id,organizationId});
    return NextResponse.json({ok:true,organization:{id:organizationId,name,slug,status:'TRIAL'},warehouse:{id:warehouseId,code:warehouseCode,name:warehouseName},admin:{id:adminId,name:adminName,email:adminEmail}},{status:201});
  }catch(error){
    const raw=String(error?.message||error);
    logError('organization_onboarding_failed',error,{...context,actorId:actor.id});
    if(raw.includes('organizations_slug_key'))return fail('Такой короткий адрес уже используется',409);
    if(raw.includes('users_email_key'))return fail('Пользователь с таким email уже существует',409);
    return fail('Не удалось создать фулфилмент. Проверьте данные и повторите попытку');
  }
}
