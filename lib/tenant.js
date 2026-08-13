import {sql} from './db';

const missing=()=>{throw new Error('ENTITY_NOT_FOUND')};

export function requireOrganization(user){
  if(!user?.organization_id)throw new Error('TENANT_REQUIRED');
  return user.organization_id;
}

export async function requireSeller(user,sellerId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select id from sellers where id=${sellerId} and organization_id=${organizationId} limit 1`;
  if(!rows[0])missing();
  return rows[0];
}

export async function requireReceipt(user,receiptId,sellerId){
  if(!receiptId)return;
  const organizationId=requireOrganization(user);
  const rows=await sql`select r.id from receipts r join sellers s on s.id=r.seller_id where r.id=${receiptId} and r.seller_id=${sellerId} and s.organization_id=${organizationId} limit 1`;
  if(!rows[0])missing();
}

export async function requireBox(user,boxId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select b.id,b.seller_id from boxes b join sellers s on s.id=b.seller_id where b.id=${boxId} and s.organization_id=${organizationId} limit 1`;
  if(!rows[0])missing();
  return rows[0];
}

export async function requireCell(user,cellId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select c.id,c.zone_id from cells c join zones z on z.id=c.zone_id join warehouses w on w.id=z.warehouse_id where c.id=${cellId} and c.status='ACTIVE' and w.organization_id=${organizationId} limit 1`;
  if(!rows[0])throw new Error('CELL_NOT_FOUND');
  return rows[0];
}

export async function requireZone(user,zoneId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select z.id from zones z join warehouses w on w.id=z.warehouse_id where z.id=${zoneId} and w.organization_id=${organizationId} limit 1`;
  if(!rows[0])missing();
  return rows[0];
}

export async function requireBoxProduct(user,boxId,productId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select b.id from boxes b join sellers bs on bs.id=b.seller_id join products p on p.id=${productId} join sellers ps on ps.id=p.seller_id where b.id=${boxId} and bs.organization_id=${organizationId} and ps.organization_id=${organizationId} and b.seller_id=p.seller_id limit 1`;
  if(!rows[0])missing();
}

export async function requireOrderProducts(user,sellerId,items){
  const organizationId=requireOrganization(user);
  const rows=await sql`select count(*)::int total,coalesce(bool_and(p.id is not null and p.seller_id=${sellerId} and s.organization_id=${organizationId}),false) valid from jsonb_to_recordset(${JSON.stringify(items)}::jsonb) as requested(product_id uuid,qty int) left join products p on p.id=requested.product_id left join sellers s on s.id=p.seller_id`;
  if(rows[0]?.total!==items.length||!rows[0]?.valid)missing();
}

export async function requirePick(user,orderItemId,boxId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select oi.id from order_items oi join orders o on o.id=oi.order_id join sellers os on os.id=o.seller_id join boxes b on b.id=${boxId} join sellers bs on bs.id=b.seller_id where oi.id=${orderItemId} and os.organization_id=${organizationId} and bs.organization_id=${organizationId} and o.seller_id=b.seller_id limit 1`;
  if(!rows[0])missing();
}

export async function requireOrder(user,orderId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select o.id from orders o join sellers s on s.id=o.seller_id where o.id=${orderId} and s.organization_id=${organizationId} limit 1`;
  if(!rows[0])missing();
}

export async function requireMember(user,userId){
  const organizationId=requireOrganization(user);
  const rows=await sql`select user_id from organization_members where organization_id=${organizationId} and user_id=${userId} limit 1`;
  if(!rows[0])missing();
}

export async function requireDeviceCode(user,deviceCode){
  const organizationId=requireOrganization(user);
  const existing=await sql`select d.id,exists(select 1 from organization_members m where m.user_id=d.user_id and m.organization_id=${organizationId}) owned from devices d where d.device_code=${deviceCode} limit 1`;
  if(existing[0]&&!existing[0].owned)missing();
}
