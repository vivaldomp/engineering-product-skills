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
