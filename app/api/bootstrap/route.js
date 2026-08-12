import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(){
  const count=await sql`select count(*)::int n from users`;
  if(count[0].n===0)return NextResponse.json({loading:false,setupRequired:true});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({loading:false,user:null});
  const [zones,cells,sellers,products,boxes,orders,tasks,devices,audit]=await Promise.all([
    sql`select * from zones order by sort_order`,
    sql`select * from cells order by code`,
    sql`select * from sellers order by name`,
    sql`select p.*,s.name seller_name from products p join sellers s on s.id=p.seller_id where p.active=true order by p.created_at desc limit 1000`,
    sql`select b.*,s.name seller_name,z.name zone_name,z.code zone_code,c.code cell_code,coalesce(sum(bi.qty),0)::int item_qty from boxes b join sellers s on s.id=b.seller_id join zones z on z.id=b.zone_id left join cells c on c.id=b.cell_id left join box_items bi on bi.box_id=b.id group by b.id,s.name,z.name,z.code,c.code order by b.received_at desc limit 2000`,
    sql`select o.*,s.name seller_name from orders o join sellers s on s.id=o.seller_id order by o.created_at desc limit 1000`,
    sql`select * from operational_tasks order by created_at desc limit 500`,
    sql`select * from devices order by created_at desc limit 200`,
    sql`select a.*,u.name user_name from audit_logs a left join users u on u.id=a.actor_id order by a.created_at desc limit 500`
  ]);
  return NextResponse.json({loading:false,user,data:{zones,cells,sellers,products,boxes,orders,tasks,devices,audit}})
}
