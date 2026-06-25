# product-design-suite feedback-004 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply all 11 feedback-004 improvements to the `product-design-suite` plugin — kill phantom orphans, harden the scripts against cwd drift, add structure/mermaid validators, auto-sync ADR status, and refine the gate's reporting — without adding any runtime dependency.

**Architecture:** All logic stays in pure-Node scripts under `plugins/product-design-suite/scripts/`. A shared `stripCode` helper in `id-conventions.js` removes code spans before any ID scan. `consistency-gate.js` gains an error/warn level per check. Two new validators (`validate-structure.js`, `mermaid-lint.js`) and one new generator (`adr-index.js`) plug into the gate / `pm-doc-sync`. Templates and builder SKILLs get matching edits.

**Tech Stack:** Node.js (`node:` builtins only), `node:test`, Markdown templates. No `package.json`, no `node_modules`, no jsdom/playwright/puppeteer.

## Global Constraints

- **Zero runtime dependencies.** Only `node:` builtins + the vendored browser-side `scripts/vendor/mermaid.min.js`. Never add a `package.json`/`node_modules` to a shippable script.
- **Single ID source of truth.** The requirement/ADR/constraint ID regex lives only in `scripts/id-conventions.js`. New code imports it; never re-declares it.
- **Tests are `node:test`.** Run the whole suite with `node --test tests/*.test.js` from the repo root (`/home/vivaldo/projetos/ferramentas/pm-skills`). It must stay green after every task.
- **Repo root** for all commands: `/home/vivaldo/projetos/ferramentas/pm-skills`.
- **Plugin scripts dir:** `plugins/product-design-suite/scripts/`.
- **`stripCode` is for ID scanning only.** `mermaid-lint.js` reads RAW markdown (never stripped).

---

## File Structure

**Created:**
- `plugins/product-design-suite/scripts/validate-structure.js` — template-structure drift validator (IMP-3).
- `plugins/product-design-suite/scripts/mermaid-lint.js` — rule-based mermaid syntax linter (IMP-6).
- `plugins/product-design-suite/scripts/adr-index.js` — ADR index generator + SDD §15 status sync (IMP-4).
- `tests/validate-structure.test.js`, `tests/mermaid-lint.test.js`, `tests/adr-index.test.js`.

**Modified:**
- `scripts/id-conventions.js` — add `stripCode` (IMP-1b).
- `scripts/traceability.js` — strip code in `parseRefs`/`linksWithin`; absolute path in CLI (IMP-1b, IMP-2).
- `scripts/lint-ids.js` — strip code; duplicate-definition split (IMP-1b, IMP-8).
- `scripts/consistency-gate.js` — error/warn levels; cwd-safety; `inputs-present`; new checks; `related-adrs` reciprocity (IMP-2, IMP-3, IMP-6, IMP-7, IMP-8).
- `shared/templates/*.md` — non-matching placeholders (IMP-1a); `planned` enum (IMP-5); ADR-INDEX/ADR-STATUS markers (IMP-4).
- `skills/pm-*-builder/SKILL.md`, `skills/pm-doc-sync/SKILL.md`, `shared/references/questioning-protocol.md` — `docs/` guard, decision ledger, version-bump heuristic, ADR-index wiring (IMP-4, IMP-9, IMP-10, IMP-11).
- `tests/lint-ids.test.js`, `tests/consistency-gate.test.js`, `tests/metadata-conventions.test.js`, `tests/traceability.test.js` — new assertions.

---

## Phase A — Scanner & gate core

### Task 1: `stripCode` helper (IMP-1b)

**Files:**
- Modify: `plugins/product-design-suite/scripts/id-conventions.js`
- Test: `tests/id-conventions.test.js`

**Interfaces:**
- Produces: `stripCode(text: string|null) -> string` — exported from `id-conventions.js`. Removes fenced code blocks (```` ``` ````-delimited, multi-line) then inline-code spans (`` ` ``-delimited), replacing each with a single space. Idempotent.

- [x] **Step 1: Write the failing test**

Add to `tests/id-conventions.test.js`:

```js
test('stripCode removes fenced blocks and inline spans, keeps prose', () => {
  const C = require('../plugins/product-design-suite/scripts/id-conventions.js');
  const text = 'See FR-001 in prose.\n```\nexample FR-999 here\n```\nAnd inline `NFR-888` too.';
  const out = C.stripCode(text);
  assert.ok(out.includes('FR-001'), 'prose ID kept');
  assert.ok(!out.includes('FR-999'), 'fenced ID removed');
  assert.ok(!out.includes('NFR-888'), 'inline ID removed');
  assert.equal(C.stripCode(C.stripCode(text)), C.stripCode(text), 'idempotent');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/id-conventions.test.js`
Expected: FAIL — `C.stripCode is not a function`.

- [x] **Step 3: Implement `stripCode`**

In `scripts/id-conventions.js`, add before `module.exports`:

```js
// Remove code so example IDs shown in code never count as references (feedback IMP-1b).
// Fenced blocks first (multi-line), then inline spans. Used only for ID scanning.
function stripCode(text) {
  return String(text == null ? '' : text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}
```

And add `stripCode` to the exports object:

```js
module.exports = { PREFIXES, PREFIX, CAT, MEMBER, MEMBER_RE, REQ_RE, parseMember, classify, familyOf, stripCode };
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/id-conventions.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/id-conventions.js tests/id-conventions.test.js
git commit -m "feat: stripCode helper in id-conventions (IMP-1b)"
```

---

