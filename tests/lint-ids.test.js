// tests/lint-ids.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const l = require('../plugins/product-design-suite/scripts/lint-ids.js');

test('lintText flags ID-shaped tokens that miss the canonical form', () => {
  // 'NFR_P1' uses an underscore; 'FR-01X' has an uppercase trailing letter.
  const r = l.lintText('Good: FR-001 NFR-P1 C-3. Bad: NFR_P1 FR-01X.');
  assert.ok(r.malformed.includes('NFR_P1'));
  assert.ok(r.malformed.includes('FR-01X'));
});

test('lintText passes clean canonical text', () => {
  assert.deepEqual(l.lintText('FR-001 BR-007 NFR-P1 AR-002 C-8 UAT-003 ADR-004').malformed, []);
});

test('lintText ignores prose words sharing the single-letter C prefix', () => {
  assert.deepEqual(l.lintText('Briefed the C-suite and C-level execs about C-section.').malformed, []);
});

test('lintText still flags digit-bearing near-misses amid prose', () => {
  const r = l.lintText('The C-suite reviewed NFR_P1 and FR-01X.');
  assert.ok(r.malformed.includes('NFR_P1'));
  assert.ok(r.malformed.includes('FR-01X'));
  assert.ok(!r.malformed.includes('C-suite'));
});

test('lintText ignores malformed IDs shown inside code (IMP-1b)', () => {
  const r = l.lintText('Prose NFR_P1 is bad. But `NFR_P9` in code is fine.');
  assert.ok(r.malformed.includes('NFR_P1'), 'prose near-miss still flagged');
  assert.ok(!r.malformed.includes('NFR_P9'), 'in-code near-miss ignored');
});

test('lintProduct detects duplicate IDs across files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-'));
  try {
    fs.writeFileSync(path.join(dir, 'file1.md'), 'This document has FR-001 in it.');
    fs.writeFileSync(path.join(dir, 'file2.md'), 'Another file also has FR-001 here.');
    const result = l.lintProduct(dir);
    const dupeEntry = result.duplicates.find(d => d.id === 'FR-001');
    assert.ok(dupeEntry, 'FR-001 should be detected as duplicate');
    assert.strictEqual(dupeEntry.files.length, 2, 'FR-001 should appear in 2 files');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('lintProduct separates duplicate table definitions from mentions (IMP-8)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lintdef-'));
  // FR-001 DEFINED (first table cell) in two files; FR-002 only mentioned in prose twice.
  fs.writeFileSync(path.join(dir, 'a.md'), '| ID | Req |\n| --- | --- |\n| FR-001 | x |\nMentions FR-002.');
  fs.writeFileSync(path.join(dir, 'b.md'), '| ID | Req |\n| --- | --- |\n| FR-001 | y |\nAlso FR-002.');
  const r = l.lintProduct(dir);
  assert.ok(r.definitionDuplicates.find(d => d.id === 'FR-001'), 'FR-001 is a duplicate definition');
  assert.ok(!r.definitionDuplicates.find(d => d.id === 'FR-002'), 'FR-002 is only a mention, not a definition');
});
