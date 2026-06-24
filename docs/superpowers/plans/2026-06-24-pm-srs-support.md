# SRS Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, first-class IEEE-830 SRS document (template + builder + command + full wiring) that owns the canonical `FR`/`NFR` requirements when present, while leaving the PRD-only triad unchanged when it is absent.

**Architecture:** A new `srs-template.md` and `pm-srs-builder` skill author `.product/srs/srs.md`. "SRS mode" is detected solely by the existence of that file: present → `FR`/`NFR` are canonical in the SRS and the PRD references them; absent → today's behavior. `traceability.js` sources `FR`/`NFR` from the SRS when present (default arg keeps it backward-compatible), and the PRD/SDD builders, workflow, doc-sync, and import all branch on the same file-existence signal. `BR`/`UAT` always stay in the PRD.

**Tech Stack:** Markdown skill/template/command files; dependency-free CommonJS Node.js (`node:test`). Convention tests via regex over file contents; engine tests via direct module calls.

## Global Constraints

- No new runtime dependency and no new parsing script — mapping stays skill-driven (consistent with Phases 3–4).
- Dependency-free CommonJS; Node.js ≥18; run tests with `node --test tests/*.test.js`.
- New skill front-matter `name: pm-srs-builder` in directory `skills/pm-srs-builder/` (must satisfy `name == dir` for `validate-plugin.test.js`).
- SRS mode is detected **only** by the existence of `.product/srs/srs.md` — no stored flag, no config.
- PRD mode (no SRS) behavior is unchanged — full backward compatibility, regression-guarded.
- `FR` + `NFR` are canonical in the SRS when present; `BR` + `UAT` **always** stay in the PRD and never move.
- `buildMatrix` gains a `srs` field defaulting to `''`, so existing callers behave identically.
- All cross-document linking is by ID; IDs are reused verbatim across PRD/SRS/SDD.
- Migration of requirements out of an existing PRD is confirmation-gated (propose, then apply on approval — no silent rewrite).
- Phases 1–4 test suites must stay green.
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

- **Create** `plugins/product-design-suite/shared/templates/srs-template.md` — IEEE-830 SRS template; canonical `FR`/`NFR` tables (Task 1).
- **Create** `plugins/product-design-suite/skills/pm-srs-builder/SKILL.md` — SRS builder skill (Task 2).
- **Create** `plugins/product-design-suite/commands/pm-srs.md` — `/pm-srs` command (Task 2).
- **Modify** `plugins/product-design-suite/scripts/traceability.js` — SRS-aware `buildMatrix`/`loadProduct` (Task 3).
- **Modify** `plugins/product-design-suite/skills/pm-prd-builder/SKILL.md`, `pm-sdd-builder/SKILL.md`, `pm-product-workflow/SKILL.md` — SRS-mode wiring (Task 4).
- **Modify** `plugins/product-design-suite/skills/pm-doc-sync/SKILL.md`, `pm-import/SKILL.md`, `shared/references/concepts.md` — SRS-aware sync/import/docs (Task 5).
- **Create** `tests/srs-conventions.test.js` — accretes across Tasks 1, 2, 4, 5.
- **Modify** `tests/traceability.test.js` — SRS sourcing + regression (Task 3).

---

### Task 1: SRS template

**Files:**
- Create: `plugins/product-design-suite/shared/templates/srs-template.md`
- Test: `tests/srs-conventions.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `shared/templates/srs-template.md` with YAML front-matter (`title`, `status`, `version`, `owner`, `date`), section headings `## 1. Introduction`, `## 2. Overall Description`, `## 3. Specific Requirements`, subheadings `### Functional Requirements` and `### Non-Functional Requirements`, an `FR-001` row in the functional table, and an `NFR-001` row in the non-functional table. Later tasks rely on this file path and on `FR`/`NFR` being column-compatible with the PRD's tables.

- [ ] **Step 1: Write the failing test**

Create `tests/srs-conventions.test.js`:

