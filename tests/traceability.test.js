const test = require('node:test');
const assert = require('node:assert');
const t = require('../plugins/product-design-suite/scripts/traceability.js');

test('extractIds finds unique typed ids', () => {
  const ids = t.extractIds('See FR-001 and FR-001 and ADR-003 and noise FRX-9');
  assert.deepEqual(ids.sort(), ['ADR-003', 'FR-001']);
});

test('buildMatrix links requirement to sdd and adrs', () => {
  const rows = t.buildMatrix({
    prd: 'FR-001 do a thing. NFR-002 be fast.',
    sdd: 'Implements FR-001 in section 4.',
    adrs: { 'ADR-003': 'Decision affecting FR-001.' },
  });
  const fr = rows.find(r => r.id === 'FR-001');
  assert.equal(fr.inSdd, true);
  assert.deepEqual(fr.adrs, ['ADR-003']);
  const nfr = rows.find(r => r.id === 'NFR-002');
  assert.equal(nfr.inSdd, false);
  assert.deepEqual(nfr.adrs, []);
});

test('renderMatrixMarkdown and Html include the id', () => {
  const rows = t.buildMatrix({ prd: 'FR-001 x', sdd: '', adrs: {} });
  assert.match(t.renderMatrixMarkdown(rows), /FR-001/);
  assert.match(t.renderMatrixHtml(rows), /<table/);
  assert.match(t.renderMatrixHtml(rows), /FR-001/);
});
