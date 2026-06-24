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
