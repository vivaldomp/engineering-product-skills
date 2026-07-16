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
  assert.match(s, /AR-NNN/);
  assert.match(s, /C4Context/);
});

test('egp-sad-builder skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/egp-sad-builder/SKILL.md');
  assert.match(s, /^---\nname: egp-sad-builder\n/);
  assert.match(s, /\ndescription:/);
});

test('egp-sad-builder documents authoring, AR ownership, derive-then-confirm, and SDD migration', () => {
  const s = read('skills/egp-sad-builder/SKILL.md');
  assert.match(s, /workspace\/outputs\/current\/architecture\/sad\.md/);
  assert.match(s, /AR-NNN/);
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /migrat/i);
});

test('egp-sad command exists and routes to the skill', () => {
  const s = read('commands/egp-sad.md');
  assert.match(s, /egp-sad/);
});

test('egp-sdd-builder documents SAD mode', () => {
  const sdd = read('skills/egp-sdd-builder/SKILL.md');
  assert.match(sdd, /SAD/);
  assert.match(sdd, /workspace\/outputs\/current\/architecture\/sad\.md/);
});

test('egp-product-workflow documents the optional SAD stage', () => {
  const s = read('skills/egp-product-workflow/SKILL.md');
  assert.match(s, /egp-sad-builder/);
  assert.match(s, /SAD/);
});

test('egp-doc-sync and egp-import handle the SAD', () => {
  const sync = read('skills/egp-doc-sync/SKILL.md');
  assert.match(sync, /SAD/);
  const imp = read('skills/egp-import/SKILL.md');
  assert.match(imp, /sad-template|architecture\/sad/i);
});

test('adr-template documents the related-sad field', () => {
  const adr = read('shared/templates/adr-template.md');
  assert.match(adr, /related-sad/);
});

test('concepts documents the SAD as an optional document', () => {
  const s = read('shared/references/concepts.md');
  assert.match(s, /SAD/);
  assert.match(s, /workspace\/outputs\/current\/architecture\/sad\.md/);
});

test('questioning-protocol mandates an interactive finalize-with-gaps checkpoint (007 #5)', () => {
  const s = read('shared/references/questioning-protocol.md');
  assert.match(s, /before finaliz/i, 'must require a checkpoint before finalizing with gaps');
  assert.match(s, /interactive|question UI|multiple-choice/i, 'checkpoint must be an explicit interactive prompt');
  assert.match(s, /derive-then-confirm|batch/i, 'must apply beyond greenfield');
});

test('egp-sad-builder requires render-verify before the approval link and a C4 fallback (007)', () => {
  const s = read('skills/egp-sad-builder/SKILL.md');
  assert.match(s, /--verify/, 'gate must run mermaid-preview.js --verify');
  assert.match(s, /render NOT verified|no browser found/, 'must document the no-browser fallback');
  assert.match(s, /flowchart[^\n]*subgraph|subgraph[^\n]*boundar/i, 'must document the C4→flowchart fallback');
});
