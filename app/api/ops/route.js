import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
import {cleanText,DEVICE_TYPES,ORDER_PRIORITIES,positiveInteger,ROLES,validEmail} from '../../../lib/wms-contract';
import {logError,requestContext} from '../../../lib/observability';
const allowed=(role,list)=>list.includes(role);
const fail=(message,status=400)=>NextResponse.json({error:message},{status});
const errorMessages={
  FORBIDDEN:'Недостаточно прав для этой операции',
  SELLER_REQUIRED:'Выберите клиента',
  PRODUCT_FIELDS_REQUIRED:'Заполните клиента, SKU и название',
  SELLER_NAME_REQUIRED:'Введите название клиента',
  TARGET_REQUIRED:'Выберите зону или ячейку',
  CELL_NOT_FOUND:'Ячейка не найдена или недоступна',
  ITEM_FIELDS_REQUIRED:'Выберите товар и укажите количество',
  ORDER_FIELDS_REQUIRED:'Выберите клиента и добавьте позиции',
  PICK_FIELDS_REQUIRED:'Выберите позицию, короб и количество',
  USER_FIELDS_REQUIRED:'Заполните данные сотрудника',
  PASSWORD_TOO_SHORT:'Пароль должен содержать минимум 8 символов',
  INVALID_EMAIL:'Проверьте email',
  INVALID_ROLE:'Недопустимая роль',
  INVALID_DEVICE_TYPE:'Недопустимый тип устройства',
  INVALID_PRIORITY:'Недопустимый приоритет'
};
export async function POST(r){
  const context=requestContext(r,'/api/ops');
  const u=await getCurrentUser();
  if(!u)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const x=await r.json().catch(()=>null);
  if(!x||typeof x!=='object')return fail('Некорректный запрос');
  try{
    if(x.action==='CREATE_BOX'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id)throw new Error('SELLER_REQUIRED');
      const code=cleanText(x.box_code,80)||('BOX-'+Date.now().toString().slice(-9));
      const a=await sql`select wms_receive_box(${x.seller_id},${x.receipt_id||null},${code},${cleanText(x.barcode,120)||code},${u.id},${cleanText(x.notes,500)||null}) id`;
      return NextResponse.json({ok:true,id:a[0].id,box_code:code});
    }
    if(x.action==='CREATE_PRODUCT'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!x.sku||!x.name)throw new Error('PRODUCT_FIELDS_REQUIRED');
      const a=await sql`insert into products(seller_id,sku,name,wb_barcode,vendor_code,active) values(${x.seller_id},${cleanText(x.sku,100)},${cleanText(x.name,240)},${cleanText(x.barcode,120)||null},${cleanText(x.vendor,120)||null},true) returning id`;
      return NextResponse.json({ok:true,id:a[0].id});
    }
    if(x.action==='CREATE_SELLER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.name)throw new Error('SELLER_NAME_REQUIRED');
      if(x.email&&!validEmail(x.email))throw new Error('INVALID_EMAIL');
      const a=u.organization_id
        ?await sql`insert into sellers(organization_id,name,contact_name,phone,email) values(${u.organization_id},${cleanText(x.name,200)},${cleanText(x.contact,160)||null},${cleanText(x.phone,60)||null},${cleanText(x.email,254).toLowerCase()||null}) returning id`
        :await sql`insert into sellers(name,contact_name,phone,email) values(${cleanText(x.name,200)},${cleanText(x.contact,160)||null},${cleanText(x.phone,60)||null},${cleanText(x.email,254).toLowerCase()||null}) returning id`;
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
      const qty=positiveInteger(x.qty);
      if(!x.box_id||!x.product_id||!qty)throw new Error('ITEM_FIELDS_REQUIRED');
      await sql`select wms_add_box_item(${x.box_id},${x.product_id},${qty},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='CREATE_ORDER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!Array.isArray(x.items)||!x.items.length)throw new Error('ORDER_FIELDS_REQUIRED');
      if(!ORDER_PRIORITIES.includes(x.priority||'NORMAL'))throw new Error('INVALID_PRIORITY');
      const items=x.items.map(item=>({product_id:item.product_id,qty:positiveInteger(item.qty)}));
      if(items.some(item=>!item.product_id||!item.qty))throw new Error('ORDER_FIELDS_REQUIRED');
      const no=cleanText(x.order_no,100)||('ORD-'+Date.now().toString().slice(-9));
      const a=await sql`select wms_create_order(${no},${x.seller_id},${x.priority||'NORMAL'},${x.deadline||null},${JSON.stringify(items)}::jsonb,${u.id}) id`;
      return NextResponse.json({ok:true,id:a[0].id,order_no:no});
    }
    if(x.action==='PICK_ITEM'){
      if(!allowed(u.role,['ADMIN','MANAGER','PICKER']))throw new Error('FORBIDDEN');
      const qty=positiveInteger(x.qty);
      if(!x.order_item_id||!x.box_id||!qty)throw new Error('PICK_FIELDS_REQUIRED');
      await sql`select wms_pick_order_item(${x.order_item_id},${x.box_id},${qty},${u.id})`;
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
      if(!validEmail(x.email))throw new Error('INVALID_EMAIL');
      if(!ROLES.includes(x.role))throw new Error('INVALID_ROLE');
      const a=await sql`insert into users(email,name,password_hash,role,active) values(lower(${cleanText(x.email,254)}::text),${cleanText(x.name,160)}::text,crypt(${x.password}::text,gen_salt('bf',10)),${x.role}::text,true) returning id,email,name,role,active`;
      if(u.organization_id)await sql`insert into organization_members(organization_id,user_id,role,active) values(${u.organization_id},${a[0].id},${x.role},true)`;
      return NextResponse.json(a[0]);
    }
    if(x.action==='TOGGLE_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      await sql`update users set active=${!!x.active} where id=${x.user_id}`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='REGISTER_DEVICE'){
      const type=x.device_type||'PHONE';
      if(!DEVICE_TYPES.includes(type))throw new Error('INVALID_DEVICE_TYPE');
      const code=cleanText(x.device_code,100)||('DEV-'+Date.now());
      const a=await sql`insert into devices(device_code,device_type,user_id,platform,label,user_agent,active,last_seen_at,paired_at) values(${code},${type},${u.id},${cleanText(x.platform,160)||null},${cleanText(x.label,160)||null},${cleanText(x.user_agent,500)||null},true,now(),now()) on conflict(device_code) do update set user_id=excluded.user_id,device_type=excluded.device_type,label=excluded.label,last_seen_at=now(),active=true returning id,device_code`;
      return NextResponse.json(a[0]);
    }
    return NextResponse.json({error:'UNKNOWN_ACTION'},{status:400});
  }catch(e){
    const raw=String(e.message||e);
    const key=Object.keys(errorMessages).find(item=>raw.includes(item));
    logError('wms_operation_failed',e,{...context,action:cleanText(x.action,80)||'UNKNOWN',actorId:u.id});
    return fail(key?errorMessages[key]:'Операция не выполнена',key==='FORBIDDEN'?403:400);
  }
}
