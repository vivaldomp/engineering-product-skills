const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('sdd template ships the coverage-index markers and an appendices section', () => {
  const tpl = read('shared/templates/sdd-template.md');
  assert.match(tpl, /COVERAGE-INDEX:START/);
  assert.match(tpl, /COVERAGE-INDEX:END/);
  assert.match(tpl, /## 16\. Requirement Coverage Index/);
  assert.match(tpl, /## 17\. Appendices/);
});

test('egp-doc-sync documents coverage injection and orphan reporting', () => {
  const s = read('skills/egp-doc-sync/SKILL.md');
  assert.match(s, /COVERAGE-INDEX|§16|coverage index/i);
  assert.match(s, /orphan/i);
});

test('structures.md documents range-aware traceability and orphans', () => {
  const s = read('shared/references/structures.md');
  assert.match(s, /orphan/i);
});

test('egp-sdd-builder notes the generated coverage index', () => {
  const s = read('skills/egp-sdd-builder/SKILL.md');
  assert.match(s, /generated|§16/i);
});

test('id-conventions reference documents prefixes, category-letters and constraints', () => {
  const s = read('shared/references/id-conventions.md');
  assert.match(s, /NFR-P1/);          // category-lettered example (A1)
  assert.match(s, /\bC-\d/);          // constraints (A4)
  assert.match(s, /FR|BR|NFR|AR|UAT|ADR/);
});

test('srs and sad templates link to the id-conventions reference', () => {
  assert.match(read('shared/templates/srs-template.md'), /id-conventions/);
  assert.match(read('shared/templates/sad-template.md'), /id-conventions/);
});
