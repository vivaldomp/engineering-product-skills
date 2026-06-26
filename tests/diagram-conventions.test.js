const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'plugins/product-design-suite');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('sdd-template uses inline mermaid for C4 and sequence diagrams', () => {
  const t = read('shared/templates/sdd-template.md');
  assert.match(t, /```mermaid/);
  assert.match(t, /C4Container/);
  assert.match(t, /sequenceDiagram/);
  assert.match(t, /stateDiagram-v2/);
  // The old HTML-render placeholder phrasing is gone:
  assert.ok(!/Insert or reference the C4 context diagram/.test(t));
});

test('structures.md ships a mermaid diagram archetype catalog', () => {
  const s = read('shared/references/structures.md');
  assert.match(s, /Diagram archetypes \(Mermaid\)/);
  assert.match(s, /C4Container/);
  assert.match(s, /sequenceDiagram/);
  assert.match(s, /erDiagram/);
  assert.match(s, /trust boundary/i);
  // expanded export subfolders documented:
  assert.match(s, /state\//);
});

test('egp-sdd-builder uses mermaid-preview and inline diagrams, not diagram-render', () => {
  const s = read('skills/egp-sdd-builder/SKILL.md');
  assert.match(s, /mermaid-preview\.js/);
  assert.match(s, /inline/i);
  assert.ok(!/diagram-render/.test(s));
});

test('egp-product-workflow preview step references mermaid-preview', () => {
  const w = read('skills/egp-product-workflow/SKILL.md');
  assert.match(w, /mermaid-preview\.js/);
});

test('sad/sdd builders distinguish derived vs net-new diagram approval (B1/B3)', () => {
  for (const skill of ['skills/egp-sad-builder/SKILL.md', 'skills/egp-sdd-builder/SKILL.md']) {
    const s = read(skill);
    assert.match(s, /net-new/i);
    assert.match(s, /batch-confirm|faithful conversion|derived/i);
  }
});
