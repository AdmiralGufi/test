import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WMS_ACTIONS, cleanText, positiveInteger, validEmail} from '../lib/wms-contract.js';
import {decryptSecret,encryptSecret} from '../lib/secrets.js';
import {normalizeWbOrder} from '../lib/wildberries.js';

test('all public WMS actions are implemented by the canonical API', async () => {
  const source = await readFile(new URL('../app/api/ops/route.js', import.meta.url), 'utf8');
  for (const action of WMS_ACTIONS) {
    assert.match(source, new RegExp(`action===['"]${action}['"]`), `missing ${action}`);
  }
});

test('page renders the V3 operational application', async () => {
  const source = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
  assert.match(source, /WmsAppV3/);
});

test('input helpers reject unsafe quantities and malformed email', () => {
  assert.equal(positiveInteger(3), 3);
  assert.equal(positiveInteger(0), null);
  assert.equal(positiveInteger(1.2), null);
  assert.equal(validEmail('operator@example.com'), true);
  assert.equal(validEmail('operator@'), false);
  assert.equal(cleanText('  BOX-1  '), 'BOX-1');
});

test('database connection remains server-only', async () => {
  const files = [
    '../components/WmsAppV3.js',
    '../app/page.js',
    '../app/globals.css'
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /DATABASE_URL|postgres(?:ql)?:\/\//);
  }
});

