# Template Metadata & ADR Relationships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the PRD/SDD/ADR templates a first-class YAML front-matter metadata block, add structured `supersedes`/`superseded-by`/`amends`/`amended-by` fields to the ADR (restoring `Status` to a clean enum), and wire the builder skills and `pm-doc-sync` to populate and maintain it.

**Architecture:** Two tasks. Task 1 changes the three markdown templates (prepend front-matter; restructure the ADR — drop its `## 1. Metadata` table, renumber §2–§8 to §1–§7) and creates a convention test asserting the new structure. Task 2 wires the four skills and two references to populate/maintain the metadata and extends the same convention test with doc-content assertions. No runtime code, no new scripts.

**Tech Stack:** Markdown templates; Node.js ≥18 `node:test` runner (`node --test tests/*.test.js`); `node:fs`/`node:path`. Dependency-free CommonJS.

## Global Constraints

- No new runtime scripts and no new runtime dependencies this phase — only markdown templates, SKILL/reference docs, and one test file.
- YAML front-matter is delimited by `---` on its own line: the opening `---` is line 1 of the file, the closing `---` sits immediately before the document's `#` H1.
- Every list/relationship field is always present; an empty relationship is `[]`, never omitted.
- ADR `status` is a single enum value (`Proposed | Accepted | Superseded | Deprecated | Rejected`) — never overloaded with parenthetical text. Supersede/amend relationships live only in their own fields.
- Supersede/amend relationships are bidirectional: `supersedes` on one ADR implies `superseded-by` on the target (likewise `amends`/`amended-by`).
- ADR template: the `## 1. Metadata` table is removed; remaining sections renumber `## 2. Context`→`## 1. Context` … `## 8. References`→`## 7. References`; `## Status History` stays unnumbered at the end.
- PRD/SDD front-matter fields: `title`, `status`, `version`, `owner`, `date`. ADR front-matter fields: `id`, `title`, `status`, `date`, `author`, `reviewers`, `supersedes`, `superseded-by`, `amends`, `amended-by`, `related-prd`, `related-sdd`, `related-adrs`.
- Run tests with `node --test tests/*.test.js` (a bare `tests/` directory arg fails on Node 24). The Phase 1 and Phase 2 suites — including `tests/traceability-conventions.test.js` (SDD §16 markers + §16/§17 headings) and `tests/e2e-smoke.test.js` — must continue to pass.

---

### Task 1: Front-matter on all three templates + ADR restructure

**Files:**
- Modify: `plugins/product-design-suite/shared/templates/prd-template.md` (prepend front-matter before line 1 `# PRD: ...`)
- Modify: `plugins/product-design-suite/shared/templates/sdd-template.md` (prepend front-matter before line 1 `# SDD: ...`)
- Modify: `plugins/product-design-suite/shared/templates/adr-template.md` (prepend front-matter; delete `## 1. Metadata` block; renumber §2–§8)
- Create: `tests/metadata-conventions.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the front-matter contract Task 2's skills will populate, and the test file `tests/metadata-conventions.test.js` that Task 2 extends. Exact field sets are listed in Global Constraints.

- [x] **Step 1: Write the failing test**

Create `tests/metadata-conventions.test.js` with exactly this content:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'plugins', 'product-design-suite');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// Returns the YAML front-matter body (text between the opening and closing ---),
// or null if the file does not start with a front-matter block.
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

test('all three templates open with a YAML front-matter block', () => {
  for (const f of ['prd-template.md', 'sdd-template.md', 'adr-template.md']) {
    const text = read(path.join('shared/templates', f));
    assert.ok(text.startsWith('---\n'), `${f} must start with front-matter`);
    assert.ok(frontMatter(text), `${f} must have a closing --- delimiter`);
  }
});

test('PRD and SDD front-matter declare the five metadata fields', () => {
  for (const f of ['prd-template.md', 'sdd-template.md']) {
    const fm = frontMatter(read(path.join('shared/templates', f)));
    for (const key of ['title', 'status', 'version', 'owner', 'date']) {
      assert.match(fm, new RegExp('^' + key + ':', 'm'), `${f} front-matter needs ${key}`);
    }
  }
});

test('ADR front-matter declares scalar and relationship fields', () => {
  const fm = frontMatter(read('shared/templates/adr-template.md'));
  const keys = ['id', 'title', 'status', 'date', 'author', 'reviewers',
                'supersedes', 'superseded-by', 'amends', 'amended-by',
                'related-prd', 'related-sdd', 'related-adrs'];
  for (const key of keys) {
    assert.match(fm, new RegExp('^' + key + ':', 'm'), `ADR front-matter needs ${key}`);
  }
});

test('ADR template drops the Metadata section and renumbers Context to 1', () => {
  const tpl = read('shared/templates/adr-template.md');
  assert.doesNotMatch(tpl, /## \d+\. Metadata/);
  assert.match(tpl, /## 1\. Context/);
  assert.match(tpl, /## 7\. References/);
  assert.match(tpl, /## Status History/);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL — templates have no front-matter yet; the ADR still has `## 1. Metadata` and `## 2. Context`.

