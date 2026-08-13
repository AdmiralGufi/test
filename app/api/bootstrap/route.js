import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
export const dynamic='force-dynamic';
const respond=body=>NextResponse.json(body,{headers:{'cache-control':'private, no-store, max-age=0'}});

async function sellerSnapshot(user){
  if(!user.seller_id)return respond({loading:false,user:null});
  const organizationId=user.organization_id;
  const sellerId=user.seller_id;
  const [sellers,warehouses,stock,orders,orderItems,integrations]=await Promise.all([
    sql`select id,name,contact_name,phone,email,wb_seller_id,status from sellers where id=${sellerId} and organization_id=${organizationId} limit 1`,
    sql`select w.id,w.code,w.name,w.city,w.address,w.timezone,
      coalesce(inv.physical_qty,0)::int physical_qty,
      coalesce(inv.reserved_qty,0)::int reserved_qty,
      coalesce(inv.damaged_qty,0)::int damaged_qty,
      coalesce(inv.quarantine_qty,0)::int quarantine_qty,
      coalesce(inv.available_qty,0)::int available_qty,
      coalesce(bx.box_count,0)::int box_count
      from warehouses w
      left join lateral (
        select sum(i.physical_qty) physical_qty,sum(i.reserved_qty) reserved_qty,
          sum(i.damaged_qty) damaged_qty,sum(i.quarantine_qty) quarantine_qty,
          sum(i.physical_qty-i.reserved_qty-i.damaged_qty-i.quarantine_qty) available_qty
        from inventory i join zones z on z.id=i.zone_id join products p on p.id=i.product_id
        where z.warehouse_id=w.id and p.seller_id=${sellerId}
      ) inv on true
      left join lateral (
        select count(*) box_count from boxes b join zones z on z.id=b.zone_id
        where z.warehouse_id=w.id and b.seller_id=${sellerId} and b.status not in ('SHIPPED','CANCELLED')
      ) bx on true
      where w.organization_id=${organizationId} and w.active=true
      order by w.created_at`,
    sql`select w.id warehouse_id,w.name warehouse_name,w.city,p.id product_id,p.sku,p.name,p.wb_barcode,
      coalesce(sum(i.physical_qty),0)::int physical_qty,
      coalesce(sum(i.reserved_qty),0)::int reserved_qty,
      coalesce(sum(i.damaged_qty),0)::int damaged_qty,
      coalesce(sum(i.quarantine_qty),0)::int quarantine_qty,
      coalesce(sum(i.physical_qty-i.reserved_qty-i.damaged_qty-i.quarantine_qty),0)::int available_qty
      from products p
      cross join warehouses w
      left join zones z on z.warehouse_id=w.id
      left join inventory i on i.zone_id=z.id and i.product_id=p.id
      where p.seller_id=${sellerId} and p.active=true and w.organization_id=${organizationId} and w.active=true
      group by w.id,w.name,w.city,p.id order by p.name,w.name limit 5000`,
    sql`select o.id,o.order_no,o.status,o.priority,o.deadline,o.wb_order_id,o.wb_nm_id,o.wb_chrt_id,o.created_at,o.updated_at,
      coalesce(sum(oi.qty),0)::int item_qty,coalesce(sum(oi.picked_qty),0)::int picked_qty
      from orders o left join order_items oi on oi.order_id=o.id
      where o.seller_id=${sellerId}
      group by o.id order by o.created_at desc limit 1000`,
    sql`select oi.id,oi.order_id,oi.qty,oi.picked_qty,p.sku,p.name product_name,p.wb_barcode
      from order_items oi join orders o on o.id=oi.order_id join products p on p.id=oi.product_id
      where o.seller_id=${sellerId} order by o.created_at desc,oi.id limit 5000`,
    sql`select i.id,i.seller_id,i.name,i.token_hint,i.active,i.last_sync_at,i.last_success_at,i.last_error,i.imported_orders,i.created_at,s.name seller_name
      from wb_integrations i join sellers s on s.id=i.seller_id
      where i.organization_id=${organizationId} and i.seller_id=${sellerId} order by i.created_at`
  ]);
  return respond({loading:false,user,data:{sellers,warehouses,stock,orders,orderItems,integrations}});
}

