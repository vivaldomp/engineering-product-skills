const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const S = require('../plugins/product-design-suite/scripts/snapshot.js');

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, W.CURRENT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

test('snapshot writes a self-contained package with manifest and validation', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  const now = new Date('2026-07-15T10:34:22');
  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', artifact: 'planning/prd.md', projectRoot: root, now });
  assert.equal(manifest.runId, '2026-07-15T103422');
  assert.equal(manifest.skill, 'egp-prd-builder');
  assert.equal(manifest.status, 'success');
  assert.equal(manifest.primaryArtifact, 'planning/prd.md');
  assert.ok(manifest.artifacts.includes('planning/prd.md'));
  assert.ok(manifest.validation.gatePass);
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.md')));
  assert.ok(fs.existsSync(path.join(dest, 'validation', 'gate.json')));
  assert.ok(fs.existsSync(path.join(dest, 'validation', 'lint.json')));
  assert.ok(fs.existsSync(path.join(root, W.CONFIG)));
  const onDisk = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  assert.deepEqual(onDisk, manifest);
});

test('a failing gate still snapshots, with status gate-failed', () => {
  const root = project({ 'planning/prd.md': 'FR-001 x. FR-002 y.', 'architecture/sdd.md': 'Only FR-001.' });
  const { manifest } = S.snapshot({ skill: 'egp-prd-builder', projectRoot: root });
  assert.equal(manifest.status, 'gate-failed');
  assert.equal(manifest.validation.gatePass, false);
});

test('run-id collisions get a numeric suffix', () => {
  const root = project({ 'planning/prd.md': 'FR-001 x.', 'architecture/sdd.md': 'FR-001.' });
  const now = new Date('2026-07-15T10:34:22');
  const a = S.snapshot({ projectRoot: root, now });
  const b = S.snapshot({ projectRoot: root, now });
  assert.equal(a.manifest.runId, '2026-07-15T103422');
  assert.equal(b.manifest.runId, '2026-07-15T103422-2');
});

test('snapshot refuses a project without workspace/outputs/current', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  assert.throws(() => S.snapshot({ projectRoot: root }), /no workspace/);
});

test('the package carries sidecars and graph, and the run leaves a receipt', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  const now = new Date('2026-07-15T10:34:22');
  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', artifact: 'planning/prd.md', projectRoot: root, now });

  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.meta.json')));
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'governance', 'traceability.json')));
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'governance', 'artifacts.graph.json')));
  assert.ok(manifest.artifacts.includes('planning/prd.meta.json'));

  const receipt = JSON.parse(fs.readFileSync(path.join(root, W.RECEIPTS, `${manifest.runId}.json`), 'utf8'));
  assert.equal(receipt.runId, manifest.runId);
  assert.equal(receipt.skill, 'egp-prd-builder');
  assert.equal(receipt.status, 'success');
  assert.equal(receipt.nodeVersion, process.version);
  assert.deepEqual(receipt.gate.errors, []);
  // Deliberate: duration is unobservable from a finalize-time script.
  assert.equal(receipt.duration, undefined);
});

test('each run appends exactly one telemetry line', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  fs.writeFileSync(path.join(root, W.CURRENT, 'planning', 'prd.md'), 'FR-001 onboarding, revised.');
  S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:35:00') });

  const lines = fs.readFileSync(path.join(root, W.RUNS_LOG), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]);
  assert.equal(first.runId, '2026-07-15T103422');
  assert.equal(first.skill, 'egp-prd-builder');
  assert.equal(first.status, 'success');
  assert.equal(first.gateErrors, 0);
  assert.ok(first.artifactCount > 0);
});

test('an import run records its workspace inputs on the sidecars it writes', () => {
  const root = project({ 'governance/import-map.json': '{"targets":[]}' });
  const inputAbs = path.join(root, W.INPUTS, 'legacy-spec.md');
  fs.mkdirSync(path.dirname(inputAbs), { recursive: true });
  fs.writeFileSync(inputAbs, 'legacy content');

  S.snapshot({ skill: 'egp-import', artifact: 'governance/import-map.json', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  const meta = JSON.parse(fs.readFileSync(path.join(root, W.CURRENT, 'governance', 'import-map.meta.json'), 'utf8'));
  assert.deepEqual(meta.inputs, ['legacy-spec.md']);
  assert.equal(meta.skill, 'egp-import');
});

test('a receipt failure warns but never fails a finalize whose package is valid', (t) => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  // Occupy the receipts path with a file so mkdirSync of it throws.
  const eng = path.join(root, W.ENGINEERING);
  fs.mkdirSync(eng, { recursive: true });
  fs.writeFileSync(path.join(root, W.RECEIPTS), 'not a directory');
  t.mock.method(console, 'warn', () => {});

  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  assert.equal(manifest.status, 'success');
  assert.ok(fs.existsSync(path.join(dest, 'manifest.json')));
  assert.equal(console.warn.mock.callCount(), 1);
});