- [x] **Step 3: Add front-matter to the PRD template**

In `plugins/product-design-suite/shared/templates/prd-template.md`, prepend this block so it becomes the very top of the file, immediately followed by the existing `# PRD: <Product or Initiative Name>` line:

```yaml
---
title: <Product or Initiative Name>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.1.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---
```

(Leave one blank line between the closing `---` and the `# PRD:` heading.)

- [x] **Step 4: Add front-matter to the SDD template**

In `plugins/product-design-suite/shared/templates/sdd-template.md`, prepend this block so it becomes the very top of the file, immediately followed by the existing `# SDD: <System or Initiative Name>` line:

```yaml
---
title: <System or Initiative Name>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.1.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---
```

(Leave one blank line between the closing `---` and the `# SDD:` heading. Do not touch anything else in the file — the §16 COVERAGE-INDEX markers and §17 Appendices at the end stay exactly as they are.)

- [x] **Step 5: Add front-matter to the ADR template and delete the Metadata table**

In `plugins/product-design-suite/shared/templates/adr-template.md`, prepend this block at the very top, immediately followed by the existing `# ADR-<NNN>: <Decision Title>` line (one blank line between the closing `---` and the H1):

```yaml
---
id: ADR-<NNN>
title: <Decision title>
status: <Proposed | Accepted | Superseded | Deprecated | Rejected>
date: <YYYY-MM-DD>
author: <Name or team>
reviewers: [<Name or team>]
supersedes: []      # ADR IDs this decision replaces, e.g. [ADR-003]
superseded-by: []   # ADR IDs that replace this decision
amends: []          # ADR IDs this decision modifies without replacing
amended-by: []      # ADR IDs that modify this decision
related-prd: []     # PRD section/ID references, e.g. ["§7 FR-012"]
related-sdd: []     # SDD section references, e.g. ["§4 Components"]
related-adrs: []    # other related ADR IDs
---
```

Then delete the entire `## 1. Metadata` section — every line from `## 1. Metadata` through the closing table row, up to (but not including) the `## 2. Context` heading. The block to remove is exactly:

```markdown
## 1. Metadata

| Field | Value |
| --- | --- |
| ID | ADR-<NNN> |
| Title | <Decision title> |
| Status | <Proposed/Accepted/Superseded/Deprecated/Rejected> |
| Date | <YYYY-MM-DD> |
| Author | <Name or team> |
| Reviewers | <Names or teams> |
| Related PRD Sections | <PRD references> |
| Related SDD Sections | <SDD references> |
| Related ADRs | <ADR references> |

```

- [x] **Step 6: Renumber the remaining ADR section headings**

In the same file, apply these seven exact heading replacements (decrement each by one):

| Old heading | New heading |
| --- | --- |
| `## 2. Context` | `## 1. Context` |
| `## 3. Options Considered` | `## 2. Options Considered` |
| `## 4. Evaluation` | `## 3. Evaluation` |
| `## 5. Decision` | `## 4. Decision` |
| `## 6. Consequences` | `## 5. Consequences` |
| `## 7. Implementation Plan` | `## 6. Implementation Plan` |
| `## 8. References` | `## 7. References` |

