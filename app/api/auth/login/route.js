import {NextResponse} from 'next/server';
import {sql} from '../../../../lib/db';
import {createSession} from '../../../../lib/auth';
export async function POST(req){
  const {email,password}=await req.json();
  if(!email||!password)return NextResponse.json({error:'Введите email и пароль'},{status:400});
  const rows=await sql`select id from users where lower(email)=lower(${email}::text) and active=true and password_hash=crypt(${password}::text,password_hash) limit 1`;
  if(!rows[0])return NextResponse.json({error:'Неверный email или пароль'},{status:401});
  try{await createSession(rows[0].id)}catch(error){
    if(String(error?.message||error).includes('NO_ACTIVE_ORGANIZATION'))return NextResponse.json({error:'Доступ к фулфилменту приостановлен. Обратитесь к владельцу платформы.'},{status:403});
    throw error;
  }
  return NextResponse.json({ok:true});
}
