const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const M = require('../plugins/product-design-suite/scripts/migrate-workspace.js');

function legacy(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, '.product', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

test('migrate moves a populated legacy tree into the taxonomy without loss', () => {
  const root = legacy({
    'prd/prd.md': 'FR-001',
    'prd/prd-summary.html': '<html>',
    'srs/srs.md': 'srs',
    'sad/sad.md': 'sad',
    'sdd/sdd.md': 'sdd',
    'adr/ADR-001-x.md': 'adr',
    'adr/index.md': 'idx',
    'traceability.md': 'trace',
    'import-state.json': '{}',
    'design/mock.html': 'ui',
    'diagrams/all.html': 'dg',
    'preview/sess1/state/x': 's',
    'notes/scratch.md': 'unmapped',
  });
  const { moves } = M.migrate(root);
  const cur = path.join(root, W.CURRENT);
  assert.equal(fs.readFileSync(path.join(cur, 'planning', 'prd.md'), 'utf8'), 'FR-001');
  assert.equal(fs.readFileSync(path.join(cur, 'ux', 'prd-summary.html'), 'utf8'), '<html>');
  assert.equal(fs.readFileSync(path.join(cur, 'specifications', 'srs.md'), 'utf8'), 'srs');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'sad.md'), 'utf8'), 'sad');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'sdd.md'), 'utf8'), 'sdd');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'adr', 'ADR-001-x.md'), 'utf8'), 'adr');
  assert.equal(fs.readFileSync(path.join(cur, 'governance', 'traceability.md'), 'utf8'), 'trace');
  assert.equal(fs.readFileSync(path.join(cur, 'governance', 'import-state.json'), 'utf8'), '{}');
  assert.equal(fs.readFileSync(path.join(cur, 'ux', 'mock.html'), 'utf8'), 'ui');
  assert.equal(fs.readFileSync(path.join(cur, 'exports', 'all.html'), 'utf8'), 'dg');
  assert.equal(fs.readFileSync(path.join(root, W.CACHE, 'preview', 'sess1', 'state', 'x'), 'utf8'), 's');
  // unmapped files keep their relative path and are reported
  assert.equal(fs.readFileSync(path.join(cur, 'notes', 'scratch.md'), 'utf8'), 'unmapped');
  // 4 whole-directory moves (adr, design, diagrams, preview) + 8 file moves
  assert.equal(moves.length, 12);
  assert.ok(!fs.existsSync(path.join(root, '.product')));
  assert.ok(fs.existsSync(path.join(root, W.CONFIG)));
});

test('migrate refuses when workspace/ already exists', () => {
  const root = legacy({ 'prd/prd.md': 'x' });
  fs.mkdirSync(path.join(root, W.WORKSPACE));
  assert.throws(() => M.migrate(root), /refusing/);
});

test('migrate refuses when there is no .product/', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  assert.throws(() => M.migrate(root), /no \.product/);
});
