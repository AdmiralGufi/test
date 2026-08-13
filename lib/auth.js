import { cookies } from 'next/headers';
import { sql } from './db';
const COOKIE='wms_session';
const secureCookie=process.env.NODE_ENV==='production';

export async function tenancyEnabled(){
  const rows=await sql`select to_regclass('public.organization_members') is not null enabled`;
  return rows[0]?.enabled===true;
}

export async function ensureInitialOrganization(userId,name='Fulfillment'){
  if(!await tenancyEnabled())return null;
  let organizations=await sql`select id from organizations order by created_at limit 1`;
  if(!organizations[0])organizations=await sql`insert into organizations(name,slug,status,plan) values(${name},'main-fulfillment','ACTIVE','PILOT') returning id`;
  const organizationId=organizations[0].id;
  await sql`insert into organization_members(organization_id,user_id,role,active) values(${organizationId},${userId},'ADMIN',true) on conflict(organization_id,user_id) do update set role='ADMIN',active=true`;
  const warehouses=await sql`select id from warehouses where organization_id=${organizationId} order by created_at limit 1`;
  if(!warehouses[0])await sql`insert into warehouses(organization_id,code,name) values(${organizationId},'MAIN','Основной склад')`;
  return organizationId;
}

export async function createSession(userId){
  let rows;
  if(await tenancyEnabled()){
    rows=await sql`with t as (select encode(gen_random_bytes(32),'hex') raw),m as (select om.organization_id from organization_members om join organizations o on o.id=om.organization_id where om.user_id=${userId} and om.active=true and o.status in ('ACTIVE','TRIAL') and o.archived_at is null order by om.created_at limit 1) insert into sessions(token_hash,user_id,organization_id,expires_at) select encode(digest(t.raw,'sha256'),'hex'),${userId},m.organization_id,now()+interval '30 days' from t cross join m returning (select raw from t) as token`;
    if(!rows[0])throw new Error('NO_ACTIVE_ORGANIZATION');
  }else{
    rows=await sql`with t as (select encode(gen_random_bytes(32),'hex') raw) insert into sessions(token_hash,user_id,expires_at) select encode(digest(raw,'sha256'),'hex'),${userId},now()+interval '30 days' from t returning (select raw from t) as token`;
  }
  const c=await cookies();
  c.set(COOKIE,rows[0].token,{httpOnly:true,secure:secureCookie,sameSite:'lax',path:'/',maxAge:2592000});
}
export async function getCurrentUser(){
  const c=await cookies(); const token=c.get(COOKIE)?.value; if(!token)return null;
  let rows;
  if(await tenancyEnabled())rows=await sql`select u.id,u.email,u.name,u.is_platform_admin,m.role,s.organization_id,o.name organization_name,w.id warehouse_id,w.name warehouse_name,sm.seller_id,sm.access_role seller_access_role,se.name seller_name from sessions s join users u on u.id=s.user_id join organizations o on o.id=s.organization_id join organization_members m on m.organization_id=s.organization_id and m.user_id=u.id and m.active=true left join lateral(select id,name from warehouses where organization_id=o.id and active=true order by created_at limit 1) w on true left join seller_members sm on sm.organization_id=s.organization_id and sm.user_id=u.id and sm.active=true left join sellers se on se.id=sm.seller_id where s.token_hash=encode(digest(${token},'sha256'),'hex') and s.expires_at>now() and u.active=true and o.status in ('ACTIVE','TRIAL') and o.archived_at is null limit 1`;
  else rows=await sql`select u.id,u.email,u.name,u.role,false is_platform_admin from sessions s join users u on u.id=s.user_id where s.token_hash=encode(digest(${token},'sha256'),'hex') and s.expires_at>now() and u.active=true limit 1`;
  return rows[0]||null;
}
export async function logout(){const c=await cookies();const token=c.get(COOKIE)?.value;if(token)await sql`delete from sessions where token_hash=encode(digest(${token},'sha256'),'hex')`;c.set(COOKIE,'',{httpOnly:true,secure:secureCookie,sameSite:'lax',path:'/',maxAge:0})}
