# product-design-suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a distributable Claude Code marketplace plugin (`product-design-suite`) of Agent Skills that guides a PM through a sequential PRD → SDD → ADR workflow with cross-document sync and framework-free HTML visualizations.

**Architecture:** A marketplace repo (`engineering-product-skills`) containing one plugin with five `egp-`-prefixed skills (orchestrator + 3 builders + sync), thin slash-command wrappers, a shared knowledge layer (the existing `concepts.md`/`structures.md`/`templates/`), and three new Node renderers plus the reused superpowers preview server. Skills emit artifacts into `.product/`.

**Tech Stack:** Markdown (skills, references, templates, commands), JSON (manifests), Node.js ≥ 18 CommonJS scripts (`traceability.js`, `diagram-render.js`, `openui-render.js`) tested with the built-in `node:test` runner, and self-contained HTML/CSS/inline-JS output.

## Global Constraints

- All **generated** non-Markdown artifacts must be HTML + CSS + **inline** JS only — no CDN, no framework, must open offline in major browsers. (Dev tooling in `scripts/`/`tools/` may use Node.)
- Node.js ≥ 18; tests use the built-in `node:test` runner — **no external test dependencies**.
- Every skill directory name MUST equal its `SKILL.md` `name` field and be prefixed `egp-` (Agent Skills rule).
- `SKILL.md` frontmatter: `name` ≤ 64 chars, lowercase alphanumeric + single hyphens, no leading/trailing/double hyphen; `description` non-empty ≤ 1024 chars.
- Keep each `SKILL.md` body focused; detailed material lives in `shared/references/` and is loaded on demand.
- Author identity everywhere: `Vivaldo <vivaldomp@gmail.com>`.
- Plugin name `product-design-suite`; marketplace name `engineering-product-skills`; plugin version `0.1.0`.
- Skills reference shared files as `${CLAUDE_PLUGIN_ROOT}/shared/...` and scripts as `${CLAUDE_PLUGIN_ROOT}/scripts/...`.

---

## File Structure

**Repo root (`engineering-product-skills/`):**
- `.claude-plugin/marketplace.json` — marketplace manifest
- `tools/validate-plugin.js` — dev validator (manifests + skills)
- `tests/*.test.js` — unit tests (node:test), kept out of the shipped plugin
- `docs/superpowers/specs/2026-06-23-product-design-suite-design.md` — the approved spec (exists)

**Plugin (`plugins/product-design-suite/`):**
- `.claude-plugin/plugin.json`
- `skills/egp-product-workflow/SKILL.md` — orchestrator
- `skills/egp-prd-builder/SKILL.md`, `skills/egp-sdd-builder/SKILL.md`, `skills/egp-adr-builder/SKILL.md`
- `skills/egp-doc-sync/SKILL.md`
- `commands/egp-prd.md`, `egp-sdd.md`, `egp-adr.md`, `egp-product.md`
- `shared/references/{concepts.md,structures.md,questioning-protocol.md,openui-guide.md}`
- `shared/templates/{prd-template.md,sdd-template.md,adr-template.md}`
- `scripts/{traceability.js,diagram-render.js,openui-render.js}` + reused `{preview-server.cjs,start-server.sh,stop-server.sh,frame-template.html,helper.js}`

**Setup before Task 1:** create a working branch off the default branch.

```bash
git checkout -b feat/product-design-suite
```

---

