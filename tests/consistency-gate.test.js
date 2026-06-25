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
