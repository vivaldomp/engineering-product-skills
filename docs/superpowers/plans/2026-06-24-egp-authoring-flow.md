# PM Authoring Flow (Import + Derive-then-Confirm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class import/bootstrap path (`egp-import`) plus a derive-then-confirm questioning mode so the suite can onboard existing docs without rewriting, and migrate pre-existing `.product/` docs to the Phase 3 front-matter convention.

**Architecture:** All deliverables are plugin markdown (skills, a command, a shared reference) plus one new convention-test file. No runtime scripts and no new dependencies. `egp-import` is a new skill that ingests/maps/reports only (never authors). Derive-then-confirm is a second mode in the shared `questioning-protocol.md` that the three builders branch into when source exists. The legacy migration is a confirmation-gated step in `egp-doc-sync`. Tests are markdown-structure assertions (regex over file contents), mirroring `tests/metadata-conventions.test.js` and `tests/traceability-conventions.test.js`.

**Tech Stack:** Node.js ≥18, dependency-free CommonJS, `node:test` runner (`node --test tests/*.test.js`), `node:fs`/`node:path`. Plugin skills are Markdown with YAML front-matter under `plugins/product-design-suite/`.

## Global Constraints

- No new runtime scripts and no new dependencies this phase — mapping is skill-driven (judgment), not programmatic.
- The new skill's front-matter `name` MUST equal its directory name (`egp-import`) — `validate-plugin.test.js` enforces this.
- `egp-import` is analysis only: it MUST NOT write `.product/prd/prd.md`, `.product/sdd/sdd.md`, or `.product/adr/*.md`. It writes only `.product/import-gap-report.md`.
- Source documents are READ-ONLY: never move, rename, or edit the user's existing files.
- The SRS has no native template this phase — it stays a linked read-only reference, never folded into another doc or relocated.
- The gap report artifact path is exactly `.product/import-gap-report.md`.
- Derive-then-confirm: derive sections, present ONE confirmation batch, ask only genuine gaps; the 4-question pause cadence still governs the gap questions; unconfirmed derived content goes to Open Questions, never presented silently as fact.
- All edits are additive/confirmation-gated; no auto-rewrite or auto-migration without user approval.
- Reuse source IDs (`FR-NNN`, `BR-NNN`, `NFR-NNN`, `UAT-NNN`, `ADR-NNN`) verbatim for traceability.
- Run the full suite with `node --test tests/*.test.js`. Phase 1/2/3 suites must stay green.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: `egp-import` skill + `/egp-import` command (B6)

**Files:**
- Create: `plugins/product-design-suite/skills/egp-import/SKILL.md`
- Create: `plugins/product-design-suite/commands/egp-import.md`
- Test: `tests/import-conventions.test.js` (create)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a skill named `egp-import` and a `/egp-import` command. Task 2's workflow wiring references the skill name `egp-import` and the derive-then-confirm hand-off; the gap-report path `.product/import-gap-report.md` is referenced by this skill only.

- [x] **Step 1: Write the failing test**

Create `tests/import-conventions.test.js` with exactly:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('egp-import skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /^---\nname: egp-import\n/);
  assert.match(s, /\ndescription:/);
});

test('egp-import documents ingest, mapping, gap report, SRS reference, read-only, and hand-off', () => {
  const s = read('skills/egp-import/SKILL.md');
  assert.match(s, /classif/i);
  assert.match(s, /map/i);
  assert.match(s, /\.product\/import-gap-report\.md/);
  assert.match(s, /SRS/);
  assert.match(s, /read-only/i);
  assert.match(s, /derive-then-confirm/i);
});