```js
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

test('srs-template has front-matter with the five metadata fields', () => {
  const text = read('shared/templates/srs-template.md');
  assert.ok(text.startsWith('---\n'), 'srs-template must start with front-matter');
  const fm = frontMatter(text);
  assert.ok(fm, 'srs-template must have a closing --- delimiter');
  for (const key of ['title', 'status', 'version', 'owner', 'date']) {
    assert.match(fm, new RegExp('^' + key + ':', 'm'), `srs front-matter needs ${key}`);
  }
});

test('srs-template documents IEEE-830 sections and FR/NFR tables', () => {
  const s = read('shared/templates/srs-template.md');
  assert.match(s, /## 1\. Introduction/);
  assert.match(s, /## 2\. Overall Description/);
  assert.match(s, /## 3\. Specific Requirements/);
  assert.match(s, /### Functional Requirements/);
  assert.match(s, /### Non-Functional Requirements/);
  assert.match(s, /FR-001/);
  assert.match(s, /NFR-001/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/srs-conventions.test.js`
Expected: FAIL — `ENOENT` reading `shared/templates/srs-template.md` (file does not exist yet).

- [ ] **Step 3: Create the SRS template**

Create `plugins/product-design-suite/shared/templates/srs-template.md` with exactly this content:

```markdown
---
title: <System or Initiative Name>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.1.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---

# SRS: <System or Initiative Name>

## 1. Introduction

### Purpose

<State the purpose of this SRS and the system or change it specifies.>

### Scope

<Identify the software to be produced, what it will and will not do, and the objectives and goals it serves.>

### Definitions, Acronyms, and Abbreviations

| Term | Meaning |
| --- | --- |
| <Term> | <Definition> |

### References

| Reference | Description | Link or Location |
| --- | --- | --- |
| PRD | Product Requirements Document | .product/prd/prd.md |
| <Reference> | <Description> | <Link> |

### Overview

<Describe what the rest of this SRS contains and how it is organized.>

## 2. Overall Description

### Product Perspective

<Describe how the product relates to other products or systems, including context and origin.>

### Product Functions

<Summarize the major functions the software performs.>

### User Characteristics

<Describe the intended users: roles, experience, and technical expertise.>

### Constraints

<List regulatory, hardware, interface, or design constraints that limit the available options.>

### Assumptions and Dependencies

- <Assumption or dependency 1>
- <Assumption or dependency 2>

## 3. Specific Requirements

### External Interface Requirements

| Interface | Type | Description |
| --- | --- | --- |
| <Interface> | <User / Hardware / Software / Communication> | <Description> |

### Functional Requirements

| ID | Requirement | Priority | Source | Acceptance Reference |
| --- | --- | --- | --- | --- |
| FR-001 | <Requirement> | <Must/Should/Could> | <Source> | <AC reference> |
| FR-002 | <Requirement> | <Must/Should/Could> | <Source> | <AC reference> |

### Non-Functional Requirements

| ID | Category | Requirement | Target or Threshold | Measurement Method |
| --- | --- | --- | --- | --- |
| NFR-001 | Performance | <Requirement> | <Target> | <How measured> |
| NFR-002 | Security | <Requirement> | <Target> | <How measured> |

### Design Constraints and Standards Compliance

<Describe coding standards, regulatory standards, or design constraints the system must comply with.>

## 4. Traceability

The requirement coverage index (`FR`/`NFR` against SDD sections and ADRs) is generated by
`pm-doc-sync` into the SDD's §16 — do not hand-author it. Business rules (`BR-NNN`) and
user-acceptance tests (`UAT-NNN`) remain in the PRD; architectural requirements (`AR-NNN`)
live in the SDD and trace back to the `FR`/`NFR` IDs defined here.

## 5. Appendices

<Optional supporting material: data dictionaries, analysis models, or supplementary diagrams.>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/srs-conventions.test.js`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Verify no regressions**

Run: `node --test tests/*.test.js`
Expected: All tests pass (new `srs-conventions` tests plus the existing Phase 1–4 suites).

- [ ] **Step 6: Commit**

