alter table users add column is_platform_admin boolean not null default false;

update users
set is_platform_admin=true
where lower(email)='bakyt130600@gmail.com';
