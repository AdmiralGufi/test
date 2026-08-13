import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getCurrentUser} from '../../../../lib/auth';
import {sql,transaction} from '../../../../lib/db';
import {cleanText,validEmail} from '../../../../lib/wms-contract';
import {logError,logInfo,requestContext} from '../../../../lib/observability';
import {STANDARD_ZONES} from '../../../../lib/warehouse';

export const runtime='nodejs';

const fail=(error,status=400)=>NextResponse.json({error},{status});
const PLANS=['PILOT','START','GROWTH','BUSINESS','ENTERPRISE'];
const STATUSES=['ACTIVE','TRIAL','SUSPENDED'];

async function platformActor(){
  const actor=await getCurrentUser();
  if(!actor)return {error:fail('UNAUTHORIZED',401)};
  if(!actor.is_platform_admin)return {error:fail('Эта операция доступна только владельцу платформы',403)};
  return {actor};
}

async function organization(id){
  const rows=await sql`select id,name,slug,status,plan,archived_at from organizations where id=${id} limit 1`;
  return rows[0]||null;
}

export async function POST(request){
  const context=requestContext(request,'/api/platform/organizations');
  const auth=await platformActor();
  if(auth.error)return auth.error;
  const actor=auth.actor;

  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=='object')return fail('Некорректный запрос');

  const name=cleanText(input.name,200);
  const slug=cleanText(input.slug,80).toLowerCase();
  const warehouseName=cleanText(input.warehouse_name,200)||'Основной склад';
  const warehouseCode=(cleanText(input.warehouse_code,40)||'MAIN').toUpperCase();
  const warehouseCity=cleanText(input.warehouse_city,120);
  const warehouseAddress=cleanText(input.warehouse_address,240);
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
      tx`insert into organizations(id,name,slug,status,plan,billing_status,trial_ends_at) values(${organizationId},${name},${slug},'TRIAL','PILOT','TRIALING',now()+interval '14 days')`,
      tx`insert into warehouses(id,organization_id,code,name,city,address,timezone,active) values(${warehouseId},${organizationId},${warehouseCode},${warehouseName},${warehouseCity||null},${warehouseAddress||null},${timezone},true)`,
      ...STANDARD_ZONES.map(([code,zoneName,type,sortOrder])=>tx`insert into zones(id,warehouse_id,code,name,zone_type,sort_order) values(${randomUUID()},${warehouseId},${code},${zoneName},${type},${sortOrder})`),
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