### Task 1: Scaffold repo, move shared content, write manifests

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/product-design-suite/.claude-plugin/plugin.json`
- Create: `README.md`
- Move: `concepts.md` → `plugins/product-design-suite/shared/references/concepts.md`
- Move: `structures.md` → `plugins/product-design-suite/shared/references/structures.md`
- Move: `templates/*.md` → `plugins/product-design-suite/shared/templates/*.md`

**Interfaces:**
- Produces: marketplace at `.claude-plugin/marketplace.json` with keys `name`, `owner`, `plugins`; plugin manifest at `plugins/product-design-suite/.claude-plugin/plugin.json` with keys `name`, `version`, `description`, `author`. Consumed by Task 2's validator and all skill tasks (shared paths).

- [x] **Step 1: Create directory tree and move existing content**

```bash
cd "$(git rev-parse --show-toplevel)"
mkdir -p plugins/product-design-suite/.claude-plugin \
         plugins/product-design-suite/skills \
         plugins/product-design-suite/commands \
         plugins/product-design-suite/shared/references \
         plugins/product-design-suite/shared/templates \
         plugins/product-design-suite/scripts \
         tools tests
mv concepts.md   plugins/product-design-suite/shared/references/concepts.md
mv structures.md plugins/product-design-suite/shared/references/structures.md
mv templates/prd-template.md plugins/product-design-suite/shared/templates/prd-template.md
mv templates/sdd-template.md plugins/product-design-suite/shared/templates/sdd-template.md
mv templates/adr-template.md plugins/product-design-suite/shared/templates/adr-template.md
rmdir templates 2>/dev/null || true
```

- [x] **Step 2: Write the marketplace manifest**

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "engineering-product-skills",
  "owner": { "name": "Vivaldo", "email": "vivaldomp@gmail.com" },
  "plugins": [
    {
      "name": "product-design-suite",
      "source": "./plugins/product-design-suite",
      "description": "Guided PRD/SDD/ADR product-design workflow with cross-document sync and framework-free HTML visualizations."
    }
  ]
}
```

- [x] **Step 3: Write the plugin manifest**

Create `plugins/product-design-suite/.claude-plugin/plugin.json`:

```json
{
  "name": "product-design-suite",
  "version": "0.1.0",
  "description": "Drives a Product Manager through a sequential PRD -> SDD -> ADR workflow: gap-only questioning, cross-document sync, and lightweight framework-free HTML diagrams and UI mockups, stored in .product/.",
  "author": { "name": "Vivaldo", "email": "vivaldomp@gmail.com" }
}
```

- [x] **Step 4: Write a minimal README**

Create `README.md`:

```markdown
# engineering-product-skills

Claude Code marketplace containing the **product-design-suite** plugin — a set of
Agent Skills that guide Product Managers through a sequential PRD -> SDD -> ADR
workflow with cross-document sync and framework-free HTML visualizations.

## Install
Add this repo as a plugin marketplace in Claude Code, then install
`product-design-suite`.

## Skills
- `egp-product-workflow` — orchestrator (sequence + question cadence)
- `egp-prd-builder`, `egp-sdd-builder`, `egp-adr-builder` — artifact builders
- `egp-doc-sync` — cross-document impact + sync

## Commands
`/egp-product`, `/egp-prd`, `/egp-sdd`, `/egp-adr`

Generated artifacts are written to `.product/`.

## Development
Run validation and tests:
\`\`\`bash
node tools/validate-plugin.js .
node --test tests/
\`\`\`
```

- [x] **Step 5: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); JSON.parse(require('fs').readFileSync('plugins/product-design-suite/.claude-plugin/plugin.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`

- [x] **Step 6: Verify the move succeeded**

Run: `test -f plugins/product-design-suite/shared/references/concepts.md && test -f plugins/product-design-suite/shared/templates/prd-template.md && test ! -f concepts.md && echo MOVED_OK`
Expected: `MOVED_OK`

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold marketplace, plugin manifest, move shared content"
```

---

### Task 2: Dev validator (`tools/validate-plugin.js`)

**Files:**
- Create: `tools/validate-plugin.js`
- Test: `tests/validate-plugin.test.js`

**Interfaces:**
- Produces (CommonJS exports): `parseFrontmatter(src) -> object|null`, `validateSkill(dir) -> string[]`, `validateJson(path, requiredKeys) -> string[]`, `validatePlugin(root) -> string[]`. CLI: `node tools/validate-plugin.js <root>` exits non-zero on errors. Consumed by Tasks 8–10 and 12 to validate skills.

- [x] **Step 1: Write the failing test**

Create `tests/validate-plugin.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const v = require('../tools/validate-plugin.js');

test('parseFrontmatter reads name and description', () => {
  const fm = v.parseFrontmatter('---\nname: egp-prd-builder\ndescription: Build a PRD\n---\nbody');
  assert.equal(fm.name, 'egp-prd-builder');
  assert.equal(fm.description, 'Build a PRD');
});

test('validateSkill flags name != dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  const skill = path.join(dir, 'egp-prd-builder');
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: wrong-name\ndescription: x\n---\n');
  const errs = v.validateSkill(skill);
  assert.ok(errs.some(e => /!=/.test(e)), errs.join(';'));
});

test('validateSkill passes a correct skill', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  const skill = path.join(dir, 'egp-adr-builder');
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: egp-adr-builder\ndescription: Build an ADR\n---\n');
  assert.deepEqual(v.validateSkill(skill), []);
});

test('validateJson flags missing keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  const p = path.join(dir, 'm.json');
  fs.writeFileSync(p, JSON.stringify({ name: 'x' }));
  const errs = v.validateJson(p, ['name', 'owner']);
  assert.ok(errs.some(e => /owner/.test(e)));
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/validate-plugin.test.js`
Expected: FAIL — `Cannot find module '../tools/validate-plugin.js'`

- [x] **Step 3: Implement the validator**

Create `tools/validate-plugin.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) obj[mm[1]] = mm[2].trim();
  }
  return obj;
}

function validateSkill(dir) {
  const errors = [];
  const skillPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return [`missing SKILL.md in ${dir}`];
  const fm = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
  if (!fm) return [`${dir}: no frontmatter`];
  const name = fm.name;
  if (!name) errors.push(`${dir}: missing name`);
  else {
    if (name.length > 64) errors.push(`${dir}: name >64 chars`);
    if (!NAME_RE.test(name)) errors.push(`${dir}: name not lowercase-hyphen`);
    if (name !== path.basename(dir)) errors.push(`${dir}: name '${name}' != dir '${path.basename(dir)}'`);
  }
  if (!fm.description) errors.push(`${dir}: missing description`);
  else if (fm.description.length > 1024) errors.push(`${dir}: description >1024 chars`);
  return errors;
}

function validateJson(p, required) {
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return [`${p}: invalid JSON (${e.message})`]; }
  return required.filter(k => !(k in data)).map(k => `${p}: missing '${k}'`);
}

function validatePlugin(root) {
  const errors = [];
  errors.push(...validateJson(path.join(root, '.claude-plugin/marketplace.json'), ['name', 'owner', 'plugins']));
  const pluginDir = path.join(root, 'plugins/product-design-suite');
  errors.push(...validateJson(path.join(pluginDir, '.claude-plugin/plugin.json'), ['name', 'version', 'description']));
  const skillsDir = path.join(pluginDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir)) {
      const full = path.join(skillsDir, d);
      if (fs.statSync(full).isDirectory()) errors.push(...validateSkill(full));
    }
  }
  return errors;
}

module.exports = { parseFrontmatter, validateSkill, validateJson, validatePlugin };

if (require.main === module) {
  const root = process.argv[2] || '.';
  const errs = validatePlugin(root);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('OK: plugin valid');
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/validate-plugin.test.js`
Expected: PASS (4 tests)

- [x] **Step 5: Run the validator against the real repo**

Run: `node tools/validate-plugin.js .`
Expected: `OK: plugin valid` (no skills yet — manifests validate; skills checked as added)

- [x] **Step 6: Commit**

```bash
git add tools/validate-plugin.js tests/validate-plugin.test.js
git commit -m "feat: add plugin/skill validator with tests"
```

---

### Task 3: `traceability.js` — ID extraction + matrix

**Files:**
- Create: `plugins/product-design-suite/scripts/traceability.js`
- Test: `tests/traceability.test.js`

**Interfaces:**
- Produces (CommonJS exports): `extractIds(text) -> string[]`; `buildMatrix({prd, sdd, adrs}) -> Array<{id, inSdd, adrs}>` where `adrs` input is `{ 'ADR-001': text }`; `renderMatrixMarkdown(rows) -> string`; `renderMatrixHtml(rows) -> string`; `loadProduct(dir) -> {prd, sdd, adrs}`. CLI writes `<dir>/traceability.md` and `<dir>/traceability.html`. Consumed by `egp-doc-sync` (Task 9).

- [x] **Step 1: Write the failing test**

Create `tests/traceability.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const t = require('../plugins/product-design-suite/scripts/traceability.js');

test('extractIds finds unique typed ids', () => {
  const ids = t.extractIds('See FR-001 and FR-001 and ADR-003 and noise FRX-9');
  assert.deepEqual(ids.sort(), ['ADR-003', 'FR-001']);
});

test('buildMatrix links requirement to sdd and adrs', () => {
  const rows = t.buildMatrix({
    prd: 'FR-001 do a thing. NFR-002 be fast.',
    sdd: 'Implements FR-001 in section 4.',
    adrs: { 'ADR-003': 'Decision affecting FR-001.' },
  });
  const fr = rows.find(r => r.id === 'FR-001');
  assert.equal(fr.inSdd, true);
  assert.deepEqual(fr.adrs, ['ADR-003']);
  const nfr = rows.find(r => r.id === 'NFR-002');
  assert.equal(nfr.inSdd, false);
  assert.deepEqual(nfr.adrs, []);
});

test('renderMatrixMarkdown and Html include the id', () => {
  const rows = t.buildMatrix({ prd: 'FR-001 x', sdd: '', adrs: {} });
  assert.match(t.renderMatrixMarkdown(rows), /FR-001/);
  assert.match(t.renderMatrixHtml(rows), /<table/);
  assert.match(t.renderMatrixHtml(rows), /FR-001/);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — cannot find module `traceability.js`

- [x] **Step 3: Implement the script**

Create `plugins/product-design-suite/scripts/traceability.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function extractIds(text) {
  const re = /\b(?:FR|BR|NFR|AR|UAT|ADR)-\d+\b/g;
  return [...new Set((text || '').match(re) || [])];
}

function buildMatrix({ prd = '', sdd = '', adrs = {} } = {}) {
  const prdIds = extractIds(prd).filter(id => /^(FR|BR|NFR)-/.test(id));
  return prdIds.map(id => ({
    id,
    inSdd: sdd.includes(id),
    adrs: Object.entries(adrs).filter(([, txt]) => txt.includes(id)).map(([a]) => a),
  }));
}

function renderMatrixMarkdown(rows) {
  const head = '| Requirement | In SDD | Related ADRs |\n| --- | --- | --- |';
  const body = rows.map(r =>
    `| ${r.id} | ${r.inSdd ? 'yes' : 'NO'} | ${r.adrs.join(', ') || '-'} |`).join('\n');
  return `# Traceability Matrix\n\n${head}\n${body}\n`;
}

function renderMatrixHtml(rows) {
  const trs = rows.map(r =>
    `<tr><td>${r.id}</td><td class="${r.inSdd ? 'ok' : 'gap'}">${r.inSdd ? 'yes' : 'NO'}</td><td>${r.adrs.join(', ') || '-'}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Traceability Matrix</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.4rem .6rem}.gap{color:#b00;font-weight:bold}.ok{color:#070}</style>
</head><body><h1>Traceability Matrix</h1>
<table><thead><tr><th>Requirement</th><th>In SDD</th><th>Related ADRs</th></tr></thead>
<tbody>${trs}</tbody></table></body></html>`;
}

function loadProduct(dir) {
  const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const adrDir = path.join(dir, 'adr');
  const adrs = {};
  if (fs.existsSync(adrDir)) {
    for (const f of fs.readdirSync(adrDir)) {
      if (f.endsWith('.md')) {
        const m = f.match(/ADR-\d+/);
        adrs[m ? m[0] : f] = read(path.join(adrDir, f));
      }
    }
  }
  return { prd: read(path.join(dir, 'prd', 'prd.md')), sdd: read(path.join(dir, 'sdd', 'sdd.md')), adrs };
}

module.exports = { extractIds, buildMatrix, renderMatrixMarkdown, renderMatrixHtml, loadProduct };

if (require.main === module) {
  const dir = process.argv[2] || '.product';
  const rows = buildMatrix(loadProduct(dir));
  fs.writeFileSync(path.join(dir, 'traceability.md'), renderMatrixMarkdown(rows));
  fs.writeFileSync(path.join(dir, 'traceability.html'), renderMatrixHtml(rows));
  console.log(`Wrote traceability for ${rows.length} requirements.`);
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/traceability.test.js`
Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: add traceability matrix builder with tests"
```

---

### Task 4: `diagram-render.js` — compact spec → inline-SVG HTML

**Files:**
- Create: `plugins/product-design-suite/scripts/diagram-render.js`
- Test: `tests/diagram-render.test.js`

**Interfaces:**
- Produces (CommonJS exports): `renderSvg(spec) -> string` and `renderDiagram(spec) -> string` (full self-contained HTML). `spec = { title, nodes:[{id,label,kind}], edges:[{from,to,label}] }`. CLI: `node diagram-render.js <spec.json> <out.html>`. Consumed by `egp-sdd-builder` (Task 8).

- [x] **Step 1: Write the failing test**

Create `tests/diagram-render.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const d = require('../plugins/product-design-suite/scripts/diagram-render.js');

const spec = {
  title: 'C4 Context',
  nodes: [{ id: 'u', label: 'User', kind: 'person' }, { id: 's', label: 'System', kind: 'system' }],
  edges: [{ from: 'u', to: 's', label: 'uses' }],
};

test('renderSvg emits an svg with node labels and an arrow marker', () => {
  const svg = d.renderSvg(spec);
  assert.match(svg, /<svg/);
  assert.match(svg, /User/);
  assert.match(svg, /System/);
  assert.match(svg, /marker id="arrow"/);
  assert.match(svg, /uses/);
});

test('renderDiagram wraps svg in self-contained html with no external src', () => {
  const html = d.renderDiagram(spec);
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /C4 Context/);
  assert.ok(!/src=("|')http/.test(html), 'must not load external resources');
});

test('escapes angle brackets in labels', () => {
  const svg = d.renderSvg({ nodes: [{ id: 'a', label: '<b>x</b>' }], edges: [] });
  assert.ok(!svg.includes('<b>x</b>'));
  assert.match(svg, /&lt;b&gt;/);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/diagram-render.test.js`
Expected: FAIL — cannot find module `diagram-render.js`

- [x] **Step 3: Implement the script**

Create `plugins/product-design-suite/scripts/diagram-render.js`:

```js
const NODE_W = 160, NODE_H = 70, GAP = 70, PAD = 40;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function layout(nodes) {
  return nodes.map((n, i) => ({ ...n, x: PAD + i * (NODE_W + GAP), y: PAD }));
}

function renderSvg(spec) {
  const nodes = layout(spec.nodes || []);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const count = Math.max(nodes.length, 1);
  const width = PAD * 2 + count * NODE_W + (count - 1) * GAP;
  const height = PAD * 2 + NODE_H + 40;
  const edges = (spec.edges || []).map(e => {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) return '';
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
    const x2 = b.x, y2 = b.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    const label = e.label ? `<text x="${mx}" y="${y1 - 8}" text-anchor="middle" font-size="11" fill="#555">${esc(e.label)}</text>` : '';
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#888" marker-end="url(#arrow)"/>${label}`;
  }).join('');
  const boxes = nodes.map(n =>
    `<g><rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="#eef3fb" stroke="#3b6ea5"/>` +
    `<text x="${n.x + NODE_W / 2}" y="${n.y + NODE_H / 2 - 4}" text-anchor="middle" font-size="13" font-weight="bold">${esc(n.label)}</text>` +
    `<text x="${n.x + NODE_W / 2}" y="${n.y + NODE_H / 2 + 14}" text-anchor="middle" font-size="10" fill="#666">${esc(n.kind || '')}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>` +
    `${edges}${boxes}</svg>`;
}

function renderDiagram(spec) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(spec.title || 'Diagram')}</title>` +
    `<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#fff}h1{font-size:1.2rem}</style></head>` +
    `<body><h1>${esc(spec.title || 'Diagram')}</h1>${renderSvg(spec)}</body></html>`;
}

module.exports = { renderSvg, renderDiagram };

if (require.main === module) {
  const fs = require('node:fs');
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) { console.error('usage: diagram-render.js <spec.json> <out.html>'); process.exit(1); }
  fs.writeFileSync(outPath, renderDiagram(JSON.parse(fs.readFileSync(specPath, 'utf8'))));
  console.log(`Wrote ${outPath}`);
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/diagram-render.test.js`
Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/diagram-render.js tests/diagram-render.test.js
git commit -m "feat: add inline-SVG diagram renderer with tests"
```

---

### Task 5: `openui-render.js` — OpenUI Lang → self-contained HTML

**Files:**
- Create: `plugins/product-design-suite/scripts/openui-render.js`
- Test: `tests/openui-render.test.js`

**Interfaces:**
- Produces (CommonJS exports): `parseOpenUI(src) -> {rootId, defs}` (defs maps id → AST node); `renderOpenUI(src) -> string` (self-contained HTML). Supported components: `Root, Section, Grid, Card, Navbar, Link, StatCard, Heading, Text, Button, Input, Form`. CLI: `node openui-render.js <in.openui> <out.html>`. Consumed by `egp-sdd-builder`/`egp-prd-builder` (Tasks 8/8a) and `openui-guide.md` (Task 7).

- [x] **Step 1: Write the failing test**

Create `tests/openui-render.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const o = require('../plugins/product-design-suite/scripts/openui-render.js');

test('parseOpenUI resolves root and a call node', () => {
  const { rootId, defs } = o.parseOpenUI('root = Root([h])\nh = Heading("Hello")');
  assert.equal(rootId, 'root');
  assert.equal(defs.root.t, 'call');
  assert.equal(defs.root.type, 'Root');
  assert.equal(defs.h.type, 'Heading');
});

test('renderOpenUI renders nested components and text', () => {
  const html = o.renderOpenUI('root = Root([nav, body])\nnav = Navbar("Acme", [l1])\nl1 = Link("Home", "/")\nbody = Section([h, b])\nh = Heading("Dashboard")\nb = Button("Save")');
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /Acme/);
  assert.match(html, /Dashboard/);
  assert.match(html, /<button[^>]*>Save<\/button>/);
  assert.match(html, /href="\/"/);
  assert.ok(!/src=("|')http/.test(html), 'no external resources');
});

test('renders a StatCard grid', () => {
  const html = o.renderOpenUI('root = Grid([s1, s2])\ns1 = StatCard("Revenue", "$1.2M", "up")\ns2 = StatCard("Users", "450k", "flat")');
  assert.match(html, /Revenue/);
  assert.match(html, /\$1\.2M/);
  assert.match(html, /450k/);
});

test('escapes HTML in text', () => {
  const html = o.renderOpenUI('root = Heading("<script>x</script>")');
  assert.ok(!/<script>x<\/script>/.test(html));
  assert.match(html, /&lt;script&gt;/);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/openui-render.test.js`
Expected: FAIL — cannot find module `openui-render.js`

- [x] **Step 3: Implement the parser + renderer**

Create `plugins/product-design-suite/scripts/openui-render.js`:

```js
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- expression parser: string | number | bool | null | array | object | call | ref ---
class P {
  constructor(s) { this.s = s; this.i = 0; }
  ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }
  value() {
    this.ws();
    const c = this.s[this.i];
    if (c === '"') return this.string();
    if (c === '[') return this.array();
    if (c === '{') return this.object();
    if (c === '-' || (c >= '0' && c <= '9')) return this.number();
    const id = this.ident();
    if (id === 'true') return { t: 'bool', v: true };
    if (id === 'false') return { t: 'bool', v: false };
    if (id === 'null') return { t: 'null' };
    this.ws();
    if (this.s[this.i] === '(') return { t: 'call', type: id, args: this.argList() };
    return { t: 'ref', name: id };
  }
  string() { this.i++; let out = ''; while (this.s[this.i] && this.s[this.i] !== '"') { if (this.s[this.i] === '\\') this.i++; out += this.s[this.i++]; } this.i++; return { t: 'str', v: out }; }
  number() { const st = this.i; if (this.s[this.i] === '-') this.i++; while (/[0-9.]/.test(this.s[this.i])) this.i++; return { t: 'num', v: Number(this.s.slice(st, this.i)) }; }
  ident() { this.ws(); const st = this.i; while (/[A-Za-z0-9_]/.test(this.s[this.i])) this.i++; return this.s.slice(st, this.i); }
  array() { this.i++; const a = []; this.ws(); if (this.s[this.i] === ']') { this.i++; return { t: 'arr', items: a }; } while (true) { a.push(this.value()); this.ws(); if (this.s[this.i] === ',') { this.i++; continue; } break; } this.ws(); if (this.s[this.i] === ']') this.i++; return { t: 'arr', items: a }; }
  object() { this.i++; const o = {}; this.ws(); if (this.s[this.i] === '}') { this.i++; return { t: 'obj', entries: o }; } while (true) { const k = this.ident(); this.ws(); if (this.s[this.i] === ':') this.i++; o[k] = this.value(); this.ws(); if (this.s[this.i] === ',') { this.i++; continue; } break; } this.ws(); if (this.s[this.i] === '}') this.i++; return { t: 'obj', entries: o }; }
  argList() { this.i++; const a = []; this.ws(); if (this.s[this.i] === ')') { this.i++; return a; } while (true) { a.push(this.value()); this.ws(); if (this.s[this.i] === ',') { this.i++; continue; } break; } this.ws(); if (this.s[this.i] === ')') this.i++; return a; }
}

function parseOpenUI(src) {
  const defs = {};
  let rootId = null;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const id = line.slice(0, eq).trim();
    defs[id] = new P(line.slice(eq + 1)).value();
    if (rootId === null) rootId = id;
  }
  if (defs.root) rootId = 'root';
  return { rootId, defs };
}

function resolve(node, defs) {
  let n = node, guard = 0;
  while (n && n.t === 'ref' && guard++ < 100) n = defs[n.name];
  return n;
}
function txt(node, defs) {
  const n = resolve(node, defs);
  if (!n) return '';
  if (n.t === 'str') return esc(n.v);
  if (n.t === 'num' || n.t === 'bool') return esc(n.v);
  return renderNode(n, defs);
}
function kids(node, defs) {
  const n = resolve(node, defs);
  if (!n) return '';
  if (n.t === 'arr') return n.items.map(x => renderNode(x, defs)).join('');
  return renderNode(n, defs);
}

const COMPONENTS = {
  Root: (a, d) => `<div class="ui-root">${kids(a[0], d)}</div>`,
  Section: (a, d) => `<section class="ui-section">${kids(a[0], d)}</section>`,
  Grid: (a, d) => `<div class="ui-grid">${kids(a[0], d)}</div>`,
  Card: (a, d) => `<div class="ui-card">${a.map(x => renderNode(x, d)).join('')}</div>`,
  Navbar: (a, d) => `<nav class="ui-nav"><span class="ui-brand">${txt(a[0], d)}</span><span class="ui-links">${kids(a[1], d)}</span></nav>`,
  Link: (a, d) => `<a class="ui-link" href="${txt(a[1], d) || '#'}">${txt(a[0], d)}</a>`,
  StatCard: (a, d) => `<div class="ui-stat"><div class="ui-stat-label">${txt(a[0], d)}</div><div class="ui-stat-value">${txt(a[1], d)}</div><div class="ui-stat-trend">${txt(a[2], d)}</div></div>`,
  Heading: (a, d) => `<h2 class="ui-heading">${txt(a[0], d)}</h2>`,
  Text: (a, d) => `<p class="ui-text">${txt(a[0], d)}</p>`,
  Button: (a, d) => `<button class="ui-btn">${txt(a[0], d)}</button>`,
  Input: (a, d) => `<label class="ui-field"><span>${txt(a[0], d)}</span><input placeholder="${txt(a[1], d)}"/></label>`,
  Form: (a, d) => `<form class="ui-form">${kids(a[0], d)}</form>`,
};

function renderNode(node, defs) {
  const n = resolve(node, defs);
  if (!n) return '';
  switch (n.t) {
    case 'str': return esc(n.v);
    case 'num': case 'bool': return esc(n.v);
    case 'arr': return n.items.map(x => renderNode(x, defs)).join('');
    case 'call': {
      const fn = COMPONENTS[n.type];
      return fn ? fn(n.args, defs) : `<!-- unknown component ${esc(n.type)} -->`;
    }
    default: return '';
  }
}

const CSS = `*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:#f5f7fa;color:#1c2733}
.ui-root{max-width:1024px;margin:0 auto;padding:1rem}
.ui-nav{display:flex;justify-content:space-between;align-items:center;background:#fff;padding:.75rem 1rem;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:1rem}
.ui-brand{font-weight:700}.ui-links a{margin-left:1rem;text-decoration:none;color:#3b6ea5}
.ui-section{background:#fff;padding:1rem;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:1rem}
.ui-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
.ui-card{background:#fff;padding:1rem;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ui-stat{background:#fff;padding:1rem;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ui-stat-label{font-size:.8rem;color:#667}.ui-stat-value{font-size:1.6rem;font-weight:700}.ui-stat-trend{font-size:.8rem;color:#888}
.ui-heading{margin:.2rem 0 .8rem}.ui-btn{background:#3b6ea5;color:#fff;border:0;padding:.5rem 1rem;border-radius:6px;cursor:pointer}
.ui-field{display:block;margin:.5rem 0}.ui-field input{display:block;width:100%;padding:.5rem;border:1px solid #ccd;border-radius:6px}`;

function renderOpenUI(src) {
  const { rootId, defs } = parseOpenUI(src);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI Mockup</title><style>${CSS}</style></head><body>${renderNode(defs[rootId], defs)}</body></html>`;
}

module.exports = { parseOpenUI, renderOpenUI };

if (require.main === module) {
  const fs = require('node:fs');
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) { console.error('usage: openui-render.js <in.openui> <out.html>'); process.exit(1); }
  fs.writeFileSync(outPath, renderOpenUI(fs.readFileSync(inPath, 'utf8')));
  console.log(`Wrote ${outPath}`);
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/openui-render.test.js`
Expected: PASS (4 tests)

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/openui-render.js tests/openui-render.test.js
git commit -m "feat: add OpenUI Lang renderer with tests"
```

---

### Task 6: Reuse and adapt the superpowers preview server

**Files:**
- Create: `plugins/product-design-suite/scripts/preview-server.cjs` (from superpowers `server.cjs`)
- Create: `plugins/product-design-suite/scripts/start-server.sh`, `stop-server.sh`, `frame-template.html`, `helper.js` (from superpowers)
- Test: `tests/preview-server.test.js`

**Interfaces:**
- Consumes: `renderOpenUI` and `renderDiagram` (Tasks 4–5) for preview content.
- Produces: a runnable preview server; verified here only by a non-network smoke test (syntax loads + frame template references no external URLs). Consumed by `egp-product-workflow` (Task 10) for live iteration.

- [x] **Step 1: Copy the reused files**

```bash
SRC=/home/vivaldo/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/skills/brainstorming/scripts
DST=plugins/product-design-suite/scripts
cp "$SRC/server.cjs"          "$DST/preview-server.cjs"
cp "$SRC/start-server.sh"     "$DST/start-server.sh"
cp "$SRC/stop-server.sh"      "$DST/stop-server.sh"
cp "$SRC/frame-template.html" "$DST/frame-template.html"
cp "$SRC/helper.js"           "$DST/helper.js"
chmod +x "$DST/start-server.sh" "$DST/stop-server.sh"
```

- [x] **Step 2: Write the failing smoke test**

Create `tests/preview-server.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const dir = path.join('plugins/product-design-suite/scripts');

test('preview-server.cjs parses without syntax errors', () => {
  const r = cp.spawnSync('node', ['--check', path.join(dir, 'preview-server.cjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('frame-template.html loads no external http(s) resources', () => {
  const html = fs.readFileSync(path.join(dir, 'frame-template.html'), 'utf8');
  assert.ok(!/(src|href)=("|')https?:\/\//.test(html), 'frame template must be self-contained');
});
```

- [x] **Step 3: Run the test to verify it fails (or passes)**

Run: `node --test tests/preview-server.test.js`
Expected: FAIL if files not yet copied, or the second test FAILS if the upstream template references external URLs.

- [x] **Step 4: If the second test fails, inline external references in `frame-template.html`**

Open `plugins/product-design-suite/scripts/frame-template.html`. For each `https?://` reference found, either remove it or replace with an inline equivalent (e.g., download a font/icon and inline it as base64, or drop the dependency). The template uses OS-aware CSS that should already be local; remove any analytics/CDN tags. Re-run until the test passes.

- [x] **Step 5: Run the test to verify it passes**

Run: `node --test tests/preview-server.test.js`
Expected: PASS (2 tests)

- [x] **Step 6: Commit**

```bash
git add plugins/product-design-suite/scripts/preview-server.cjs plugins/product-design-suite/scripts/start-server.sh plugins/product-design-suite/scripts/stop-server.sh plugins/product-design-suite/scripts/frame-template.html plugins/product-design-suite/scripts/helper.js tests/preview-server.test.js
git commit -m "feat: reuse superpowers preview server (self-contained)"
```

---

### Task 7: Shared references — questioning protocol + OpenUI guide

**Files:**
- Create: `plugins/product-design-suite/shared/references/questioning-protocol.md`
- Create: `plugins/product-design-suite/shared/references/openui-guide.md`

**Interfaces:**
- Produces: two reference docs loaded on demand by every skill. `questioning-protocol.md` defines the gap-question cadence consumed by Tasks 8–10. `openui-guide.md` documents the grammar that `openui-render.js` (Task 5) accepts.

- [x] **Step 1: Write `questioning-protocol.md`**

Create `plugins/product-design-suite/shared/references/questioning-protocol.md`:

```markdown
# Gap-Question Cadence

All builder skills follow this protocol when information is missing.

## Rules
1. **Scope discipline.** Ask only about gaps required to complete the *current
   document's* required sections. Never expand scope to other documents, future
   features, or implementation detail the current document should not contain.
2. **Prefer multiple choice.** Offer concrete options when possible; open-ended
   only when necessary.
3. **One topic per question.** Keep each question answerable in isolation.
4. **Pause after every 4 consecutive questions.** Stop and ask the user:
   *"Continue answering, or finalize the document now?"* — and include a bulleted
   **summary of the remaining gaps** so the user can decide with full context.
5. **Finalize cleanly.** If the user chooses to finalize, write the document and
   record every unresolved gap explicitly in the template's **Open Questions**
   table. Never leave silent `TBD`s in the body.

## Counter reset
The "4 question" counter counts *consecutive* clarifying questions. It resets
after each pause checkpoint and after the user volunteers a batch of information
without being asked.
```

- [x] **Step 2: Write `openui-guide.md`**

Create `plugins/product-design-suite/shared/references/openui-guide.md`:

```markdown
# OpenUI Lang Authoring Guide

UI mockups are authored in **OpenUI Lang** (token-efficient) and rendered to
self-contained HTML by `scripts/openui-render.js`.

## Grammar
- One statement per line: `identifier = Expression`
- The first statement (or an `id` literally named `root`) is the tree root.
- A component is `Type(arg1, arg2, ...)`; arguments map to props by position.
- Values: `"string"`, numbers, `true`/`false`/`null`, arrays `[a, b]`,
  objects `{k: v}`, and references to other identifiers.
- Lines starting with `#` are comments.

## Supported components (positional args)
| Type | Args | Renders |
| --- | --- | --- |
| `Root` | (children[]) | page container |
| `Section` | (children[]) | card-like section |
| `Grid` | (children[]) | responsive grid |
| `Card` | (...children) | a card |
| `Navbar` | (brand, links[]) | top nav |
| `Link` | (label, href) | anchor |
| `StatCard` | (label, value, trend) | KPI tile |
| `Heading` | (text) | h2 |
| `Text` | (text) | paragraph |
| `Button` | (label) | button |
| `Input` | (label, placeholder) | labeled input |
| `Form` | (children[]) | form |

## Example
\`\`\`text
root = Root([nav, dash])
nav  = Navbar("Acme", [home, settings])
home = Link("Home", "/")
settings = Link("Settings", "/settings")
dash = Section([kpis])
kpis = Grid([rev, users])
rev  = StatCard("Revenue", "$1.2M", "up")
users = StatCard("Users", "450k", "flat")
\`\`\`

## Render
\`\`\`bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js" design/home.openui design/home.html
\`\`\`
```

- [x] **Step 3: Verify the example renders**

Run: `printf 'root = Root([h])\nh = Heading("OK")\n' > /tmp/g.openui && node plugins/product-design-suite/scripts/openui-render.js /tmp/g.openui /tmp/g.html && grep -q "OK" /tmp/g.html && echo RENDER_OK`
Expected: `RENDER_OK`

- [x] **Step 4: Commit**

```bash
git add plugins/product-design-suite/shared/references/questioning-protocol.md plugins/product-design-suite/shared/references/openui-guide.md
git commit -m "docs: add questioning protocol and OpenUI authoring guide"
```

---

### Task 8: Builder skills — `egp-prd-builder`, `egp-sdd-builder`, `egp-adr-builder`

**Files:**
- Create: `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md`
- Create: `plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md`
- Create: `plugins/product-design-suite/skills/egp-adr-builder/SKILL.md`

**Interfaces:**
- Consumes: shared templates/references (Task 1, 7), `diagram-render.js` and `openui-render.js` (Tasks 4–5).
- Produces: three valid skills writing to `.product/{prd,sdd,adr}`. Validated by Task 2's validator.

- [x] **Step 1: Write `egp-prd-builder/SKILL.md`**

Create `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md`:

```markdown
---
name: egp-prd-builder
description: Create or update a Product Requirements Document (PRD). Use when the user wants to write, draft, or revise a PRD, define product requirements, problem statement, personas, scope, functional/non-functional requirements, or acceptance criteria. Writes .product/prd/prd.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-prd-builder

Build or update the PRD at `.product/prd/prd.md` from the shared template.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/prd-template.md`
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
1. Ensure `.product/prd/` exists. If `prd.md` exists, load it and treat this as an update.
2. Read the PRD template and the concepts/structures references.
3. Fill each required section from what the user has provided.
4. For any missing required section, ask gap questions following
   `questioning-protocol.md` (pause after every 4 questions and summarize
   remaining gaps).
5. Assign stable IDs: functional `FR-NNN`, business rules `BR-NNN`,
   non-functional `NFR-NNN`, UAT `UAT-NNN`. Keep IDs stable across updates.
6. On finalize, write `.product/prd/prd.md` and record unresolved gaps in the
   **Open Questions** table.
7. Optionally produce `.product/prd/prd-summary.html` (objectives + success
   metrics) by authoring OpenUI Lang and rendering with
   `${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js`.
8. After writing, hand off: suggest running `egp-doc-sync` if a prior SDD/ADR
   exists, then offer to proceed to `egp-sdd-builder`.

## Rules
- Stay product-level: no architecture, schemas, or technology choices unless a
  hard constraint (see concepts.md "What a PRD should avoid").
- Do not invent requirements; ask instead.
```

- [x] **Step 2: Write `egp-sdd-builder/SKILL.md`**

Create `plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md`:

```markdown
---
name: egp-sdd-builder
description: Create or update a Software Design Document (SDD). Use when the user wants to design the technical solution, architecture, C4 diagrams, components, data model, APIs, security, observability, or testing strategy derived from a PRD. Writes .product/sdd/sdd.md and diagrams to .product/diagrams/.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-sdd-builder

Build or update the SDD at `.product/sdd/sdd.md` from the shared template,
derived from the PRD.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/sdd-template.md`
- PRD: `.product/prd/prd.md` (read for requirements to satisfy)
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol,openui-guide}.md`

## Steps
1. If `.product/prd/prd.md` is missing, warn the user that the SDD should follow
   a PRD, and offer to run `egp-prd-builder` first (do not hard-block).
2. Read the SDD template and the PRD. Map PRD `FR-NNN` to Architectural
   Requirements `AR-NNN` in the SDD for traceability (reference the FR IDs).
3. Fill each required section; ask gap questions per `questioning-protocol.md`.
4. Render diagrams as self-contained HTML into `.product/diagrams/`:
   - Build a compact spec `{title, nodes, edges}` and run
     `${CLAUDE_PLUGIN_ROOT}/scripts/diagram-render.js <spec.json> .product/diagrams/<name>.html`
     for C4 context/container/component and sequence/flow diagrams.
5. For UI/frontend sections, author OpenUI Lang in `.product/design/*.openui`
   and render with `openui-render.js` to `.product/design/*.html`.
6. Identify decisions with significant trade-offs and flag them as ADR
   candidates; hand each to `egp-adr-builder`. Reference resulting `ADR-NNN`
   in the SDD's "Referenced ADRs" section.
7. On finalize, write the SDD and record unresolved gaps in Open Questions.
8. Suggest running `egp-doc-sync` to refresh the traceability matrix.

## Rules
- Every major design choice should map back to a PRD requirement or an ADR.
- Cover failure modes, security, observability, and operations — not only happy paths.
```

- [x] **Step 3: Write `egp-adr-builder/SKILL.md`**

Create `plugins/product-design-suite/skills/egp-adr-builder/SKILL.md`:

```markdown
---
name: egp-adr-builder
description: Create or update an Architecture Decision Record (ADR). Use when the user wants to record a single significant architectural decision, capture options considered, trade-offs, the chosen option, consequences, or change an ADR status (proposed/accepted/superseded). Writes .product/adr/ADR-NNN-*.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-adr-builder

Record one architectural decision per file in `.product/adr/`.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/adr-template.md`
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,questioning-protocol}.md`

## Steps
1. Ensure `.product/adr/` exists. Determine the next `ADR-NNN` by scanning
   existing files (zero-padded, starting at 001).
2. Confirm the decision is significant and scoped to exactly ONE decision.
3. Fill the ADR template; ask gap questions per `questioning-protocol.md`.
   Options considered must be real alternatives (include "do nothing" when
   relevant).
4. Link related PRD/SDD sections by their IDs in the Metadata block.
5. Set Status (Proposed/Accepted/Superseded/Deprecated/Rejected) and append to
   the Status History table. When superseding, link the superseding ADR both
   ways.
6. Write `.product/adr/ADR-NNN-<kebab-title>.md`.
7. Suggest running `egp-doc-sync` so the SDD's "Referenced ADRs" stays current.

## Rules
- One decision per ADR. If the user describes several, create several ADRs.
- Keep it durable: explain *why*, not just *what*.
```

- [x] **Step 4: Validate the three skills**

Run: `node tools/validate-plugin.js .`
Expected: `OK: plugin valid`

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/skills/egp-prd-builder plugins/product-design-suite/skills/egp-sdd-builder plugins/product-design-suite/skills/egp-adr-builder
git commit -m "feat: add prd/sdd/adr builder skills"
```

---

### Task 9: `egp-doc-sync` skill

**Files:**
- Create: `plugins/product-design-suite/skills/egp-doc-sync/SKILL.md`

**Interfaces:**
- Consumes: `scripts/traceability.js` (Task 3) and the artifacts under `.product/`.
- Produces: a valid skill that generates an impact report and confirmation-gated edits, and refreshes `.product/traceability.{md,html}`. Validated by Task 2.

- [x] **Step 1: Write `egp-doc-sync/SKILL.md`**

Create `plugins/product-design-suite/skills/egp-doc-sync/SKILL.md`:

```markdown
---
name: egp-doc-sync
description: Propagate changes across PRD, SDD, and ADR documents. Use after editing any product document, or when the user asks to sync docs, check cross-document impact, refresh the traceability matrix, or find stale/affected sections. Produces an impact report and confirmation-gated edits in .product/.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-doc-sync

Keep the PRD/SDD/ADR triad consistent after a change. Never rewrite a document
without explicit user confirmation.

## Steps
1. Refresh the traceability index:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/traceability.js" .product`
   This writes `.product/traceability.md` and `.product/traceability.html`.
2. Determine what changed (use git diff if available, else ask the user which
   document/section changed).
3. Using the traceability matrix, build an **impact report** listing each
   affected downstream and upstream item, for example:
   - A changed PRD `FR-NNN` -> SDD sections referencing it, ADRs referencing it.
   - A changed/ superseded ADR -> SDD "Referenced ADRs" and design choices.
   - A changed SDD contract -> PRD acceptance criteria that depend on it.
4. For each impact, propose a **concrete edit** (show the exact before/after).
5. Apply only the edits the user approves. Re-run step 1 afterward so the matrix
   reflects the applied edits.
6. Report any requirements with `In SDD = NO` in the matrix as coverage gaps.

## Rules
- Confirmation-gated: propose, then apply on approval. No silent rewrites.
- Bidirectional: check both downstream (PRD->SDD->ADR) and back-references.
```

- [x] **Step 2: Validate**

Run: `node tools/validate-plugin.js .`
Expected: `OK: plugin valid`

- [x] **Step 3: Commit**

```bash
git add plugins/product-design-suite/skills/egp-doc-sync
git commit -m "feat: add doc-sync skill"
```

---

### Task 10: `egp-product-workflow` orchestrator skill

**Files:**
- Create: `plugins/product-design-suite/skills/egp-product-workflow/SKILL.md`

**Interfaces:**
- Consumes: all four other skills, the preview server (Task 6), and `${CLAUDE_PLUGIN_ROOT}/shared/...`.
- Produces: a valid orchestrator skill. Validated by Task 2.

- [x] **Step 1: Write `egp-product-workflow/SKILL.md`**

Create `plugins/product-design-suite/skills/egp-product-workflow/SKILL.md`:

```markdown
---
name: egp-product-workflow
description: Orchestrate the end-to-end product design workflow (PRD then SDD then ADR). Use when the user wants to start designing a product, run the full product-spec workflow, or is unsure which document to write next. Initializes .product/, enforces the question cadence, and dispatches to the prd/sdd/adr builders and doc-sync.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-product-workflow

Drive the sequential PRD -> SDD -> ADR workflow.

## Steps
1. **Initialize** `.product/` if missing: create `prd/ sdd/ adr/ diagrams/
   design/ research/`.
2. **Detect stage** by inspecting `.product/`:
   - no `prd/prd.md` -> start with `egp-prd-builder`.
   - PRD exists, no `sdd/sdd.md` -> offer `egp-sdd-builder`.
   - SDD exists -> offer `egp-adr-builder` for flagged decisions.
   Warn (don't block) if the user wants to skip ahead.
3. **Enforce cadence** from
   `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md` across the
   active builder (gap-only questions; pause after every 4; summarize remaining
   gaps).
4. **Dispatch** to the appropriate builder skill for the current stage.
5. **Preview (optional)** during iteration: start the live preview server with
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/start-server.sh"` to show diagrams/
   mockups in a browser tab; stop it with `stop-server.sh` when done.
6. **Sync after edits**: whenever a document is created or changed, run
   `egp-doc-sync` to propagate impacts and refresh the traceability matrix.
7. **Advance** to the next stage when the current document is finalized.

## Rules
- Respect the sequence; the PRD anchors the SDD, and ADRs record decisions made
  during SDD design.
- Keep everything inside `.product/`.
```

- [x] **Step 2: Validate**

Run: `node tools/validate-plugin.js .`
Expected: `OK: plugin valid`

- [x] **Step 3: Commit**

```bash
git add plugins/product-design-suite/skills/egp-product-workflow
git commit -m "feat: add product-workflow orchestrator skill"
```

---

### Task 11: Slash-command wrappers

**Files:**
- Create: `plugins/product-design-suite/commands/egp-prd.md`
- Create: `plugins/product-design-suite/commands/egp-sdd.md`
- Create: `plugins/product-design-suite/commands/egp-adr.md`
- Create: `plugins/product-design-suite/commands/egp-product.md`

**Interfaces:**
- Produces: four command files that invoke the matching skills. Verified by a presence/content check.

- [x] **Step 1: Write the four command files**

Create `plugins/product-design-suite/commands/egp-prd.md`:

```markdown
---
description: Create or update the PRD via the egp-prd-builder skill
argument-hint: [what to add or change]
---
Use the egp-prd-builder skill to create or update `.product/prd/prd.md`. $ARGUMENTS
```

Create `plugins/product-design-suite/commands/egp-sdd.md`:

```markdown
---
description: Create or update the SDD via the egp-sdd-builder skill
argument-hint: [what to design or change]
---
Use the egp-sdd-builder skill to create or update `.product/sdd/sdd.md` and its diagrams. $ARGUMENTS
```

Create `plugins/product-design-suite/commands/egp-adr.md`:

```markdown
---
description: Record or update an ADR via the egp-adr-builder skill
argument-hint: [the decision]
---
Use the egp-adr-builder skill to record or update an ADR in `.product/adr/`. $ARGUMENTS
```

Create `plugins/product-design-suite/commands/egp-product.md`:

```markdown
---
description: Run the end-to-end product design workflow via egp-product-workflow
argument-hint: [product idea or next step]
---
Use the egp-product-workflow skill to drive the PRD -> SDD -> ADR workflow. $ARGUMENTS
```

- [x] **Step 2: Verify the wrappers reference the right skills**

Run: `for c in prd sdd adr product; do grep -q "egp-${c/product/product-workflow}" "plugins/product-design-suite/commands/egp-$c.md" || echo "MISSING ref in egp-$c.md"; done; echo CHECK_DONE`
Expected: `CHECK_DONE` with no `MISSING` lines.

- [x] **Step 3: Commit**

```bash
git add plugins/product-design-suite/commands
git commit -m "feat: add egp-prefixed slash command wrappers"
```

---

### Task 12: End-to-end validation + sample `.product` smoke run

**Files:**
- Create: `tests/e2e-smoke.test.js`

**Interfaces:**
- Consumes: every script and the validator.
- Produces: a single end-to-end test proving the toolchain works on a sample, and a clean full validation + full test run.

- [x] **Step 1: Write the end-to-end smoke test**

Create `tests/e2e-smoke.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const t = require('../plugins/product-design-suite/scripts/traceability.js');
const o = require('../plugins/product-design-suite/scripts/openui-render.js');
const d = require('../plugins/product-design-suite/scripts/diagram-render.js');

test('traceability over a sample .product links PRD->SDD->ADR', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-'));
  fs.mkdirSync(path.join(dir, 'prd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sdd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'prd', 'prd.md'), 'FR-001 onboarding. NFR-002 latency.');
  fs.writeFileSync(path.join(dir, 'sdd', 'sdd.md'), 'AR-001 implements FR-001.');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-x.md'), 'Decision impacting FR-001.');
  const rows = t.buildMatrix(t.loadProduct(dir));
  const fr = rows.find(r => r.id === 'FR-001');
  assert.equal(fr.inSdd, true);
  assert.deepEqual(fr.adrs, ['ADR-001']);
  assert.equal(rows.find(r => r.id === 'NFR-002').inSdd, false);
});

test('renderers produce self-contained html', () => {
  const ui = o.renderOpenUI('root = Section([h])\nh = Heading("Hi")');
  const dg = d.renderDiagram({ title: 'X', nodes: [{ id: 'a', label: 'A' }], edges: [] });
  for (const html of [ui, dg]) {
    assert.match(html, /<!DOCTYPE html>/);
    assert.ok(!/(src|href)=("|')https?:\/\//.test(html));
  }
});
```

- [x] **Step 2: Run the full test suite**

Run: `node --test tests/`
Expected: PASS — all suites green (validate-plugin, traceability, diagram-render, openui-render, preview-server, e2e-smoke).

- [x] **Step 3: Run the full plugin validation**

Run: `node tools/validate-plugin.js .`
Expected: `OK: plugin valid`

- [x] **Step 4: Verify the final structure**

Run: `find plugins/product-design-suite -type f | sort`
Expected: lists 5 `SKILL.md`, 4 command files, 4 references, 3 templates, 8 scripts, 1 plugin.json — matching the File Structure section.

- [x] **Step 5: Commit**

```bash
git add tests/e2e-smoke.test.js
git commit -m "test: add end-to-end smoke test for the toolchain"
```

---

## Self-Review

**Spec coverage:**
- D1 architecture (orchestrator + 3 builders + sync) → Tasks 8, 9, 10. ✓
- D2 sync = impact report + confirmed edits + traceability → Tasks 3, 9. ✓
- D3 rendering = inline SVG + OpenUI→HTML, framework-free → Tasks 4, 5, 7; constraint asserted by tests in Tasks 4/5/12. ✓
- D4/D5 `egp-` prefix on skills + 4 commands → Tasks 8–11; enforced by validator (Task 2). ✓
- D6 author identity → Tasks 1, 8–10. ✓
- D7 move shared content → Task 1. ✓
- Marketplace plugin packaging → Task 1 manifests; structure verified Task 12. ✓
- Reuse superpowers preview server → Task 6. ✓
- Gap-question + pause-after-4 cadence → Task 7 reference, consumed by Tasks 8–10. ✓
- `.product/` layout + HTML/OpenUI outputs → Tasks 8, 10. ✓

**Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to Task N"; all code and file contents are shown in full. ✓

**Type consistency:** Exported names are used consistently across tasks — `extractIds`/`buildMatrix`/`renderMatrixMarkdown`/`renderMatrixHtml`/`loadProduct` (Task 3 ↔ 9, 12), `renderSvg`/`renderDiagram` (Task 4 ↔ 12), `parseOpenUI`/`renderOpenUI` (Task 5 ↔ 7, 12), `parseFrontmatter`/`validateSkill`/`validateJson`/`validatePlugin` (Task 2 ↔ 8–10, 12). Skill names equal their directory names everywhere. ✓
