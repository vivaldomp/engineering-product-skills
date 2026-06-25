// tests/consistency-gate.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../plugins/product-design-suite/scripts/consistency-gate.js');

function scaffold() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  fs.mkdirSync(path.join(dir, 'prd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sdd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'prd', 'prd.md'), '# PRD\nFR-001 export.\n');
  fs.writeFileSync(path.join(dir, 'sdd', 'sdd.md'), '## 4. Components\nImplements FR-001.\n');
  return dir;
}

test('gate passes a clean product and reports per-check results', () => {
  const r = g.runGate(scaffold());
  assert.equal(r.pass, true);
  assert.ok(r.checks.some(c => c.name === 'traceability'));
  assert.ok(r.checks.some(c => c.name === 'id-lint'));
  assert.ok(r.checks.some(c => c.name === 'adr-reciprocity'));
});

test('gate fails when an ADR claims a supersede that is not reciprocated', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-x.md'),
    '---\nid: ADR-002\nsupersedes: [ADR-001]\nsuperseded-by: []\n---\n# x\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-y.md'),
    '---\nid: ADR-001\nsuperseded-by: []\n---\n# y\n'); // missing back-link
  const r = g.runGate(dir);
  assert.equal(r.pass, false);
  assert.ok(r.checks.find(c => c.name === 'adr-reciprocity' && !c.pass));
});

test('gate passes when quoted ADR IDs in front-matter are matched after quote-stripping', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-x.md'),
    '---\nid: ADR-002\nsupersedes: ["ADR-001"]\nsuperseded-by: []\n---\n# x\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-y.md'),
    '---\nid: ADR-001\nsuperseded-by: ["ADR-002"]\n---\n# y\n');
  const r = g.runGate(dir);
  assert.equal(r.pass, true);
  assert.ok(r.checks.find(c => c.name === 'adr-reciprocity' && c.pass));
});

test('gate FAILs loudly on a directory with no product docs (IMP-2)', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-empty-'));
  const r = g.runGate(empty);
  assert.equal(r.pass, false);
  assert.ok(r.checks.find(c => c.name === 'inputs-present' && !c.pass));
});

test('every gate check carries an error|warn level (IMP-2)', () => {
  const r = g.runGate(scaffold());
  assert.ok(r.checks.every(c => c.level === 'error' || c.level === 'warn'));
});

test('id-lint detail labels cross-doc mentions as expected (IMP-8)', () => {
  const r = g.runGate(scaffold());
  const idLint = r.checks.find(c => c.name === 'id-lint');
  assert.match(idLint.detail, /duplicate-definitions/);
  assert.match(idLint.detail, /cross-doc mentions/);
});

test('structure check is warn-level and never fails the gate (IMP-3)', () => {
  const r = g.runGate(scaffold());
  const s = r.checks.find(c => c.name === 'structure');
  assert.ok(s, 'structure check present');
  assert.equal(s.level, 'warn');
});

test('mermaid-lint is error-level and fails a bad diagram (IMP-6)', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'sdd', 'sdd.md'),
    '## 4. Components\nImplements FR-001.\n```mermaid\nsequenceDiagram\n  A->>B: a; b\n```\n');
  const r = g.runGate(dir);
  const ml = r.checks.find(c => c.name === 'mermaid-lint');
  assert.equal(ml.level, 'error');
  assert.equal(ml.pass, false);
  assert.equal(r.pass, false);
});

test('one-directional related-adrs warns but does not fail the gate (IMP-7)', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-a.md'),
    '---\nid: ADR-001\nrelated-adrs: [ADR-002]\n---\n# a\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-b.md'),
    '---\nid: ADR-002\nrelated-adrs: []\n---\n# b\n'); // missing back-link
  const r = g.runGate(dir);
  const rel = r.checks.find(c => c.name === 'related-adrs');
  assert.equal(rel.level, 'warn');
  assert.equal(rel.pass, false);
  assert.equal(r.pass, true, 'gate still passes — related-adrs is advisory');
});
