import {NextResponse} from 'next/server';
import {getCurrentUser} from '../../../lib/auth';
import {sql} from '../../../lib/db';

export const dynamic='force-dynamic';

const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
const csv=(headers,rows)=>'\ufeff'+[headers,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
const fail=(error,status=400)=>NextResponse.json({error},{status});

export async function GET(request){
  const user=await getCurrentUser();
  if(!user)return fail('UNAUTHORIZED',401);
  const type=new URL(request.url).searchParams.get('type')||'orders';
  const organizationId=user.organization_id;
  const sellerId=user.role==='SELLER'?user.seller_id:null;
  let headers,rows;
  if(type==='products'){
    headers=['Клиент','SKU','Название','Штрихкод','Артикул'];
    rows=await sql`select s.name seller,p.sku,p.name,coalesce(p.wb_barcode,'') barcode,coalesce(p.vendor_code,'') vendor
      from products p join sellers s on s.id=p.seller_id
      where s.organization_id=${organizationId} and (${sellerId}::uuid is null or s.id=${sellerId}) and p.active=true order by s.name,p.sku`;
    rows=rows.map(item=>[item.seller,item.sku,item.name,item.barcode,item.vendor]);
  }else if(type==='inventory'){
    headers=['Склад','Клиент','SKU','Товар','Зона','Ячейка','Физически','Резерв','Доступно','Брак','Карантин'];
    rows=await sql`select w.name warehouse,s.name seller,p.sku,p.name,z.name zone,coalesce(c.code,'') cell,i.physical_qty,i.reserved_qty,
      (i.physical_qty-i.reserved_qty-i.damaged_qty-i.quarantine_qty)::int available_qty,i.damaged_qty,i.quarantine_qty
      from inventory i join products p on p.id=i.product_id join sellers s on s.id=p.seller_id join zones z on z.id=i.zone_id join warehouses w on w.id=z.warehouse_id left join cells c on c.id=i.cell_id
      where w.organization_id=${organizationId} and (${sellerId}::uuid is null or s.id=${sellerId}) order by w.name,s.name,p.sku,z.sort_order,c.code`;
    rows=rows.map(item=>[item.warehouse,item.seller,item.sku,item.name,item.zone,item.cell,item.physical_qty,item.reserved_qty,item.available_qty,item.damaged_qty,item.quarantine_qty]);
  }else if(type==='boxes'){
    headers=['Склад','Клиент','Короб','Статус','Зона','Ячейка','Единиц','Принят'];
    rows=await sql`select w.name warehouse,s.name seller,b.box_code,b.status,z.name zone,coalesce(c.code,'') cell,coalesce(sum(bi.qty),0)::int qty,b.received_at
      from boxes b join sellers s on s.id=b.seller_id join zones z on z.id=b.zone_id join warehouses w on w.id=z.warehouse_id left join cells c on c.id=b.cell_id left join box_items bi on bi.box_id=b.id
      where w.organization_id=${organizationId} and (${sellerId}::uuid is null or s.id=${sellerId}) group by w.name,s.name,b.id,z.name,c.code order by b.received_at desc`;
    rows=rows.map(item=>[item.warehouse,item.seller,item.box_code,item.status,item.zone,item.cell,item.qty,new Date(item.received_at).toISOString()]);
  }else if(type==='orders'){
    headers=['Склад','Клиент','Заказ','Источник','Статус','Приоритет','Дедлайн','Создан'];
    rows=await sql`select w.name warehouse,s.name seller,o.order_no,case when o.wb_order_id is null then 'Вручную' else 'Wildberries' end source,o.status,o.priority,o.deadline,o.created_at
      from orders o join sellers s on s.id=o.seller_id join warehouses w on w.id=o.warehouse_id
      where s.organization_id=${organizationId} and (${sellerId}::uuid is null or s.id=${sellerId}) order by o.created_at desc`;
    rows=rows.map(item=>[item.warehouse,item.seller,item.order_no,item.source,item.status,item.priority,item.deadline?new Date(item.deadline).toISOString():'',new Date(item.created_at).toISOString()]);
  }else return fail('Неизвестный тип выгрузки');
  return new NextResponse(csv(headers,rows),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="wms-${type}-${new Date().toISOString().slice(0,10)}.csv"`,'cache-control':'private, no-store'}});
}
