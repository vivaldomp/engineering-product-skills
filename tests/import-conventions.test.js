const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('egp-import skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /^---\nname: egp-import\n/);
  assert.match(s, /\ndescription:/);
});

test('egp-import documents ingest, mapping, gap report, SRS reference, read-only, and hand-off', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /classif/i);
  assert.match(s, /map/i);
  assert.match(s, /workspace\/outputs\/current\/governance\/import-gap-report\.md/);
  assert.match(s, /SRS/);
  assert.match(s, /read-only/i);
  assert.match(s, /derive-then-confirm/i);
});

test('egp-import command exists and routes to the skill', () => {
  const s = read('commands/egp-import.md');
  assert.match(s, /egp-import/);
});

test('questioning-protocol documents derive-then-confirm mode', () => {
  const s = read('shared/references/questioning-protocol.md');
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /confirmation batch/i);
  assert.match(s, /genuine gap/i);
});

test('all three builders support derive-then-confirm mode', () => {
  for (const b of ['egp-prd-builder', 'egp-sdd-builder', 'egp-adr-builder']) {
    const s = read(`skills/${b}/SKILL.md`);
    assert.match(s, /derive-then-confirm/i, `${b} should mention derive-then-confirm`);
  }
});

test('egp-product-workflow detects existing source docs and legacy docs', () => {
  const s = read('skills/egp-product-workflow/SKILL.md');
  assert.match(s, /egp-import/);
  assert.match(s, /## 1\. Metadata|front-matter|legacy/i);
});

test('egp-doc-sync documents the legacy front-matter migration', () => {
  const s = read('skills/egp-doc-sync/SKILL.md');
  assert.match(s, /migrat/i);
  assert.match(s, /## 1\. Metadata/);
  assert.match(s, /front-matter/i);
});

test('egp-import documents a machine-readable import-map.json (C1)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /import-map\.json/);
  assert.match(s, /sourceRef|mappedTo|unmapped/);
});

test('egp-import prescribes per-file ADR default and an import-state file (C2/C3)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /per-file/i);
  assert.match(s, /ADR-NNN/);
  assert.match(s, /import-state\.json/);
});
