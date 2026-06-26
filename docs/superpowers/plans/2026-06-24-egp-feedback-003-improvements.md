# product-design-suite feedback-003 improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply all 17 improvements from `docs/feedbacks/003-improvements.md` to the `product-design-suite` plugin, centered on a single canonical ID-convention module that kills the silent ID-drift bug.

**Architecture:** A new `scripts/id-conventions.js` becomes the single source of truth for ID prefixes and member syntax (permissive: accepts `NFR-001` and `NFR-P1`, adds `C-NNN` constraints). `traceability.js` is refactored to consume it; a new `lint-ids.js` linter and a `consistency-gate.js` build on it. Templates, the diagram skills, `egp-import`, and `egp-product-workflow` then layer their improvements on top.

**Tech Stack:** Node.js (CommonJS, no external deps), `node:test` + `node:assert` for tests, Markdown templates/skills.

## Global Constraints

- Node.js standard library only — **no new npm dependencies** (matches existing scripts).
- All scripts are CommonJS (`require`/`module.exports`), `.js` extension, like `traceability.js`.
- Every test uses `node:test` + `node:assert` and lives in `tests/` (run with `node --test`).
- Canonical ID format is **permissive**: accept both `NFR-001` and `NFR-P1`; do **not** churn existing `NFR-001` examples in templates.
- Member regex (verbatim): prefix ∈ `FR BR NFR AR UAT ADR C`, then `-`, then `[A-Z]{0,2}` category letters, then `\d+`, then optional `[a-z]` sub-id suffix.
- Follow the existing conventions-test pattern (`assert.match(text, /…/)`) for documentation/skill assertions.
- Per project convention: tick each task's plan checkbox and commit before starting the next task.
- Run the **full** suite (`node --test`) before every commit; the existing `tests/traceability.test.js` is the regression guard for the Phase 0 refactor and must stay green.

---

## File Structure

**New files:**
- `plugins/product-design-suite/scripts/id-conventions.js` — canonical ID module (Task 1)
- `plugins/product-design-suite/scripts/lint-ids.js` — ID linter (Task 3)
- `plugins/product-design-suite/scripts/consistency-gate.js` — final gate (Task 16)
- `plugins/product-design-suite/shared/references/id-conventions.md` — human spec (Task 4)
- `tests/id-conventions.test.js`, `tests/lint-ids.test.js`, `tests/consistency-gate.test.js`

**Modified files:**
- `scripts/traceability.js` (Tasks 2, 5, 6, 7)
- `scripts/mermaid-preview.js` (Task 11)
- `shared/templates/{adr,sdd,srs,sad,prd}-template.md` (Tasks 4, 8, 9, 10)
- `skills/{egp-adr-builder,egp-doc-sync,egp-sad-builder,egp-sdd-builder,egp-import,egp-product-workflow}/SKILL.md` (Tasks 4, 8, 9, 11, 12, 13, 14, 15, 16)
- `tests/{traceability,metadata,import,sad,srs,diagram,mermaid-preview,traceability-conventions}*.test.js` (various)

---

# Phase 0 — Foundation: canonical ID conventions (E1; enables A1/A3/A4)

### Task 1: Canonical ID-convention module

**Files:**
- Create: `plugins/product-design-suite/scripts/id-conventions.js`
- Test: `tests/id-conventions.test.js`

**Interfaces:**
- Produces: `PREFIXES: string[]`, `PREFIX: string`, `CAT: string`, `MEMBER: string`, `MEMBER_RE: RegExp`, `REQ_RE: RegExp`, `parseMember(tok) -> {prefix, cat, num, suf} | null`, `classify(tok) -> string | null`, `familyOf(id) -> string | null` (returns e.g. `'FR-'` or `'NFR-P'`).

- [ ] **Step 1: Write the failing test**

```js
// tests/id-conventions.test.js
const test = require('node:test');
const assert = require('node:assert');
const c = require('../plugins/product-design-suite/scripts/id-conventions.js');

test('classify recognizes every canonical prefix incl constraints', () => {
  assert.equal(c.classify('FR-001'), 'FR');
  assert.equal(c.classify('C-7'), 'C');
  assert.equal(c.classify('NFR-P1'), 'NFR');     // category-lettered (A1)
  assert.equal(c.classify('UAT-005'), 'UAT');
});

test('parseMember splits category letters from the number', () => {
  assert.deepEqual(c.parseMember('NFR-PR1'), { prefix: 'NFR', cat: 'PR', num: '1', suf: '' });
  assert.deepEqual(c.parseMember('FR-003a'), { prefix: 'FR', cat: '', num: '3', suf: 'a' });
});

test('classify returns null for non-ids', () => {
  assert.equal(c.classify('FRX-9'), null);
  assert.equal(c.classify('service/002'), null);
});

test('familyOf includes the dash and any category for range expansion', () => {
  assert.equal(c.familyOf('NFR-P1'), 'NFR-P');
  assert.equal(c.familyOf('FR-003'), 'FR-');
});

test('PREFIXES contains constraints', () => {
  assert.ok(c.PREFIXES.includes('C'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/id-conventions.test.js`
Expected: FAIL — `Cannot find module '.../id-conventions.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/product-design-suite/scripts/id-conventions.js
// Canonical ID convention — the single source of truth for requirement/ADR/
// constraint identifiers. Consumed by traceability.js, lint-ids.js, and
// consistency-gate.js so the regex lives in exactly one place (feedback E1).
//
// Accepted forms (permissive — feedback A1/A4):
//   FR-001  BR-002  NFR-003  AR-004  UAT-005  ADR-006  C-007
//   NFR-P1  NFR-S4  NFR-PR1            (category-lettered NFRs)
//   FR-003a                            (sub-id suffix letter)

const PREFIXES = ['FR', 'BR', 'NFR', 'AR', 'UAT', 'ADR', 'C'];
const PREFIX = '(?:' + PREFIXES.join('|') + ')';
const CAT = '[A-Z]{0,2}';                       // optional category letters, e.g. P, PR, S
const MEMBER = PREFIX + '-' + CAT + '\\d+[a-z]?';
const MEMBER_RE = new RegExp('^(' + PREFIXES.join('|') + ')-(' + CAT + ')(\\d+)([a-z]?)$');
const REQ_RE = /^(FR|BR|NFR)-/;

function parseMember(tok) {
  const m = String(tok == null ? '' : tok).match(MEMBER_RE);
  if (!m) return null;
  return { prefix: m[1], cat: m[2] || '', num: m[3], suf: m[4] || '' };
}

function classify(tok) {
  const m = parseMember(tok);
  return m ? m.prefix : null;
}

// Family = the constant part across a numeric range, WITH its trailing dash, so
// that `familyOf(id) + number === id`. FR-003 -> 'FR-', NFR-P1 -> 'NFR-P'.
function familyOf(id) {
  const m = parseMember(id);
  if (!m) return null;
  return `${m.prefix}-${m.cat}`;
}

module.exports = { PREFIXES, PREFIX, CAT, MEMBER, MEMBER_RE, REQ_RE, parseMember, classify, familyOf };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/id-conventions.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/id-conventions.js tests/id-conventions.test.js
git commit -m "feat: canonical id-conventions module (E1 foundation; A1/A4 prefixes)"
```