Leave `## Status History` unchanged. Do not renumber the `### Option A/B/C` subheadings or any `####` — only the seven top-level `##` numbered headings above.

- [x] **Step 7: Run the test to verify it passes**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS — all four tests green.

- [x] **Step 8: Run the full suite for no regressions**

Run: `node --test tests/*.test.js`
Expected: PASS — every test, including `traceability-conventions` and `e2e-smoke`, stays green.

- [x] **Step 9: Commit**

```bash
git add plugins/product-design-suite/shared/templates/prd-template.md \
        plugins/product-design-suite/shared/templates/sdd-template.md \
        plugins/product-design-suite/shared/templates/adr-template.md \
        tests/metadata-conventions.test.js
git commit -m "feat: add YAML front-matter to PRD/SDD/ADR templates + ADR relationship fields"
```

---

### Task 2: Wire builder skills, doc-sync, and references

**Files:**
- Modify: `plugins/product-design-suite/skills/pm-adr-builder/SKILL.md:25-28` (steps 4–5)
- Modify: `plugins/product-design-suite/skills/pm-prd-builder/SKILL.md:27-28` (step 6)
- Modify: `plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md:51` (step 7)
- Modify: `plugins/product-design-suite/skills/pm-doc-sync/SKILL.md:22-26` (step 3)
- Modify: `plugins/product-design-suite/shared/references/structures.md:373` (ADR quality checklist)
- Modify: `plugins/product-design-suite/shared/references/concepts.md:127,143` (ADR contents + statuses)
- Modify (extend): `tests/metadata-conventions.test.js`

**Interfaces:**
- Consumes: the front-matter field names defined in Task 1 (Global Constraints) and the test file created in Task 1.
- Produces: nothing downstream (final task).

- [x] **Step 1: Write the failing tests (extend the convention test)**

Append these tests to the end of `tests/metadata-conventions.test.js`:

```js
test('pm-adr-builder documents structured supersede/amend front-matter', () => {
  const s = read('skills/pm-adr-builder/SKILL.md');
  assert.match(s, /front-matter/i);
  assert.match(s, /supersed/i);
  assert.match(s, /amend/i);
});

test('pm-prd-builder and pm-sdd-builder populate front-matter', () => {
  assert.match(read('skills/pm-prd-builder/SKILL.md'), /front-matter/i);
  assert.match(read('skills/pm-sdd-builder/SKILL.md'), /front-matter/i);
});

test('pm-doc-sync checks supersede/amend link symmetry', () => {
  const s = read('skills/pm-doc-sync/SKILL.md');
  assert.match(s, /supersed/i);
  assert.match(s, /symmetr|asymmetr|reciprocal/i);
});

test('references document front-matter metadata and relationship fields', () => {
  const st = read('shared/references/structures.md');
  const co = read('shared/references/concepts.md');
  assert.match(st, /front-matter/i);
  assert.match(st, /superseded-by/i);
  assert.match(co, /front-matter/i);
  assert.match(co, /amend/i);
});
```

- [x] **Step 2: Run the new tests to verify they fail**

Run: `node --test tests/metadata-conventions.test.js`
Expected: FAIL — the four new tests fail (skills/references not yet updated); the four Task 1 tests still pass.

- [x] **Step 3: Update pm-adr-builder**

In `plugins/product-design-suite/skills/pm-adr-builder/SKILL.md`, replace step 4:

```markdown
4. Link related PRD/SDD sections by their IDs in the Metadata block.
```

with:

```markdown
4. Populate the YAML front-matter (`id`, `title`, `status`, `date`, `author`,
   `reviewers`). Link related PRD/SDD/ADR references in the `related-prd`,
   `related-sdd`, and `related-adrs` front-matter fields.
```

and replace step 5:

```markdown
5. Set Status (Proposed/Accepted/Superseded/Deprecated/Rejected) and append to
   the Status History table. When superseding, link the superseding ADR both
   ways.
```

with:

