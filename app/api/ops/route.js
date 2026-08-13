import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {sql,transaction} from '../../../lib/db';
import {getCurrentUser} from '../../../lib/auth';
import {cleanText,DEVICE_TYPES,ORDER_PRIORITIES,positiveInteger,ROLES,validEmail} from '../../../lib/wms-contract';
import {logError,logInfo,requestContext} from '../../../lib/observability';
import {requireBox,requireBoxProduct,requireCell,requireDeviceCode,requireMember,requireOrder,requireOrderProducts,requireOrganization,requirePick,requireReceipt,requireSeller,requireZone} from '../../../lib/tenant';
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
  SELLER_USER_FIELDS_REQUIRED:'Выберите клиента и заполните данные для входа',
  PASSWORD_TOO_SHORT:'Пароль должен содержать минимум 8 символов',
  EMAIL_EXISTS:'Пользователь с таким email уже существует',
  INVALID_EMAIL:'Проверьте email',
  INVALID_ROLE:'Недопустимая роль',
  INVALID_DEVICE_TYPE:'Недопустимый тип устройства',
  INVALID_PRIORITY:'Недопустимый приоритет',
  ENTITY_NOT_FOUND:'Объект не найден или недоступен',
  TENANT_REQUIRED:'Пользователь не привязан к организации',
  CANNOT_DISABLE_SELF:'Нельзя отключить собственную учётную запись',
  RECEIVING_ZONE_MISSING:'Для склада не настроена зона приёмки',
  INSUFFICIENT_AVAILABLE_STOCK:'Недостаточно доступного остатка для резервирования заказа'
};
export async function POST(r){
  const context=requestContext(r,'/api/ops');
  const u=await getCurrentUser();
  if(!u)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const x=await r.json().catch(()=>null);
  if(!x||typeof x!=='object')return fail('Некорректный запрос');
  try{
    const organizationId=requireOrganization(u);
    if(x.action==='CREATE_BOX'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id)throw new Error('SELLER_REQUIRED');
      await requireSeller(u,x.seller_id);
      await requireReceipt(u,x.receipt_id,x.seller_id);
      const code=cleanText(x.box_code,80)||('BOX-'+Date.now().toString().slice(-9));
      const boxId=randomUUID();
      const [created]=await transaction(tx=>[
        tx`insert into boxes(id,box_code,barcode,seller_id,zone_id,receipt_id,status,notes)
           select ${boxId},${code},${cleanText(x.barcode,120)||code},${x.seller_id},z.id,${x.receipt_id||null},'RECEIVED',${cleanText(x.notes,500)||null}
           from zones z join warehouses w on w.id=z.warehouse_id and w.active=true
           where w.organization_id=${organizationId} and z.code='RCV'
           order by w.created_at,z.sort_order,z.id limit 1 returning id`,
        tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data)
           select ${u.id},'RECEIVE_BOX','box',${boxId},jsonb_build_object('box_code',${code}::text,'seller_id',${x.seller_id}::text,'receipt_id',${x.receipt_id||null}::text)
           where exists(select 1 from boxes where id=${boxId})`
      ]);
      if(!created[0])throw new Error('RECEIVING_ZONE_MISSING');
      return NextResponse.json({ok:true,id:boxId,box_code:code});
    }
    if(x.action==='CREATE_PRODUCT'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!x.sku||!x.name)throw new Error('PRODUCT_FIELDS_REQUIRED');
      await requireSeller(u,x.seller_id);
      const a=await sql`insert into products(seller_id,sku,name,wb_barcode,vendor_code,active) values(${x.seller_id},${cleanText(x.sku,100)},${cleanText(x.name,240)},${cleanText(x.barcode,120)||null},${cleanText(x.vendor,120)||null},true) returning id`;
      return NextResponse.json({ok:true,id:a[0].id});
    }
    if(x.action==='CREATE_SELLER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.name)throw new Error('SELLER_NAME_REQUIRED');
      if(x.email&&!validEmail(x.email))throw new Error('INVALID_EMAIL');
      const a=await sql`insert into sellers(organization_id,name,contact_name,phone,email) values(${organizationId},${cleanText(x.name,200)},${cleanText(x.contact,160)||null},${cleanText(x.phone,60)||null},${cleanText(x.email,254).toLowerCase()||null}) returning id`;
      return NextResponse.json({ok:true,id:a[0].id});
    }
    if(x.action==='MOVE_BOX'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER','PICKER','PACKER']))throw new Error('FORBIDDEN');
      await requireBox(u,x.box_id);
      let zone=null,cell=null;
      if(x.target_type==='cell'){
        cell=x.target_id;
        const c=await requireCell(u,cell);
        zone=c.zone_id;
      }else if(x.target_type==='zone'){zone=x.target_id;await requireZone(u,zone)}else throw new Error('TARGET_REQUIRED');
      await sql`select wms_move_box(${x.box_id},${zone},${cell},${u.id},${x.reason||'Перемещение'})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ADD_BOX_ITEM'){
      if(!allowed(u.role,['ADMIN','MANAGER','RECEIVER']))throw new Error('FORBIDDEN');
      const qty=positiveInteger(x.qty);
      if(!x.box_id||!x.product_id||!qty)throw new Error('ITEM_FIELDS_REQUIRED');
      await requireBoxProduct(u,x.box_id,x.product_id);
      await sql`select wms_add_box_item(${x.box_id},${x.product_id},${qty},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='CREATE_ORDER'){
      if(!allowed(u.role,['ADMIN','MANAGER']))throw new Error('FORBIDDEN');
      if(!x.seller_id||!Array.isArray(x.items)||!x.items.length)throw new Error('ORDER_FIELDS_REQUIRED');
      if(!ORDER_PRIORITIES.includes(x.priority||'NORMAL'))throw new Error('INVALID_PRIORITY');
      const items=x.items.map(item=>({product_id:item.product_id,qty:positiveInteger(item.qty)}));
      if(items.some(item=>!item.product_id||!item.qty))throw new Error('ORDER_FIELDS_REQUIRED');
      await requireSeller(u,x.seller_id);
      await requireOrderProducts(u,x.seller_id,items);
      const no=cleanText(x.order_no,100)||('ORD-'+Date.now().toString().slice(-9));
      const orderId=randomUUID();
      const orderItems=items.map(item=>({...item,id:randomUUID()}));
      const queries=await transaction(tx=>{
        const batch=[tx`insert into orders(id,order_no,seller_id,priority,deadline,status) values(${orderId},${no},${x.seller_id},${x.priority||'NORMAL'},${x.deadline||null},'NEW') returning id`];
        for(const item of orderItems){
          batch.push(tx`insert into order_items(id,order_id,product_id,qty) values(${item.id},${orderId},${item.product_id},${item.qty})`);
          batch.push(tx`with locked as materialized (
              select i.id,i.cell_id,(i.physical_qty-i.reserved_qty-i.damaged_qty-i.quarantine_qty)::int available,i.updated_at
              from inventory i join zones z on z.id=i.zone_id join warehouses w on w.id=z.warehouse_id
              where i.product_id=${item.product_id} and z.code='STG' and w.organization_id=${organizationId} and i.cell_id is not null
                and (i.physical_qty-i.reserved_qty-i.damaged_qty-i.quarantine_qty)>0
              order by i.updated_at,i.id for update of i
            ), ranked as (
              select id,cell_id,available,coalesce(sum(available) over(order by updated_at,id rows between unbounded preceding and 1 preceding),0)::int used_before
              from locked
            ), allocation as (
              select id,cell_id,greatest(least(available,${item.qty}-used_before),0)::int take from ranked
            ), reserved as (
              update inventory i set reserved_qty=i.reserved_qty+a.take,updated_at=now()
              from allocation a where i.id=a.id and a.take>0 returning a.cell_id,a.take
            ), recorded as (
              insert into order_allocations(order_item_id,cell_id,qty)
              select ${item.id},cell_id,take from reserved returning qty
            )
            select (case when coalesce(sum(qty),0)=${item.qty} then 'true' else 'INSUFFICIENT_AVAILABLE_STOCK' end)::boolean reserved from recorded`);
        }
        batch.push(tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${u.id},'CREATE_ORDER','order',${orderId},jsonb_build_object('order_no',${no}::text,'items',${JSON.stringify(items)}::jsonb,'reservation','allocated'))`);
        return batch;
      },{isolationLevel:'Serializable'});
      if(!queries[0]?.[0])throw new Error('ORDER_CREATE_FAILED');
      return NextResponse.json({ok:true,id:orderId,order_no:no});
    }
    if(x.action==='PICK_ITEM'){
      if(!allowed(u.role,['ADMIN','MANAGER','PICKER']))throw new Error('FORBIDDEN');
      const qty=positiveInteger(x.qty);
      if(!x.order_item_id||!x.box_id||!qty)throw new Error('PICK_FIELDS_REQUIRED');
      await requirePick(u,x.order_item_id,x.box_id);
      await sql`select wms_pick_order_item(${x.order_item_id},${x.box_id},${qty},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_PACKED'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER']))throw new Error('FORBIDDEN');
      await requireOrder(u,x.order_id);
      await sql`select wms_pack_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_READY'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER']))throw new Error('FORBIDDEN');
      await requireOrder(u,x.order_id);
      await sql`select wms_ready_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='ORDER_SHIPPED'){
      if(!allowed(u.role,['ADMIN','MANAGER','PACKER','SHIPPER']))throw new Error('FORBIDDEN');
      await requireOrder(u,x.order_id);
      await sql`select wms_ship_order(${x.order_id},${u.id})`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='CREATE_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      if(!x.email||!x.name||!x.password||!x.role)throw new Error('USER_FIELDS_REQUIRED');
      if(String(x.password).length<8)throw new Error('PASSWORD_TOO_SHORT');
      if(!validEmail(x.email))throw new Error('INVALID_EMAIL');
      if(!ROLES.includes(x.role)||x.role==='SELLER')throw new Error('INVALID_ROLE');
      const a=await sql`with new_user as (insert into users(email,name,password_hash,role,active) values(lower(${cleanText(x.email,254)}::text),${cleanText(x.name,160)}::text,crypt(${x.password}::text,gen_salt('bf',10)),${x.role}::text,true) returning id,email,name,role,active),new_member as (insert into organization_members(organization_id,user_id,role,active) select ${organizationId},id,role,true from new_user) select * from new_user`;
      return NextResponse.json(a[0]);
    }
    if(x.action==='CREATE_SELLER_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      if(!x.seller_id||!x.email||!x.name||!x.password)throw new Error('SELLER_USER_FIELDS_REQUIRED');
      if(String(x.password).length<8)throw new Error('PASSWORD_TOO_SHORT');
      if(!validEmail(x.email))throw new Error('INVALID_EMAIL');
      const accessRole=x.access_role==='OWNER'?'OWNER':'VIEWER';
      await requireSeller(u,x.seller_id);
      const userId=randomUUID();
      try{
        await transaction(tx=>[
          tx`insert into users(id,email,name,password_hash,role,active) values(${userId},lower(${cleanText(x.email,254)}::text),${cleanText(x.name,160)},crypt(${x.password}::text,gen_salt('bf',10)),'SELLER',true)`,
          tx`insert into organization_members(organization_id,user_id,role,active) values(${organizationId},${userId},'SELLER',true)`,
          tx`insert into seller_members(organization_id,seller_id,user_id,access_role,active) values(${organizationId},${x.seller_id},${userId},${accessRole},true)`,
          tx`insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(${u.id},'CREATE_SELLER_USER','user',${userId},jsonb_build_object('seller_id',${x.seller_id}::text,'access_role',${accessRole}::text))`
        ],{isolationLevel:'Serializable'});
      }catch(error){
        if(String(error?.message||error).includes('users_email_key'))throw new Error('EMAIL_EXISTS');
        throw error;
      }
      return NextResponse.json({ok:true,id:userId});
    }
    if(x.action==='TOGGLE_USER'){
      if(u.role!=='ADMIN')throw new Error('FORBIDDEN');
      if(x.user_id===u.id&&!x.active)throw new Error('CANNOT_DISABLE_SELF');
      await requireMember(u,x.user_id);
      await sql`update organization_members set active=${!!x.active} where organization_id=${organizationId} and user_id=${x.user_id}`;
      return NextResponse.json({ok:true});
    }
    if(x.action==='REGISTER_DEVICE'){
      const type=x.device_type||'PHONE';
      if(!DEVICE_TYPES.includes(type))throw new Error('INVALID_DEVICE_TYPE');
      const code=cleanText(x.device_code,100)||('DEV-'+Date.now());
      await requireDeviceCode(u,code);
      const a=await sql`insert into devices(device_code,device_type,user_id,platform,label,user_agent,active,last_seen_at,paired_at) values(${code},${type},${u.id},${cleanText(x.platform,160)||null},${cleanText(x.label,160)||null},${cleanText(x.user_agent,500)||null},true,now(),now()) on conflict(device_code) do update set user_id=excluded.user_id,device_type=excluded.device_type,label=excluded.label,last_seen_at=now(),active=true returning id,device_code`;
      return NextResponse.json(a[0]);
    }
    return NextResponse.json({error:'UNKNOWN_ACTION'},{status:400});
  }catch(e){
    const raw=String(e.message||e);
    const key=Object.keys(errorMessages).find(item=>raw.includes(item));
    const logContext={...context,action:cleanText(x.action,80)||'UNKNOWN',actorId:u.id,reason:key||'UNEXPECTED'};
    if(key)logInfo('wms_operation_rejected',logContext);else logError('wms_operation_failed',e,logContext);
    return fail(key?errorMessages[key]:'Операция не выполнена',key==='FORBIDDEN'?403:key==='ENTITY_NOT_FOUND'?404:key==='EMAIL_EXISTS'?409:400);
  }
}
