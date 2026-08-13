create table wb_integrations(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  name text not null default 'Wildberries FBS',
  token_encrypted text not null,
  token_hint text not null,
  active boolean not null default true,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  imported_orders integer not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,seller_id)
);

create index wb_integrations_active_idx on wb_integrations(active,last_sync_at);

alter table products add column wb_nm_id bigint;
alter table products add column wb_chrt_id bigint;

create unique index products_seller_wb_chrt_key
  on products(seller_id,wb_chrt_id) where wb_chrt_id is not null;

create unique index orders_seller_wb_order_key
  on orders(seller_id,wb_order_id) where wb_order_id is not null;
