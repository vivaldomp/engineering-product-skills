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

test('sad-template has front-matter with the five metadata fields', () => {
  const text = read('shared/templates/sad-template.md');
  assert.ok(text.startsWith('---\n'), 'sad-template must start with front-matter');
  const fm = frontMatter(text);
  assert.ok(fm, 'sad-template must have a closing --- delimiter');
  for (const key of ['title', 'status', 'version', 'owner', 'date']) {
    assert.match(fm, new RegExp('^' + key + ':', 'm'), `sad front-matter needs ${key}`);
  }
});

test('sad-template documents the AR table and C4/architecture sections', () => {
  const s = read('shared/templates/sad-template.md');
  assert.match(s, /## 1\. Introduction/);
  assert.match(s, /## 2\. Architectural Drivers and Requirements/);
  assert.match(s, /## 3\. System Context/);
  assert.match(s, /## 4\. Container and Infrastructure/);
  assert.match(s, /## 5\. Data Flow and Integration Patterns/);
  assert.match(s, /## 6\. Security and Compliance Architecture/);
  assert.match(s, /AR-001/);
  assert.match(s, /C4Context/);
});

test('pm-sad-builder skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/pm-sad-builder/SKILL.md');
  assert.match(s, /^---\nname: pm-sad-builder\n/);
  assert.match(s, /\ndescription:/);
});

test('pm-sad-builder documents authoring, AR ownership, derive-then-confirm, and SDD migration', () => {
  const s = read('skills/pm-sad-builder/SKILL.md');
  assert.match(s, /\.product\/sad\/sad\.md/);
  assert.match(s, /AR-NNN/);
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /migrat/i);
});

test('pm-sad command exists and routes to the skill', () => {
  const s = read('commands/pm-sad.md');
  assert.match(s, /pm-sad/);
});

test('pm-sdd-builder documents SAD mode', () => {
  const sdd = read('skills/pm-sdd-builder/SKILL.md');
  assert.match(sdd, /SAD/);
  assert.match(sdd, /\.product\/sad\/sad\.md/);
});

test('pm-product-workflow documents the optional SAD stage', () => {
  const s = read('skills/pm-product-workflow/SKILL.md');
  assert.match(s, /pm-sad-builder/);
  assert.match(s, /SAD/);
});

test('pm-doc-sync and pm-import handle the SAD', () => {
  const sync = read('skills/pm-doc-sync/SKILL.md');
  assert.match(sync, /SAD/);
  const imp = read('skills/pm-import/SKILL.md');
  assert.match(imp, /sad-template|\.product\/sad/i);
});

test('adr-template documents the related-sad field', () => {
  const adr = read('shared/templates/adr-template.md');
  assert.match(adr, /related-sad/);
});

test('concepts documents the SAD as an optional document', () => {
  const s = read('shared/references/concepts.md');
  assert.match(s, /SAD/);
  assert.match(s, /\.product\/sad\/sad\.md/);
});
