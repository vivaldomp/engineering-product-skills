const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const a = require('../plugins/product-design-suite/scripts/adr-index.js');

function scaffoldAdrs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-'));
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-x.md'),
    '---\nid: ADR-001\ntitle: Use Postgres\nstatus: Accepted\ndate: 2026-06-01\n---\n# x\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-y.md'),
    '---\nid: ADR-002\ntitle: Event bus\nstatus: Proposed\ndate: 2026-06-02\n---\n# y\n');
  return dir;
}

test('renderIndex builds a marker-wrapped table from front-matter', () => {
  const dir = scaffoldAdrs();
  const adrs = a.loadAdrFm(dir);
  const md = a.renderIndex(adrs);
  assert.match(md, /ADR-INDEX:START/);
  assert.match(md, /ADR-INDEX:END/);
  assert.match(md, /\| ADR-001 \| Use Postgres \| Accepted \| 2026-06-01 \|/);
  assert.match(md, /\| ADR-002 \| Event bus \| Proposed \| 2026-06-02 \|/);
});

test('writeIndex writes .product/adr/index.md and skips itself on re-run', () => {
  const dir = scaffoldAdrs();
  a.writeIndex(dir);
  const first = fs.readFileSync(path.join(dir, 'adr', 'index.md'), 'utf8');
  a.writeIndex(dir); // index.md now exists; must not be parsed as an ADR
  const second = fs.readFileSync(path.join(dir, 'adr', 'index.md'), 'utf8');
  assert.equal(first, second, 'idempotent');
  assert.ok(!/\| undefined \|/.test(second), 'index.md not treated as an ADR');
});