### Task 2: Strip code in the traceability scanner (IMP-1b)

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js:94-99` (`parseRefs`), `:123-140` (`linksWithin`)
- Test: `tests/traceability.test.js`

**Interfaces:**
- Consumes: `C.stripCode` from Task 1.
- Produces: `parseRefs` and `linksWithin` ignore IDs that appear inside code. Signatures unchanged.

- [x] **Step 1: Write the failing test**

Add to `tests/traceability.test.js`:

```js
test('parseRefs ignores IDs inside fenced and inline code (IMP-1b)', () => {
  const t = require('../plugins/product-design-suite/scripts/traceability.js');
  const md = 'Real FR-001 here.\n```\nFR-777 example\n```\nInline `NFR-888`.';
  const refs = t.parseRefs(md);
  assert.ok(refs.includes('FR-001'));
  assert.ok(!refs.includes('FR-777'));
  assert.ok(!refs.includes('NFR-888'));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — `refs` still includes `FR-777`/`NFR-888`.

- [x] **Step 3: Implement**

In `scripts/traceability.js`, the file already does `const C = require('./id-conventions.js');`. Change `parseRefs`:

```js
function parseRefs(text) {
  const groups = C.stripCode(text).match(GROUP_RE) || [];
  const all = [];
  for (const g of groups) all.push(...parseGroup(g));
  return [...new Set(all)].sort(refCompare);
}
```

And in `linksWithin`, strip the whole text before splitting into segments (so multi-line fences are removed before the sentence split):

```js
  for (const seg of C.stripCode(text).split(/\n+|(?<=\.)\s+/)) {
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/traceability.test.js`
Expected: PASS (and all pre-existing traceability tests still pass).

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: traceability scanner ignores IDs inside code (IMP-1b)"
```

---

### Task 3: Strip code in the ID linter (IMP-1b)

**Files:**
- Modify: `plugins/product-design-suite/scripts/lint-ids.js:14-18` (`lintText`), `:28-37` (`lintProduct` scan)
- Test: `tests/lint-ids.test.js`

**Interfaces:**
- Consumes: `C.stripCode` from Task 1.
- Produces: `lintText`/`lintProduct` ignore IDs inside code. Signatures unchanged.

- [x] **Step 1: Write the failing test**

Add to `tests/lint-ids.test.js`:

```js
test('lintText ignores malformed IDs shown inside code (IMP-1b)', () => {
  const r = l.lintText('Prose NFR_P1 is bad. But `NFR_P9` in code is fine.');
  assert.ok(r.malformed.includes('NFR_P1'), 'prose near-miss still flagged');
  assert.ok(!r.malformed.includes('NFR_P9'), 'in-code near-miss ignored');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/lint-ids.test.js`
Expected: FAIL — `NFR_P9` is flagged.

- [x] **Step 3: Implement**

In `scripts/lint-ids.js`, `lintText` becomes:

```js
function lintText(text) {
  const shaped = C.stripCode(text).match(SHAPED_RE) || [];
  const malformed = [...new Set(shaped.filter(tok => !C.MEMBER_RE.test(tok)))];
  return { malformed };
}
```

In `lintProduct`, strip once and use the stripped text for the duplicate/seen scan:

```js
      else if (ent.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf8');
        const stripped = C.stripCode(text);
        for (const tok of lintText(text).malformed) malformed.push({ file: p, token: tok });
        for (const tok of (stripped.match(SHAPED_RE) || [])) {
          if (C.MEMBER_RE.test(tok)) {
            const set = seen.get(tok) || new Set();
            set.add(p);
            seen.set(tok, set);
          }
        }
      }
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/lint-ids.test.js`
Expected: PASS (existing lint-ids tests still pass).

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/lint-ids.js tests/lint-ids.test.js
git commit -m "feat: id linter ignores IDs inside code (IMP-1b)"
```

---

### Task 4: Non-matching template placeholders (IMP-1a)

**Files:**
- Modify: `shared/templates/prd-template.md`, `srs-template.md`, `sad-template.md`, `sdd-template.md`, `adr-template.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:**
- Produces: template example rows use `-NNN` placeholders that do not match the canonical `\d+` member regex.

- [x] **Step 1: Write the failing test**

Add to `tests/metadata-conventions.test.js`:

```js
test('templates use non-matching placeholder IDs, not real example IDs (IMP-1a)', () => {
  const files = ['prd', 'srs', 'sad', 'sdd'].map(n => `shared/templates/${n}-template.md`);
  // A real-looking example ID = a known prefix + dash + digits (e.g. FR-001).
  const REAL = /\b(FR|BR|NFR|AR|UAT)-\d+\b/;
  for (const f of files) {
    const lines = read(f).split('\n').filter(l => REAL.test(l));
    assert.deepEqual(lines, [], `${f} should not contain real example IDs like FR-001:\n${lines.join('\n')}`);
  }
});
```

(`read` is the existing helper at the top of `metadata-conventions.test.js`.)

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL — lists `FR-001`/`NFR-001`/etc rows.

- [x] **Step 3: Replace example IDs with placeholders**

Apply these exact replacements (digits → `NNN`):

- `prd-template.md`: `FR-001`→`FR-NNN`, `FR-002`→`FR-NNN`, `BR-001`→`BR-NNN`, `BR-002`→`BR-NNN`, `UAT-001`→`UAT-NNN`.
- `srs-template.md`: `FR-001`→`FR-NNN`, `FR-002`→`FR-NNN`, `NFR-001`→`NFR-NNN`, `NFR-002`→`NFR-NNN`. The format-doc line `` `FR-001`/`NFR-001` `` is inside inline-code and may stay (it is inert via IMP-1b), but for cleanliness change it to `` `FR-NNN`/`NFR-NNN` ``.
- `sad-template.md`: `AR-001`→`AR-NNN`, `AR-002`→`AR-NNN`. ADR list examples `ADR-001`/`ADR-002` (lines 38–39) → `ADR-NNN`.
- `sdd-template.md`: `AR-001`→`AR-NNN`; ADR list examples `ADR-001`/`ADR-002` (lines 37–38) → `ADR-NNN`; §15 example row `<ADR-001>` → `<ADR-NNN>`.

Note: the `adr-template.md` front-matter comments (`e.g. [ADR-003]`) are illustrative comments and are NOT requirement-table rows; leave them (they do not produce phantom orphans). The test above does not scan `adr-template.md`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add shared/templates/*.md tests/metadata-conventions.test.js
git commit -m "feat: non-matching placeholder IDs in templates (IMP-1a)"
```

---

### Task 5: Gate error/warn levels + cwd-safety + fail-loud (IMP-2)

**Files:**
- Modify: `plugins/product-design-suite/scripts/consistency-gate.js:55-82`
- Test: `tests/consistency-gate.test.js`

**Interfaces:**
- Produces:
  - Each check object gains `level: 'error' | 'warn'` (default `'error'`).
  - `runGate(dir)` resolves `dir` to absolute via `path.resolve`, and computes `pass` from `error`-level checks only.
  - New `error`-level check `inputs-present`: fails when zero `.product/*.md` files exist under the resolved dir.

- [x] **Step 1: Write the failing tests**

Add to `tests/consistency-gate.test.js`:

```js
test('gate FAILs loudly on a directory with no product docs (IMP-2)', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-empty-'));
  const r = g.runGate(empty);
  assert.equal(r.pass, false);
  assert.ok(r.checks.find(c => c.name === 'inputs-present' && !c.pass));
});

test('every gate check carries an error|warn level (IMP-2)', () => {
  const r = g.runGate(scaffold());
  assert.ok(r.checks.every(c => c.level === 'error' || c.level === 'warn'));
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/consistency-gate.test.js`
Expected: FAIL — no `inputs-present` check; `level` undefined.

- [x] **Step 3: Implement**

In `scripts/consistency-gate.js`, add a `.product/*.md` counter near the top (after the requires):

```js
function countProductMd(dir) {
  let n = 0;
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) n++;
    }
  };
  walk(dir);
  return n;
}
```

Replace `runGate` with:

```js
function runGate(dir) {
  dir = path.resolve(dir);                       // cwd-safety (IMP-2)
  const product = trace.loadProduct(dir);
  const matrix = trace.buildMatrix(product);
  const lint = lintProduct(dir);
  const adrs = loadAdrs(dir);
  const recip = checkReciprocity(adrs);
  const mdCount = countProductMd(dir);

  const checks = [
    { name: 'inputs-present', level: 'error', pass: mdCount > 0,
      detail: mdCount > 0 ? `${mdCount} .product doc(s)` : `no .product/*.md found under ${dir}` },
    { name: 'traceability', level: 'error', pass: matrix.orphans.length === 0,
      detail: matrix.orphans.length ? `orphans: ${matrix.orphans.join(', ')}` : 'no orphans' },
    { name: 'id-lint', level: 'error', pass: lint.malformed.length === 0,
      detail: `${lint.malformed.length} malformed, ${lint.duplicates.length} duplicate` },
    { name: 'unclassified', level: 'error', pass: matrix.unclassified.length === 0,
      detail: matrix.unclassified.join(', ') || 'none' },
    { name: 'adr-reciprocity', level: 'error', pass: recip.length === 0,
      detail: recip.join('; ') || 'reciprocal' },
  ];
  return { pass: checks.filter(c => c.level === 'error').every(c => c.pass), checks };
}
```

Update the CLI block at the bottom to render levels:

```js
if (require.main === module) {
  const { pass, checks } = runGate(process.argv[2] || '.product');
  for (const c of checks) {
    const tag = c.pass ? 'PASS' : (c.level === 'warn' ? 'WARN' : 'FAIL');
    console.log(`[${tag}] ${c.name}: ${c.detail}`);
  }
  console.log(pass ? 'consistency-gate: PASS' : 'consistency-gate: FAIL');
  process.exit(pass ? 0 : 1);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/consistency-gate.test.js`
Expected: PASS (existing gate tests still pass).

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/consistency-gate.js tests/consistency-gate.test.js
git commit -m "feat: gate error/warn levels + cwd-safety + fail-loud inputs-present (IMP-2)"
```

---

### Task 6: Duplicate-definition vs cross-doc-mention split (IMP-8)

**Files:**
- Modify: `plugins/product-design-suite/scripts/lint-ids.js`, `scripts/consistency-gate.js:62-71`
- Test: `tests/lint-ids.test.js`, `tests/consistency-gate.test.js`

**Interfaces:**
- Consumes: gate `level` infra from Task 5.
- Produces: `lintProduct(dir)` returns `{ malformed, duplicates, definitionDuplicates }`. `definitionDuplicates` = IDs that appear in the **first cell of a Markdown table row** in more than one file. `duplicates` (cross-doc mentions) is unchanged. Gate `id-lint` errors on `malformed` + `definitionDuplicates`; the mention count is labelled informational.

- [x] **Step 1: Write the failing tests**

Add to `tests/lint-ids.test.js`:

```js
test('lintProduct separates duplicate table definitions from mentions (IMP-8)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lintdef-'));
  // FR-001 DEFINED (first table cell) in two files; FR-002 only mentioned in prose twice.
  fs.writeFileSync(path.join(dir, 'a.md'), '| ID | Req |\n| --- | --- |\n| FR-001 | x |\nMentions FR-002.');
  fs.writeFileSync(path.join(dir, 'b.md'), '| ID | Req |\n| --- | --- |\n| FR-001 | y |\nAlso FR-002.');
  const r = l.lintProduct(dir);
  assert.ok(r.definitionDuplicates.find(d => d.id === 'FR-001'), 'FR-001 is a duplicate definition');
  assert.ok(!r.definitionDuplicates.find(d => d.id === 'FR-002'), 'FR-002 is only a mention, not a definition');
});
```

Add to `tests/consistency-gate.test.js`:

```js
test('id-lint detail labels cross-doc mentions as expected (IMP-8)', () => {
  const r = g.runGate(scaffold());
  const idLint = r.checks.find(c => c.name === 'id-lint');
  assert.match(idLint.detail, /duplicate-definitions/);
  assert.match(idLint.detail, /cross-doc mentions/);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lint-ids.test.js tests/consistency-gate.test.js`
Expected: FAIL — `definitionDuplicates` undefined; detail lacks new labels.

- [x] **Step 3: Implement**

In `scripts/lint-ids.js`, add a table-definition extractor:

```js
// IDs that appear as the first cell of a Markdown table row = "definitions".
function tableDefIds(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    const first = (line.split('|')[1] || '').replace(/[<>`]/g, '').trim();
    if (C.MEMBER_RE.test(first)) out.push(first);
  }
  return out;
}
```

In `lintProduct`, track definitions alongside the existing `seen` map. Add `const defSeen = new Map();` next to `const seen = new Map();`, and inside the `.md` branch after computing `stripped`:

```js
        for (const id of tableDefIds(stripped)) {
          const set = defSeen.get(id) || new Set();
          set.add(p);
          defSeen.set(id, set);
        }
```

At the end of `lintProduct`, build and return the new field:

```js
  const definitionDuplicates = [...defSeen.entries()]
    .filter(([, files]) => files.size > 1)
    .map(([id, files]) => ({ id, files: [...files] }));
  return { malformed, duplicates, definitionDuplicates };
```

In `scripts/consistency-gate.js`, change the `id-lint` check:

```js
    { name: 'id-lint', level: 'error',
      pass: lint.malformed.length === 0 && lint.definitionDuplicates.length === 0,
      detail: `${lint.malformed.length} malformed, ${lint.definitionDuplicates.length} duplicate-definitions, ${lint.duplicates.length} cross-doc mentions (expected)` },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lint-ids.test.js tests/consistency-gate.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/lint-ids.js plugins/product-design-suite/scripts/consistency-gate.js tests/lint-ids.test.js tests/consistency-gate.test.js
git commit -m "feat: split duplicate definitions from cross-doc mentions in id-lint (IMP-8)"
```

---

## Phase B — New validators

### Task 7: `validate-structure.js` + gate wiring (IMP-3)

**Files:**
- Create: `plugins/product-design-suite/scripts/validate-structure.js`
- Modify: `plugins/product-design-suite/scripts/consistency-gate.js`
- Test: `tests/validate-structure.test.js`, `tests/consistency-gate.test.js`

**Interfaces:**
- Consumes: gate `level` infra from Task 5.
- Produces:
  - `validateDoc(producedMd, templateMd) -> { missing: string[], merged: string[] }` — required headings = the template's `##`/`###` headings (section numbers and `<...>` markers stripped, lower-cased). `merged` = a required name found *inside* a produced heading (e.g. `retry / timeouts / fallbacks`). `missing` = required name neither matched exactly nor merged.
  - `validateProduct(dir) -> Array<{ file, missing, merged }>` — over `prd/srs/sad/sdd` docs that exist.
  - Gate gains a **`warn`**-level `structure` check.

- [x] **Step 1: Write the failing tests**

Create `tests/validate-structure.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const v = require('../plugins/product-design-suite/scripts/validate-structure.js');

test('validateDoc flags a missing required heading', () => {
  const tpl = '## 1. Overview\n## 2. Components\n';
  const doc = '## 1. Overview\n';
  const r = v.validateDoc(doc, tpl);
  assert.ok(r.missing.includes('components'));
});

test('validateDoc treats a merged heading as merged, not missing', () => {
  const tpl = '## 9. Retry\n## 10. Timeouts\n## 11. Fallbacks\n';
  const doc = '## 9. Retry / Timeouts / Fallbacks\n';
  const r = v.validateDoc(doc, tpl);
  assert.deepEqual(r.missing, []);
  assert.ok(r.merged.includes('timeouts'));
});

test('validateDoc is clean for a faithful doc', () => {
  const tpl = '## 1. Overview\n### Goals\n';
  const doc = '## 1. Overview\n### Goals\n';
  const r = v.validateDoc(doc, tpl);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.merged, []);
});
```

Add to `tests/consistency-gate.test.js`:

```js
test('structure check is warn-level and never fails the gate (IMP-3)', () => {
  const r = g.runGate(scaffold());
  const s = r.checks.find(c => c.name === 'structure');
  assert.ok(s, 'structure check present');
  assert.equal(s.level, 'warn');
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/validate-structure.test.js tests/consistency-gate.test.js`
Expected: FAIL — module not found; no `structure` check.

- [x] **Step 3: Implement `validate-structure.js`**

Create `plugins/product-design-suite/scripts/validate-structure.js`:

```js
// Template-structure drift validator (feedback IMP-3). Warn-level: surfaces
// dropped/merged/renamed headings without failing the gate. Required headings
// are derived from the matching template at runtime — no hardcoded list.
const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'shared', 'templates');
const TEMPLATE_FOR = {
  'prd/prd.md': 'prd-template.md',
  'srs/srs.md': 'srs-template.md',
  'sad/sad.md': 'sad-template.md',
  'sdd/sdd.md': 'sdd-template.md',
};

function normalizeHeading(t) {
  return t.replace(/^\d+\.?\s*/, '').replace(/[<>]/g, '').trim().toLowerCase();
}

function headings(md) {
  return [...String(md || '').matchAll(/^#{2,3}\s+(.*\S)\s*$/gm)]
    .map(m => normalizeHeading(m[1]))
    .filter(Boolean);
}

function validateDoc(producedMd, templateMd) {
  const required = [...new Set(headings(templateMd))];
  const produced = headings(producedMd);
  const missing = [];
  const merged = [];
  for (const r of required) {
    if (produced.includes(r)) continue;
    if (produced.some(p => p !== r && p.includes(r))) merged.push(r);
    else missing.push(r);
  }
  return { missing, merged };
}

function validateProduct(dir) {
  const out = [];
  for (const [rel, tplName] of Object.entries(TEMPLATE_FOR)) {
    const docPath = path.join(dir, rel);
    if (!fs.existsSync(docPath)) continue;
    const tplPath = path.join(TEMPLATE_DIR, tplName);
    const r = validateDoc(fs.readFileSync(docPath, 'utf8'), fs.readFileSync(tplPath, 'utf8'));
    if (r.missing.length || r.merged.length) out.push({ file: rel, ...r });
  }
  return out;
}

module.exports = { validateDoc, validateProduct, headings, normalizeHeading };

if (require.main === module) {
  const results = validateProduct(path.resolve(process.argv[2] || '.product'));
  for (const r of results) {
    if (r.missing.length) console.log(`structure: ${r.file} missing: ${r.missing.join(', ')}`);
    if (r.merged.length) console.log(`structure: ${r.file} merged: ${r.merged.join(', ')}`);
  }
  console.log(results.length ? 'validate-structure: drift found (advisory)' : 'validate-structure: clean');
}
```

- [x] **Step 4: Wire into the gate**

In `scripts/consistency-gate.js`, add `const structure = require('./validate-structure.js');` to the requires, and inside `runGate` (after `const mdCount = ...`):

```js
  const drift = structure.validateProduct(dir);
```

Add this check to the `checks` array (after `adr-reciprocity`):

```js
    { name: 'structure', level: 'warn', pass: drift.length === 0,
      detail: drift.length
        ? drift.map(d => `${d.file}: ${[...d.missing.map(m => 'missing ' + m), ...d.merged.map(m => 'merged ' + m)].join(', ')}`).join('; ')
        : 'matches templates' },
```

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test tests/validate-structure.test.js tests/consistency-gate.test.js`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add plugins/product-design-suite/scripts/validate-structure.js plugins/product-design-suite/scripts/consistency-gate.js tests/validate-structure.test.js tests/consistency-gate.test.js
git commit -m "feat: validate-structure.js drift validator, warn-level in gate (IMP-3)"
```

---

### Task 8: `mermaid-lint.js` + gate wiring (IMP-6)

**Files:**
- Create: `plugins/product-design-suite/scripts/mermaid-lint.js`
- Modify: `plugins/product-design-suite/scripts/consistency-gate.js`
- Test: `tests/mermaid-lint.test.js`, `tests/consistency-gate.test.js`

**Interfaces:**
- Consumes: `extractMermaidBlocks` from `mermaid-preview.js`; gate `level` infra.
- Produces:
  - `lintBlock(src) -> string[]` — error messages for one diagram block.
  - `lintMarkdown(md) -> string[]` — errors across all blocks in a doc (reads RAW markdown).
  - `lintProductDiagrams(dir) -> Array<{ file, errors }>`.
  - Gate gains an **`error`**-level `mermaid-lint` check.

- [x] **Step 1: Write the failing tests**

Create `tests/mermaid-lint.test.js`:

```js
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
```

Add to `tests/consistency-gate.test.js`:

```js
test('mermaid-lint is error-level and fails a bad diagram (IMP-6)', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'sdd', 'sdd.md'),
    '## 4. Components\nImplements FR-001.\n```mermaid\nsequenceDiagram\n  A->>B: a; b\n```\n');
  const r = g.runGate(dir);
  const ml = r.checks.find(c => c.name === 'mermaid-lint');
  assert.equal(ml.level, 'error');
  assert.equal(ml.pass, false);
  assert.equal(r.pass, false);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mermaid-lint.test.js tests/consistency-gate.test.js`
Expected: FAIL — module not found; no `mermaid-lint` check.

- [x] **Step 3: Implement `mermaid-lint.js`**

Create `plugins/product-design-suite/scripts/mermaid-lint.js`:

```js
// Lightweight, dependency-free mermaid linter (feedback IMP-6). Catches the
// known footgun class — NOT a full parser. Reads RAW markdown (never stripped).
const fs = require('node:fs');
const path = require('node:path');
const { extractMermaidBlocks } = require('./mermaid-preview.js');

const TYPE_RE = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|C4Context|C4Container|C4Component|C4Dynamic|mindmap|timeline|gitGraph)\b/;

function lintBlock(src) {
  const errs = [];
  const lines = String(src || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) { errs.push('empty mermaid block'); return errs; }
  if (!TYPE_RE.test(lines[0])) errs.push(`unknown/missing diagram type on first line: "${lines[0]}"`);
  for (const [open, close] of [['[', ']'], ['(', ')'], ['{', '}']]) {
    const o = (src.match(new RegExp('\\' + open, 'g')) || []).length;
    const c = (src.match(new RegExp('\\' + close, 'g')) || []).length;
    if (o !== c) errs.push(`unbalanced ${open}${close} (${o} open, ${c} close)`);
  }
  if (/^sequenceDiagram/.test(lines[0])) {
    for (const l of lines) {
      if (/(--?>>?|-->>?)/.test(l) && l.includes(';')) errs.push(`semicolon in sequenceDiagram message: "${l}"`);
    }
  }
  return errs;
}

function lintMarkdown(md) {
  return extractMermaidBlocks(md).flatMap((b, i) => lintBlock(b).map(e => `diagram ${i + 1}: ${e}`));
}

function lintProductDiagrams(dir) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) {
        const errs = lintMarkdown(fs.readFileSync(p, 'utf8'));
        if (errs.length) out.push({ file: p, errors: errs });
      }
    }
  };
  walk(dir);
  return out;
}