---

### Task 2: Refactor traceability.js onto the module (lands A1)

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js:1-96` (constants + parse helpers)
- Test: `tests/traceability.test.js` (add category cases; existing cases are the regression guard)

**Interfaces:**
- Consumes: `id-conventions.js` (`PREFIX`, `MEMBER`, `CAT`, `parseMember`, `familyOf`, `REQ_RE`).
- Produces: unchanged public API (`parseRefs`, `expandRange`, `buildMatrix`, …) but now recognizes `NFR-P1`, `C-NNN`.

- [ ] **Step 1: Write the failing tests** (append to `tests/traceability.test.js`)

```js
test('parseRefs recognizes category-lettered NFR ids (A1)', () => {
  assert.deepEqual(t.parseRefs('Targets NFR-P1 and NFR-S4 and NFR-PR1.'),
    ['NFR-P1', 'NFR-PR1', 'NFR-S4']);
});

test('parseRefs expands a category-lettered range', () => {
  assert.deepEqual(t.parseRefs('NFR-P1..P3'), ['NFR-P1', 'NFR-P2', 'NFR-P3']);
});

test('parseRefs recognizes constraint ids (A4 prefix)', () => {
  assert.ok(t.parseRefs('Bounded by C-1 and C-8.').includes('C-1'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — category/constraint ids not found (current regex drops them).

- [ ] **Step 3: Apply the refactor**

Replace lines 4-5:

```js
const PREFIX = '(?:FR|BR|NFR|AR|UAT|ADR)';
const MEMBER = PREFIX + '-\\d+[a-z]?';
```

with:

```js
const C = require('./id-conventions.js');
const PREFIX = C.PREFIX;
const MEMBER = C.MEMBER;
```

Replace the `GROUP_RE`/`TOKEN_RE` definitions (lines 7-11) — the continuation tails must allow optional category letters:

```js
// A reference group: an anchor member plus a run of continuation operators + members.
const GROUP_RE = new RegExp(
  MEMBER + '(?:\\s*(?:…|\\.\\.\\.|\\.\\.|[/,])\\s*(?:' + PREFIX + '-)?' + C.CAT + '\\d+[a-z]?|/[a-z](?![a-z\\d]))*', 'g');
// Tokens inside a group. Member alternative first so 'FR-001' wins over '..'+digits.
const TOKEN_RE = new RegExp(
  MEMBER + '|…|\\.\\.\\.|\\.\\.|[/,]|' + C.CAT + '\\d+[a-z]?|[a-z]', 'g');
```

Delete the local `REQ_RE` on line 18 (now imported); change it to:

```js
const REQ_RE = C.REQ_RE;
```

Replace `memberParts` (lines 25-33) with a category-aware version that defers to the module:

```js
function memberParts(tok) {
  const m = C.parseMember(tok);
  if (m) return { prefix: m.prefix, cat: m.cat, num: m.num, suf: m.suf };
  const bare = tok.match(/^([A-Z]{0,2})(\d+)([a-z]?)$/);
  if (bare) return { prefix: null, cat: bare[1] || '', num: bare[2], suf: bare[3] };
  const bareSuf = tok.match(/^([a-z])$/);
  if (bareSuf) return { prefix: null, cat: '', num: null, suf: bareSuf[1] };
  return null;
}
```

Replace `expandRange` (lines 35-50) to use family-aware boundaries:

```js
function expandRange(startId, endId) {
  const fa = C.familyOf(startId), fb = C.familyOf(endId);
  const a = C.parseMember(startId), b = C.parseMember(endId);
  if (!a || !b || fa !== fb) return [startId, endId];
  const start = parseInt(a.num, 10), end = parseInt(b.num, 10);
  const width = Math.max(a.num.length, b.num.length);
  if (end < start || (end - start) >= MAX_SPAN) {
    if ((end - start) >= MAX_SPAN) {
      console.warn(`traceability: range ${startId}..${endId} exceeds ${MAX_SPAN}; emitting endpoints only`);
    }
    return [startId, endId];
  }
  const out = [];
  for (let i = start; i <= end; i++) out.push(`${fa}${pad(i, width)}`);
  return out;
}
```

Replace `parseGroup` (lines 52-78) to carry the category through list/range continuations:

```js
function parseGroup(group) {
  const toks = group.match(TOKEN_RE) || [];
  const ids = [];
  let prefix = null, cat = '', prev = null, pendingRange = false;
  for (const tok of toks) {
    if (RANGE_OPS.has(tok)) { pendingRange = true; continue; }
    if (LIST_OPS.has(tok)) { pendingRange = false; continue; }
    const parts = memberParts(tok);
    if (!parts) continue;
    if (parts.prefix) prefix = parts.prefix;
    if (!prefix) continue;
    cat = parts.prefix ? parts.cat : (parts.cat || cat); // inherit category for bare tails
    const num = parts.num !== null ? parts.num : (prev && prev.num);
    if (!num) continue;
    const cur = { prefix, cat, num, suf: parts.suf };
    const curId = `${cur.prefix}-${cur.cat}${cur.num}${cur.suf}`;
    if (pendingRange && prev) {
      ids.pop(); // remove prev's standalone push; replace with the full range
      for (const r of expandRange(`${prev.prefix}-${prev.cat}${prev.num}${prev.suf}`, curId)) ids.push(r);
    } else {
      ids.push(curId);
    }
    prev = cur;
    pendingRange = false;
  }
  return ids;
}
```

Replace `refTuple` (lines 80-83) so sorting accounts for the category:

```js
function refTuple(id) {
  const m = C.parseMember(id);
  return m ? [m.prefix, m.cat, parseInt(m.num, 10), m.suf] : [id, '', 0, ''];
}
```

And update `refCompare` (lines 84-89) for the extra field:

```js
function refCompare(a, b) {
  const x = refTuple(a), y = refTuple(b);
  if (x[0] !== y[0]) return x[0] < y[0] ? -1 : 1;
  if (x[1] !== y[1]) return x[1] < y[1] ? -1 : 1;
  if (x[2] !== y[2]) return x[2] - y[2];
  return x[3] < y[3] ? -1 : x[3] > y[3] ? 1 : 0;
}
```

- [ ] **Step 4: Run the full suite to verify pass + no regression**

Run: `node --test`
Expected: PASS — new category/constraint tests pass AND every pre-existing `tests/traceability.test.js` case still passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "refactor: traceability.js consumes id-conventions module; recognizes NFR-P1/C-NNN (A1)"
```

---

### Task 3: ID linter (E1)

**Files:**
- Create: `plugins/product-design-suite/scripts/lint-ids.js`
- Test: `tests/lint-ids.test.js`

**Interfaces:**
- Consumes: `id-conventions.js` (`MEMBER_RE`, `classify`, `PREFIXES`).
- Produces: `lintText(text) -> {malformed: string[]}` (ID-shaped tokens that fail the canonical regex), `lintProduct(dir) -> {malformed: [{file, token}], duplicates: [{id, files}]}`, CLI exit code (0 clean / 1 violations).

- [ ] **Step 1: Write the failing test**

```js
// tests/lint-ids.test.js
const test = require('node:test');
const assert = require('node:assert');
const l = require('../plugins/product-design-suite/scripts/lint-ids.js');

test('lintText flags ID-shaped tokens that miss the canonical form', () => {
  // 'NFR_P1' uses an underscore; 'FR-01X' has an uppercase trailing letter.
  const r = l.lintText('Good: FR-001 NFR-P1 C-3. Bad: NFR_P1 FR-01X.');
  assert.ok(r.malformed.includes('NFR_P1'));
  assert.ok(r.malformed.includes('FR-01X'));
});

test('lintText passes clean canonical text', () => {
  assert.deepEqual(l.lintText('FR-001 NFR-P1 AR-002 C-8 UAT-003 ADR-004').malformed, []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/lint-ids.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// plugins/product-design-suite/scripts/lint-ids.js
// ID linter (feedback E1): flags identifiers that LOOK like requirement IDs but
// do not match the canonical convention in id-conventions.js, plus duplicates.
const fs = require('node:fs');
const path = require('node:path');
const C = require('./id-conventions.js');

// "ID-shaped": a known prefix, a dash, then letters/digits/underscores — broad
// on purpose so we catch near-misses (NFR_P1, FR-01X) the canonical regex drops.
const SHAPED_RE = new RegExp('\\b(?:' + C.PREFIXES.join('|') + ')[-_][A-Za-z0-9]+', 'g');

function lintText(text) {
  const shaped = String(text || '').match(SHAPED_RE) || [];
  const malformed = [...new Set(shaped.filter(tok => !C.MEMBER_RE.test(tok.replace('_', '-')) && !C.MEMBER_RE.test(tok)))];
  return { malformed };
}

function lintProduct(dir) {
  const malformed = [];
  const seen = new Map(); // id -> Set<file>
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf8');
        for (const tok of lintText(text).malformed) malformed.push({ file: p, token: tok });
        for (const tok of (text.match(SHAPED_RE) || [])) {
          if (C.MEMBER_RE.test(tok)) {
            const set = seen.get(tok) || new Set();
            set.add(p);
            seen.set(tok, set);
          }
        }
      }
    }
  };
  walk(dir);
  const duplicates = [...seen.entries()]
    .filter(([, files]) => files.size > 1)
    .map(([id, files]) => ({ id, files: [...files] }));
  return { malformed, duplicates };
}

module.exports = { lintText, lintProduct, SHAPED_RE };

if (require.main === module) {
  const dir = process.argv[2] || '.product';
  const { malformed, duplicates } = lintProduct(dir);
  for (const m of malformed) console.log(`malformed id "${m.token}" in ${m.file}`);
  for (const d of duplicates) console.log(`duplicate id ${d.id} in ${d.files.join(', ')}`);
  if (malformed.length || duplicates.length) {
    console.error(`lint-ids: ${malformed.length} malformed, ${duplicates.length} duplicate id(s).`);
    process.exit(1);
  }
  console.log('lint-ids: all ids match the canonical convention.');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/lint-ids.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/lint-ids.js tests/lint-ids.test.js
git commit -m "feat: lint-ids.js — flags non-canonical and duplicate ids (E1)"
```

---

### Task 4: Canonical ID reference doc + template links

**Files:**
- Create: `plugins/product-design-suite/shared/references/id-conventions.md`
- Modify: `shared/templates/srs-template.md`, `shared/templates/sad-template.md` (link to the spec near their ID tables)
- Test: `tests/traceability-conventions.test.js` (add assertions)

**Interfaces:** documentation only; no code API.

- [ ] **Step 1: Write the failing test** (append to `tests/traceability-conventions.test.js`)

```js
test('id-conventions reference documents prefixes, category-letters and constraints', () => {
  const s = read('shared/references/id-conventions.md');
  assert.match(s, /NFR-P1/);          // category-lettered example (A1)
  assert.match(s, /\bC-\d/);          // constraints (A4)
  assert.match(s, /FR|BR|NFR|AR|UAT|ADR/);
});

test('srs and sad templates link to the id-conventions reference', () => {
  assert.match(read('shared/templates/srs-template.md'), /id-conventions/);
  assert.match(read('shared/templates/sad-template.md'), /id-conventions/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/traceability-conventions.test.js`
Expected: FAIL — reference file missing.

- [ ] **Step 3: Create the reference and add the links**

Create `plugins/product-design-suite/shared/references/id-conventions.md`:

```markdown
# Canonical ID Conventions

The single, shared specification for requirement, architecture, test, decision,
and constraint identifiers. The traceability tooling (`scripts/traceability.js`),
the linter (`scripts/lint-ids.js`), and the consistency gate all derive their
notion of a "valid ID" from `scripts/id-conventions.js`, which implements this
spec. Keep documents and tooling in sync by following the forms below.

## Prefixes

| Prefix | Meaning                       | Owning document |
| ------ | ----------------------------- | --------------- |
| FR     | Functional requirement        | PRD or SRS      |
| BR     | Business requirement          | PRD             |
| NFR    | Non-functional requirement    | PRD or SRS      |
| AR     | Architectural requirement     | SAD (or SDD)    |
| UAT    | User acceptance test          | PRD             |
| ADR    | Architecture decision record  | ADR files       |
| C      | Constraint                    | SRS/SAD/SDD     |

## Member form

```
<PREFIX>-[CATEGORY][NUMBER][suffix]
```

- **CATEGORY** — 0 to 2 uppercase letters, optional. Lets you group by category,
  e.g. `NFR-P1` (performance), `NFR-S4` (security), `NFR-PR1`. Both the plain
  form `NFR-001` and the category form `NFR-P1` are valid and accepted.
- **NUMBER** — one or more digits. Zero-pad for stable sorting (`FR-001`).
- **suffix** — a single lowercase letter for sub-items, e.g. `FR-003a`.

Examples: `FR-001`, `BR-002`, `NFR-003`, `NFR-P1`, `AR-004`, `UAT-005`,
`ADR-006`, `C-007`, `FR-003a`.

## Ranges and lists

- Range: `FR-001..FR-005`, `FR-036…042`, `NFR-P1..P3`.
- List: `FR-001/002/003a`, `FR-010a, FR-010b`.

## Linting

Run `node scripts/lint-ids.js .product` to flag identifiers that look like IDs
but do not match this spec, and duplicate IDs across files.
```

In `shared/templates/srs-template.md`, immediately above the FR/NFR requirement tables in §3, add the line:

```markdown
> ID format follows the [canonical ID conventions](../references/id-conventions.md): `FR-001`/`NFR-001` or category-grouped `NFR-P1`.
```

In `shared/templates/sad-template.md`, immediately above the Architectural Requirements table in §2, add:

```markdown
> AR/constraint IDs follow the [canonical ID conventions](../references/id-conventions.md).
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/traceability-conventions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/references/id-conventions.md plugins/product-design-suite/shared/templates/srs-template.md plugins/product-design-suite/shared/templates/sad-template.md tests/traceability-conventions.test.js
git commit -m "docs: canonical id-conventions reference; templates link to it (E1)"
```

---

# Phase 1 — Section A: traceability (depends on Phase 0)

### Task 5: A3 — report unclassifiable ID-shaped tokens

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js` (`buildMatrix`, CLI block, `renderCoverageBlock`)
- Test: `tests/traceability.test.js`

**Interfaces:**
- Consumes: `lint-ids.js` `lintText`, or `id-conventions` `SHAPED_RE` + `MEMBER_RE`.
- Produces: `buildMatrix(...)` return object gains `unclassified: string[]`; CLI prints a warning; coverage block renders a note when non-empty.

- [ ] **Step 1: Write the failing test**

```js
test('buildMatrix reports ID-shaped tokens it could not classify (A3)', () => {
  const m = t.buildMatrix({
    prd: 'Defines FR-001. Also mentions NFR_P1 and FR-01X informally.',
    sdd: '## 4. Components\nImplements FR-001.',
    adrs: {},
  });
  assert.ok(m.unclassified.includes('NFR_P1'));
  assert.ok(m.unclassified.includes('FR-01X'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — `m.unclassified` is undefined.

- [ ] **Step 3: Implement**

At the top of `traceability.js` (after the `C` require added in Task 2) add:

```js
const { lintText } = require('./lint-ids.js');
```

In `buildMatrix`, before the final `return`, compute the union of malformed tokens across all inputs:

```js
  const unclassified = [...new Set([prd, sdd, srs, sad, ...Object.values(adrs)]
    .flatMap(txt => lintText(txt).malformed))].sort();
```

Change the return to include it:

```js
  return { requirements, ars, uats, orphans, unclassified };
```

In `renderCoverageBlock`, after the orphans line block, add:

```js
  if (matrix.unclassified && matrix.unclassified.length) {
    out += `\n> ⚠️ ${matrix.unclassified.length} unclassified ID-shaped token(s) (check ID format): ${matrix.unclassified.join(', ')}\n`;
  }
```

In the CLI block (`require.main`), after computing `matrix`, add:

```js
  if (matrix.unclassified.length) {
    console.warn(`traceability: saw ${matrix.unclassified.length} token(s) it could not classify: ${matrix.unclassified.join(', ')}`);
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: traceability reports unclassified id-shaped tokens (A3)"
```

---

### Task 6: A2 — structural AR-table column parsing

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js` (add `parseArTable`, union into AR traces)
- Test: `tests/traceability.test.js`

**Interfaces:**
- Produces: `parseArTable(markdown) -> Map<arId, string[]>` (AR → requirement IDs from the Source column), exported and unioned into `arTrace` inside `buildMatrix`.

- [ ] **Step 1: Write the failing test**

```js
test('parseArTable links AR to Source-column ids even across a period (A2)', () => {
  const sad = [
    '### Architectural Requirements',
    '',
    '| ID | Requirement | Source | Design Impact |',
    '| --- | --- | --- | --- |',
    '| AR-001 | Must scale horizontally. | FR-012, NFR-P1 | Stateless services |',
    '| AR-002 | Encrypt at rest. | NFR-S4 | KMS-backed storage |',
  ].join('\n');
  const map = t.parseArTable(sad);
  assert.deepEqual(map.get('AR-001'), ['FR-012', 'NFR-P1']);
  assert.deepEqual(map.get('AR-002'), ['NFR-S4']);
});

test('buildMatrix folds AR-table sources into AR traces', () => {
  const sad = [
    '| ID | Requirement | Source | Design Impact |',
    '| --- | --- | --- | --- |',
    '| AR-001 | Scale. | FR-012 | x |',
  ].join('\n');
  const m = t.buildMatrix({ prd: 'FR-012 export.', sdd: '## 4\nFR-012', sad });
  const ar = m.ars.find(a => a.id === 'AR-001');
  assert.ok(ar.tracesTo.includes('FR-012'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — `t.parseArTable` is not a function.

- [ ] **Step 3: Implement**

Add `parseArTable` near `linksWithin` in `traceability.js`:

```js
// Structurally read an "Architectural Requirements" table: AR id from the ID
// column, requirement ids from the Source column. Independent of sentence
// boundaries, unlike linksWithin (feedback A2).
function parseArTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const map = new Map();
  let cols = null; // {id, source} column indices
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) { cols = null; continue; }
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.every(c => /^:?-+:?$/.test(c) || c === '')) continue; // separator row
    const lower = cells.map(c => c.toLowerCase());
    if (lower.includes('id') && lower.includes('source')) {
      cols = { id: lower.indexOf('id'), source: lower.indexOf('source') };
      continue;
    }
    if (!cols) continue;
    const arId = (cells[cols.id] || '').match(/^AR-[A-Z]{0,2}\d+[a-z]?/);
    if (!arId) continue;
    const reqs = parseRefs(cells[cols.source] || '').filter(id => REQ_RE.test(id));
    if (reqs.length) map.set(arId[0], reqs);
  }
  return map;
}
```

In `buildMatrix`, after `const arTrace = linksWithin(arSource, /^AR-/, REQ_RE);`, union the table-derived links:

```js
  const arTable = parseArTable(arSource);
  for (const [ar, reqs] of arTable) {
    const merged = new Set([...(arTrace.get(ar) || []), ...reqs]);
    arTrace.set(ar, [...merged].sort(refCompare));
  }
```

Note: `parseRefs(arSource)` already discovers AR ids that appear only in the table, so the `ars` list picks them up. Add `parseArTable` to `module.exports`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: structural AR-table column parsing in traceability (A2)"
```

---

### Task 7: A4 — constraints (C-NNN) as a first-class matrix group

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js` (`buildMatrix`, `renderCoverageBlock`)
- Test: `tests/traceability.test.js`

**Interfaces:**
- Produces: `buildMatrix(...)` return gains `constraints: [{id, tracesTo, adrs}]`; rendered as a dedicated Constraints table.

- [ ] **Step 1: Write the failing test**

```js
test('buildMatrix surfaces constraints and what they trace to (A4)', () => {
  const m = t.buildMatrix({
    prd: 'FR-012 export. Constraint C-1 limits payload; relates to FR-012.',
    sdd: '## 4\nFR-012',
    adrs: { 'ADR-003.md': 'Honors C-1 in the gateway.' },
  });
  const c1 = m.constraints.find(c => c.id === 'C-1');
  assert.ok(c1, 'C-1 present');
  assert.ok(c1.tracesTo.includes('FR-012'));
  assert.ok(c1.adrs.includes('ADR-003'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — `m.constraints` undefined.

- [ ] **Step 3: Implement**

In `buildMatrix`, after the `ars` block, add constraints (sourced from the union of PRD/SRS/SAD/SDD text):

```js
  const cSource = [prd, srs, sad, sdd].join('\n');
  const cTrace = linksWithin(cSource, /^C-/, REQ_RE);
  const constraints = parseRefs(cSource).filter(id => /^C-/.test(id)).map(id => ({
    id, tracesTo: cTrace.get(id) || [], adrs: adrsFor(id),
  }));
```

Add `constraints` to the return:

```js
  return { requirements, ars, uats, orphans, unclassified, constraints };
```

In `renderCoverageBlock`, after the AR table block, add:

```js
  if (matrix.constraints && matrix.constraints.length) {
    out += '\n**Constraints**\n\n| Constraint | Traces to | In ADRs |\n| --- | --- | --- |\n';
    out += matrix.constraints.map(c => `| ${c.id} | ${c.tracesTo.join(', ') || '—'} | ${c.adrs.join(', ') || '—'} |`).join('\n') + '\n';
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: constraints (C-NNN) as first-class traceability group (A4)"
```

---

# Phase 2 — Section D: templates & front-matter

### Task 8: D1 — `related-srs` in the ADR schema

**Files:**
- Modify: `shared/templates/adr-template.md` (front-matter), `skills/egp-adr-builder/SKILL.md`, `skills/egp-doc-sync/SKILL.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:** front-matter field `related-srs: []`.

- [ ] **Step 1: Write the failing test** (append to `tests/metadata-conventions.test.js`)

```js
test('adr template front-matter includes related-srs (D1)', () => {
  const tpl = read('shared/templates/adr-template.md');
  assert.match(tpl, /related-srs:\s*\[\]/);
});

test('egp-adr-builder and egp-doc-sync mention related-srs', () => {
  assert.match(read('skills/egp-adr-builder/SKILL.md'), /related-srs/);
  assert.match(read('skills/egp-doc-sync/SKILL.md'), /related-srs/);
});
```

(Use the existing `read`/`root` helpers already defined at the top of `tests/metadata-conventions.test.js`.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `shared/templates/adr-template.md`, add after the `related-prd` line:

```yaml
related-srs: []     # SRS section/ID references, e.g. ["§3 FR-012", "NFR-P1"]
```

In `skills/egp-adr-builder/SKILL.md`, in the front-matter guidance, add a bullet:

```markdown
- When FR/NFR live in an SRS, link them via `related-srs` (e.g. `["§3 FR-012"]`).
```

In `skills/egp-doc-sync/SKILL.md`, where related-* links are parsed/checked, add `related-srs` to the list of ADR relationship fields it reads and reciprocity-checks.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/templates/adr-template.md plugins/product-design-suite/skills/egp-adr-builder/SKILL.md plugins/product-design-suite/skills/egp-doc-sync/SKILL.md tests/metadata-conventions.test.js
git commit -m "feat: ADR related-srs front-matter field (D1)"
```

---

### Task 9: D2 — blessed mode-banner slot

**Files:**
- Modify: `shared/templates/srs-template.md`, `shared/templates/sad-template.md`, `skills/egp-srs-builder/SKILL.md`, `skills/egp-sad-builder/SKILL.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:** an HTML-comment-delimited slot `<!-- MODE-BANNER:START -->…<!-- MODE-BANNER:END -->` directly after front-matter.

- [ ] **Step 1: Write the failing test**

```js
test('srs and sad templates ship a mode-banner slot (D2)', () => {
  assert.match(read('shared/templates/srs-template.md'), /MODE-BANNER:START/);
  assert.match(read('shared/templates/srs-template.md'), /MODE-BANNER:END/);
  assert.match(read('shared/templates/sad-template.md'), /MODE-BANNER:START/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In both `srs-template.md` and `sad-template.md`, directly after the closing `---` of the front-matter and before the `# SRS:`/`# SAD:` heading, insert:

```markdown
<!-- MODE-BANNER:START — optional orientation note (e.g. "This SRS owns the canonical FR/NFR"); leave as-is if unused -->
<!-- MODE-BANNER:END -->
```

In `skills/egp-srs-builder/SKILL.md` and `skills/egp-sad-builder/SKILL.md`, add a line directing the builder to fill the `MODE-BANNER` slot with the mode orientation note instead of inventing an ad-hoc banner.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/templates/srs-template.md plugins/product-design-suite/shared/templates/sad-template.md plugins/product-design-suite/skills/egp-srs-builder/SKILL.md plugins/product-design-suite/skills/egp-sad-builder/SKILL.md tests/metadata-conventions.test.js
git commit -m "feat: blessed mode-banner slot in SRS/SAD templates (D2)"
```

---

### Task 10: D3 — per-concern status field in SDD §9/§10/§14

**Files:**
- Modify: `shared/templates/sdd-template.md`
- Test: `tests/metadata-conventions.test.js`

**Interfaces:** a leading status table per section with a `Status` column constrained to `designed | partial | gap | n/a`.

- [ ] **Step 1: Write the failing test**

```js
test('sdd §9/§10/§14 carry a per-concern status field (D3)', () => {
  const tpl = read('shared/templates/sdd-template.md');
  assert.match(tpl, /designed \| partial \| gap \| n\/a/);
  // appears for each of the three sections
  assert.ok((tpl.match(/designed \| partial \| gap \| n\/a/g) || []).length >= 3);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

At the top of SDD §9 (Observability), §10 (Resilience and Reliability), and §14 (Operations), insert a status table. For §9:

```markdown
**Concern status** (`designed | partial | gap | n/a`):

| Concern | Status | Notes |
| --- | --- | --- |
| Logs | <designed | partial | gap | n/a> | <note> |
| Metrics | <designed | partial | gap | n/a> | <note> |
| Traces | <designed | partial | gap | n/a> | <note> |
| Alerts | <designed | partial | gap | n/a> | <note> |
```

For §10 use rows: Retry, Circuit breakers, Timeouts, Fallbacks, Idempotency, Disaster recovery. For §14 use rows: Runbooks, Support model, SLOs/SLAs, Capacity planning, Incident response. Each row's Status cell carries the literal `<designed | partial | gap | n/a>` placeholder.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/templates/sdd-template.md tests/metadata-conventions.test.js
git commit -m "feat: per-concern status field in SDD §9/§10/§14 (D3)"
```

---

# Phase 3 — Section B: diagram workflow

### Task 11: B2 — surface the one-shot render path

**Files:**
- Modify: `plugins/product-design-suite/scripts/mermaid-preview.js` (clearer CLI path output), `skills/egp-sdd-builder/SKILL.md`, `skills/egp-sad-builder/SKILL.md`, `skills/egp-product-workflow/SKILL.md`
- Test: `tests/mermaid-preview.test.js`

**Interfaces:** the existing CLI `mermaid-preview.js <input.md> <out.html>` already renders a self-contained file with no server; make it print an absolute path and document it as the lighter path.

- [ ] **Step 1: Write the failing test** (append to `tests/mermaid-preview.test.js`)

```js
test('CLI prints the absolute output path for the one-shot render (B2)', () => {
  const os = require('node:os');
  const cp = require('node:child_process');
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-'));
  const md = path.join(dir, 'in.md');
  const out = path.join(dir, 'out.html');
  fs.writeFileSync(md, '```mermaid\nflowchart TD\nA-->B\n```\n');
  const script = path.join(__dirname, '..', 'plugins', 'product-design-suite', 'scripts', 'mermaid-preview.js');
  const res = cp.execFileSync('node', [script, md, out], { encoding: 'utf8' });
  assert.match(res, new RegExp(out.replace(/[.\\]/g, '\\$&')));
  assert.ok(fs.existsSync(out));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/mermaid-preview.test.js`
Expected: FAIL — CLI currently logs `Wrote out.html (...)` (basename only via the passed path; assert the absolute form).

- [ ] **Step 3: Implement**

In `mermaid-preview.js` CLI block, change the final log to print the resolved absolute path:

```js
  const abs = path.resolve(outPath);
  fs.writeFileSync(abs, renderPreview(blocks, { title: path.basename(inPath), mermaidJs }));
  console.log(`Wrote ${abs} (${blocks.length} diagram${blocks.length === 1 ? '' : 's'}) — open this file directly; no server needed.`);
```

In `egp-sdd-builder`, `egp-sad-builder`, and `egp-product-workflow` SKILL.md, add a sentence offering the lighter path: *"For a quick look without the preview server, run `node scripts/mermaid-preview.js <draft.md> <out.html>` and open the returned file directly."*

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/mermaid-preview.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/mermaid-preview.js plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md plugins/product-design-suite/skills/egp-sad-builder/SKILL.md plugins/product-design-suite/skills/egp-product-workflow/SKILL.md tests/mermaid-preview.test.js
git commit -m "feat: surface one-shot (server-less) diagram render path (B2)"
```

---

### Task 12: B1 + B3 — derived vs net-new diagram rules

**Files:**
- Modify: `skills/egp-sad-builder/SKILL.md`, `skills/egp-sdd-builder/SKILL.md`
- Test: `tests/diagram-conventions.test.js`

**Interfaces:** documentation/skill behavior only.

- [ ] **Step 1: Write the failing test** (append to `tests/diagram-conventions.test.js`)

```js
test('sad/sdd builders distinguish derived vs net-new diagram approval (B1/B3)', () => {
  for (const skill of ['skills/egp-sad-builder/SKILL.md', 'skills/egp-sdd-builder/SKILL.md']) {
    const s = read(skill);
    assert.match(s, /net-new/i);
    assert.match(s, /batch-confirm|faithful conversion|derived/i);
  }
});
```

(Reuse the `read` helper at the top of `tests/diagram-conventions.test.js`.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/diagram-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In the diagram section of both `egp-sad-builder` and `egp-sdd-builder` SKILL.md, add:

```markdown
**Approval bar by provenance (B1/B3):**
- **Net-new diagrams** (authored from scratch) MUST go through the preview loop
  one at a time until approved.
- **Derived diagrams** (faithful conversions of existing source, e.g. from an
  import or a SAD→SDD lift) MAY be batch-confirmed: present them together and
  ask for a single approval. Derive-then-confirm covers *section content*; these
  derived diagrams may be folded into that same confirmation batch. Net-new
  diagrams remain outside the batch and use the preview loop.
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/diagram-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/skills/egp-sad-builder/SKILL.md plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md tests/diagram-conventions.test.js
git commit -m "docs: derived vs net-new diagram approval bar (B1/B3)"
```

---

# Phase 4 — Section C: egp-import

### Task 13: C1 — machine-readable import map

**Files:**
- Modify: `skills/egp-import/SKILL.md`
- Test: `tests/import-conventions.test.js`

**Interfaces:** import emits `.product/import-map.json` with shape `{ targets: { <doc>: [{ sourceRef, status, mappedTo }] }, unmapped: [] }`.

- [ ] **Step 1: Write the failing test** (append to `tests/import-conventions.test.js`)

```js
test('egp-import documents a machine-readable import-map.json (C1)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /import-map\.json/);
  assert.match(s, /sourceRef|mappedTo|unmapped/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/import-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `skills/egp-import/SKILL.md`, in the output section (alongside the prose gap report), add:

```markdown
### Machine-readable map

Alongside `.product/import-gap-report.md`, write `.product/import-map.json` so
builders consume a structured map instead of re-reading prose:

```json
{
  "targets": {
    "prd": [{ "sourceRef": "legacy/spec.md#goals", "status": "derived", "mappedTo": "§2" }],
    "sdd": [{ "sourceRef": "legacy/arch.md", "status": "partial", "mappedTo": "§4" }]
  },
  "unmapped": ["legacy/notes.md#misc"]
}
```

`status` is one of `derived | partial | gap`.
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/import-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/skills/egp-import/SKILL.md tests/import-conventions.test.js
git commit -m "feat: egp-import emits machine-readable import-map.json (C1)"
```

---

### Task 14: C2 + C3 — per-file ADR default and import-state file

**Files:**
- Modify: `skills/egp-import/SKILL.md`
- Test: `tests/import-conventions.test.js`

**Interfaces:** import writes `.product/import-state.json` (e.g. `{ "sad": true, "adrGranularity": "per-file" }`); prescribes collected `ADR.md` → per-file `ADR-NNN-*.md` default.

- [ ] **Step 1: Write the failing test**

```js
test('egp-import prescribes per-file ADR default and an import-state file (C2/C3)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /per-file/i);
  assert.match(s, /ADR-NNN/);
  assert.match(s, /import-state\.json/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/import-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `skills/egp-import/SKILL.md` add:

```markdown
### Collected ADR handling (C2)

A single `ADR.md` containing N records defaults to **per-file** output:
split into `.product/adr/ADR-NNN-<slug>.md`, one record per file, preserving
the original IDs. Note to the user that they may opt to keep a single collected
file instead.

### Import state (C3)

Record import decisions in `.product/import-state.json` so downstream builders
read them instead of having them re-passed as arguments:

```json
{ "sad": true, "adrGranularity": "per-file", "srs": false }
```
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/import-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/skills/egp-import/SKILL.md tests/import-conventions.test.js
git commit -m "feat: per-file ADR default + import-state.json (C2/C3)"
```

---

# Phase 5 — Section F: orchestration (depends on Phases 0 + 1)

### Task 15: F1 — central confirmation-batch contract

**Files:**
- Modify: `shared/references/questioning-protocol.md`, `skills/egp-product-workflow/SKILL.md`, and the builder skills (`egp-prd-builder`, `egp-srs-builder`, `egp-sad-builder`, `egp-sdd-builder`, `egp-adr-builder`) to reference it
- Test: `tests/metadata-conventions.test.js` (or `import-conventions` — use the file with a `read` helper)

**Interfaces:** documentation only — one canonical statement of the "one confirmation batch" contract.

- [ ] **Step 1: Write the failing test**

```js
test('confirmation-batch contract is defined once and referenced by workflow (F1)', () => {
  assert.match(read('shared/references/questioning-protocol.md'), /one confirmation batch/i);
  assert.match(read('skills/egp-product-workflow/SKILL.md'), /confirmation batch/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `shared/references/questioning-protocol.md`, add a section:

```markdown
## The one-confirmation-batch contract

In derive-then-confirm mode, a builder derives all sections it can, then
presents the result as **one confirmation batch** — a single consolidated
summary of what was derived plus the list of gaps — and asks for one approval.
Builders MUST NOT trickle confirmations section-by-section. This contract is
defined here once; builders reference it rather than restating it.
```

In `egp-product-workflow` SKILL.md, replace any per-builder restatement with a reference: *"Each builder follows the one-confirmation-batch contract in `shared/references/questioning-protocol.md`."* In each builder skill, where it currently describes presenting a confirmation batch, point to the protocol reference.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/references/questioning-protocol.md plugins/product-design-suite/skills/ tests/metadata-conventions.test.js
git commit -m "docs: central one-confirmation-batch contract (F1)"
```

---

### Task 16: F2 — consistency gate

**Files:**
- Create: `plugins/product-design-suite/scripts/consistency-gate.js`
- Modify: `skills/egp-product-workflow/SKILL.md`, `skills/egp-doc-sync/SKILL.md`
- Test: `tests/consistency-gate.test.js`

**Interfaces:**
- Consumes: `traceability.js` (`buildMatrix`, `loadProduct`), `lint-ids.js` (`lintProduct`), ADR front-matter.
- Produces: `runGate(dir) -> {pass: boolean, checks: [{name, pass, detail}]}` and a CLI that prints one pass/fail summary (exit 0/1).

- [ ] **Step 1: Write the failing test**

```js
// tests/consistency-gate.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../plugins/product-design-suite/scripts/consistency-gate.js');

function scaffold() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  fs.mkdirSync(path.join(dir, 'prd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sdd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'prd', 'prd.md'), '# PRD\nFR-001 export.\n');
  fs.writeFileSync(path.join(dir, 'sdd', 'sdd.md'), '## 4. Components\nImplements FR-001.\n');
  return dir;
}

test('gate passes a clean product and reports per-check results', () => {
  const r = g.runGate(scaffold());
  assert.equal(r.pass, true);
  assert.ok(r.checks.some(c => c.name === 'traceability'));
  assert.ok(r.checks.some(c => c.name === 'id-lint'));
  assert.ok(r.checks.some(c => c.name === 'adr-reciprocity'));
});

test('gate fails when an ADR claims a supersede that is not reciprocated', () => {
  const dir = scaffold();
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-002-x.md'),
    '---\nid: ADR-002\nsupersedes: [ADR-001]\nsuperseded-by: []\n---\n# x\n');
  fs.writeFileSync(path.join(dir, 'adr', 'ADR-001-y.md'),
    '---\nid: ADR-001\nsuperseded-by: []\n---\n# y\n'); // missing back-link
  const r = g.runGate(dir);
  assert.equal(r.pass, false);
  assert.ok(r.checks.find(c => c.name === 'adr-reciprocity' && !c.pass));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/consistency-gate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// plugins/product-design-suite/scripts/consistency-gate.js
// Final consistency gate (feedback F2): runs traceability, the ID linter, and
// ADR supersede/amend reciprocity + front-matter completeness, then prints one
// pass/fail summary.
const fs = require('node:fs');
const path = require('node:path');
const trace = require('./traceability.js');
const { lintProduct } = require('./lint-ids.js');

function readFrontMatter(text) {
  const m = String(text || '').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    fm[kv[1]] = val.startsWith('[')
      ? val.replace(/[[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean)
      : val;
  }
  return fm;
}

function loadAdrs(dir) {
  const adrDir = path.join(dir, 'adr');
  const out = {};
  if (!fs.existsSync(adrDir)) return out;
  for (const f of fs.readdirSync(adrDir)) {
    if (!f.endsWith('.md')) continue;
    const fm = readFrontMatter(fs.readFileSync(path.join(adrDir, f), 'utf8'));
    if (fm.id) out[fm.id] = fm;
  }
  return out;
}

// supersedes/amends on A must be mirrored by superseded-by/amended-by on B.
function checkReciprocity(adrs) {
  const problems = [];
  const pairs = [['supersedes', 'superseded-by'], ['amends', 'amended-by']];
  for (const [id, fm] of Object.entries(adrs)) {
    for (const [fwd, back] of pairs) {
      for (const other of (fm[fwd] || [])) {
        const target = adrs[other];
        if (!target || !(target[back] || []).includes(id)) {
          problems.push(`${id} ${fwd} ${other} but ${other} is missing ${back}: ${id}`);
        }
      }
    }
  }
  return problems;
}

function runGate(dir) {
  const product = trace.loadProduct(dir);
  const matrix = trace.buildMatrix(product);
  const lint = lintProduct(dir);
  const adrs = loadAdrs(dir);
  const recip = checkReciprocity(adrs);

  const checks = [
    { name: 'traceability', pass: matrix.orphans.length === 0,
      detail: matrix.orphans.length ? `orphans: ${matrix.orphans.join(', ')}` : 'no orphans' },
    { name: 'id-lint', pass: lint.malformed.length === 0 && lint.duplicates.length === 0,
      detail: `${lint.malformed.length} malformed, ${lint.duplicates.length} duplicate` },
    { name: 'unclassified', pass: matrix.unclassified.length === 0,
      detail: matrix.unclassified.join(', ') || 'none' },
    { name: 'adr-reciprocity', pass: recip.length === 0,
      detail: recip.join('; ') || 'reciprocal' },
  ];
  return { pass: checks.every(c => c.pass), checks };
}

module.exports = { runGate, checkReciprocity, readFrontMatter };

if (require.main === module) {
  const { pass, checks } = runGate(process.argv[2] || '.product');
  for (const c of checks) console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
  console.log(pass ? 'consistency-gate: PASS' : 'consistency-gate: FAIL');
  process.exit(pass ? 0 : 1);
}
```

In `egp-product-workflow` SKILL.md final step and `egp-doc-sync` SKILL.md, document running `node scripts/consistency-gate.js .product` as the final consistency check that reports one pass/fail summary.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS (whole suite green).

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/consistency-gate.js plugins/product-design-suite/skills/egp-product-workflow/SKILL.md plugins/product-design-suite/skills/egp-doc-sync/SKILL.md tests/consistency-gate.test.js
git commit -m "feat: consistency-gate.js — traceability + lint + ADR reciprocity (F2)"
```

---

## Final verification

- [ ] Run the full suite: `node --test` — all green.
- [ ] Run `node tools/validate-plugin.js` (if present) to confirm the plugin still validates.
- [ ] Confirm each feedback item A1–A4, B1–B3, C1–C3, D1–D3, E1, F1–F2 maps to a committed task (see coverage table below).

## Feedback → task coverage

| Item | Task(s) | Item | Task(s) |
| --- | --- | --- | --- |
| A1 | 1, 2 | C2 | 14 |
| A2 | 6 | C3 | 14 |
| A3 | 5 | D1 | 8 |
| A4 | 1, 7 | D2 | 9 |
| B1 | 12 | D3 | 10 |
| B2 | 11 | E1 | 1, 3, 4 |
| B3 | 12 | F1 | 15 |
| C1 | 13 | F2 | 16 |
