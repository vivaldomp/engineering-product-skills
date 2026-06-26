# Spec: product-design-suite — feedback-004 improvements

**Date:** 2026-06-25
**Source feedback:** `docs/feedbacks/004-improvements.md`
**Plugin:** `plugins/product-design-suite`
**Scope:** All 11 improvements (IMP-1 … IMP-11).

## Guiding constraints

- **Zero runtime dependencies.** The entire suite is pure Node (`node:` builtins) plus a
  vendored browser-side `mermaid.min.js`. There is no programmatic/headless renderer; visual
  preview launches the user's real browser. Every change here preserves the zero-dep model —
  no `package.json`, no `node_modules`, no jsdom/playwright/puppeteer added to any shippable
  script.
- **Single source of truth for IDs.** `scripts/id-conventions.js` remains the only place the
  requirement/ADR/constraint ID regex is defined. New code consumes it; it is not duplicated.
- **No behavior regressions.** The existing `tests/` suite must stay green; new behavior ships
  with new tests in the same `node:test` style.

## New foundational concept: gate check levels

`scripts/consistency-gate.js` currently treats every check as binary pass/fail. Introduce a
per-check `level` field: `'error' | 'warn'`.

- `level: 'error'` → a failing check fails the gate (exit 1). *(default; preserves today's behavior)*
- `level: 'warn'` → a failing check prints a `[WARN]` line but the gate still passes (exit 0).

The summary still prints one line per check; the final `PASS/FAIL` is computed from
`error`-level checks only. `warn`-level checks never flip the gate.

This level mechanism is the backbone for IMP-3 (structure drift) and IMP-7 (related-adrs).

---

## High value

### IMP-1 — Eliminate phantom orphans (two layers)

**Problem:** Templates use real-looking example IDs (`FR-001`, `NFR-001`, `AR-001`, `UAT-001`,
`ADR-001`, `BR-001`). The scanner treats any ID-shaped token in prose as a real reference, so
leftover/example IDs surface as phantom orphans.

**Fix layer (a) — non-matching template placeholders.** In all five templates
(`prd/srs/sad/sdd/adr`), replace real-looking example IDs in example/illustration rows with
non-matching placeholders:

- `FR-001`/`FR-002` → `FR-NNN`
- `NFR-001`/`NFR-002` → `NFR-NNN`
- `BR-001`/`BR-002` → `BR-NNN`
- `AR-001`/`AR-002` → `AR-NNN`
- `UAT-001` → `UAT-NNN`
- `ADR-001`/`ADR-002` → `ADR-NNN`

`-NNN` does not match the canonical `\d+` member regex, so placeholders are inert to the scanner
and the linter. (The `srs-template.md` line that *documents* the ID format inside an inline-code
span — e.g. `` `FR-001` `` — is covered by layer (b) below and may keep its example.)

**Fix layer (b) — strip code before scanning.** Add a shared helper `stripCode(text)` that
removes fenced code blocks (```` ``` ````-delimited) and inline-code spans (`` ` ``-delimited)
from a string. Apply it inside `traceability.js` (`parseRefs`, and the table/section readers that
scan prose) and `lint-ids.js` (`lintText`) so any ID shown as an example *inside code* is never
counted as a reference or a lint target.

- `stripCode` lives in one module (recommended: `id-conventions.js`, already the shared
  convention module, or a tiny `text-utils.js`) and is imported by both consumers.
- Fenced blocks are removed first (multi-line), then inline spans, so a backtick inside a fenced
  block does not corrupt the pass.
- **Important:** `mermaid-lint.js` (IMP-6) must read mermaid blocks from the **raw** markdown,
  not the stripped text — stripping is only for ID scanning.

**Acceptance:**
- A template rendered with placeholders produces zero phantom orphans through the gate.
- An ID written inside an inline-code span or fenced block in a `.product` doc is not reported as
  a reference or as a malformed/duplicate ID.
- Real IDs in ordinary prose and in tables continue to be detected exactly as before.

### IMP-2 — cwd-safety and fail-loud

**Problem:** Scripts resolve the target via a relative path. With the shell cwd inside `.product/`,
`traceability.js` threw `ENOENT` on write while the gate still printed `PASS` against an
effectively empty read.

**Fix:**
- At entry of every CLI script (`traceability.js`, `consistency-gate.js`, `lint-ids.js`,
  `validate-structure.js`, `mermaid-lint.js`), resolve the target dir to an absolute path via
  `path.resolve(dir)` before any read/write.
- Add an `error`-level gate check `inputs-present`: FAIL when **both** zero requirements are
  parsed **and** zero `.product/*.md` files exist under the resolved dir. A real-but-empty project
  is distinguishable from a misdirected run; the latter must not pass vacuously.
- When `traceability.js` cannot write its outputs (e.g. ENOENT), it prints a clear error and exits
  non-zero rather than reporting partial success.

**Acceptance:**
- Running the gate against a directory containing no `.product` docs FAILs with a clear message.
- Running from inside `.product/` resolves correctly (or fails loudly) — never a false PASS.

### IMP-3 — `scripts/validate-structure.js` (warn-level)

**Problem:** Nothing detects when a builder drops, renames, or merges a template subsection
(observed §9/§10/§14 consolidations and the altered Alerts table).

**Fix:** New pure-Node script `validate-structure.js`.

- Maps each produced doc to its template:
  `prd/prd.md → prd-template.md`, `srs/srs.md → srs-template.md`,
  `sad/sad.md → sad-template.md`, `sdd/sdd.md → sdd-template.md`.
  (ADRs are excluded — they are short and per-decision.)
- Resolves templates from `shared/templates/` relative to `__dirname` (self-maintaining; **no
  hardcoded heading list**).
- Extracts the template's `##` and `###` headings (stripping leading section numbers and the
  `<...>` placeholder/angle markers) as the **required heading set**.
