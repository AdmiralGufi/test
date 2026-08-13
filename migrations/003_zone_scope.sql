alter table zones drop constraint zones_code_key;

alter table zones
add constraint zones_warehouse_code_key unique(warehouse_id,code);
