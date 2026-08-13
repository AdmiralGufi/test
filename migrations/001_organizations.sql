-- Applied to production through Neon migration:
-- 13a6bbd8-5668-41e6-8ed0-4ab0f85726f0

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','TRIAL','SUSPENDED')),
  plan text not null default 'PILOT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  code text not null,
  name text not null,
  timezone text not null default 'Asia/Bishkek',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table organization_members (
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  role text not null check (role in ('ADMIN','MANAGER','RECEIVER','PICKER','PACKER','SHIPPER','VIEWER')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table sessions add column organization_id uuid;
alter table sellers add column organization_id uuid;
alter table zones add column warehouse_id uuid;

with new_org as (
  insert into organizations(name,slug,status,plan)
  values ('Zarif Fulfillment','zarif-fulfillment','ACTIVE','PILOT')
  returning id
), new_warehouse as (
  insert into warehouses(organization_id,code,name)
  select id,'MAIN','Основной склад' from new_org
  returning id,organization_id
)
insert into organization_members(organization_id,user_id,role)
select new_warehouse.organization_id,u.id,u.role
from new_warehouse cross join users u;

update sessions s set organization_id=m.organization_id
from organization_members m
where m.user_id=s.user_id and s.organization_id is null;

update sellers set organization_id=(select id from organizations where slug='zarif-fulfillment')
where organization_id is null;

update zones set warehouse_id=(select id from warehouses where code='MAIN' and organization_id=(select id from organizations where slug='zarif-fulfillment'))
where warehouse_id is null;

alter table sessions add constraint sessions_organization_fk foreign key (organization_id) references organizations(id) not valid;
alter table sellers add constraint sellers_organization_fk foreign key (organization_id) references organizations(id) not valid;
alter table zones add constraint zones_warehouse_fk foreign key (warehouse_id) references warehouses(id) not valid;
alter table sessions validate constraint sessions_organization_fk;
alter table sellers validate constraint sellers_organization_fk;
alter table zones validate constraint zones_warehouse_fk;

alter table sessions add constraint sessions_organization_required check (organization_id is not null) not valid;
alter table sellers add constraint sellers_organization_required check (organization_id is not null) not valid;
alter table zones add constraint zones_warehouse_required check (warehouse_id is not null) not valid;
alter table sessions validate constraint sessions_organization_required;
alter table sellers validate constraint sellers_organization_required;
alter table zones validate constraint zones_warehouse_required;
alter table sessions alter column organization_id set not null;
alter table sellers alter column organization_id set not null;
alter table zones alter column warehouse_id set not null;
alter table sessions drop constraint sessions_organization_required;
alter table sellers drop constraint sellers_organization_required;
alter table zones drop constraint zones_warehouse_required;

create index sessions_organization_idx on sessions(organization_id);
create index sellers_organization_idx on sellers(organization_id);
create index zones_warehouse_idx on zones(warehouse_id);
create index organization_members_user_idx on organization_members(user_id);
