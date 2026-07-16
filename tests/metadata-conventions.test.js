const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// Returns the YAML front-matter body (text between the opening and closing ---),
// or null if the file does not start with a front-matter block.
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

test('all three templates open with a YAML front-matter block', () => {
  for (const f of ['prd-template.md', 'sdd-template.md', 'adr-template.md']) {
    const text = read(path.join('shared/templates', f));
    assert.ok(text.startsWith('---\n'), `${f} must start with front-matter`);
    assert.ok(frontMatter(text), `${f} must have a closing --- delimiter`);
  }
});

test('PRD and SDD front-matter declare the five metadata fields', () => {
  for (const f of ['prd-template.md', 'sdd-template.md']) {
    const fm = frontMatter(read(path.join('shared/templates', f)));
    for (const key of ['title', 'status', 'version', 'owner', 'date']) {
      assert.match(fm, new RegExp('^' + key + ':', 'm'), `${f} front-matter needs ${key}`);
    }
  }
});

test('ADR front-matter declares scalar and relationship fields', () => {
  const fm = frontMatter(read('shared/templates/adr-template.md'));
  const keys = ['id', 'title', 'status', 'date', 'author', 'reviewers',
                'supersedes', 'superseded-by', 'amends', 'amended-by',
                'related-prd', 'related-sdd', 'related-adrs'];
  for (const key of keys) {
    assert.match(fm, new RegExp('^' + key + ':', 'm'), `ADR front-matter needs ${key}`);
  }
});

test('ADR template drops the Metadata section and renumbers Context to 1', () => {
  const tpl = read('shared/templates/adr-template.md');
  assert.doesNotMatch(tpl, /## \d+\. Metadata/);
  assert.match(tpl, /## 1\. Context/);
  assert.match(tpl, /## 7\. References/);
  assert.match(tpl, /## Status History/);
});

test('egp-adr-builder documents structured supersede/amend front-matter', () => {
  const s = read('skills/egp-adr-builder/SKILL.md');
  assert.match(s, /front-matter/i);
  assert.match(s, /supersed/i);
  assert.match(s, /amend/i);
});

test('egp-prd-builder and egp-sdd-builder populate front-matter', () => {
  assert.match(read('skills/egp-prd-builder/SKILL.md'), /front-matter/i);
  assert.match(read('skills/egp-sdd-builder/SKILL.md'), /front-matter/i);
});

test('egp-doc-sync checks supersede/amend link symmetry', () => {
  const s = read('skills/egp-doc-sync/SKILL.md');
  assert.match(s, /supersed/i);
  assert.match(s, /symmetr|asymmetr|reciprocal/i);
});

test('references document front-matter metadata and relationship fields', () => {
  const st = read('shared/references/structures.md');
  const co = read('shared/references/concepts.md');
  assert.match(st, /front-matter/i);
  assert.match(st, /superseded-by/i);
  assert.match(co, /front-matter/i);
  assert.match(co, /amend/i);
});

test('adr template front-matter links to PRD/SAD, and the retired SRS is gone (D1)', () => {
  const tpl = read('shared/templates/adr-template.md');
  assert.match(tpl, /related-prd:\s*\[\]/);
  assert.match(tpl, /related-sad:\s*\[\]/);
  assert.ok(!/related-srs/.test(tpl));
});

test('egp-adr-builder and egp-doc-sync mention related-sad, not the retired related-srs', () => {
  const adr = read('skills/egp-adr-builder/SKILL.md');
  const sync = read('skills/egp-doc-sync/SKILL.md');
  assert.match(adr, /related-sad/);
  assert.match(sync, /related-sad/);
  assert.ok(!/related-srs/.test(adr));
  assert.ok(!/related-srs/.test(sync));
});

test('sad template ships a mode-banner slot (D2)', () => {
  assert.match(read('shared/templates/sad-template.md'), /MODE-BANNER:START/);
  assert.match(read('shared/templates/sad-template.md'), /MODE-BANNER:END/);
});

test('sdd §9/§10/§14 carry a per-concern status field with planned (D3, IMP-5)', () => {
  const tpl = read('shared/templates/sdd-template.md');
  assert.match(tpl, /designed \| partial \| gap \| planned \| n\/a/);
  assert.ok((tpl.match(/designed \| partial \| gap \| planned \| n\/a/g) || []).length >= 3);
  // old four-value enum must be fully replaced
  assert.ok(!/designed \| partial \| gap \| n\/a/.test(tpl.replace(/designed \| partial \| gap \| planned \| n\/a/g, '')));
});

test('confirmation-batch contract is defined once and referenced by workflow (F1)', () => {
  assert.match(read('shared/references/questioning-protocol.md'), /one confirmation batch/i);
  assert.match(read('skills/egp-product-workflow/SKILL.md'), /confirmation batch/i);
});

test('templates use non-matching placeholder IDs, not real example IDs (IMP-1a)', () => {
  const files = ['prd', 'sad', 'sdd'].map(n => `shared/templates/${n}-template.md`);
  // A real-looking example ID = a known prefix + dash + digits (e.g. FR-001).
  const REAL = /\b(FR|BR|NFR|AR|UAT)-\d+\b/;
  for (const f of files) {
    const lines = read(f).split('\n').filter(l => REAL.test(l));
    assert.deepEqual(lines, [], `${f} should not contain real example IDs like FR-001:\n${lines.join('\n')}`);
  }
});

test('builders carry the docs/ guard and version-bump heuristic (IMP-9, IMP-11)', () => {
  for (const b of ['egp-prd-builder', 'egp-sad-builder', 'egp-sdd-builder', 'egp-adr-builder']) {
    const s = read(`skills/${b}/SKILL.md`);
    assert.match(s, /docs\//, `${b} must mention the docs/ guard`);
    assert.match(s, /version/i, `${b} must mention version-bump guidance`);
  }
});

test('questioning-protocol defines a consolidated decision ledger (IMP-10)', () => {
  assert.match(read('shared/references/questioning-protocol.md'), /decision[- ]ledger|open decisions/i);
});
