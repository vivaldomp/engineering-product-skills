const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const M = require('../plugins/product-design-suite/scripts/meta.js');

const META_JS = path.join(__dirname, '..', 'plugins', 'product-design-suite', 'scripts', 'meta.js');

// meta.js operates on a current root directly, so fixtures write relative paths under it.
function current(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

const read = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('sidecars cover authored artifacts but not regenerated reports', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'governance/traceability.md': 'generated every finalize',
    'governance/import-map.json': '{}',
  });
  const { written } = M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  assert.deepEqual(written.sort(), [
    path.join('governance', 'import-map.json'),
    path.join('planning', 'prd.md'),
  ].sort());
  assert.ok(fs.existsSync(path.join(root, 'planning', 'prd.meta.json')));
  assert.ok(fs.existsSync(path.join(root, 'governance', 'import-map.meta.json')));
  assert.ok(!fs.existsSync(path.join(root, 'governance', 'traceability.meta.json')));
});

test('a hand-edited doc reports MODIFIED, naming the run that last wrote it', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: '2026-07-15T103422', version: '0.1.1' });
  assert.deepEqual(M.checkSidecars(root).map(r => r.status), ['OK']);
  fs.writeFileSync(path.join(root, 'planning', 'prd.md'), 'FR-001 edited by hand');
  const [r] = M.checkSidecars(root);
  assert.equal(r.status, 'MODIFIED');
  assert.equal(r.runId, '2026-07-15T103422');
});

test('a doc with no sidecar reports MISSING', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  assert.deepEqual(M.checkSidecars(root), [
    { file: path.join('planning', 'prd.md'), status: 'MISSING', runId: null },
  ]);
});

// The load-bearing behaviour: an untouched doc keeps its provenance across runs,
// while a doc that actually changed is re-attributed to the run that changed it.
test('unchanged docs keep provenance; changed docs take the new run', () => {
  const root = current({ 'planning/prd.md': 'FR-001', 'architecture/sad.md': 'AR-001 detail' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  fs.writeFileSync(path.join(root, 'architecture', 'sad.md'), 'AR-001 detail, revised');
  const { written, preserved } = M.writeSidecars({ root, skill: 'egp-sad-builder', runId: 'R2', version: '0.1.1' });

  assert.deepEqual(written, [path.join('architecture', 'sad.md')]);
  assert.deepEqual(preserved, [path.join('planning', 'prd.md')]);

  const prd = read(root, 'planning/prd.meta.json');
  assert.equal(prd.runId, 'R1');
  assert.equal(prd.skill, 'egp-prd-builder');

  const sad = read(root, 'architecture/sad.meta.json');
  assert.equal(sad.runId, 'R2');
  assert.equal(sad.skill, 'egp-sad-builder');
  // SAD now depends on the PRD (the SRS stage is retired).
  assert.deepEqual(sad.dependsOn, [path.join('planning', 'prd.md')]);
});

test('ADR sidecars resolve the ADR template and depend on the SAD', () => {
  const root = current({ 'architecture/adr/ADR-001-cache.md': 'Decision body' });
  M.writeSidecars({ root, skill: 'egp-adr-builder', runId: 'R1', version: '0.1.1' });
  const m = read(root, 'architecture/adr/ADR-001-cache.meta.json');
  assert.equal(m.template, 'adr-template.md');
  assert.deepEqual(m.dependsOn, [W.REL.sad]);
  assert.equal(m.author, 'product-design-suite@0.1.1');
  assert.match(m.hash, /^sha256:[0-9a-f]{64}$/);
});

test('inputs are recorded on an import run and empty otherwise', () => {
  const root = current({ 'governance/import-map.json': '{}', 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-import', runId: 'R1', version: '0.1.1', inputs: ['legacy-spec.md'] });
  const imp = read(root, 'governance/import-map.meta.json');
  assert.deepEqual(imp.inputs, ['legacy-spec.md']);
  assert.equal(imp.template, null);
  assert.deepEqual(imp.dependsOn, []);

  const root2 = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root: root2, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  assert.deepEqual(read(root2, 'planning/prd.meta.json').inputs, []);
});

test('CLI without --check cannot rewrite provenance (it is check-only)', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  const before = read(root, 'planning/prd.meta.json');

  fs.writeFileSync(path.join(root, 'planning', 'prd.md'), 'FR-001 edited by hand');

  execFileSync(process.execPath, [META_JS, root]);

  const after = read(root, 'planning/prd.meta.json');
  assert.deepEqual(after, before);
  assert.equal(after.skill, 'egp-prd-builder');
  assert.equal(after.runId, 'R1');
});

test('sidecarPath rejects extensionless paths; normal and dotted-directory paths resolve correctly', () => {
  // Extensionless path must throw.
  assert.throws(
    () => M.sidecarPath('planning/prd'),
    { message: /extensionless path/ }
  );

  // Normal cases must work.
  assert.equal(M.sidecarPath('planning/prd.md'), 'planning/prd.meta.json');
  assert.equal(M.sidecarPath('governance/import-map.json'), 'governance/import-map.meta.json');

  // Dotted directory names must not be mistaken for extensions.
  assert.equal(M.sidecarPath('archive/v1.2/report.md'), 'archive/v1.2/report.meta.json');
});