export async function GET(){
  const count=await sql`select count(*)::int n from users`;
  if(count[0].n===0)return respond({loading:false,setupRequired:true});
  const user=await getCurrentUser();
  if(!user)return respond({loading:false,user:null});
  if(user.role==='SELLER')return sellerSnapshot(user);
  const organizationId=user.organization_id;
  const [warehouses,zones,cells,sellers,products,boxes,boxItems,orders,orderItems,tasks,devices,audit,users,organizations,integrations]=await Promise.all([
    organizationId?sql`select id,code,name,city,address,timezone,active,created_at from warehouses where organization_id=${organizationId} order by created_at`:Promise.resolve([]),
    organizationId?sql`select z.* from zones z join warehouses w on w.id=z.warehouse_id where w.organization_id=${organizationId} order by z.sort_order`:sql`select * from zones order by sort_order`,
    organizationId?sql`select c.* from cells c join zones z on z.id=c.zone_id join warehouses w on w.id=z.warehouse_id where w.organization_id=${organizationId} order by c.code`:sql`select * from cells order by code`,
    organizationId?sql`select * from sellers where organization_id=${organizationId} order by name`:sql`select * from sellers order by name`,
    organizationId?sql`select p.*,s.name seller_name from products p join sellers s on s.id=p.seller_id where s.organization_id=${organizationId} and p.active=true order by p.created_at desc limit 1000`:sql`select p.*,s.name seller_name from products p join sellers s on s.id=p.seller_id where p.active=true order by p.created_at desc limit 1000`,
    organizationId?sql`select b.*,s.name seller_name,z.name zone_name,z.code zone_code,c.code cell_code,coalesce(sum(bi.qty),0)::int item_qty from boxes b join sellers s on s.id=b.seller_id join zones z on z.id=b.zone_id left join cells c on c.id=b.cell_id left join box_items bi on bi.box_id=b.id where s.organization_id=${organizationId} group by b.id,s.name,z.name,z.code,c.code order by b.received_at desc limit 2000`:sql`select b.*,s.name seller_name,z.name zone_name,z.code zone_code,c.code cell_code,coalesce(sum(bi.qty),0)::int item_qty from boxes b join sellers s on s.id=b.seller_id join zones z on z.id=b.zone_id left join cells c on c.id=b.cell_id left join box_items bi on bi.box_id=b.id group by b.id,s.name,z.name,z.code,c.code order by b.received_at desc limit 2000`,
    organizationId?sql`select bi.*,p.sku,p.name product_name,b.box_code,c.code cell_code from box_items bi join products p on p.id=bi.product_id join boxes b on b.id=bi.box_id join sellers s on s.id=b.seller_id left join cells c on c.id=b.cell_id where s.organization_id=${organizationId} order by b.received_at desc limit 5000`:sql`select bi.*,p.sku,p.name product_name,b.box_code,c.code cell_code from box_items bi join products p on p.id=bi.product_id join boxes b on b.id=bi.box_id left join cells c on c.id=b.cell_id order by b.received_at desc limit 5000`,
    organizationId?sql`select o.*,s.name seller_name from orders o join sellers s on s.id=o.seller_id where s.organization_id=${organizationId} order by o.created_at desc limit 1000`:sql`select o.*,s.name seller_name from orders o join sellers s on s.id=o.seller_id order by o.created_at desc limit 1000`,
    organizationId?sql`select oi.*,p.sku,p.name product_name,c.code source_cell_code,b.box_code picked_box_code from order_items oi join orders o on o.id=oi.order_id join sellers s on s.id=o.seller_id join products p on p.id=oi.product_id left join cells c on c.id=oi.source_cell_id left join boxes b on b.id=oi.picked_box_id where s.organization_id=${organizationId} order by oi.id limit 5000`:sql`select oi.*,p.sku,p.name product_name,c.code source_cell_code,b.box_code picked_box_code from order_items oi join products p on p.id=oi.product_id left join cells c on c.id=oi.source_cell_id left join boxes b on b.id=oi.picked_box_id order by oi.id limit 5000`,
    organizationId?sql`select t.* from operational_tasks t left join zones z on z.id=t.zone_id left join warehouses w on w.id=z.warehouse_id left join organization_members m on m.user_id=t.assigned_to and m.organization_id=${organizationId} where w.organization_id=${organizationId} or m.user_id is not null order by t.created_at desc limit 500`:sql`select * from operational_tasks order by created_at desc limit 500`,
    organizationId?sql`select d.* from devices d join organization_members m on m.user_id=d.user_id where m.organization_id=${organizationId} order by d.created_at desc limit 200`:sql`select * from devices order by created_at desc limit 200`,
    organizationId?sql`select a.*,u.name user_name from audit_logs a join users u on u.id=a.actor_id join organization_members m on m.user_id=u.id where m.organization_id=${organizationId} order by a.created_at desc limit 500`:sql`select a.*,u.name user_name from audit_logs a left join users u on u.id=a.actor_id order by a.created_at desc limit 500`,
    user.role==='ADMIN'?(organizationId?sql`select u.id,u.email,u.name,m.role,m.active,u.created_at,sm.seller_id,sm.access_role seller_access_role,s.name seller_name from users u join organization_members m on m.user_id=u.id left join seller_members sm on sm.organization_id=m.organization_id and sm.user_id=u.id left join sellers s on s.id=sm.seller_id where m.organization_id=${organizationId} order by u.created_at`:sql`select id,email,name,role,active,created_at from users order by created_at`):Promise.resolve([]),
    user.is_platform_admin?sql`select o.id,o.name,o.slug,o.status,o.plan,o.created_at,
      count(distinct w.id)::int warehouse_count,
      count(distinct m.user_id) filter(where m.active=true)::int user_count,
      count(distinct s.id)::int seller_count,
      (select u.name from organization_members am join users u on u.id=am.user_id where am.organization_id=o.id and am.role='ADMIN' and am.active=true order by am.created_at limit 1) admin_name,
      (select u.email from organization_members am join users u on u.id=am.user_id where am.organization_id=o.id and am.role='ADMIN' and am.active=true order by am.created_at limit 1) admin_email
      from organizations o
      left join warehouses w on w.organization_id=o.id
      left join organization_members m on m.organization_id=o.id
      left join sellers s on s.organization_id=o.id
      group by o.id order by o.created_at desc`:Promise.resolve([]),
    sql`select i.id,i.seller_id,i.name,i.token_hint,i.active,i.last_sync_at,i.last_success_at,i.last_error,i.imported_orders,i.created_at,s.name seller_name
      from wb_integrations i join sellers s on s.id=i.seller_id
      where i.organization_id=${organizationId} order by i.created_at`
  ]);
  return respond({loading:false,user,data:{warehouses,zones,cells,sellers,products,boxes,boxItems,orders,orderItems,tasks,devices,audit,users,organizations,integrations}})
}
