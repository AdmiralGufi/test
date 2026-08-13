import {sql} from './db.js';

export const PLAN_CATALOG=Object.freeze({
  PILOT:{label:'Pilot',warehouses:1,users:5,sellers:10,monthlyOrders:1000},
  START:{label:'Start',warehouses:1,users:10,sellers:30,monthlyOrders:5000},
  GROWTH:{label:'Growth',warehouses:3,users:30,sellers:100,monthlyOrders:25000},
  BUSINESS:{label:'Business',warehouses:10,users:100,sellers:500,monthlyOrders:100000},
  ENTERPRISE:{label:'Enterprise',warehouses:null,users:null,sellers:null,monthlyOrders:null}
});

export function planDefinition(plan){
  return PLAN_CATALOG[String(plan||'PILOT').toUpperCase()]||PLAN_CATALOG.PILOT;
}

export async function organizationUsage(organizationId){
  const rows=await sql`select o.plan,o.status,o.billing_status,o.trial_ends_at,
    (select count(*)::int from warehouses w where w.organization_id=o.id and w.active=true) warehouses,
    (select count(*)::int from organization_members m where m.organization_id=o.id and m.active=true) users,
    (select count(*)::int from sellers s where s.organization_id=o.id and s.status<>'ARCHIVED') sellers,
    (select count(*)::int from orders ord join sellers s on s.id=ord.seller_id where s.organization_id=o.id and ord.created_at>=date_trunc('month',now())) monthly_orders
    from organizations o where o.id=${organizationId} limit 1`;
  if(!rows[0])throw new Error('ENTITY_NOT_FOUND');
  const usage=rows[0];
  return {...usage,limits:planDefinition(usage.plan)};
}

export async function requirePlanCapacity(organizationId,resource,additional=1){
  const usage=await organizationUsage(organizationId);
  const fields={warehouse:'warehouses',user:'users',seller:'sellers',monthlyOrder:'monthly_orders'};
  const limits={warehouse:'warehouses',user:'users',seller:'sellers',monthlyOrder:'monthlyOrders'};
  const field=fields[resource];
  const limit=usage.limits[limits[resource]];
  if(!field)throw new Error('UNKNOWN_PLAN_RESOURCE');
  if(limit!==null&&Number(usage[field]||0)+additional>limit)throw new Error('PLAN_LIMIT_REACHED');
  return usage;
}
