# Design: product-design-suite improvements (feedback 003)

**Date:** 2026-06-24
**Source:** `docs/feedbacks/003-improvements.md`
**Scope:** All 17 improvements (areas A–F), one phased plan.
**Status:** Approved (design), pending spec review.

## Summary

Feedback 003 lists 17 concrete improvements to the `product-design-suite`
plugin, grouped into six areas: (A) traceability tooling, (B) diagram workflow,
(C) `egp-import`, (D) templates & front-matter, (E) ID-convention governance,
(F) workflow orchestration. The root cause behind the highest-impact items (A1,
A3, A4, E1) is **ID-convention drift**: `scripts/traceability.js` hard-codes its
own ID regex, real-world docs use forms it silently drops (`NFR-P1`, `C-1`), and
nothing reconciles the templates, the tool, and real documents.

This design introduces a **single canonical ID-convention module** as the
foundation, refactors `traceability.js` to consume it, and adds a linter and a
consistency gate that build on it. The remaining template, diagram, import, and
orchestration improvements layer on top.

## Decisions (locked with user)

1. **Scope:** All 17 improvements, one dependency-ordered phased plan.
2. **Canonical ID format — permissive:** The canonical convention accepts
   **both** sequential (`NFR-001`) and category-lettered (`NFR-P1`) forms via
   `[A-Z]{0,2}\d+[a-z]?`. Templates keep their `NFR-001` examples but a note
   blesses category-letters. The linter accepts either. Lowest friction, no doc
   churn, fixes the silent-drop bug.
3. **Spec mechanism — shared JS module + reference doc:** One
   `scripts/id-conventions.js` (single source of truth, imported by
   `traceability.js` and the linter) plus a human-readable
   `shared/references/id-conventions.md` that templates link to.
4. **Constraints (`C-NNN`) are a first-class matrix row group** in the
   traceability output (not merged into AR handling).
5. **The consistency gate is a new standalone script** (`consistency-gate.js`),
   also exposed as a `egp-doc-sync` mode — not folded entirely into egp-doc-sync.

## Architecture

```
scripts/id-conventions.js   ← single source of truth (PREFIXES, member regex, parsers)
        │  imported by
        ├── scripts/traceability.js      (drops its local PREFIX/MEMBER constants)
        ├── scripts/lint-ids.js          (new — E1 linter)
        └── scripts/consistency-gate.js  (new — F2; also calls traceability + lint-ids)

shared/references/id-conventions.md   ← human-readable canonical spec; templates link here
```

The module is the keystone: it is what actually removes the duplication that
caused the drift. `traceability.js`, `lint-ids.js`, and the conventions tests
all derive their notion of "valid ID" from this one file.

## Phase 0 — Foundation: canonical ID conventions (E1; enables A1/A3/A4)

**New `scripts/id-conventions.js`** (CommonJS, matching `traceability.js`):
- `PREFIXES = ['FR','BR','NFR','AR','UAT','ADR','C']` — `C` added (A4).
- Member regex with category-letter + constraint support:
  `(?:FR|BR|NFR|AR|UAT|ADR|C)-[A-Z]{0,2}\d+[a-z]?` (A1).
- `parseMember(token) -> {prefix, cat, num, suf} | null`.
- `classify(token) -> prefix | null` (used for A3 unclassified reporting).
- Re-export the group/token/range building blocks `traceability.js` needs so
  range and list syntax (`FR-001..FR-005`, `NFR-P1/P2`) stay centralized.

**New `shared/references/id-conventions.md`** — documents prefixes (incl. `C`
constraints), category-lettered NFRs, suffix letters, and range/list syntax.
Templates link to it from their ID-bearing tables.

**Refactor `scripts/traceability.js`** to import `PREFIX`/`MEMBER`/parsers from
the module and delete its local copies (lines ~4–11 today). Behavior preserved
for existing IDs; new forms now recognized.

**New `scripts/lint-ids.js`** — scans a `.product/` directory, reports IDs that
don't match the canonical regex, plus duplicate and malformed IDs; exits
non-zero on violation. Importable for the F2 gate and runnable standalone.

**Tests:** new `tests/id-conventions.test.js` and `tests/lint-ids.test.js`;
extend `tests/traceability-conventions.test.js` to assert the module is the
source of the prefixes.

## Phase 1 — Section A: traceability (depends on Phase 0)

- **A1** — category-lettered NFR (`NFR-P1`, `NFR-S4`, `NFR-PR1`) parse via the
  module. Covered by Phase 0 + regression tests here.
- **A2 — structural AR-table parsing.** New `parseArTable(markdown)` locates the
  *Architectural Requirements* table (header
  `| ID | Requirement | Source | Design Impact |`) in SAD/SDD, reads the AR id
  from column 1 and FR/BR/NFR IDs **structurally from the Source column**,
  independent of sentence/period boundaries. Results are unioned with the
  existing prose `linksWithin` traces. Fixes the "period before Source breaks
  the link" bug (D4 workaround in feedback).
- **A3 — warn on dropped IDs.** During parse, collect tokens `classify()` cannot
  place; `buildMatrix` returns `unclassified: [...]`; the CLI prints
  `traceability: saw N tokens it could not classify: …`; `renderMarkdown` /
  `renderHtml` surface the list so coverage gaps from ID drift are visible.