```bash
git add plugins/product-design-suite/shared/templates/srs-template.md tests/srs-conventions.test.js
git commit -m "feat: IEEE-830 SRS template with canonical FR/NFR tables (B9)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: pm-srs-builder skill + /pm-srs command

**Files:**
- Create: `plugins/product-design-suite/skills/pm-srs-builder/SKILL.md`
- Create: `plugins/product-design-suite/commands/pm-srs.md`
- Test: `tests/srs-conventions.test.js` (append)

**Interfaces:**
- Consumes: `shared/templates/srs-template.md` (Task 1).
- Produces: a skill named `pm-srs-builder` that authors `.product/srs/srs.md`, owns `FR-NNN`/`NFR-NNN`, supports derive-then-confirm mode, and performs a confirmation-gated PRD→SRS requirements migration. The command `/pm-srs` routes to it. Task 4 (workflow) references `pm-srs-builder` by name; Task 5 (import) references the same authoring contract.

- [ ] **Step 1: Write the failing test**

Append to `tests/srs-conventions.test.js`:

```js
test('pm-srs-builder skill exists with valid front-matter (name == dir)', () => {
  const s = read('skills/pm-srs-builder/SKILL.md');
  assert.match(s, /^---\nname: pm-srs-builder\n/);
  assert.match(s, /\ndescription:/);
});

test('pm-srs-builder documents authoring, FR/NFR ownership, derive-then-confirm, and PRD migration', () => {
  const s = read('skills/pm-srs-builder/SKILL.md');
  assert.match(s, /\.product\/srs\/srs\.md/);
  assert.match(s, /FR-NNN/);
  assert.match(s, /NFR-NNN/);
  assert.match(s, /derive-then-confirm/i);
  assert.match(s, /migrat/i);
});