- Compares against the produced doc's headings and reports:
  - **missing** — a required heading with no match;
  - **merged** — a produced heading whose text *contains* one or more required heading names
    (e.g. `Retry / Timeouts / Fallbacks` covers `Retry`, `Timeouts`, `Fallbacks`); reported
    informationally, not as missing;
  - **renamed** — best-effort: a required heading absent and an unexpected sibling present at the
    same level.
- Headings under an explicit "add subsections as needed" escape hatch (SDD §17) are not required.
- Wired into the gate as a **`warn`-level** check (`structure`): drift is surfaced but never
  fails the gate.

**Acceptance:**
- A doc that merges three template subsections into one heading is reported as a structure
  **warning** listing the merged names, and the gate still PASSes.
- A doc that simply omits a required heading is reported as missing (warn).
- A faithfully-structured doc produces no structure warnings.

### IMP-4 — ADR index + status auto-sync

**Problem:** ADR status/titles are duplicated by hand across SDD §15, SDD §2 (Related ADRs), and
SAD §7/§1. A single status change meant editing 5–7 places.

**Fix (runs during `egp-doc-sync`):**
- **Index generation:** write `.product/adr/index.md` — a table of `ID | Title | Status | Date`
  built from each ADR file's front-matter (reusing `consistency-gate.js`'s `readFrontMatter`).
  Wrapped in `START`/`END` markers so regeneration is idempotent.
- **SDD §15 status sync:** populate the §15 ADR table's `Status` column from each ADR's
  front-matter `status`, using the same marker-injection mechanism as the §16 coverage index
  (`injectCoverage` pattern in `traceability.js`). The SDD §15 table region is delimited by its
  own `START/END` markers; front-matter is the single source of truth.
- Implementation: a new function set (recommended module `scripts/adr-index.js`, or added to
  `traceability.js`) exporting `buildAdrIndex(dir)`, `renderAdrIndex(adrs)`, and
  `syncSddAdrStatus(sddText, adrs)`.

**Acceptance:**
- Changing an ADR's front-matter `status` and re-running `egp-doc-sync` updates `.product/adr/index.md`
  and the SDD §15 Status column without manual edits.
- Re-running with no changes is a no-op (idempotent between markers).

---

## Medium value

### IMP-5 — Add `planned` concern status

**Problem:** The `designed | partial | gap | n/a` enum forced whole unbuilt-but-designed
subsystems to be marked `gap`, conflating "designed, not yet built" with "design missing."

**Fix:**
- Extend the enum to `designed | partial | gap | planned | n/a` everywhere it appears in
  `shared/templates/sdd-template.md` (the §9/§10/§14 concern-status tables and their legends).
- `planned` = designed but not yet built; `gap` = design missing.
- Update `tests/metadata-conventions.test.js` regex assertions to the new enum.
- Note: the `egp-import` `status` enum (`derived | partial | gap`) is a *separate* concept
  (import maturity) and is **not** changed.

**Acceptance:** templates and tests reference the five-value enum; the gate/tests pass.

### IMP-6 — `scripts/mermaid-lint.js` (lightweight, error-level)

**Problem:** A real mermaid syntax error (semicolons in `sequenceDiagram` message text) was caught
only by a manual headless render.

**Fix:** New pure-Node, dependency-free rule-based linter.

- Reuses `extractMermaidBlocks` (from `mermaid-preview.js`) over the **raw** markdown of each
  `.product` doc.
- Per block, checks the known footgun class:
  - missing or unknown diagram-type keyword on the first non-empty line
    (`graph`/`flowchart`/`sequenceDiagram`/`classDiagram`/`stateDiagram`/`erDiagram`/`C4Context`/…);
  - stray `;` or unescaped `:` inside `sequenceDiagram` message text;
  - unbalanced `[]`, `()`, `{}` brackets within the block;
  - empty block (no content lines).
- These are **parse-class** failures → wired into the gate as an **`error`-level** check
  (`mermaid-lint`).
- Documented limitation: catches the known classes, **not** a full mermaid parser. Comment and
  the gate detail line say so.

**Acceptance:**
- A `sequenceDiagram` block with a semicolon in message text fails the gate with a pointed message.
- A well-formed set of diagrams passes.