test('PWA assets and install metadata are present', async () => {
  const manifest = await readFile(new URL('../app/manifest.js', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.match(manifest, /display:'standalone'/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(serviceWorker, /offline\.html/);
  assert.doesNotMatch(serviceWorker, /cache\.put\([^)]*\/api\//);
  assert.match(layout, /appleWebApp/);
});

test('handheld scanner supports keyboard Enter, camera and operator feedback', async () => {
  const source = await readFile(new URL('../components/WmsAppV3.js', import.meta.url), 'utf8');
  assert.match(source, /e\.key===['"]Enter['"]/);
  assert.match(source, /BrowserMultiFormatReader/);
  assert.match(source, /navigator\.vibrate/);
  assert.match(source, /Последние сканы/);
  assert.match(source, /input\.current\?\.focus/);
});

test('commercial foundation exposes health checks and architecture documentation', async () => {
  const status = await readFile(new URL('../app/api/status/route.js', import.meta.url), 'utf8');
  const architecture = await readFile(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8');
  const roadmap = await readFile(new URL('../docs/ROADMAP.md', import.meta.url), 'utf8');
  assert.match(status, /database:'connected'/);
  assert.match(status, /cache-control.*no-store/);
  assert.match(architecture, /Multi-tenant model/);
  assert.match(roadmap, /commercial scale/i);
});

test('authentication supports staged organization migration', async () => {
  const auth = await readFile(new URL('../lib/auth.js', import.meta.url), 'utf8');
  const opsRoute = await readFile(new URL('../app/api/ops/route.js', import.meta.url), 'utf8');
  const bootstrap = await readFile(new URL('../app/api/bootstrap/route.js', import.meta.url), 'utf8');
  const scan = await readFile(new URL('../app/api/scan/route.js', import.meta.url), 'utf8');
  assert.match(auth, /tenancyEnabled/);
  assert.match(auth, /organization_members/);
  assert.match(auth, /sessions\(token_hash,user_id,organization_id,expires_at\)/);
  assert.match(opsRoute, /sellers\(organization_id,name/);
  assert.match(opsRoute, /insert into organization_members/);
  assert.match(bootstrap, /where s\.organization_id=\$\{organizationId\}/);
  assert.match(bootstrap, /cache-control.*private, no-store/);
  assert.match(scan, /w\.organization_id=\$\{u\.organization_id\}/);
});

test('applied database migrations are versioned in the repository', async () => {
  const migration = await readFile(new URL('../migrations/001_organizations.sql', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../migrations/README.md', import.meta.url), 'utf8');
  assert.match(migration, /create table organizations/);
  assert.match(migration, /organization_members/);
  assert.match(guide, /13a6bbd8-5668-41e6-8ed0-4ab0f85726f0/);
});

test('every tenant-sensitive write has an ownership guard', async () => {
  const route = await readFile(new URL('../app/api/ops/route.js', import.meta.url), 'utf8');
  const tenant = await readFile(new URL('../lib/tenant.js', import.meta.url), 'utf8');
  for (const guard of ['requireSeller','requireReceipt','requireBox','requireCell','requireZone','requireWarehouse','requireBoxProduct','requireOrderProducts','requirePick','requireOrder','requireMember','requireDeviceCode']) {
    assert.match(route,new RegExp(`${guard}\\(`),`missing ${guard} call`);
  }
  assert.match(tenant, /ENTITY_NOT_FOUND/);
  assert.match(tenant, /organization_id=\$\{organizationId\}/);
  assert.match(route, /with new_user as/);
  assert.match(route, /wms_operation_rejected/);
});

test('commercial onboarding is platform-only, atomic and creates a complete warehouse', async () => {
  const auth = await readFile(new URL('../lib/auth.js', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/platform/organizations/route.js', import.meta.url), 'utf8');
  const bootstrap = await readFile(new URL('../app/api/bootstrap/route.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../components/WmsAppV3.js', import.meta.url), 'utf8');
  assert.match(auth, /u\.is_platform_admin/);
  assert.match(route, /actor\.is_platform_admin/);
  assert.match(route, /transaction\(tx=>/);
  assert.match(route, /ZONES\.map/);
  assert.match(route, /ONBOARD_ORGANIZATION/);
  assert.doesNotMatch(route, /console\.(?:log|error).*password/i);
  assert.match(bootstrap, /user\.is_platform_admin\?sql/);
  assert.match(ui, /Фулфилменты/);
  assert.match(ui, /Создать и подготовить фулфилмент/);
});

test('receiving and reservation are scoped to the active organization and transactional', async () => {
  const route = await readFile(new URL('../app/api/ops/route.js', import.meta.url), 'utf8');
  const db = await readFile(new URL('../lib/db.js', import.meta.url), 'utf8');
  assert.match(db, /transaction\(build/);
  assert.match(route, /w\.organization_id=\$\{organizationId\} and w\.id=\$\{x\.warehouse_id\} and z\.code='RCV'/);
  assert.match(route, /w\.organization_id=\$\{organizationId\}/);
  assert.match(route, /for update of i/);
  assert.match(route, /isolationLevel:'Serializable'/);
  assert.doesNotMatch(route, /wms_receive_box/);
  assert.doesNotMatch(route, /wms_create_order/);
});

test('commercial scale enforces plan limits, trial lifecycle and warehouse routing', async () => {
  const opsRoute=await readFile(new URL('../app/api/ops/route.js',import.meta.url),'utf8');
  const wbRoute=await readFile(new URL('../app/api/integrations/wildberries/route.js',import.meta.url),'utf8');
  const importer=await readFile(new URL('../lib/wildberries.js',import.meta.url),'utf8');
  const plans=await readFile(new URL('../lib/plans.js',import.meta.url),'utf8');
  const lifecycle=await readFile(new URL('../app/api/cron/subscriptions/route.js',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/007_commercial_scale.sql',import.meta.url),'utf8');
  assert.match(opsRoute,/action==='CREATE_WAREHOUSE'/);
  assert.match(opsRoute,/requirePlanCapacity\(organizationId,'warehouse'\)/);
  assert.match(opsRoute,/warehouse_id,priority,deadline,status/);
  assert.match(wbRoute,/requireWarehouse\(user,input\.warehouse_id\)/);
  assert.match(importer,/integration\.warehouse_id/);
  assert.match(importer,/organizationUsage/);
  assert.match(plans,/monthlyOrders:1000/);
  assert.match(lifecycle,/billing_status='PAST_DUE'/);
  assert.match(lifecycle,/delete from sessions/);
  assert.match(migration,/orders ADD COLUMN IF NOT EXISTS warehouse_id/i);
  assert.match(migration,/trial_ends_at/);
});

test('operator toolkit provides scoped exports, bulk product import, labels and reports', async () => {
  const exportRoute=await readFile(new URL('../app/api/export/route.js',import.meta.url),'utf8');
  const importRoute=await readFile(new URL('../app/api/import/products/route.js',import.meta.url),'utf8');
  const label=await readFile(new URL('../components/BarcodeLabel.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  assert.match(exportRoute,/organization_id=\$\{organizationId\}/);
  assert.match(exportRoute,/sellerId/);
  assert.match(exportRoute,/text\/csv/);
  assert.match(importRoute,/rows\.length>5000/);
  assert.match(importRoute,/on conflict\(seller_id,sku\) do update/);
  assert.match(importRoute,/IMPORT_PRODUCTS/);
  assert.match(label,/import\('jsbarcode'\)/);
  assert.match(ui,/function Reports/);
  assert.match(ui,/function DataExchange/);
  assert.match(ui,/window\.print\(\)/);
});

test('platform and zone migrations are versioned', async () => {
  const owner = await readFile(new URL('../migrations/002_platform_admin.sql', import.meta.url), 'utf8');
  const zones = await readFile(new URL('../migrations/003_zone_scope.sql', import.meta.url), 'utf8');
  assert.match(owner, /is_platform_admin/);
  assert.match(zones, /zones_warehouse_code_key/);
});

test('Wildberries FBS integration is secure, idempotent and visible in the mobile UI', async () => {
  const previous=process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY='test-only-integration-key';
  try{
    const encrypted=encryptSecret('wb-test-token-1234567890');
    assert.notEqual(encrypted,'wb-test-token-1234567890');
    assert.doesNotMatch(encrypted,/wb-test-token/);
    assert.equal(decryptSecret(encrypted),'wb-test-token-1234567890');
  }finally{
    if(previous===undefined)delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY=previous;
  }

  assert.deepEqual(normalizeWbOrder({id:77,nmId:101,chrtId:202,skus:['460000000001']}),{
    id:'77',orderNo:'WB-77',sku:'WB-101-202',name:'Товар Wildberries · артикул 101',barcode:'460000000001',nmId:101,chrtId:202,
    destination:null,officeId:null,warehouseId:null,orderUid:null,sellerDate:null,
    raw:{id:77,nmId:101,chrtId:202,skus:['460000000001']}
  });

  const route=await readFile(new URL('../app/api/integrations/wildberries/route.js',import.meta.url),'utf8');
  const importer=await readFile(new URL('../lib/wildberries.js',import.meta.url),'utf8');
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/004_wildberries_integration.sql',import.meta.url),'utf8');
  const cron=await readFile(new URL('../app/api/cron/wildberries/route.js',import.meta.url),'utf8');
  const workflow=await readFile(new URL('../.github/workflows/wb-sync.yml',import.meta.url),'utf8');
  assert.match(route,/validateWildberriesToken/);
  assert.match(route,/encryptSecret/);
  assert.match(importer,/\/api\/v3\/orders\/new/);
  assert.match(importer,/on conflict\(seller_id,wb_order_id\)/);
  assert.match(importer,/insert into order_allocations/);
  assert.match(importer,/stock_reserved/);
  assert.doesNotMatch(bootstrap,/token_encrypted/);
  assert.match(ui,/type="password"/);
  assert.match(ui,/platformShortcut/);
  assert.match(ui,/window\.setInterval\(sync,60000\)/);
  assert.match(migration,/token_encrypted text not null/);
  assert.match(migration,/products_seller_wb_chrt_key/);
  assert.match(cron,/CRON_SECRET/);
  assert.match(cron,/interval '6 hours'/);
  assert.match(cron,/interval '5 minutes'/);
  assert.match(cron,/cache-control.*private, no-store/);
  assert.doesNotMatch(cron,/x-vercel-cron-schedule/);
  assert.match(workflow,/cron: '\*\/5 \* \* \* \*'/);
  assert.match(workflow,/secrets\.WB_SYNC_SECRET/);
  assert.doesNotMatch(workflow,/Bearer [A-Za-z0-9_-]{20,}/);
});

test('fulfillment desk keeps the WB route and groups ready orders for shipping', async () => {
  const normalized=normalizeWbOrder({id:88,nmId:303,chrtId:404,skus:['460000000002'],offices:['СЦ Коледино'],officeId:507,warehouseId:9001,orderUid:'basket-1',sellerDate:'02.06.2025'});
  assert.equal(normalized.destination,'СЦ Коледино');
  assert.equal(normalized.officeId,507);
  assert.equal(normalized.warehouseId,9001);
  assert.equal(normalized.orderUid,'basket-1');
  assert.equal(normalized.sellerDate,'2025-06-02');

  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  const importer=await readFile(new URL('../lib/wildberries.js',import.meta.url),'utf8');
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/008_wb_shipping_routes.sql',import.meta.url),'utf8');
  assert.match(ui,/function WorkspaceScope/);
  assert.match(ui,/function ShippingBoard/);
  assert.match(ui,/Маршруты на склады и СЦ WB/);
  assert.match(ui,/action:'ORDER_SHIPPED'/);
  assert.match(importer,/order\.offices/);
  assert.match(importer,/wb_office_id,wb_warehouse_id,wb_order_uid,wb_seller_date/);
  assert.match(bootstrap,/coalesce\(o\.shipped_at,o\.ready_at,o\.packed_at,o\.picked_at,o\.created_at\) updated_at/);
  assert.doesNotMatch(bootstrap,/o\.wb_nm_id|o\.wb_chrt_id/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS destination/i);
  assert.match(migration,/orders_ready_destination_idx/);
});

test('seller portal is read-only, seller-scoped and hides warehouse internals', async () => {
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const auth=await readFile(new URL('../lib/auth.js',import.meta.url),'utf8');
  const portal=await readFile(new URL('../components/SellerPortal.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  assert.match(auth,/sm\.seller_id/);
  assert.match(bootstrap,/if\(user\.role==='SELLER'\)return sellerSnapshot\(user\)/);
  assert.match(bootstrap,/where o\.seller_id=\$\{sellerId\}/);
  assert.match(bootstrap,/where i\.organization_id=\$\{organizationId\} and i\.seller_id=\$\{sellerId\}/);
  assert.doesNotMatch(portal,/cell_code|source_cell|audit_logs|organization_members/);
  assert.doesNotMatch(portal,/token_encrypted|DATABASE_URL/);
  assert.match(ui,/state\.user\.role==='SELLER'/);
  assert.match(portal,/Остатки по складам/);
  assert.match(portal,/FBS заказы/);
});

test('client access creation is atomic and Wildberries ownership is enforced', async () => {
  const opsRoute=await readFile(new URL('../app/api/ops/route.js',import.meta.url),'utf8');
  const wbRoute=await readFile(new URL('../app/api/integrations/wildberries/route.js',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/005_seller_portal.sql',import.meta.url),'utf8');
  assert.match(opsRoute,/action==='CREATE_SELLER_USER'/);
  assert.match(opsRoute,/insert into seller_members/);
  assert.match(opsRoute,/transaction\(tx=>/);
  assert.match(wbRoute,/user\.seller_access_role!=='OWNER'/);
  assert.match(wbRoute,/seller_id=\$\{user\.seller_id\}/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS seller_members/i);
  assert.match(migration,/seller_members_organization_user_key/);
  assert.match(migration,/ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city/i);
});

test('warehouse locations are editable only inside the active organization', async () => {
  const route=await readFile(new URL('../app/api/ops/route.js',import.meta.url),'utf8');
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  assert.match(route,/action==='UPDATE_WAREHOUSE'/);
  assert.match(route,/u\.role!=='ADMIN'/);
  assert.match(route,/requireWarehouse\(u,x\.warehouse_id\)/);
  assert.match(route,/UPDATE_WAREHOUSE/);
  assert.match(bootstrap,/select id,code,name,city,address,timezone/);
  assert.match(ui,/Сохранить данные склада/);
  assert.match(ui,/Эти данные отображаются в клиентском кабинете/);
});

test('picking cannot consume a box from another warehouse', async () => {
  const tenant=await readFile(new URL('../lib/tenant.js',import.meta.url),'utf8');
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  assert.match(tenant,/o\.warehouse_id=bz\.warehouse_id/);
  assert.match(bootstrap,/z\.warehouse_id from box_items/);
  assert.match(ui,/x\.warehouse_id===order\?\.warehouse_id/);
});

test('platform owner can safely manage, suspend and archive sold fulfillment access', async () => {
  const route=await readFile(new URL('../app/api/platform/organizations/route.js',import.meta.url),'utf8');
  const auth=await readFile(new URL('../lib/auth.js',import.meta.url),'utf8');
  const cron=await readFile(new URL('../app/api/cron/wildberries/route.js',import.meta.url),'utf8');
  const bootstrap=await readFile(new URL('../app/api/bootstrap/route.js',import.meta.url),'utf8');
  const ui=await readFile(new URL('../components/WmsAppV3.js',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/006_organization_archive.sql',import.meta.url),'utf8');
  assert.match(route,/export async function PATCH/);
  assert.match(route,/export async function DELETE/);
  assert.match(route,/UPDATE_PROFILE/);
  assert.match(route,/UPDATE_ADMIN/);
  assert.match(route,/SET_STATUS/);
  assert.match(route,/RESTORE/);
  assert.match(route,/ARCHIVE_ORGANIZATION/);
  assert.match(route,/target\.id===actor\.organization_id/);
  assert.doesNotMatch(route,/delete from organizations/);
  assert.match(auth,/o\.archived_at is null/);
  assert.match(cron,/o\.status in \('ACTIVE','TRIAL'\) and o\.archived_at is null/);
  assert.match(bootstrap,/o\.archived_at/);
  assert.match(ui,/Управление ·/);
  assert.match(ui,/Архивировать фулфилмент/);
  assert.match(ui,/Восстановить из архива/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS archived_at/i);
});
