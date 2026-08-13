import { cookies } from 'next/headers';
import { sql } from './db';
const COOKIE='wms_session';
const secureCookie=process.env.NODE_ENV==='production';
export async function createSession(userId){
  const rows=await sql`with t as (select encode(gen_random_bytes(32),'hex') raw) insert into sessions(token_hash,user_id,expires_at) select encode(digest(raw,'sha256'),'hex'),${userId},now()+interval '30 days' from t returning (select raw from t) as token`;
  const c=await cookies();
  c.set(COOKIE,rows[0].token,{httpOnly:true,secure:secureCookie,sameSite:'lax',path:'/',maxAge:2592000});
}
export async function getCurrentUser(){
  const c=await cookies(); const token=c.get(COOKIE)?.value; if(!token)return null;
  const rows=await sql`select u.id,u.email,u.name,u.role from sessions s join users u on u.id=s.user_id where s.token_hash=encode(digest(${token},'sha256'),'hex') and s.expires_at>now() and u.active=true limit 1`;
  return rows[0]||null;
}
export async function logout(){const c=await cookies();const token=c.get(COOKIE)?.value;if(token)await sql`delete from sessions where token_hash=encode(digest(${token},'sha256'),'hex')`;c.set(COOKIE,'',{httpOnly:true,secure:secureCookie,sameSite:'lax',path:'/',maxAge:0})}