test('pm-srs command exists and routes to the skill', () => {
  const s = read('commands/pm-srs.md');
  assert.match(s, /pm-srs/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/srs-conventions.test.js`
Expected: FAIL — `ENOENT` reading `skills/pm-srs-builder/SKILL.md`.

- [ ] **Step 3: Create the skill**

Create `plugins/product-design-suite/skills/pm-srs-builder/SKILL.md` with exactly this content:

```markdown
---
name: pm-srs-builder
description: Create or update an IEEE-830 Software Requirements Specification (SRS). Use when a team maintains a formal SRS and wants the canonical functional (FR-NNN) and non-functional (NFR-NNN) requirements to live in a dedicated document rather than the PRD. Writes .product/srs/srs.md; the PRD then references these requirements.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-srs-builder

Build or update the SRS at `.product/srs/srs.md` from the shared template. The SRS is
**optional**: when it exists, it is the canonical home for functional (`FR-NNN`) and
non-functional (`NFR-NNN`) requirements, and the PRD references them. When no SRS exists,
the PRD owns those requirements as usual — creating this file is what puts the project into
"SRS mode".

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/srs-template.md`
- PRD: `.product/prd/prd.md` (read for product intent and any existing `FR`/`NFR` to migrate)
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
1. Ensure `.product/srs/` exists. If `srs.md` exists, load it and treat this as an update.
2. Read the SRS template and the PRD. The SRS owns detailed functional (`FR-NNN`) and
   non-functional (`NFR-NNN`) requirements; business rules (`BR-NNN`) and user-acceptance
   tests (`UAT-NNN`) stay in the PRD and must not be moved here.
3. Fill each required section per `questioning-protocol.md`. When authoritative source is
   provided — mapped content from `pm-import`, or source supplied by the user — use
   **derive-then-confirm mode**: derive the sections, present one confirmation batch, and ask
   only about genuine gaps. Otherwise ask gap questions (pause after every 4 questions and
   summarize remaining gaps).
4. **Own the `FR-NNN`/`NFR-NNN` IDs.** Assign stable, zero-padded IDs and keep them stable
   across updates. When ingesting from a source (PRD or imported docs), **reuse source IDs
   verbatim** so cross-document traceability is preserved.
5. **Migrate requirements out of the PRD (confirmation-gated).** If `.product/prd/prd.md`
   already enumerates `FR`/`NFR` (a PRD authored before the SRS existed), propose the
   migration: lift the §7 Functional Requirements and §9 Non-Functional Requirements rows into
   the SRS verbatim (IDs preserved), then rewrite those PRD sections as references to the SRS
   (`.product/srs/srs.md`). Show the exact before/after and apply only on approval — no silent
   rewrite. Never touch the PRD's business rules (`BR-NNN`) or UAT (`UAT-NNN`).
6. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`)
   — bump `version` and refresh `date` on an update — write `.product/srs/srs.md`, and record
   unresolved gaps in the SRS's traceability/assumptions notes rather than leaving silent TBDs.
7. Suggest running `pm-doc-sync` to refresh the traceability matrix and propagate the new
   requirements source to the SDD and PRD references.

## Rules
- The SRS owns `FR`/`NFR` only; `BR` and `UAT` remain the PRD's responsibility.
- Confirmation-gated: propose the PRD migration, then apply on approval. No silent rewrites.
- Reuse source IDs verbatim; keep IDs stable across updates.
```

- [ ] **Step 4: Create the command**

Create `plugins/product-design-suite/commands/pm-srs.md` with exactly this content:

```markdown
---
description: Create or update the SRS via the pm-srs-builder skill
argument-hint: [what to add or change]
---
Use the pm-srs-builder skill to create or update `.product/srs/srs.md`, the canonical home for functional (FR-NNN) and non-functional (NFR-NNN) requirements. $ARGUMENTS
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/srs-conventions.test.js`
Expected: PASS — 5 tests pass (2 from Task 1 + 3 new).

- [ ] **Step 6: Verify no regressions (validate-plugin must accept the new skill)**

Run: `node --test tests/*.test.js`
Expected: All pass, including `validate-plugin.test.js` (the new skill's `name: pm-srs-builder` matches its directory).

- [ ] **Step 7: Commit**

```bash
git add plugins/product-design-suite/skills/pm-srs-builder/SKILL.md plugins/product-design-suite/commands/pm-srs.md tests/srs-conventions.test.js
git commit -m "feat: pm-srs-builder skill and /pm-srs command (B9)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: SRS-aware traceability engine

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js:139` (`buildMatrix`) and `:236` (`loadProduct`)
- Test: `tests/traceability.test.js` (append)

**Interfaces:**
- Consumes: nothing from prior tasks (the engine works on text, not files authored by Tasks 1–2).
- Produces: `buildMatrix({ prd, sdd, adrs, srs })` where `srs` defaults to `''`; when `srs` is non-empty, `FR`/`NFR` requirements are sourced from `srs` and `BR` from `prd`; when empty, `FR`/`BR`/`NFR` all come from `prd` (unchanged). `loadProduct(dir)` returns `{ prd, sdd, adrs, srs }`, reading `.product/srs/srs.md` (empty string if absent).

- [ ] **Step 1: Write the failing tests**

Append to `tests/traceability.test.js`:

```js
test('buildMatrix sources FR/NFR from the SRS when present, BR/UAT from the PRD', () => {
  const m = t.buildMatrix({
    prd: 'Business rule BR-001 applies. UAT-001 verifies FR-001.',
    srs: 'FR-001 login. NFR-001 performance.',
    sdd: '## 4. Components\nImplements FR-001, NFR-001 and BR-001.',
    adrs: {},
  });
  assert.deepEqual(m.requirements.map(r => r.id).sort(), ['BR-001', 'FR-001', 'NFR-001']);
  assert.deepEqual(m.uats.map(u => u.id), ['UAT-001']);
});

test('buildMatrix sources all requirements from the PRD when no SRS (regression)', () => {
  const m = t.buildMatrix({
    prd: 'FR-001 a. NFR-001 b. BR-001 c.',
    sdd: '## 4. X\nFR-001 NFR-001 BR-001.',
    adrs: {},
  });
  assert.deepEqual(m.requirements.map(r => r.id).sort(), ['BR-001', 'FR-001', 'NFR-001']);
});

test('loadProduct reads srs/srs.md into the srs field', () => {
  const os = require('node:os');
  const fsm = require('node:fs');
  const pth = require('node:path');
  const dir = fsm.mkdtempSync(pth.join(os.tmpdir(), 'pm-srs-'));
  fsm.mkdirSync(pth.join(dir, 'srs'), { recursive: true });
  fsm.writeFileSync(pth.join(dir, 'srs', 'srs.md'), 'FR-001 from srs');
  const loaded = t.loadProduct(dir);
  assert.match(loaded.srs, /FR-001 from srs/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/traceability.test.js`
Expected: FAIL — the SRS test sees `FR-001` only because the PRD references it (BR/NFR sourcing wrong), and `loadProduct(...).srs` is `undefined`.

- [ ] **Step 3: Make `buildMatrix` SRS-aware**

In `plugins/product-design-suite/scripts/traceability.js`, replace the start of `buildMatrix` and its requirement-set construction.

Find (current, lines ~139-168):

```js
function buildMatrix({ prd = '', sdd = '', adrs = {} } = {}) {
  const prdRefs = parseRefs(prd);
  const sddSet = new Set(parseRefs(sdd));
```

Replace the signature line and `prdRefs` definition with:

```js
function buildMatrix({ prd = '', sdd = '', adrs = {}, srs = '' } = {}) {
  // SRS mode: when an SRS is present it is the canonical source of FR/NFR;
  // BR always comes from the PRD. With no SRS, FR/BR/NFR all come from the PRD.
  const hasSrs = String(srs).trim() !== '';
  const fnrRefs = parseRefs(hasSrs ? srs : prd).filter(id => /^(FR|NFR)-/.test(id));
  const brRefs = parseRefs(prd).filter(id => /^BR-/.test(id));
  const prdRefs = [...new Set([...fnrRefs, ...brRefs, ...parseRefs(prd).filter(id => /^UAT-/.test(id))])].sort(refCompare);
  const sddSet = new Set(parseRefs(sdd));
```

The `requirements` line already filters `prdRefs` by `REQ_RE` (`/^(FR|BR|NFR)-/`) and the `uats` line filters by `/^UAT-/`, so both keep working against the merged `prdRefs`. `sectionAnchors(sdd, id)` and `sddSet.has(id)` are ID-based and unchanged.

Note: `uatVerifies` and `arTrace` already read from `prd`/`sdd` respectively and link by ID — leave them unchanged.

- [ ] **Step 4: Make `loadProduct` read the SRS**

In `plugins/product-design-suite/scripts/traceability.js`, find the return of `loadProduct` (line ~248):

```js
  return { prd: read(path.join(dir, 'prd', 'prd.md')), sdd: read(path.join(dir, 'sdd', 'sdd.md')), adrs };
```

Replace with:

```js
  return {
    prd: read(path.join(dir, 'prd', 'prd.md')),
    sdd: read(path.join(dir, 'sdd', 'sdd.md')),
    srs: read(path.join(dir, 'srs', 'srs.md')),
    adrs,
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/traceability.test.js`
Expected: PASS — all traceability tests pass, including the 3 new ones.

- [ ] **Step 6: Verify no regressions across the whole suite**

Run: `node --test tests/*.test.js`
Expected: All pass. The `traceability-conventions.test.js` and `e2e-smoke.test.js` suites still pass (the `srs` default of `''` preserves PRD-mode behavior).

- [ ] **Step 7: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js
git commit -m "feat: SRS-aware traceability (source FR/NFR from SRS when present) (B9)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Builder + workflow wiring

**Files:**
- Modify: `plugins/product-design-suite/skills/pm-prd-builder/SKILL.md:27-32` (step 5, ID assignment)
- Modify: `plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md:22-23` (step 2, AR mapping)
- Modify: `plugins/product-design-suite/skills/pm-product-workflow/SKILL.md:11,16-26,44-46` (lead, detect-stage, rules)
- Test: `tests/srs-conventions.test.js` (append)

**Interfaces:**
- Consumes: `pm-srs-builder` (Task 2, referenced by name); the `.product/srs/srs.md` mode signal (Task 3 contract).
- Produces: PRD/SDD builders and the workflow that branch on SRS mode. No code symbols — these are skill-prose edits asserted by convention tests.

- [ ] **Step 1: Write the failing tests**

Append to `tests/srs-conventions.test.js`:

```js
test('pm-prd-builder and pm-sdd-builder document SRS mode', () => {
  const prd = read('skills/pm-prd-builder/SKILL.md');
  assert.match(prd, /SRS/);
  assert.match(prd, /\.product\/srs\/srs\.md/);
  const sdd = read('skills/pm-sdd-builder/SKILL.md');
  assert.match(sdd, /SRS/);
  assert.match(sdd, /\.product\/srs\/srs\.md/);
});

test('pm-product-workflow documents the optional SRS stage', () => {
  const s = read('skills/pm-product-workflow/SKILL.md');
  assert.match(s, /pm-srs-builder/);
  assert.match(s, /SRS/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/srs-conventions.test.js`
Expected: FAIL — the builders/workflow do not yet mention SRS.

- [ ] **Step 3: Wire `pm-prd-builder` step 5**

In `plugins/product-design-suite/skills/pm-prd-builder/SKILL.md`, find step 5:

```markdown
5. Assign stable IDs: functional `FR-NNN`, business rules `BR-NNN`,
   non-functional `NFR-NNN`, UAT `UAT-NNN`. Keep IDs stable across updates.
```

Replace with:

```markdown
5. Assign stable IDs (keep them stable across updates):
   - **No SRS (default):** the PRD owns functional `FR-NNN`, business rules `BR-NNN`,
     non-functional `NFR-NNN`, and UAT `UAT-NNN`.
   - **SRS mode** — when `.product/srs/srs.md` exists — the SRS owns the canonical
     `FR-NNN`/`NFR-NNN`; the PRD's §7 Functional Requirements and §9 Non-Functional
     Requirements **reference** the SRS instead of enumerating them. The PRD still owns
     and assigns `BR-NNN` and `UAT-NNN`. (Moving existing `FR`/`NFR` into a new SRS is
     `pm-srs-builder`'s migration step, not the PRD builder's job — the PRD builder only
     honors the active mode.)
```

- [ ] **Step 4: Wire `pm-sdd-builder` step 2**

In `plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md`, find step 2:

```markdown
2. Read the SDD template and the PRD. Map PRD `FR-NNN` to Architectural
   Requirements `AR-NNN` in the SDD for traceability (reference the FR IDs).
```

Replace with:

```markdown
2. Read the SDD template and the requirements source. Map functional requirements to
   Architectural Requirements `AR-NNN` in the SDD for traceability (reference the requirement
   IDs). **SRS mode** — when `.product/srs/srs.md` exists — the canonical `FR-NNN`/`NFR-NNN`
   live in the SRS, so read the SRS and map its requirements to `AR-NNN`. **Otherwise** map the
   PRD's `FR-NNN`, as before.
```

- [ ] **Step 5: Wire `pm-product-workflow`**

In `plugins/product-design-suite/skills/pm-product-workflow/SKILL.md`, find the lead line:

```markdown
Drive the sequential PRD -> SDD -> ADR workflow.
```

Replace with:

```markdown
Drive the sequential PRD -> (optional) SRS -> SDD -> ADR workflow.
```

Then find these detect-stage bullets:

```markdown
   - no `prd/prd.md` -> start with `pm-prd-builder`.
   - PRD exists, no `sdd/sdd.md` -> offer `pm-sdd-builder`.
   - SDD exists -> offer `pm-adr-builder` for flagged decisions.
```

Replace with:

```markdown
   - no `prd/prd.md` -> start with `pm-prd-builder`.
   - PRD exists, no `srs/srs.md` -> offer `pm-srs-builder` for teams that maintain a formal
     IEEE-830 SRS (optional; skipping it keeps the PRD as the requirements home). If a `docs/`
     SRS was imported, offer the SRS builder here.
   - PRD exists (and the SRS, if the team uses one), no `sdd/sdd.md` -> offer `pm-sdd-builder`.
     When `.product/srs/srs.md` exists, the SRS is the requirements source for the SDD.
   - SDD exists -> offer `pm-adr-builder` for flagged decisions.
```

Then find the first Rules bullet:

```markdown
- Respect the sequence; the PRD anchors the SDD, and ADRs record decisions made
  during SDD design.
```

Replace with:

```markdown
- Respect the sequence; the PRD anchors the work, an optional SRS (when present) owns the
  detailed `FR`/`NFR` that the SDD designs against, and ADRs record decisions made during SDD
  design. `.product/srs/` is created on demand by `pm-srs-builder` — the workflow need not
  pre-create it.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/srs-conventions.test.js`
Expected: PASS — 7 tests pass (5 prior + 2 new).

- [ ] **Step 7: Verify no regressions**

Run: `node --test tests/*.test.js`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add plugins/product-design-suite/skills/pm-prd-builder/SKILL.md plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md plugins/product-design-suite/skills/pm-product-workflow/SKILL.md tests/srs-conventions.test.js
git commit -m "feat: wire SRS mode into PRD/SDD builders and workflow (B9)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: doc-sync, import, and concepts

**Files:**
- Modify: `plugins/product-design-suite/skills/pm-doc-sync/SKILL.md:22-31` (step 3 impact list)
- Modify: `plugins/product-design-suite/skills/pm-import/SKILL.md:18,30-33,34-40,47` (inputs, mapping, gap report, rules)
- Modify: `plugins/product-design-suite/shared/references/concepts.md:221,223-229` (§4 SRS framing, §5 lifecycle)
- Test: `tests/srs-conventions.test.js` (append)

**Interfaces:**
- Consumes: the SRS authoring contract (Task 2) and `srs-template.md` (Task 1).
- Produces: doc-sync, import, and concepts prose that treats the SRS as a first-class document. Asserted by convention tests; one test asserts the import skill no longer claims the SRS has no native template.

- [ ] **Step 1: Write the failing tests**

Append to `tests/srs-conventions.test.js`:

```js
test('pm-doc-sync and pm-import handle the SRS', () => {
  const sync = read('skills/pm-doc-sync/SKILL.md');
  assert.match(sync, /SRS/);
  const imp = read('skills/pm-import/SKILL.md');
  assert.match(imp, /srs-template|\.product\/srs/i);
  assert.doesNotMatch(imp, /no native template/i);
});

test('concepts documents the SRS as an optional document', () => {
  const s = read('shared/references/concepts.md');
  assert.match(s, /SRS/);
  assert.match(s, /\.product\/srs\/srs\.md/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/srs-conventions.test.js`
Expected: FAIL — `pm-import` still says "no native template"; `concepts.md` does not mention `.product/srs/srs.md`.

- [ ] **Step 3: Wire `pm-doc-sync` step 3**

In `plugins/product-design-suite/skills/pm-doc-sync/SKILL.md`, find the start of the step 3 impact bullet list:

```markdown
3. Using the traceability matrix, build an **impact report** listing each
   affected downstream and upstream item, for example:
   - A changed PRD `FR-NNN` -> SDD sections referencing it, ADRs referencing it.
```

Replace those two lines (the lead-in and the first bullet) with:

```markdown
3. Using the traceability matrix, build an **impact report** listing each
   affected downstream and upstream item, for example:
   - A changed requirement `FR-NNN`/`NFR-NNN` -> SDD `AR-NNN` and sections referencing it,
     ADRs referencing it, and PRD `UAT-NNN` that verify it. When `.product/srs/srs.md` exists,
     the SRS is the canonical source of `FR`/`NFR` and the PRD references them; otherwise they
     live in the PRD. Business rules (`BR-NNN`) and UAT (`UAT-NNN`) always live in the PRD.
```

- [ ] **Step 4: Wire `pm-import` (inputs, mapping, gap report, rules)**

In `plugins/product-design-suite/skills/pm-import/SKILL.md`:

Find the Inputs templates line:

```markdown
- Templates: `${CLAUDE_PLUGIN_ROOT}/shared/templates/{prd,sdd,adr}-template.md`
```

Replace with:

```markdown
- Templates: `${CLAUDE_PLUGIN_ROOT}/shared/templates/{prd,sdd,adr,srs}-template.md`
```

Find step 3:

```markdown
3. **Map to templates.** For each PRD/SDD/ADR source, match its content to the
   corresponding template's sections. The **SRS has no native template** — record it
   as a read-only reference link in the gap report; never fold it into another
   document or relocate it.
```

Replace with:

```markdown
3. **Map to templates.** For each PRD/SDD/ADR/SRS source, match its content to the
   corresponding template's sections. An **SRS source maps to `srs-template.md`**
   (`.product/srs/srs.md`); its `FR-NNN`/`NFR-NNN` are the canonical functional and
   non-functional requirements (the PRD then references them). The source location stays
   read-only — never relocate or edit it.
```

Find the gap-report step 4 lead:

```markdown
4. **Write the gap report** to `.product/import-gap-report.md`. For each target
   document (PRD, SDD, ADR), a table mapping every template section to a status:
```

Replace with:

```markdown
4. **Write the gap report** to `.product/import-gap-report.md`. For each target
   document (PRD, SRS, SDD, ADR), a table mapping every template section to a status:
```

Find the SRS rule:

```markdown
- The SRS stays a linked read-only reference (no native template yet).
```

Replace with:

```markdown
- An SRS source maps to the SRS template (`.product/srs/srs.md`); reuse its `FR`/`NFR` IDs
  verbatim so traceability is preserved.
```

- [ ] **Step 5: Wire `concepts.md` (§4 framing + §5 lifecycle)**

In `plugins/product-design-suite/shared/references/concepts.md`, find:

```markdown
Many agile teams do not maintain a separate formal SRS. Instead, they keep PRDs for product intent, SDDs for technical design, and ADRs for decision history. This combination usually works well in environments where architecture evolves incrementally and decisions need to remain traceable.
```

Replace with:

```markdown
Many agile teams do not maintain a separate formal SRS; the PRD then owns functional (`FR-NNN`) and non-functional (`NFR-NNN`) requirements directly, alongside the SDD for technical design and ADRs for decision history. This works well where architecture evolves incrementally and decisions need to remain traceable. Teams that do keep an IEEE-830 SRS (often regulated or enterprise contexts) can adopt the optional SRS document: the SRS becomes the canonical home for `FR-NNN`/`NFR-NNN` while the PRD references them and keeps business rules (`BR-NNN`) and acceptance tests (`UAT-NNN`). The suite detects which mode applies by whether `.product/srs/srs.md` exists.
```

Then find the lifecycle step 1:

```markdown
1. Start with a PRD when the problem, audience, expected outcomes, and scope need alignment.
```

Replace with:

```markdown
1. Start with a PRD when the problem, audience, expected outcomes, and scope need alignment.
   - *(Optional)* If the team maintains a formal SRS, author it after the PRD with
     `pm-srs-builder`; the SRS then owns the detailed `FR`/`NFR` that the PRD references and
     the SDD designs against.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/srs-conventions.test.js`
Expected: PASS — 9 tests pass (7 prior + 2 new).

- [ ] **Step 7: Verify no regressions across the whole suite**

Run: `node --test tests/*.test.js`
Expected: All pass, including the Phase 3 `metadata-conventions.test.js` (its `concepts` assertions for `front-matter`/`amend` are untouched) and the Phase 4 `import-conventions.test.js`.

- [ ] **Step 8: Commit**

```bash
git add plugins/product-design-suite/skills/pm-doc-sync/SKILL.md plugins/product-design-suite/skills/pm-import/SKILL.md plugins/product-design-suite/shared/references/concepts.md tests/srs-conventions.test.js
git commit -m "feat: SRS-aware doc-sync, import, and concepts (B9)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- C1 (srs-template.md) → Task 1. ✓
- C2 (pm-srs-builder + /pm-srs + migration + derive-then-confirm) → Task 2. ✓
- C3 (PRD references / SDD AR-from-SRS / workflow PRD→SRS→SDD→ADR) → Task 4. ✓
- C4 (traceability `srs` source + loadProduct) → Task 3. ✓
- C5 (doc-sync + import + concepts) → Task 5. ✓
- C6 (srs-conventions.test.js + traceability regression + validate-plugin) → Tasks 1,2,3,4,5 (tests interleaved per TDD). ✓
- Mode detection (`.product/srs/srs.md` existence) → encoded in Tasks 2,3,4,5. ✓
- Family split (FR/NFR move; BR/UAT stay) → Tasks 1,3,4,5. ✓
- Backward compatibility (no-SRS unchanged) → Task 3 regression test + `srs=''` default. ✓

**2. Placeholder scan:** No TBD/TODO; every code/content step shows full content. The template's `<...>` angle-bracket fills are intended template placeholder syntax (matching the existing PRD/SDD/ADR templates), not plan placeholders.

**3. Type consistency:** `buildMatrix({ prd, sdd, adrs, srs })` and `loadProduct → { prd, sdd, srs, adrs }` use the field name `srs` consistently across Task 3 and its tests. Skill name `pm-srs-builder` and file `.product/srs/srs.md` are spelled identically in Tasks 2, 4, 5. `FR-NNN`/`NFR-NNN`/`BR-NNN`/`UAT-NNN` notation matches the existing skills.
