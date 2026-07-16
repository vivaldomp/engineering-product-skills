const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const t = require('../plugins/product-design-suite/scripts/traceability.js');
const o = require('../plugins/product-design-suite/scripts/openui-render.js');
const d = require('../plugins/product-design-suite/scripts/mermaid-preview.js');

test('traceability over a sample workspace links PRD->SDD->ADR', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-'));
  fs.mkdirSync(path.join(dir, 'planning'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'architecture', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'planning', 'prd.md'), 'FR-001 onboarding. NFR-002 latency.');
  fs.writeFileSync(path.join(dir, 'architecture', 'sdd.md'), 'AR-001 implements FR-001.');
  fs.writeFileSync(path.join(dir, 'architecture', 'adr', 'ADR-001-x.md'), 'Decision impacting FR-001.');
  const m = t.buildMatrix(t.loadProduct(dir));
  const fr = m.requirements.find(r => r.id === 'FR-001');
  assert.equal(fr.inSdd, true);
  assert.deepEqual(fr.adrs, ['ADR-001']);
  assert.equal(m.requirements.find(r => r.id === 'NFR-002').inSdd, false);
});

test('renderers produce self-contained html', () => {
  const ui = o.renderOpenUI('root = Section([h])\nh = Heading("Hi")');
  const dg = d.renderPreview(d.extractMermaidBlocks('```mermaid\nflowchart TD\n A-->B\n```'), { mermaidJs: '/*m*/' });
  for (const html of [ui, dg]) {
    assert.match(html, /<!DOCTYPE html>/);
    assert.ok(!/(src|href)=("|')https?:\/\//.test(html));
  }
});
