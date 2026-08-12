import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
const allowed=(role,list)=>list.includes(role);
export async function POST(r){
  const u=await getCurrentUser();
  if(!u)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const x=await r.json();
  try{
    if(x.action==='CREATE_BOX'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id)throw new Error('SELLER_REQUIRED');
      const code=(x.box_code||('BOX-'+Date.now().toString().slice(-9))).trim();
      const a=await sql`select wms_receive_box(${x.seller_id},${x.receipt_id||null},${code},${x.barcode||code},${u.id},${x.notes||null}) id`;
      return NextResponse.json({ok:true,id:a[0].id,box_code:code});
    }
    if(x.action==='CREATE_PRODUCT'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!x.sku||!x.name)throw new Error('PRODUCT_FIELDS_REQUIRED');
      const a=await sql`insert into products(seller_id,sku,name,wb_barcode,vendor_code,active) values(${x.seller_id},${x.sku.trim()},${x.name.trim()},${x.barcode||null},${x.vendor||null},true) returning id`;
      return NextResponse.json({ok:true,id:a[0].id});
    }
    if(x.action==='CREATE_SELLER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.name)throw new Error('SELLER_NAME_REQUIRED');
      const a=await sql`insert into sellers(name,contact_name,phone,email) values(${x.name.trim()},${x.contact||null},${x.phone||null},${x.email||null}) returning id`;
      return NextResponse.json({ok:true,id:a[0].id});
    }
    if(x.action==='MOVE_BOX'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER','PICKER','PACKER']))throw new Error('FORBIDDEN');
      let zone=null,cell=null;
      if(x.target_type==='cell'){
        cell=x.target_id;
        const c=await sql`select zone_id from cells where id=${cell} and status='ACTIVE' limit 1`;
        if(!c[0])throw new Error('CELL_NOT_FOUND');
        zone=c[0].zone_id;
      }else if(x.target_type==='zone')zone=x.target_id;else throw new Error('TARGET_REQUIRED');
      await sql`select wms_move_box(${x.box_id},${zone},${cell},${u.id},${x.reason||'Перемещение'})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ADD_BOX_ITEM'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.box_id||!x.product_id||Number(x.qty)<=0)throw new Error('ITEM_FIELDS_REQUIRED');
      await sql`select wms_add_box_item(${x.box_id},${x.product_id},${Number(x.qty)},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='CREATE_ORDER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!Array.isArray(x.items)||!x.items.length)throw new Error('ORDER_FIELDS_REQUIRED');
      const no=(x.order_no||('ORD-'+Date.now().toString().slice(-9))).trim();
      const a=await sql`select wms_create_order(${no},${x.seller_id},${x.priority||'NORMAL'},${x.deadline||null},${JSON.stringify(x.items)}::jsonb,${u.id}) id`;
      return NextResponse.json({ok:true,id:a[0].id,order_no:no});
    }
    if(x.action==='PICK_ITEM'){
      if(!allowed(u.role,['ADMIN','MANAGER','PICKER']))throw new Error('FORBIDDEN');
      if(!x.order_item_id||!x.box_id||Number(x.qty)<=0)throw new Error('PICK_FIELDS_REQUIRED');
      await sql`select wms_pick_order_item(${x.order_item_id},${x.box_id},${Number(x.qty)},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_PACKED'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER']))throw new Error('FORBIDDEN');
      await sql`select wms_pack_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_READY'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER']))throw new Error('FORBIDDEN');
      await sql`select wms_ready_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_SHIPPED'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER','SHIPPER']))throw new Error('FORBIDDEN');
      await sql`select wms_ship_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='CREATE_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      if(!x.email||!x.name||!x.password||!x.role)throw new Error('USER_FIELDS_REQUIRED');
      if(String(x.password).length<8)throw new Error('PASSWORD_TOO_SHORT');
      const a=await sql`insert into users(email,name,password_hash,role,active) values(lower(${x.email}),${x.name},crypt(${x.password},gen_salt('bf',10)),${x.role},true) returning id,email,name,role,active`;
      return NextResponse.json(a[0]);
    }
    if(x.action==='TOGGLE_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      await sql`update users set active=${!!x.active} where id=${x.user_id}`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='REGISTER_DEVICE'){
      const code=x.device_code||('DEV-'+Date.now());
      const a=await sql`insert into devices(device_code,device_type,user_id,platform,label,user_agent,active,last_seen_at,paired_at) values(${code},${x.device_type||'PHONE'},${u.id},${x.platform||null},${x.label||null},${x.user_agent||null},true,now(),now()) on conflict(device_code) do update set user_id=excluded.user_id,device_type=excluded.device_type,label=excluded.label,last_seen_at=now(),active=true returning id,device_code`;
      return NextResponse.json(a[0]);
    }
    return NextResponse.json({error:'UNKNOWN_ACTION'},{status:400});
  }catch(e){const m=String(e.message||e);return NextResponse.json({error:m},{status:m==='FORBIDDEN'?403:400})}
}
