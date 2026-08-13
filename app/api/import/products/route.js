import {NextResponse} from 'next/server';
import {getCurrentUser} from '../../../../lib/auth';
import {transaction,sql} from '../../../../lib/db';
import {cleanText} from '../../../../lib/wms-contract';

const fail=(error,status=400)=>NextResponse.json({error},{status});

export async function POST(request){
  const user=await getCurrentUser();
  if(!user)return fail('UNAUTHORIZED',401);
  if(!['ADMIN','MANAGER'].includes(user.role))return fail('Недостаточно прав',403);
  const input=await request.json().catch(()=>null);
  if(!Array.isArray(input?.rows)||!input.rows.length)return fail('В файле нет товаров');
  if(input.rows.length>5000)return fail('За один раз можно загрузить не более 5000 строк');
  const rows=input.rows.map(item=>({seller:cleanText(item.seller,200),sku:cleanText(item.sku,100),name:cleanText(item.name,240),barcode:cleanText(item.barcode,120),vendor:cleanText(item.vendor,120)}));
  if(rows.some(item=>!item.seller||!item.sku||!item.name))return fail('В каждой строке должны быть клиент, SKU и название');
  const unknown=await sql`select distinct r.seller from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) r(seller text,sku text,name text,barcode text,vendor text)
    where not exists(select 1 from sellers s where s.organization_id=${user.organization_id} and lower(s.name)=lower(r.seller)) limit 10`;
  if(unknown.length)return fail(`Не найдены клиенты: ${unknown.map(item=>item.seller).join(', ')}`);
  const [result]=await transaction(tx=>[
    tx`with source as (select * from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) r(seller text,sku text,name text,barcode text,vendor text)),matched as (
        select distinct on (src.seller,src.sku) s.id seller_id,src.sku,src.name,nullif(src.barcode,'') barcode,nullif(src.vendor,'') vendor
        from source src join sellers s on s.organization_id=${user.organization_id} and lower(s.name)=lower(src.seller) order by src.seller,src.sku,s.created_at
      ),upserted as (
        insert into products(seller_id,sku,name,wb_barcode,vendor_code,active)
        select seller_id,sku,name,barcode,vendor,true from matched
        on conflict(seller_id,sku) do update set name=excluded.name,wb_barcode=coalesce(excluded.wb_barcode,products.wb_barcode),vendor_code=coalesce(excluded.vendor_code,products.vendor_code),active=true
        returning id
      ) select count(*)::int imported from upserted`,
    tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${user.id},'IMPORT_PRODUCTS','organization',${user.organization_id},jsonb_build_object('rows',${rows.length}::int))`
  ],{isolationLevel:'Serializable'});
  return NextResponse.json({ok:true,imported:result[0]?.imported||0});
}
