const test = require('node:test');
const assert = require('node:assert');
const m = require('../plugins/product-design-suite/scripts/mermaid-lint.js');

test('flags a semicolon in sequenceDiagram message text', () => {
  const errs = m.lintBlock('sequenceDiagram\n  A->>B: do this; then that');
  assert.ok(errs.some(e => /semicolon/.test(e)));
});

test('flags unbalanced brackets', () => {
  const errs = m.lintBlock('flowchart TD\n  A[Start --> B[End]');
  assert.ok(errs.some(e => /unbalanced/.test(e)));
});

test('flags a missing diagram type', () => {
  const errs = m.lintBlock('A --> B');
  assert.ok(errs.some(e => /diagram type/.test(e)));
});

test('passes a well-formed diagram', () => {
  assert.deepEqual(m.lintBlock('flowchart TD\n  A[Start] --> B[End]'), []);
});

test('lintMarkdown reads fenced mermaid blocks', () => {
  const md = 'text\n```mermaid\nsequenceDiagram\n  A->>B: x; y\n```\n';
  assert.ok(m.lintMarkdown(md).some(e => /semicolon/.test(e)));
});

test('lintBlock accepts requirementDiagram without type error', () => {
  const errs = m.lintBlock('requirementDiagram\n  requirement r { id: 1, text: test }');
  assert.ok(!errs.some(e => /diagram type/.test(e)), 'requirementDiagram should be recognized');
});

test('lintBlock accepts quadrantChart without type error', () => {
  const errs = m.lintBlock('quadrantChart\n  title X\n  A,B: 0.3, 0.6');
  assert.ok(!errs.some(e => /diagram type/.test(e)), 'quadrantChart should be recognized');
});

test('flags a semicolon in a sequenceDiagram Note line (005 #1)', () => {
  const errs = m.lintBlock('sequenceDiagram\n  Note over L: reachable; cached');
  assert.ok(errs.some(e => /semicolon/.test(e)));
});

test('flags a literal \\n inside a flowchart node label (005 #3)', () => {
  const errs = m.lintBlock('flowchart TD\n  A[Ingest API\\nscrub free text] --> B[End]');
  assert.ok(errs.some(e => /node label/.test(e)));
});
