// tests/validate-structure.test.js
const test = require('node:test');
const assert = require('node:assert');
const v = require('../plugins/product-design-suite/scripts/validate-structure.js');

test('validateDoc flags a missing required heading', () => {
  const tpl = '## 1. Overview\n## 2. Components\n';
  const doc = '## 1. Overview\n';
  const r = v.validateDoc(doc, tpl);
  assert.ok(r.missing.includes('components'));
});

test('validateDoc treats a merged heading as merged, not missing', () => {
  const tpl = '## 9. Retry\n## 10. Timeouts\n## 11. Fallbacks\n';
  const doc = '## 9. Retry / Timeouts / Fallbacks\n';
  const r = v.validateDoc(doc, tpl);
  assert.deepEqual(r.missing, []);
  assert.ok(r.merged.includes('timeouts'));
});

test('validateDoc is clean for a faithful doc', () => {
  const tpl = '## 1. Overview\n### Goals\n';
  const doc = '## 1. Overview\n### Goals\n';
  const r = v.validateDoc(doc, tpl);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.merged, []);
});