- **A4 — `C-NNN` constraints first-class.** Added to `PREFIXES`; constraints
  become trace sources with their own matrix row group (constraint → FR/NFR/AR
  and → design sections/ADRs), rendered in both markdown and HTML output as a
  dedicated Constraints table.

**Tests:** extend `tests/traceability.test.js` for category-letter IDs, AR-table
column parsing, the unclassified report, and the constraints group.

## Phase 2 — Section D: templates & front-matter

- **D1 — `related-srs`.** Add `related-srs: []` to the ADR front-matter in
  `shared/templates/adr-template.md`; wire it into `egp-adr-builder` (offer the
  field) and `egp-doc-sync` (parse + reciprocity); extend
  `tests/metadata-conventions.test.js`.
- **D2 — mode-banner slot.** Standardize an optional, blessed slot
  `<!-- mode-banner -->…<!-- /mode-banner -->` immediately after the
  front-matter in the SRS and SAD templates (and PRD/SDD for symmetry). Builders
  fill it with the SRS/SAD-mode orientation note instead of inventing ad-hoc
  banners.
- **D3 — per-concern status field.** Add a small leading status table to SDD
  §9 (Observability), §10 (Resilience), and §14 (Operations) with a `Status`
  column constrained to `designed | partial | gap | n/a`, so honest
  gap-marking is structural rather than free-form prose. Extend the SDD
  conventions test if present, else add coverage.

## Phase 3 — Section B: diagram workflow

- **B1 — derived vs net-new.** `egp-sad-builder` and `egp-sdd-builder` state that
  **net-new** diagrams MUST go through the preview loop, while **faithful
  conversions** (import flow) MAY be batch-confirmed.
- **B2 — one-shot render path.** Add an `--out <file>` (one-shot) mode to
  `scripts/mermaid-preview.js`: render a single self-contained HTML file, print
  its path, and exit — no long-running server. Skills reference it as the
  lighter alternative to `start-server.sh`. Add coverage to
  `tests/mermaid-preview.test.js`.
- **B3 — explicit approval gate in derive-then-confirm.** Builders clarify that
  derive-then-confirm covers *section content*; the diagram approval loop is
  separate, but **derived diagrams may be folded into the same confirmation
  batch** while net-new diagrams still require the preview loop.

## Phase 4 — Section C: egp-import

- **C1 — machine-readable mapping.** Emit `.product/import-map.json` alongside
  the prose gap report:
  `{ "targets": { "<doc>": [{ "sourceRef", "status", "mappedTo" }] }, "unmapped": [...] }`.
  Builders consume the JSON instead of re-reading prose.
- **C2 — collected→per-file ADR handling.** Prescribe that a single `ADR.md`
  with N records defaults to **per-file `ADR-NNN-*.md`** splitting, with a note
  allowing the user to keep a collected file.
- **C3 — import state file.** Write `.product/import-state.json` recording
  import decisions (e.g. `sad: yes`, `adr-granularity: per-file`) so downstream
  builders read them instead of having them re-passed as arguments.

**Tests:** extend `tests/import-conventions.test.js` for the JSON map, the
per-file ADR default, and the state file.

## Phase 5 — Section F: orchestration (depends on Phases 0 + 1)

- **F1 — central confirmation-batch contract.** Define the "one confirmation
  batch" contract once in `egp-product-workflow` (and/or
  `shared/references/questioning-protocol.md`); builders reference it rather than
  each self-describing it, so it is applied consistently.
- **F2 — consistency gate.** New `scripts/consistency-gate.js` that runs
  `traceability.js` + `lint-ids.js` + ADR supersede/amend reciprocity +
  front-matter completeness, reporting one pass/fail summary. Exposed as a
  `egp-doc-sync` mode and wired into the final step of `egp-product-workflow`.

**Tests:** new `tests/consistency-gate.test.js`.

## Build order & dependencies

```
Phase 0  (foundation)
   └─> Phase 1  (A — needs the module)
   └─> Phase 5  (F2 gate — needs module + traceability)
Phases 2, 3, 4  (templates / diagrams / import — independent, may run in parallel)
```

Roughly six phases / ~14 implementation tasks. Each task ships with test
coverage following the existing `tests/*-conventions.test.js` and
`tests/traceability.test.js` patterns, and ticks its plan checkbox + commits
before the next task (per project convention).

## Out of scope

- No change to the canonical *sequential* examples in templates (decision 2 —
  permissive, no doc churn).
- No new document types or builders beyond those listed.
- No CI wiring beyond the existing `tests/` suite; the linter and gate are
  runnable and test-covered but not added to an external CI pipeline here.

## Risks

- **Regex broadening (A1/A4)** could over-match prose (e.g. a stray `C-3` that
  isn't a constraint). Mitigation: the A3 unclassified report makes
  false-negatives visible; constraint matching stays anchored to the `C-`
  prefix and tested against realistic prose.
- **AR-table structural parsing (A2)** depends on the template's column order.
  Mitigation: match by header cell names, not position, and fall back to prose
  co-occurrence when the table is absent.
- **Refactor of `traceability.js` (Phase 0)** risks regressions. Mitigation:
  the existing `tests/traceability.test.js` (8.5K) runs unchanged as a guard
  before new assertions are added.