module.exports = { lintBlock, lintMarkdown, lintProductDiagrams };

if (require.main === module) {
  const results = lintProductDiagrams(path.resolve(process.argv[2] || '.product'));
  for (const r of results) for (const e of r.errors) console.log(`${r.file}: ${e}`);
  console.log(results.length ? 'mermaid-lint: errors found' : 'mermaid-lint: clean');
  process.exit(results.length ? 1 : 0);
}
```

- [x] **Step 4: Wire into the gate**

In `scripts/consistency-gate.js`, add `const mermaid = require('./mermaid-lint.js');` to the requires, and in `runGate` (after `const drift = ...`):

```js
  const mermaidErrs = mermaid.lintProductDiagrams(dir);
```

Add this check (after `structure`):

```js
    { name: 'mermaid-lint', level: 'error', pass: mermaidErrs.length === 0,
      detail: mermaidErrs.length
        ? mermaidErrs.map(d => `${path.basename(d.file)}: ${d.errors.join('; ')}`).join(' | ')
        : 'diagrams parse-clean (rule-based)' },
```

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test tests/mermaid-lint.test.js tests/consistency-gate.test.js`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add plugins/product-design-suite/scripts/mermaid-lint.js plugins/product-design-suite/scripts/consistency-gate.js tests/mermaid-lint.test.js tests/consistency-gate.test.js
git commit -m "feat: mermaid-lint.js rule-based diagram linter, error-level in gate (IMP-6)"
```

---

## Phase C — ADR sync

### Task 9: `adr-index.js` index generation + template markers (IMP-4, part 1)

**Files:**
- Create: `plugins/product-design-suite/scripts/adr-index.js`
- Modify: `shared/templates/sdd-template.md` (add ADR-INDEX note is not needed; index lives in `.product/adr/index.md`)
- Test: `tests/adr-index.test.js`

**Interfaces:**
- Consumes: `readFrontMatter` from `consistency-gate.js`.
- Produces:
  - `loadAdrFm(dir) -> Array<frontMatter>` — every `adr/*.md` except `index.md`, sorted by filename, that has an `id`.
  - `renderIndex(adrs) -> string` — Markdown table `ADR | Title | Status | Date`, wrapped in `ADR-INDEX:START/END` markers.
  - `writeIndex(dir) -> adrs` — writes `.product/adr/index.md`.

- [x] **Step 1: Write the failing test**

Create `tests/adr-index.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const a = require('../plugins/product-design-suite/scripts/adr-index.js');

function scaffoldAdrs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-'));
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-x.md'),
    '---\nid: ADR-001\ntitle: Use Postgres\nstatus: Accepted\ndate: 2026-06-01\n---\n# x\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-y.md'),
    '---\nid: ADR-002\ntitle: Event bus\nstatus: Proposed\ndate: 2026-06-02\n---\n# y\n');
  return dir;
}

test('renderIndex builds a marker-wrapped table from front-matter', () => {
  const dir = scaffoldAdrs();
  const adrs = a.loadAdrFm(dir);
  const md = a.renderIndex(adrs);
  assert.match(md, /ADR-INDEX:START/);
  assert.match(md, /ADR-INDEX:END/);
  assert.match(md, /\| ADR-001 \| Use Postgres \| Accepted \| 2026-06-01 \|/);
  assert.match(md, /\| ADR-002 \| Event bus \| Proposed \| 2026-06-02 \|/);
});

test('writeIndex writes .product/adr/index.md and skips itself on re-run', () => {
  const dir = scaffoldAdrs();
  a.writeIndex(dir);
  const first = fs.readFileSync(path.join(dir, 'adr', 'index.md'), 'utf8');
  a.writeIndex(dir); // index.md now exists; must not be parsed as an ADR
  const second = fs.readFileSync(path.join(dir, 'adr', 'index.md'), 'utf8');
  assert.equal(first, second, 'idempotent');
  assert.ok(!/\| undefined \|/.test(second), 'index.md not treated as an ADR');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/adr-index.test.js`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `adr-index.js`**

Create `plugins/product-design-suite/scripts/adr-index.js`:

```js
// ADR index generator + SDD §15 status sync (feedback IMP-4). Front-matter is
// the single source of truth for ADR status/title.
const fs = require('node:fs');
const path = require('node:path');
const { readFrontMatter } = require('./consistency-gate.js');

const I_START = '<!-- ADR-INDEX:START — generated by adr-index.js, do not edit between markers -->';
const I_END = '<!-- ADR-INDEX:END -->';

function loadAdrFm(dir) {
  const adrDir = path.join(dir, 'adr');
  const out = [];
  if (!fs.existsSync(adrDir)) return out;
  for (const f of fs.readdirSync(adrDir).sort()) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    const fm = readFrontMatter(fs.readFileSync(path.join(adrDir, f), 'utf8'));
    if (fm.id) out.push(fm);
  }
  return out;
}

function renderIndex(adrs) {
  const rows = adrs.map(a =>
    `| ${a.id} | ${a.title || '—'} | ${a.status || '—'} | ${a.date || '—'} |`).join('\n');
  return `${I_START}\n\n# ADR Index\n\n| ADR | Title | Status | Date |\n| --- | --- | --- | --- |\n${rows}\n\n${I_END}\n`;
}

function writeIndex(dir) {
  const adrs = loadAdrFm(dir);
  fs.writeFileSync(path.join(dir, 'adr', 'index.md'), renderIndex(adrs));
  return adrs;
}

module.exports = { loadAdrFm, renderIndex, writeIndex, I_START, I_END };

if (require.main === module) {
  const dir = path.resolve(process.argv[2] || '.product');
  const adrs = writeIndex(dir);
  console.log(`adr-index: wrote ${adrs.length} ADR(s) to ${path.join(dir, 'adr', 'index.md')}`);
}
```

(SDD §15 status sync is added in Task 10; this task ships index generation only.)

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/adr-index.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/adr-index.js tests/adr-index.test.js
git commit -m "feat: adr-index.js generates .product/adr/index.md from front-matter (IMP-4)"
```

---

### Task 10: SDD §15 status sync + pm-doc-sync wiring (IMP-4, part 2)

**Files:**
- Modify: `plugins/product-design-suite/scripts/adr-index.js`, `shared/templates/sdd-template.md` (§15), `skills/pm-doc-sync/SKILL.md`
- Test: `tests/adr-index.test.js`

**Interfaces:**
- Consumes: `loadAdrFm` from Task 9.
- Produces:
  - `syncSddStatus(sddText, adrs) -> string` — between the `ADR-STATUS:START/END` markers, rewrites the `Status` column of each table data row whose first cell is an ADR id, using the ADR's front-matter `status`. Other cells untouched. No markers ⇒ text returned unchanged.
  - `S_START`/`S_END` exported.

- [x] **Step 1: Write the failing test**

Add to `tests/adr-index.test.js`:

```js
test('syncSddStatus rewrites only the Status column inside the markers', () => {
  const adrs = [{ id: 'ADR-001', status: 'Accepted' }, { id: 'ADR-002', status: 'Superseded' }];
  const sdd = [
    '## 15. Referenced ADRs', '',
    a.S_START,
    '| ADR | Decision | Status | Related Section |',
    '| --- | --- | --- | --- |',
    '| ADR-001 | Use Postgres | Proposed | §4 |',
    '| ADR-002 | Event bus | Proposed | §5 |',
    a.S_END, '',
  ].join('\n');
  const out = a.syncSddStatus(sdd, adrs);
  assert.match(out, /\| ADR-001 \| Use Postgres \| Accepted \| §4 \|/);
  assert.match(out, /\| ADR-002 \| Event bus \| Superseded \| §5 \|/);
  assert.match(out, /Use Postgres/); // authored cells preserved
});

test('syncSddStatus is a no-op without markers', () => {
  const sdd = '## 15. Referenced ADRs\n| ADR | Decision | Status |\n| ADR-001 | x | Proposed |\n';
  assert.equal(a.syncSddStatus(sdd, [{ id: 'ADR-001', status: 'Accepted' }]), sdd);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/adr-index.test.js`
Expected: FAIL — `a.syncSddStatus is not a function`.

- [x] **Step 3: Implement `syncSddStatus`**

In `scripts/adr-index.js`, add markers and the function, and extend exports:

```js
const S_START = '<!-- ADR-STATUS:START — generated by adr-index.js, do not edit between markers -->';
const S_END = '<!-- ADR-STATUS:END -->';

function syncSddStatus(sddText, adrs) {
  const s = String(sddText || '');
  const si = s.indexOf(S_START), ei = s.indexOf(S_END);
  if (si === -1 || ei === -1 || ei < si) return s;
  const status = Object.fromEntries(adrs.map(a => [a.id, a.status || '—']));
  const region = s.slice(si + S_START.length, ei);
  let statusCol = -1;
  const rewritten = region.split('\n').map(line => {
    if (!/^\s*\|/.test(line)) return line;
    const cells = line.split('|');                       // ['', ' c0 ', ' c1 ', ..., '']
    const trimmed = cells.map(c => c.trim());
    if (statusCol === -1 && trimmed.some(c => c.toLowerCase() === 'status')) {
      statusCol = trimmed.findIndex(c => c.toLowerCase() === 'status');
      return line; // header row
    }
    if (trimmed.every(c => /^:?-+:?$/.test(c) || c === '')) return line; // separator
    if (statusCol === -1) return line;
    const idMatch = (trimmed[1] || '').replace(/[<>]/g, '').match(/ADR-\d+/);
    if (!idMatch || !(idMatch[0] in status)) return line;
    cells[statusCol] = ` ${status[idMatch[0]]} `;
    return cells.join('|');
  }).join('\n');
  return s.slice(0, si + S_START.length) + rewritten + s.slice(ei);
}

module.exports = { loadAdrFm, renderIndex, writeIndex, syncSddStatus, I_START, I_END, S_START, S_END };
```

Also extend the CLI `main` block to sync the SDD when present:

```js
if (require.main === module) {
  const dir = path.resolve(process.argv[2] || '.product');
  const adrs = writeIndex(dir);
  const sddPath = path.join(dir, 'sdd', 'sdd.md');
  if (fs.existsSync(sddPath)) {
    fs.writeFileSync(sddPath, syncSddStatus(fs.readFileSync(sddPath, 'utf8'), adrs));
  }
  console.log(`adr-index: wrote ${adrs.length} ADR(s); synced SDD §15 status where present.`);
}
```

- [x] **Step 4: Add markers to the SDD template §15**

In `shared/templates/sdd-template.md`, wrap the §15 table with the status markers:

```markdown
## 15. Referenced ADRs

<!-- ADR-STATUS:START — generated by adr-index.js, do not edit between markers -->
| ADR | Decision | Status | Related Section |
| --- | --- | --- | --- |
| <ADR-NNN> | <Decision> | <Status> | <SDD section> |
<!-- ADR-STATUS:END -->
```

- [x] **Step 5: Wire into pm-doc-sync**

In `skills/pm-doc-sync/SKILL.md`, add a new step after step 1 (renumber following steps):

```markdown
1b. Regenerate the ADR index and sync ADR status:
    `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr-index.js" .product`
    This writes `.product/adr/index.md` from each ADR's front-matter and populates
    the SDD §15 `Status` column between the ADR-STATUS markers. Front-matter is the
    single source of truth — never hand-edit the §15 Status column.
```

- [x] **Step 6: Run test to verify it passes**

Run: `node --test tests/adr-index.test.js`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add plugins/product-design-suite/scripts/adr-index.js shared/templates/sdd-template.md skills/pm-doc-sync/SKILL.md tests/adr-index.test.js
git commit -m "feat: sync SDD §15 ADR status from front-matter via adr-index + pm-doc-sync (IMP-4)"
```

---

## Phase D — Templates & builder docs

### Task 11: `planned` concern status (IMP-5)

**Files:**
- Modify: `shared/templates/sdd-template.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:**
- Produces: the SDD concern-status enum is `designed | partial | gap | planned | n/a` everywhere.

- [x] **Step 1: Update the failing test**

In `tests/metadata-conventions.test.js`, replace the `sdd §9/§10/§14 carry a per-concern status field (D3)` test body with the new enum:

```js
test('sdd §9/§10/§14 carry a per-concern status field with planned (D3, IMP-5)', () => {
  const tpl = read('shared/templates/sdd-template.md');
  assert.match(tpl, /designed \| partial \| gap \| planned \| n\/a/);
  assert.ok((tpl.match(/designed \| partial \| gap \| planned \| n\/a/g) || []).length >= 3);
  // old four-value enum must be fully replaced
  assert.ok(!/designed \| partial \| gap \| n\/a/.test(tpl.replace(/designed \| partial \| gap \| planned \| n\/a/g, '')));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL — template still has the four-value enum.

- [x] **Step 3: Update the template**

In `shared/templates/sdd-template.md`, replace every occurrence of `designed | partial | gap | n/a` with `designed | partial | gap | planned | n/a` (the 3 legend lines at 345/386/526 and every concern-status table cell). Add a one-line gloss after each legend, e.g.:

```markdown
**Concern status** (`designed | partial | gap | planned | n/a`) — `planned` = designed but not yet built; `gap` = design missing:
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add shared/templates/sdd-template.md tests/metadata-conventions.test.js
git commit -m "feat: add planned concern status to SDD enum (IMP-5)"
```

---

### Task 12: Builder docs — docs/ guard, decision ledger, version-bump (IMP-9, IMP-10, IMP-11)

**Files:**
- Modify: `skills/pm-prd-builder/SKILL.md`, `pm-srs-builder/SKILL.md`, `pm-sad-builder/SKILL.md`, `pm-sdd-builder/SKILL.md`, `pm-adr-builder/SKILL.md`, `shared/references/questioning-protocol.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:**
- Produces: every builder SKILL states the `docs/` read-only guard and a version-bump heuristic; `questioning-protocol.md` defines the consolidated decision-ledger convention.

- [x] **Step 1: Write the failing test**

Add to `tests/metadata-conventions.test.js`:

```js
test('builders carry the docs/ guard and version-bump heuristic (IMP-9, IMP-11)', () => {
  for (const b of ['pm-prd-builder', 'pm-srs-builder', 'pm-sad-builder', 'pm-sdd-builder', 'pm-adr-builder']) {
    const s = read(`skills/${b}/SKILL.md`);
    assert.match(s, /docs\//, `${b} must mention the docs/ guard`);
    assert.match(s, /version/i, `${b} must mention version-bump guidance`);
  }
});

test('questioning-protocol defines a consolidated decision ledger (IMP-10)', () => {
  assert.match(read('shared/references/questioning-protocol.md'), /decision[- ]ledger|open decisions/i);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL — guard/heuristic/ledger text absent.

- [x] **Step 3: Add the guidance**

To each of the five builder SKILLs, add a `## Guards` (or extend an existing rules section) with:

```markdown
## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `.product/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
```

To `shared/references/questioning-protocol.md`, add:

```markdown
## Consolidated decision ledger

Instead of many separate question rounds, each builder run emits ONE structured
**"Open decisions + recommended defaults"** block: a single list where every open
decision shows a recommended default, so the user confirms the whole set in one pass.
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add skills/pm-prd-builder/SKILL.md skills/pm-srs-builder/SKILL.md skills/pm-sad-builder/SKILL.md skills/pm-sdd-builder/SKILL.md skills/pm-adr-builder/SKILL.md shared/references/questioning-protocol.md tests/metadata-conventions.test.js
git commit -m "docs: docs/ guard, decision ledger, version-bump heuristic in builders (IMP-9/10/11)"
```

---

## Phase E — Reciprocity

### Task 13: `related-adrs` reciprocity, warn-level (IMP-7)

**Files:**
- Modify: `plugins/product-design-suite/scripts/consistency-gate.js`
- Test: `tests/consistency-gate.test.js`

**Interfaces:**
- Consumes: gate `level` infra; existing `checkReciprocity`/`loadAdrs`.
- Produces: `checkRelatedReciprocity(adrs) -> string[]` — one-directional `related-adrs` links. Surfaced as a **`warn`**-level `related-adrs` gate check; never fails the gate. Existing `adr-reciprocity` (supersedes/amends) stays error-level.

- [x] **Step 1: Write the failing test**

Add to `tests/consistency-gate.test.js`:

```js
test('one-directional related-adrs warns but does not fail the gate (IMP-7)', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-a.md'),
    '---\nid: ADR-001\nrelated-adrs: [ADR-002]\n---\n# a\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-b.md'),
    '---\nid: ADR-002\nrelated-adrs: []\n---\n# b\n'); // missing back-link
  const r = g.runGate(dir);
  const rel = r.checks.find(c => c.name === 'related-adrs');
  assert.equal(rel.level, 'warn');
  assert.equal(rel.pass, false);
  assert.equal(r.pass, true, 'gate still passes — related-adrs is advisory');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/consistency-gate.test.js`
Expected: FAIL — no `related-adrs` check.

- [x] **Step 3: Implement**

In `scripts/consistency-gate.js`, add the checker next to `checkReciprocity`:

```js
// related-adrs should be symmetric: if A lists B, B should list A (advisory).
function checkRelatedReciprocity(adrs) {
  const problems = [];
  for (const [id, fm] of Object.entries(adrs)) {
    for (const other of (fm['related-adrs'] || [])) {
      const target = adrs[other];
      if (!target || !(target['related-adrs'] || []).includes(id)) {
        problems.push(`${id} lists related-adrs ${other} but ${other} does not list ${id}`);
      }
    }
  }
  return problems;
}
```

In `runGate`, after `const recip = checkReciprocity(adrs);` add:

```js
  const relRecip = checkRelatedReciprocity(adrs);
```

Add this check (after `mermaid-lint`):

```js
    { name: 'related-adrs', level: 'warn', pass: relRecip.length === 0,
      detail: relRecip.join('; ') || 'reciprocal' },
```

Export it: change the exports line to include `checkRelatedReciprocity`:

```js
module.exports = { runGate, checkReciprocity, checkRelatedReciprocity, readFrontMatter };
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/consistency-gate.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/consistency-gate.js tests/consistency-gate.test.js
git commit -m "feat: warn on one-directional related-adrs links (IMP-7)"
```

---

## Final verification

- [x] **Run the full suite**

Run: `node --test tests/*.test.js`
Expected: all tests pass, 0 failures.

- [x] **Run the plugin validator**

Run: `node tools/validate-plugin.js`
Expected: PASS (no structural regressions).

- [x] **Smoke-test the gate end to end**

Run: `node plugins/product-design-suite/scripts/consistency-gate.js /tmp/nonexistent-product`
Expected: `[FAIL] inputs-present: no .product/*.md found …` and `consistency-gate: FAIL` (exit 1) — proving the fail-loud behavior (IMP-2).

---

## Self-Review

**Spec coverage:**
- IMP-1 → Tasks 1–4 (stripCode + wiring + placeholders). ✓
- IMP-2 → Task 5 (cwd-safety, levels, inputs-present). ✓
- IMP-3 → Task 7 (validate-structure, warn). ✓
- IMP-4 → Tasks 9–10 (index + §15 status sync + pm-doc-sync). ✓
- IMP-5 → Task 11 (planned enum). ✓
- IMP-6 → Task 8 (mermaid-lint, error). ✓
- IMP-7 → Task 13 (related-adrs warn). ✓
- IMP-8 → Task 6 (definition vs mention split). ✓
- IMP-9, IMP-10, IMP-11 → Task 12 (builder docs). ✓

**Type consistency:** `stripCode` (Task 1) consumed in Tasks 2/3. `level` field (Task 5) consumed in Tasks 6/7/8/13. `lintProduct` returns `{malformed, duplicates, definitionDuplicates}` (Task 6) — gate uses `definitionDuplicates` for error, `duplicates` for the mention count. `loadAdrFm`/`renderIndex`/`writeIndex` (Task 9) and `syncSddStatus`/`S_START`/`S_END` (Task 10) match their tests. `validateDoc`/`validateProduct` (Task 7) and `lintBlock`/`lintMarkdown`/`lintProductDiagrams` (Task 8) match their tests.

**Placeholder scan:** every code/test step has concrete code; no TBD/TODO. ✓