test('egp-import command exists and routes to the skill', () => {
  const s = read('commands/egp-import.md');
  assert.match(s, /egp-import/);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/import-conventions.test.js`
Expected: FAIL — all three tests error because `skills/egp-import/SKILL.md` and `commands/egp-import.md` do not exist (`ENOENT`).

- [x] **Step 3: Create the `egp-import` skill**

Create `plugins/product-design-suite/skills/egp-import/SKILL.md` with exactly:

```markdown
---
name: egp-import
description: Ingest existing product documents (PRD, SRS, ADR, SDD) into the suite's templates. Use when the user already has product docs and wants to adopt the plugin without rewriting from scratch — bootstrap, import, or onboard existing docs. Classifies sources, maps them to templates, and writes a gap report at .product/import-gap-report.md before any authoring.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-import

Onboard an existing document set into the plugin. **Import is analysis, not
authoring:** this skill never writes `.product/prd/prd.md`,
`.product/sdd/sdd.md`, or `.product/adr/*.md`. It classifies and maps source
documents and writes a gap report; the builder skills author the documents
afterwards in derive-then-confirm mode.

## Inputs
- Templates: `${CLAUDE_PLUGIN_ROOT}/shared/templates/{prd,sdd,adr}-template.md`
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`,
  `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`
  (derive-then-confirm mode)

## Steps
1. **Locate source.** Ask the user where existing docs live; default to scanning
   `docs/`. Accept explicit paths. Treat the source location as **read-only** —
   never move, rename, or edit source files.
2. **Classify each candidate** by type (PRD / SRS / ADR / SDD) from filename and
   heading heuristics, and confirm the classification with the user before mapping.
3. **Map to templates.** For each PRD/SDD/ADR source, match its content to the
   corresponding template's sections. The **SRS has no native template** — record it
   as a read-only reference link in the gap report; never fold it into another
   document or relocate it.
4. **Write the gap report** to `.product/import-gap-report.md`. For each target
   document (PRD, SDD, ADR), a table mapping every template section to a status:
   - `derived` — source fully covers the section;
   - `partial` — source covers it incompletely;
   - `gap` — no source material (a genuine question for the builder);
   and, per document, an **unmapped source** list of source material that did not map
   to any template section, so nothing is silently dropped.
5. **Hand off.** Offer to run each builder (`egp-prd-builder`, `egp-sdd-builder`,
   `egp-adr-builder`) in **derive-then-confirm** mode, pre-seeded with that document's
   mapped content and its gap list.

## Rules
- Read-only on source: never migrate, move, or edit the user's existing files.
- The SRS stays a linked read-only reference (no native template yet).
- Confirmation-gated: confirm classification before mapping, and confirm hand-off.
- Reuse source IDs (`FR-NNN`, `BR-NNN`, `NFR-NNN`, `UAT-NNN`, `ADR-NNN`) verbatim so
  cross-document traceability is preserved.
```

- [x] **Step 4: Create the `/egp-import` command**

Create `plugins/product-design-suite/commands/egp-import.md` with exactly:

```markdown
---
description: Ingest existing PRD/SRS/ADR/SDD docs into the suite via egp-import
argument-hint: [path to existing docs]
---
Use the egp-import skill to ingest existing product docs, map them to the templates, and write a gap report at .product/import-gap-report.md before authoring. $ARGUMENTS
```

- [x] **Step 5: Run the test to verify it passes**

Run: `node --test tests/import-conventions.test.js`
Expected: PASS — 3/3 tests pass.

- [x] **Step 6: Run the full suite (no regressions)**

Run: `node --test tests/*.test.js`
Expected: PASS — all prior suites still green (Phase 1/2/3), plus the 3 new tests. `validate-plugin` passes because `name: egp-import` matches the directory `egp-import`.

- [x] **Step 7: Commit**

```bash
git add plugins/product-design-suite/skills/egp-import/SKILL.md plugins/product-design-suite/commands/egp-import.md tests/import-conventions.test.js
git commit -m "feat: egp-import skill + command for ingesting existing docs (B6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Derive-then-confirm mode + builder & workflow wiring (B7)

**Files:**
- Modify: `plugins/product-design-suite/shared/references/questioning-protocol.md` (append a section)
- Modify: `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md` (step 4)
- Modify: `plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md` (step 3)
- Modify: `plugins/product-design-suite/skills/egp-adr-builder/SKILL.md` (step 3)
- Modify: `plugins/product-design-suite/skills/egp-product-workflow/SKILL.md` (step 2 detect-stage)
- Test: `tests/import-conventions.test.js` (append)

**Interfaces:**
- Consumes: the `egp-import` skill name and the derive-then-confirm hand-off from Task 1.
- Produces: the `## Derive-then-confirm mode` section in `questioning-protocol.md`; a derive-then-confirm branch in all three builders; a detect-stage that offers `egp-import` (existing source) and the `egp-doc-sync` migration (legacy `.product/` docs). The migration itself is implemented in Task 3 — the workflow forward-references it.

- [x] **Step 1: Write the failing tests**

Append to `tests/import-conventions.test.js`:

```js
test('questioning-protocol documents derive-then-confirm mode', () => {
  const s = read('shared/references/questioning-protocol.md');
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /confirmation batch/i);
  assert.match(s, /genuine gap/i);
});

test('all three builders support derive-then-confirm mode', () => {
  for (const b of ['egp-prd-builder', 'egp-sdd-builder', 'egp-adr-builder']) {
    const s = read(`skills/${b}/SKILL.md`);
    assert.match(s, /derive-then-confirm/i, `${b} should mention derive-then-confirm`);
  }
});

test('egp-product-workflow detects existing source docs and legacy docs', () => {
  const s = read('skills/egp-product-workflow/SKILL.md');
  assert.match(s, /egp-import/);
  assert.match(s, /## 1\. Metadata|front-matter|legacy/i);
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/import-conventions.test.js`
Expected: FAIL — the three new tests fail (no `derive-then-confirm` in the protocol or builders; no `egp-import` in the workflow). Task 1's three tests still pass.

- [x] **Step 3: Append the derive-then-confirm section to the protocol**

In `plugins/product-design-suite/shared/references/questioning-protocol.md`, append this section at the end of the file (after the existing `## Counter reset` paragraph):

```markdown

## Derive-then-confirm mode

When the builder has **authoritative source** for the document — mapped content
handed over by `egp-import`, or source supplied directly by the user — use this mode
instead of asking a gap question for every section.

1. **Derive** every section the source supports.
2. **Confirm in one batch.** Present a compact per-section summary of the derived
   content as a single **confirmation batch**, plus only the **genuine gaps** as
   questions. The user confirms or corrects the derived content in bulk rather than
   answering a question per section.
3. **Gap questions still follow the cadence.** The 4-question pause rule above
   governs the genuine-gap questions, so even in this mode the user never faces an
   interrogation wall.
4. **No silent assumptions.** If the user finalizes before confirming derived
   content, record that content as assumptions in the **Open Questions** table —
   never present unconfirmed derivation as fact.

The greenfield gap-question cadence remains the default whenever no authoritative
source exists.
```

- [x] **Step 4: Wire `egp-prd-builder` (step 4)**

In `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md`, replace:

```
4. For any missing required section, ask gap questions following
   `questioning-protocol.md` (pause after every 4 questions and summarize
   remaining gaps).
```

with:

```
4. For any missing required section, ask questions following
   `questioning-protocol.md`. When authoritative source is provided — mapped
   content from `egp-import`, or source supplied by the user — use **derive-then-
   confirm mode**: derive the sections, present one confirmation batch, and ask
   only about genuine gaps. Otherwise use the gap-question cadence (pause after
   every 4 questions and summarize remaining gaps).
```

- [x] **Step 5: Wire `egp-sdd-builder` (step 3)**

In `plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md`, replace:

```
3. Fill each required section; ask gap questions per `questioning-protocol.md` (pause after every 4 questions and summarize remaining gaps).
```

with:

```
3. Fill each required section per `questioning-protocol.md`. When authoritative
   source is provided — mapped content from `egp-import`, or source supplied by the
   user — use **derive-then-confirm mode**: derive the sections, present one
   confirmation batch, and ask only about genuine gaps. Otherwise ask gap questions
   (pause after every 4 questions and summarize remaining gaps).
```

- [x] **Step 6: Wire `egp-adr-builder` (step 3)**

In `plugins/product-design-suite/skills/egp-adr-builder/SKILL.md`, replace:

```
3. Fill the ADR template; ask gap questions per `questioning-protocol.md`
   (pause after every 4 questions and summarize remaining gaps).
   Options considered must be real alternatives (include "do nothing" when
   relevant).
```

with:

```
3. Fill the ADR template per `questioning-protocol.md`. When authoritative source
   is provided — mapped content from `egp-import`, or source supplied by the user —
   use **derive-then-confirm mode**: derive the sections, present one confirmation
   batch, and ask only about genuine gaps. Otherwise ask gap questions (pause after
   every 4 questions and summarize remaining gaps). Options considered must be real
   alternatives (include "do nothing" when relevant).
```

- [x] **Step 7: Wire `egp-product-workflow` (step 2 detect-stage)**

In `plugins/product-design-suite/skills/egp-product-workflow/SKILL.md`, replace:

```
2. **Detect stage** by inspecting `.product/`:
   - no `prd/prd.md` -> start with `egp-prd-builder`.
   - PRD exists, no `sdd/sdd.md` -> offer `egp-sdd-builder`.
   - SDD exists -> offer `egp-adr-builder` for flagged decisions.
   Warn (don't block) if the user wants to skip ahead.
```

with:

```
2. **Detect stage** by inspecting `.product/` and the working tree:
   - `.product/` has no `prd/prd.md` yet but existing product docs are present
     elsewhere (e.g. a `docs/` set with PRD/SRS/ADR/SDD) -> offer `egp-import` first
     to ingest them and write a gap report before authoring.
   - a pre-existing `.product/` document predates the metadata convention (no YAML
     front-matter, or an ADR still carrying a legacy `## 1. Metadata` table) ->
     offer the `egp-doc-sync` migration before continuing.
   - no `prd/prd.md` -> start with `egp-prd-builder`.
   - PRD exists, no `sdd/sdd.md` -> offer `egp-sdd-builder`.
   - SDD exists -> offer `egp-adr-builder` for flagged decisions.
   Warn (don't block) if the user wants to skip ahead.
```

- [x] **Step 8: Run the tests to verify they pass**

Run: `node --test tests/import-conventions.test.js`
Expected: PASS — 6/6 tests pass (Task 1's 3 + Task 2's 3).

- [x] **Step 9: Run the full suite (no regressions)**

Run: `node --test tests/*.test.js`
Expected: PASS — all suites green.

- [x] **Step 10: Commit**

```bash
git add plugins/product-design-suite/shared/references/questioning-protocol.md plugins/product-design-suite/skills/egp-prd-builder/SKILL.md plugins/product-design-suite/skills/egp-sdd-builder/SKILL.md plugins/product-design-suite/skills/egp-adr-builder/SKILL.md plugins/product-design-suite/skills/egp-product-workflow/SKILL.md tests/import-conventions.test.js
git commit -m "feat: derive-then-confirm mode + builder/workflow wiring (B7)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Legacy front-matter migration in `egp-doc-sync` (Phase 3 carryover)

**Files:**
- Modify: `plugins/product-design-suite/skills/egp-doc-sync/SKILL.md` (add a step)
- Test: `tests/import-conventions.test.js` (append)

**Interfaces:**
- Consumes: the workflow's migration offer wired in Task 2 (forward reference resolved here).
- Produces: a confirmation-gated migration step in `egp-doc-sync` for pre-existing `.product/` docs lacking front-matter or carrying the legacy `## 1. Metadata` ADR table.

- [x] **Step 1: Write the failing test**

Append to `tests/import-conventions.test.js`:

```js
test('egp-doc-sync documents the legacy front-matter migration', () => {
  const s = read('skills/egp-doc-sync/SKILL.md');
  assert.match(s, /migrat/i);
  assert.match(s, /## 1\. Metadata/);
  assert.match(s, /front-matter/i);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/import-conventions.test.js`
Expected: FAIL — the new test fails on `/migrat/i` (egp-doc-sync does not yet mention migration). The other 6 tests still pass.

- [x] **Step 3: Add the migration step to `egp-doc-sync`**

In `plugins/product-design-suite/skills/egp-doc-sync/SKILL.md`, insert a new step between the current step 6 and the `## Rules` heading. The current text is:

```
6. Report any `⚠️ Orphan` rows in the matrix as genuine coverage gaps (notation-only
   artifacts are already resolved by the range-aware parser).

## Rules
```

Replace it with:

```
6. Report any `⚠️ Orphan` rows in the matrix as genuine coverage gaps (notation-only
   artifacts are already resolved by the range-aware parser).
7. **Migrate legacy docs to the metadata convention.** If a `.product/` document
   predates the YAML front-matter convention — it has no front-matter block, or an
   ADR still carries the legacy `## 1. Metadata` table — propose the migration:
   add a front-matter block populated from the document's existing content; for an
   ADR, lift the `## 1. Metadata` rows into front-matter, drop the table, and
   renumber the body sections (§2 -> §1 … §8 -> §7) to match the current template.
   Show the exact before/after and apply only on approval — no silent rewrite.

## Rules
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/import-conventions.test.js`
Expected: PASS — 7/7 tests pass.

- [x] **Step 5: Run the full suite (no regressions)**

Run: `node --test tests/*.test.js`
Expected: PASS — all suites green.

- [x] **Step 6: Commit**

```bash
git add plugins/product-design-suite/skills/egp-doc-sync/SKILL.md tests/import-conventions.test.js
git commit -m "feat: egp-doc-sync legacy front-matter migration (Phase 3 carryover)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the executor

- The shared test file `tests/import-conventions.test.js` is created in Task 1 and appended to in Tasks 2 and 3 — never rewritten. Each task's "verify it fails" step depends on prior tasks' assertions still passing.
- All builder/workflow/doc-sync edits are exact string replacements — match the quoted "before" text verbatim (including indentation) so the Edit applies cleanly.
- Do not add a programmatic doc-parser or any new script; mapping and migration are skill-driven and confirmation-gated.
