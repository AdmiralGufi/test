import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(){
  const count=await sql`select count(*)::int n from users`;
  if(count[0].n===0)return NextResponse.json({loading:false,setupRequired:true});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({loading:false,user:null});
  const organizationId=user.organization_id;
  const [zones,cells,sellers,products,boxes,boxItems,orders,orderItems,tasks,devices,audit,users,organizations]=await Promise.all([
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
    user.role==='ADMIN'?(organizationId?sql`select u.id,u.email,u.name,m.role,m.active,u.created_at from users u join organization_members m on m.user_id=u.id where m.organization_id=${organizationId} order by u.created_at`:sql`select id,email,name,role,active,created_at from users order by created_at`):Promise.resolve([]),
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
      group by o.id order by o.created_at desc`:Promise.resolve([])
  ]);
  return NextResponse.json({loading:false,user,data:{zones,cells,sellers,products,boxes,boxItems,orders,orderItems,tasks,devices,audit,users,organizations}})
}
