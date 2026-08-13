import {sql} from './db.js';
import {decryptSecret} from './secrets.js';

const WB_BASE='https://marketplace-api.wildberries.ru';

function cleanToken(token){return String(token||'').trim().replace(/^Bearer\s+/i,'')}

async function wbRequest(path,token){
  const clean=cleanToken(token);
  if(!clean)throw new Error('WB_TOKEN_REQUIRED');
  let response=await fetch(`${WB_BASE}${path}`,{headers:{Authorization:`Bearer ${clean}`,'user-agent':'Fulfillment-WMS/1.0'},cache:'no-store'});
  if(response.status===401)response=await fetch(`${WB_BASE}${path}`,{headers:{Authorization:clean,'user-agent':'Fulfillment-WMS/1.0'},cache:'no-store'});
  if(!response.ok){
    const detail=await response.text().catch(()=>'');
    const error=new Error(`WB_API_${response.status}${detail?` ${detail.slice(0,180)}`:''}`);
    error.status=response.status;
    throw error;
  }
  return response;
}

export async function validateWildberriesToken(token){
  await wbRequest('/ping',token);
  return true;
}

export function normalizeWbOrder(order){
  const id=String(order?.id||'').trim();
  if(!id)return null;
  const nmId=Number(order.nmId)||null;
  const chrtId=Number(order.chrtId)||null;
  const barcode=Array.isArray(order.skus)?String(order.skus[0]||'').trim():'';
  return {
    id,
    orderNo:`WB-${id}`,
    sku:`WB-${nmId||'NM'}-${chrtId||id}`,
    name:nmId?`Товар Wildberries · артикул ${nmId}`:`Товар Wildberries · заказ ${id}`,
    barcode:barcode||null,
    nmId,
    chrtId,
    raw:order
  };
}

async function importOrder(integration,raw,actorId){
  const order=normalizeWbOrder(raw);
  if(!order)return false;
  const rows=await sql`with existing_product as (
      select id from products where seller_id=${integration.seller_id} and (
        (${order.chrtId}::bigint is not null and wb_chrt_id=${order.chrtId}) or
        (${order.barcode}::text is not null and wb_barcode=${order.barcode}) or sku=${order.sku}
      ) order by created_at limit 1
    ), created_product as (
      insert into products(seller_id,sku,name,wb_barcode,wb_nm_id,wb_chrt_id,active)
      select ${integration.seller_id},${order.sku},${order.name},${order.barcode},${order.nmId},${order.chrtId},true
      where not exists(select 1 from existing_product)
      on conflict(seller_id,sku) do update set wb_barcode=coalesce(products.wb_barcode,excluded.wb_barcode),wb_nm_id=coalesce(products.wb_nm_id,excluded.wb_nm_id),wb_chrt_id=coalesce(products.wb_chrt_id,excluded.wb_chrt_id)
      returning id
    ), chosen_product as (
      select id from existing_product union all select id from created_product limit 1
    ), created_order as (
      insert into orders(order_no,wb_order_id,seller_id,status,priority)
      values(${order.orderNo},${order.id},${integration.seller_id},'NEW','HIGH')
      on conflict(seller_id,wb_order_id) where wb_order_id is not null do nothing
      returning id
    ), created_item as (
      insert into order_items(order_id,product_id,qty)
      select created_order.id,chosen_product.id,1 from created_order cross join chosen_product
      returning id
    ), audit as (
      insert into audit_logs(actor_id,action,entity_type,entity_id,new_data)
      select ${actorId||integration.created_by},'WB_IMPORT_ORDER','order',created_order.id,jsonb_build_object('wb_order_id',${order.id}::text,'nm_id',${order.nmId}::bigint,'chrt_id',${order.chrtId}::bigint,'source','Wildberries FBS')
      from created_order returning id
    ) select id from created_order`;
  return Boolean(rows[0]);
}

export async function syncWildberriesIntegration(integration,actorId=null){
  const startedAt=new Date();
  try{
    const token=decryptSecret(integration.token_encrypted);
    const response=await wbRequest('/api/v3/orders/new',token);
    const payload=await response.json();
    const orders=Array.isArray(payload?.orders)?payload.orders:[];
    let imported=0;
    for(const order of orders)if(await importOrder(integration,order,actorId))imported+=1;
    await sql`update wb_integrations set last_sync_at=${startedAt},last_success_at=now(),last_error=null,imported_orders=imported_orders+${imported},updated_at=now() where id=${integration.id}`;
    return {received:orders.length,imported};
  }catch(error){
    await sql`update wb_integrations set last_sync_at=${startedAt},last_error=${String(error.message||error).slice(0,500)},updated_at=now() where id=${integration.id}`;
    throw error;
  }
}