```markdown
5. Set `status` to a single enum value (Proposed/Accepted/Superseded/Deprecated/
   Rejected) — never overload it with parentheticals. Record supersede/amend
   relationships in the structured front-matter fields: set `supersedes` or
   `amends` on this ADR **and** the reciprocal `superseded-by` or `amended-by`
   on the target ADR (bidirectional). Append the change to the Status History
   table.
```

- [x] **Step 4: Update pm-prd-builder**

In `plugins/product-design-suite/skills/pm-prd-builder/SKILL.md`, replace step 6:

```markdown
6. On finalize, write `.product/prd/prd.md` and record unresolved gaps in the
   **Open Questions** table.
```

with:

```markdown
6. On finalize, populate the YAML front-matter (`title`, `status`, `version`,
   `owner`, `date`) — bump `version` and refresh `date` on an update — write
   `.product/prd/prd.md`, and record unresolved gaps in the **Open Questions**
   table.
```

- [x] **Step 5: Update pm-sdd-builder**

In `plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md`, replace step 7:

```markdown
7. On finalize, write the SDD and record unresolved gaps in Open Questions.
```

with:

```markdown
7. On finalize, populate the YAML front-matter (`title`, `status`, `version`,
   `owner`, `date`) — bump `version` and refresh `date` on an update — write
   the SDD, and record unresolved gaps in Open Questions.
```

- [x] **Step 6: Update pm-doc-sync**

In `plugins/product-design-suite/skills/pm-doc-sync/SKILL.md`, within step 3, after the existing bullet:

```markdown
   - A changed/ superseded ADR -> SDD "Referenced ADRs" and design choices.
```

add this bullet:

```markdown
   - Read each ADR's front-matter relationship fields (`supersedes`,
     `superseded-by`, `amends`, `amended-by`) to find linked ADRs, and verify the
     links are symmetric: if ADR-A lists `supersedes: [ADR-B]` but ADR-B lacks
     `superseded-by: [ADR-A]` (or the reciprocal amend link is missing), report
     the asymmetric/dangling link and propose the corrective edit.
```

- [x] **Step 7: Update structures.md**

In `plugins/product-design-suite/shared/references/structures.md`, in the "ADR quality checklist", after the line:

```markdown
- Superseded decisions link to the replacing ADR.
```

add these two bullets:

```markdown
- Metadata lives in a YAML front-matter block (id, title, status, date, author, reviewers, related-prd/sdd/adrs).
- Supersede/amend relationships use the structured `supersedes`/`superseded-by`/`amends`/`amended-by` front-matter fields, set on both ADRs — not parentheticals on `status`.
```

- [x] **Step 8: Update concepts.md**

In `plugins/product-design-suite/shared/references/concepts.md`, replace the line:

```markdown
- Metadata: ID, title, status, date, author, reviewers, and related documents.
```

with:

```markdown
- Metadata: ID, title, status, date, author, reviewers, related documents, and supersede/amend relationships — recorded in a YAML front-matter block.
```

and, immediately after the "ADR statuses" list (after the `- Rejected: ...` line), add this paragraph:

```markdown
Supersede and amend relationships are recorded in dedicated front-matter fields
(`supersedes`/`superseded-by`/`amends`/`amended-by`), set on both ADRs, keeping
`status` a single enum value rather than overloaded prose.
```

- [x] **Step 9: Run the tests to verify they pass**

Run: `node --test tests/metadata-conventions.test.js`
Expected: PASS — all eight tests green.

- [x] **Step 10: Run the full suite for no regressions**

Run: `node --test tests/*.test.js`
Expected: PASS — every test stays green.

- [x] **Step 11: Commit**

```bash
git add plugins/product-design-suite/skills/pm-adr-builder/SKILL.md \
        plugins/product-design-suite/skills/pm-prd-builder/SKILL.md \
        plugins/product-design-suite/skills/pm-sdd-builder/SKILL.md \
        plugins/product-design-suite/skills/pm-doc-sync/SKILL.md \
        plugins/product-design-suite/shared/references/structures.md \
        plugins/product-design-suite/shared/references/concepts.md \
        tests/metadata-conventions.test.js
git commit -m "feat: wire builders, doc-sync, and references for front-matter metadata"
```
