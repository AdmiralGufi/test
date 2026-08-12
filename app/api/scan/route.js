import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/auth';

export async function POST(r) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const x = await r.json();
  const v = String(x.barcode || x.code || '').trim();
  if (!v) return NextResponse.json({ error: 'EMPTY' }, { status: 400 });

  let kind = null;
  let code = v;
  let title = '';
  let location = '';
  let entityId = null;

  let a = await sql`
    select b.id,b.box_code,b.status,s.name seller_name,z.name zone_name,c.code cell_code
    from boxes b
    join sellers s on s.id=b.seller_id
    join zones z on z.id=b.zone_id
    left join cells c on c.id=b.cell_id
    where b.box_code=${v} or b.barcode=${v}
    limit 1`;

  if (a[0]) {
    kind = 'BOX';
    entityId = a[0].id;
    code = a[0].box_code;
    title = `${a[0].seller_name} · ${a[0].status}`;
    location = a[0].cell_code ? `Ячейка ${a[0].cell_code}` : a[0].zone_name;
  } else {
    a = await sql`
      select p.id,p.sku,p.name,p.wb_barcode,s.name seller_name
      from products p
      join sellers s on s.id=p.seller_id
      where p.sku=${v} or p.wb_barcode=${v} or p.vendor_code=${v}
      limit 1`;

    if (a[0]) {
      kind = 'SKU';
      entityId = a[0].id;
      code = a[0].sku;
      title = `${a[0].name} · ${a[0].seller_name}`;
      location = 'Товар';
    } else {
      a = await sql`
        select c.id,c.code,z.name zone_name
        from cells c
        join zones z on z.id=c.zone_id
        where c.code=${v}
        limit 1`;

      if (a[0]) {
        kind = 'CELL';
        entityId = a[0].id;
        code = a[0].code;
        title = a[0].zone_name;
        location = 'Ячейка хранения';
      } else {
        a = await sql`
          select o.id,o.order_no,o.status,s.name seller_name
          from orders o
          join sellers s on s.id=o.seller_id
          where o.order_no=${v} or o.wb_order_id=${v}
          limit 1`;

        if (a[0]) {
          kind = 'ORDER';
          entityId = a[0].id;
          code = a[0].order_no;
          title = `${a[0].seller_name} · ${a[0].status}`;
          location = 'FBS заказ';
        }
      }
    }
  }

  await sql`
    insert into scan_events(actor_id,barcode,scan_type,entity_type,entity_id,result)
    values(${u.id},${v},'LOOKUP',${kind},${entityId},${kind ? 'FOUND' : 'NOT_FOUND'})`;

  if (!kind) return NextResponse.json({ error: 'Код не найден' }, { status: 404 });
  return NextResponse.json({ kind, code, title, location, id: entityId });
}
