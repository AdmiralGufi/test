begin;

alter table orders
  add column if not exists destination text,
  add column if not exists wb_office_id bigint,
  add column if not exists wb_warehouse_id bigint,
  add column if not exists wb_order_uid text,
  add column if not exists wb_seller_date date;

create index if not exists orders_ready_destination_idx
  on orders(destination, ready_at desc)
  where status = 'READY';

commit;
