import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WMS_ACTIONS, cleanText, positiveInteger, validEmail} from '../lib/wms-contract.js';

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
  assert.match(architecture, /Multi-tenant target/);
  assert.match(roadmap, /commercial pilot/i);
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
  assert.match(scan, /w\.organization_id=\$\{u\.organization_id\}/);
});

test('applied database migrations are versioned in the repository', async () => {
  const migration = await readFile(new URL('../migrations/001_organizations.sql', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../migrations/README.md', import.meta.url), 'utf8');
  assert.match(migration, /create table organizations/);
  assert.match(migration, /organization_members/);
  assert.match(guide, /13a6bbd8-5668-41e6-8ed0-4ab0f85726f0/);
});