### IMP-7 — `related-adrs` reciprocity (warn-level)

**Problem:** The gate verifies `supersedes`/`amends` reciprocity but not `related-adrs`; adding an
ADR meant manually editing the other ADR's `related-adrs`.

**Fix:** Extend `checkReciprocity` in `consistency-gate.js` to also check `related-adrs` symmetry
(A lists B ⇒ B should list A), reported at **`warn`** level — separate from the existing
`supersedes`/`amends` errors, which stay `error`-level. The gate gains a distinct `related-adrs`
warn check (or the existing `adr-reciprocity` check is split into an error part and a warn part).

**Acceptance:** a one-directional `related-adrs` link prints a `[WARN]` line; the gate still passes.
A missing `superseded-by`/`amended-by` mirror still FAILs.

### IMP-8 — Clarify the duplicate report

**Problem:** `id-lint: 0 malformed, 139 duplicate` always passes and looks alarming. Cross-document
*mentions* are expected; *duplicate definitions* are not.

**Fix:** In `lint-ids.js`, distinguish:
- **duplicate definitions** — the same ID defined in a requirement **table row** (an ID appearing
  in the first cell of a table row) in more than one place → `error`-level (a real problem);
- **cross-document mentions** — the same ID referenced across files → informational count, relabeled.

The gate's `id-lint` line reads e.g. `0 malformed, 0 duplicate-definitions, 139 cross-doc mentions
(expected)`. Only `malformed` and `duplicate-definitions` are error-level.

**Acceptance:** ordinary cross-references no longer inflate an alarming "duplicate" number; a genuine
duplicate *definition* (same ID defined in two tables) FAILs.

---

## Lower value / polish

### IMP-9 — `docs/` read-only guard

Add an explicit reminder to each builder SKILL (`egp-prd-builder`, `egp-srs-builder`,
`egp-sad-builder`, `egp-sdd-builder`, `egp-adr-builder`) output/guard section: never write under
`docs/` — the import source is read-only; all authored artifacts live under `.product/`.

### IMP-10 — Consolidated decision ledger

Add a convention to the builders / `questioning-protocol.md`: each builder run emits a single
structured **"Open decisions + recommended defaults"** block (one list with a recommended default
per item) rather than scattering many separate question rounds, so the user confirms in one pass.

### IMP-11 — Version-bump heuristic

Add a short semver rule-of-thumb to the builders for the document `version` front-matter:
- **patch** — typo/clarification/formatting, no requirement change;
- **minor** — new section, requirement, or ADR added; backward-compatible;
- **major** — restructure, removed/renamed requirements, or otherwise breaking.

---

## Testing strategy

All tests use the existing `node:test` style under `tests/`. The full suite stays green.

- `tests/traceability-conventions.test.js` / `tests/traceability.test.js` — `stripCode` cases
  (IDs in fenced/inline code ignored; placeholders inert; real prose/table IDs still detected).
- `tests/lint-ids.test.js` — `stripCode`; duplicate-definition vs cross-doc-mention split (IMP-8).
- new `tests/validate-structure.test.js` — missing/merged/renamed detection; merged headings
  satisfy required names; faithful doc is clean (IMP-3).
- new `tests/mermaid-lint.test.js` — semicolon-in-sequenceDiagram fails; unbalanced brackets;
  typeless block; well-formed passes (IMP-6).
- new ADR-index tests (in `tests/consistency-gate.test.js` or a new file) — index generation from
  front-matter; SDD §15 status sync; idempotent re-run (IMP-4).
- `tests/consistency-gate.test.js` — error/warn level mechanism; `inputs-present` fail-loud
  (IMP-2); `related-adrs` warn (IMP-7).
- `tests/metadata-conventions.test.js` — five-value `planned` enum (IMP-5).

## Delivery shape (phasing for the implementation plan)

One spec → one implementation plan, phased; each phase commits with tests passing:

- **Phase A — scanner & gate core:** `stripCode` helper + wiring (IMP-1b), template placeholders
  (IMP-1a), cwd-safety + fail-loud `inputs-present` (IMP-2), error/warn level infra +
  duplicate-definition split (IMP-8).
- **Phase B — new validators:** `validate-structure.js` (IMP-3), `mermaid-lint.js` (IMP-6), both
  wired into the gate at their respective levels.
- **Phase C — ADR sync:** `adr-index.js` + `.product/adr/index.md` generation and SDD §15 status
  sync in `egp-doc-sync` (IMP-4).
- **Phase D — templates & builder docs:** `planned` enum (IMP-5), `docs/` guard (IMP-9), decision
  ledger convention (IMP-10), version-bump heuristic (IMP-11).
- **Phase E — reciprocity:** `related-adrs` warn-level reciprocity (IMP-7).

## Out of scope

- No new runtime dependencies; no full mermaid parser (IMP-6 is rule-based by design).
- IMP-3 does not validate ADRs and does not block the gate.
- The `egp-import` `status` enum is unchanged.
