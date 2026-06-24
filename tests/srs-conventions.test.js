const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

test('srs-template has front-matter with the five metadata fields', () => {
  const text = read('shared/templates/srs-template.md');
  assert.ok(text.startsWith('---\n'), 'srs-template must start with front-matter');
  const fm = frontMatter(text);
  assert.ok(fm, 'srs-template must have a closing --- delimiter');
  for (const key of ['title', 'status', 'version', 'owner', 'date']) {
    assert.match(fm, new RegExp('^' + key + ':', 'm'), `srs front-matter needs ${key}`);
  }
});

test('srs-template documents IEEE-830 sections and FR/NFR tables', () => {
  const s = read('shared/templates/srs-template.md');
  assert.match(s, /## 1\. Introduction/);
  assert.match(s, /## 2\. Overall Description/);
  assert.match(s, /## 3\. Specific Requirements/);
  assert.match(s, /### Functional Requirements/);
  assert.match(s, /### Non-Functional Requirements/);
  assert.match(s, /FR-001/);
  assert.match(s, /NFR-001/);
});

test('pm-srs-builder skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/pm-srs-builder/SKILL.md');
  assert.match(s, /^---\nname: pm-srs-builder\n/);
  assert.match(s, /\ndescription:/);
});

test('pm-srs-builder documents authoring, FR/NFR ownership, derive-then-confirm, and PRD migration', () => {
  const s = read('skills/pm-srs-builder/SKILL.md');
  assert.match(s, /\.product\/srs\/srs\.md/);
  assert.match(s, /FR-NNN/);
  assert.match(s, /NFR-NNN/);
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /migrat/i);
});

test('pm-srs command exists and routes to the skill', () => {
  const s = read('commands/pm-srs.md');
  assert.match(s, /pm-srs/);
});

test('pm-prd-builder and pm-sdd-builder document SRS mode', () => {
  const prd = read('skills/pm-prd-builder/SKILL.md');
  assert.match(prd, /SRS/);
  assert.match(prd, /\.product\/srs\/srs\.md/);
  const sdd = read('skills/pm-sdd-builder/SKILL.md');
  assert.match(sdd, /SRS/);
  assert.match(sdd, /\.product\/srs\/srs\.md/);
});

test('pm-product-workflow documents the optional SRS stage', () => {
  const s = read('skills/pm-product-workflow/SKILL.md');
  assert.match(s, /pm-srs-builder/);
  assert.match(s, /SRS/);
});

test('pm-doc-sync and pm-import handle the SRS', () => {
  const sync = read('skills/pm-doc-sync/SKILL.md');
  assert.match(sync, /SRS/);
  const imp = read('skills/pm-import/SKILL.md');
  assert.match(imp, /srs-template|\.product\/srs/i);
  assert.doesNotMatch(imp, /no native template/i);
});

test('concepts documents the SRS as an optional document', () => {
  const s = read('shared/references/concepts.md');
  assert.match(s, /SRS/);
  assert.match(s, /\.product\/srs\/srs\.md/);
});