export async function PATCH(request){
  const context=requestContext(request,'/api/platform/organizations');
  const auth=await platformActor();
  if(auth.error)return auth.error;
  const actor=auth.actor;
  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=='object'||!input.organization_id)return fail('Выберите фулфилмент');
  const target=await organization(input.organization_id);
  if(!target)return fail('Фулфилмент не найден',404);

  try{
    if(input.action==='UPDATE_PROFILE'){
      const name=cleanText(input.name,200);
      const slug=cleanText(input.slug,80).toLowerCase();
      const plan=cleanText(input.plan,40).toUpperCase();
      if(!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return fail('Проверьте название и короткий адрес');
      if(!PLANS.includes(plan))return fail('Выберите доступный тариф');
      await transaction(tx=>[
        tx`update organizations set name=${name},slug=${slug},plan=${plan},updated_at=now() where id=${target.id}`,
        tx`insert into audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(${actor.id},'UPDATE_ORGANIZATION','organization',${target.id},jsonb_build_object('name',${target.name}::text,'slug',${target.slug}::text,'plan',${target.plan}::text),jsonb_build_object('name',${name}::text,'slug',${slug}::text,'plan',${plan}::text))`
      ],{isolationLevel:'Serializable'});
      logInfo('organization_updated',{...context,actorId:actor.id,organizationId:target.id});
      return NextResponse.json({ok:true});
    }

    if(input.action==='UPDATE_ADMIN'){
      const adminName=cleanText(input.admin_name,160);
      const adminEmail=cleanText(input.admin_email,254).toLowerCase();
      const password=String(input.admin_password||'');
      if(!input.admin_id||!adminName||!validEmail(adminEmail))return fail('Проверьте имя и email администратора');
      if(password&&password.length<8)return fail('Новый пароль должен содержать минимум 8 символов');
      const admins=await sql`select u.id from users u join organization_members m on m.user_id=u.id where u.id=${input.admin_id} and m.organization_id=${target.id} and m.role='ADMIN' and m.active=true limit 1`;
      if(!admins[0])return fail('Администратор фулфилмента не найден',404);
      await transaction(tx=>[
        tx`update users u set name=${adminName},email=${adminEmail},password_hash=case when ${password||null}::text is null then u.password_hash else crypt(${password||null}::text,gen_salt('bf',10)) end where u.id=${input.admin_id} and exists(select 1 from organization_members m where m.organization_id=${target.id} and m.user_id=u.id and m.role='ADMIN') returning u.id`,
        tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${actor.id},'UPDATE_ORGANIZATION_ADMIN','organization',${target.id},jsonb_build_object('admin_id',${input.admin_id}::text,'email',${adminEmail}::text,'password_reset',${Boolean(password)}::boolean))`,
        tx`delete from sessions where organization_id=${target.id} and user_id=${input.admin_id}`
      ],{isolationLevel:'Serializable'});
      logInfo('organization_admin_updated',{...context,actorId:actor.id,organizationId:target.id});
      return NextResponse.json({ok:true});
    }

    if(input.action==='SET_STATUS'){
      const status=cleanText(input.status,20).toUpperCase();
      if(!STATUSES.includes(status))return fail('Недопустимый статус');
      if(target.archived_at)return fail('Сначала восстановите фулфилмент из архива');
      if(target.id===actor.organization_id&&status==='SUSPENDED')return fail('Нельзя приостановить собственный рабочий фулфилмент');
      const queries=[
        tx=>tx`update organizations set status=${status},billing_status=case when ${status}='ACTIVE' then 'MANUAL' when ${status}='TRIAL' then 'TRIALING' else billing_status end,trial_ends_at=case when ${status}='TRIAL' and (trial_ends_at is null or trial_ends_at<=now()) then now()+interval '14 days' else trial_ends_at end,updated_at=now() where id=${target.id}`,
        tx=>tx`insert into audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(${actor.id},'SET_ORGANIZATION_STATUS','organization',${target.id},jsonb_build_object('status',${target.status}::text),jsonb_build_object('status',${status}::text))`
      ];
      if(status==='SUSPENDED')queries.push(tx=>tx`delete from sessions where organization_id=${target.id}`);
      await transaction(tx=>queries.map(build=>build(tx)),{isolationLevel:'Serializable'});
      logInfo('organization_status_changed',{...context,actorId:actor.id,organizationId:target.id,status});
      return NextResponse.json({ok:true});
    }

    if(input.action==='RESTORE'){
      if(!target.archived_at)return fail('Фулфилмент не находится в архиве');
      await transaction(tx=>[
        tx`update organizations set status='ACTIVE',billing_status='MANUAL',archived_at=null,updated_at=now() where id=${target.id}`,
        tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${actor.id},'RESTORE_ORGANIZATION','organization',${target.id},jsonb_build_object('status','ACTIVE'))`
      ],{isolationLevel:'Serializable'});
      logInfo('organization_restored',{...context,actorId:actor.id,organizationId:target.id});
      return NextResponse.json({ok:true});
    }
    return fail('Неизвестная операция');
  }catch(error){
    const raw=String(error?.message||error);
    logError('organization_management_failed',error,{...context,actorId:actor.id,organizationId:target.id,action:cleanText(input.action,40)});
    if(raw.includes('organizations_slug_key'))return fail('Такой короткий адрес уже используется',409);
    if(raw.includes('users_email_key'))return fail('Пользователь с таким email уже существует',409);
    return fail('Изменения не сохранены. Повторите попытку');
  }
}

export async function DELETE(request){
  const context=requestContext(request,'/api/platform/organizations');
  const auth=await platformActor();
  if(auth.error)return auth.error;
  const actor=auth.actor;
  const input=await request.json().catch(()=>null);
  if(!input?.organization_id)return fail('Выберите фулфилмент');
  const target=await organization(input.organization_id);
  if(!target)return fail('Фулфилмент не найден',404);
  if(target.id===actor.organization_id)return fail('Нельзя архивировать собственный рабочий фулфилмент',403);
  if(target.archived_at)return fail('Фулфилмент уже находится в архиве');
  if(cleanText(input.confirm_name,200)!==target.name)return fail('Для подтверждения введите точное название фулфилмента');
  try{
    await transaction(tx=>[
      tx`update organizations set status='SUSPENDED',archived_at=now(),updated_at=now() where id=${target.id}`,
      tx`delete from sessions where organization_id=${target.id}`,
      tx`insert into audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(${actor.id},'ARCHIVE_ORGANIZATION','organization',${target.id},jsonb_build_object('status',${target.status}::text),jsonb_build_object('status','SUSPENDED','archived',true))`
    ],{isolationLevel:'Serializable'});
    logInfo('organization_archived',{...context,actorId:actor.id,organizationId:target.id});
    return NextResponse.json({ok:true,archived:true});
  }catch(error){
    logError('organization_archive_failed',error,{...context,actorId:actor.id,organizationId:target.id});
    return fail('Не удалось архивировать фулфилмент');
  }
}
