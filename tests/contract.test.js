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
