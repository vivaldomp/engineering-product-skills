const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const P = require('../plugins/product-design-suite/scripts/promote.js');

// Hand-built history package: keeps promote's tests independent of snapshot.
function project(runId, status, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prom-'));
  const dir = path.join(root, W.HISTORY, runId);
  for (const [rel, c] of Object.entries(files)) {
    const p = path.join(dir, 'artifacts', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  }
  fs.mkdirSync(path.join(dir, 'validation'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'validation', 'gate.json'), JSON.stringify({
    pass: status === 'success',
    checks: [{ name: 'traceability', level: 'error', pass: status === 'success', detail: 'orphans: FR-002' }],
  }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    runId, status, artifacts: Object.keys(files),
  }));
  return root;
}

const GOOD = { 'planning/prd.md': 'FR-001' };

test('promoting a successful run writes releases/v1 with provenance', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const { dest, release } = P.promote({ run: '2026-07-15T103422', projectRoot: root, now: new Date('2026-07-15T20:10:00Z') });
  assert.equal(path.basename(dest), 'v1');
  assert.equal(release.release, 'v1');
  assert.equal(release.runId, '2026-07-15T103422');
  assert.equal(release.fromStatus, 'success');
  assert.equal(release.forced, false);
  assert.deepEqual(release.artifacts, ['planning/prd.md']);
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.md')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'release.json'), 'utf8')), release);
});

test('the next promotion auto-names v2', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  P.promote({ run: '2026-07-15T103422', projectRoot: root });
  const { dest } = P.promote({ run: '2026-07-15T103422', projectRoot: root });
  assert.equal(path.basename(dest), 'v2');
});

test('--as overrides the name', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const { dest } = P.promote({ run: '2026-07-15T103422', as: 'v1.2.0', projectRoot: root });
  assert.equal(path.basename(dest), 'v1.2.0');
});

test('a gate-failed run is refused, naming the error count', () => {
  const root = project('2026-07-15T103422', 'gate-failed', GOOD);
  assert.throws(
    () => P.promote({ run: '2026-07-15T103422', projectRoot: root }),
    /gate-failed \(1 gate error\(s\)/,
  );
  assert.ok(!fs.existsSync(path.join(root, W.RELEASES)));
});

test('--force promotes a gate-failed run and records the override', () => {
  const root = project('2026-07-15T103422', 'gate-failed', GOOD);
  const { release } = P.promote({ run: '2026-07-15T103422', force: true, projectRoot: root });
  assert.equal(release.forced, true);
  assert.equal(release.fromStatus, 'gate-failed');
});

test('an existing destination is refused', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  P.promote({ run: '2026-07-15T103422', as: 'v1', projectRoot: root });
  assert.throws(() => P.promote({ run: '2026-07-15T103422', as: 'v1', projectRoot: root }), /already exists/);
});

test('an unknown run is refused', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  assert.throws(() => P.promote({ run: 'nope', projectRoot: root }), /no run nope/);
});

test('--force on an already-successful run does not record forced', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const { release } = P.promote({ run: '2026-07-15T103422', force: true, projectRoot: root });
  assert.equal(release.forced, false);
});

test('a failed copy leaves no partial destination behind', { skip: process.getuid && process.getuid() === 0 }, () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const badFile = path.join(root, W.HISTORY, '2026-07-15T103422', 'artifacts', 'planning', 'prd.md');
  fs.chmodSync(badFile, 0o000);
  try {
    assert.throws(() => P.promote({ run: '2026-07-15T103422', as: 'v1', projectRoot: root }));
    assert.ok(!fs.existsSync(path.join(root, W.RELEASES, 'v1')));
  } finally {
    fs.chmodSync(badFile, 0o644);
  }
});
