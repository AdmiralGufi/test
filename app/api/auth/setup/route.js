import {NextResponse} from 'next/server';
import {sql} from '../../../../lib/db';
import {createSession} from '../../../../lib/auth';
export async function POST(req){
  const {name,email,password}=await req.json();
  if(!name||!email||!password||password.length<8)return NextResponse.json({error:'Заполни имя, email и пароль минимум 8 символов'},{status:400});
  const count=await sql`select count(*)::int n from users`;
  if(count[0].n>0)return NextResponse.json({error:'Администратор уже создан'},{status:409});
  const rows=await sql`insert into users(email,name,password_hash,role,active) values(${email.toLowerCase()}::text,${name}::text,crypt(${password}::text,gen_salt('bf',10)),'ADMIN',true) returning id`;
  await sql`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${rows[0].id},'ADMIN_SETUP','USER',${rows[0].id},jsonb_build_object('email',${email.toLowerCase()}::text))`;
  await createSession(rows[0].id);
  return NextResponse.json({ok:true});
}
