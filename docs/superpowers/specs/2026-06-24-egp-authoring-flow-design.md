# Phase 4 — Authoring Flow: Import/Bootstrap + Derive-then-Confirm Design

> Status: Approved · Date: 2026-06-24 · Owner: Vivaldo
> Source: `docs/feedbacks/001-assumptions.md` (items B6 + B7)
> Scope: Fourth of five phases improving the `product-design-suite` plugin.

## Context

The plugin's workflow assumes greenfield authoring. `egp-product-workflow` initializes an
empty `.product/` and drives PRD → SDD → ADR, with each builder asking gap questions for
every missing section (the 4-question cadence in `questioning-protocol.md`).

Two gaps surfaced in the feedback:

- **B6 — no sanctioned import path.** Teams that already have docs (PRD/SRS/ADR/SDD) have no
  first-class "ingest them, map to templates, flag gaps" mode. The feedback author did this
  by hand: read `docs/` → map to templates → ask only the genuine gap questions.
- **B7 — interrogation when source exists.** When authoritative source is present, most
  template sections are *derivable*. Asking about all of them is friction; confirmation is
  cheaper than interrogation.

This spec covers **Phase 4** of the five-phase roadmap derived from the feedback:

1. Diagrams (B1+B2+B3+B10) — shipped (Phase 1).
2. Traceability (B4+B8) — shipped (Phase 2).
3. Template metadata & ADR relationships (B5) — shipped (Phase 3).
4. **Authoring flow: import + derive-then-confirm (B6+B7)** — this spec.
5. SRS support (B9) — later cycle.

It also absorbs the backward-compat migration deferred from Phase 3: pre-existing `.product/`
docs that predate the front-matter convention (no front-matter; ADRs still carrying the
legacy `## 1. Metadata` table).

## Decisions (confirmed)

- **Import delivery:** a dedicated **`egp-import` skill** plus a `/egp-import` command — not
  folded into `egp-product-workflow`. Keeps the ingest → map → gap-report responsibility
  focused; the workflow detects existing source docs and offers it.
- **Gap report:** a **durable written artifact** at `.product/import-gap-report.md`, not an
  inline-only report. Reviewable, lives in git, and gives the builders a checklist to work
  from.
- **Legacy migration home:** **`egp-doc-sync`**, not `egp-import`. `egp-import` onboards
  *foreign-format* docs from outside the plugin; the migration is an *in-place upgrade* of
  docs already in the plugin's templates that predate front-matter. That in-place,
  confirmation-gated structural edit on the existing triad is precisely `egp-doc-sync`'s job.
  `egp-product-workflow` surfaces it at init; `egp-doc-sync` detects and proposes it.

## Goal & Non-Goals

**Goal:** Give the plugin a first-class "I already have docs" path. A `egp-import` skill
ingests existing PRD/SRS/ADR/SDD, maps them to the templates, and writes a gap report before
any authoring. A new derive-then-confirm mode lets the builders derive sections from that
source and confirm in bulk, asking only about genuine gaps. Pre-existing `.product/` docs get
migrated to the Phase 3 front-matter convention. Lock the conventions with tests.

**Non-goals:** Phase 5 (SRS template / B9 — SRS stays a linked read-only reference here). No
programmatic doc-parsing script — mapping is judgment-heavy and stays skill-driven, with no
new runtime script (consistent with Phase 3). No diagram or traceability-engine changes. No
auto-migration or auto-rewrite without user confirmation.

## Component 1 — `egp-import` skill (B6)

`skills/egp-import/SKILL.md` (`name: egp-import`) and `commands/egp-import.md`.

**Principle: import is analysis, not authoring.** `egp-import` never writes
`.product/prd/prd.md`, `sdd/sdd.md`, or `adr/*.md`. It produces the gap report and the mapped
material; the builders author the documents (in derive-then-confirm mode). This keeps a clean
separation: import = ingest + map + report; builders = author.

Steps:

1. **Locate source.** Ask the user where existing docs live; default to scanning `docs/`.
   Accept explicit paths. Classify each candidate by type (PRD / SRS / ADR / SDD) using
   filename and heading heuristics, and confirm the classification with the user before
   proceeding.
2. **Map to templates.** For each source doc of a supported type (PRD/SDD/ADR), match its
   content to the corresponding template's sections. **SRS has no native template** (B9 is
   Phase 5): it is recorded as a read-only reference link in the gap report, never folded into
   another doc or relocated (honors the confirmed "do not touch SRS" stance).
3. **Write the gap report** to `.product/import-gap-report.md`. For each target doc
   (PRD/SDD/ADR), a table of template sections against a status for each:
   - `derived` — source fully covers the section;
   - `partial` — source covers it incompletely;
   - `gap` — no source material; a genuine question for the builder;
   - plus an **unmapped-source** list per doc: source material that did not map to any
     template section, surfaced distinctly so nothing is silently dropped.
4. **Hand off.** Offer to run each builder in derive-then-confirm mode, pre-seeded with that
   doc's mapped content and its gap list.

Rules: read-only on the source location (never migrate, move, or edit source files);
SRS stays a linked reference; confirmation-gated throughout (classification and hand-off are
confirmed with the user).

## Component 2 — Derive-then-confirm mode (B7)

Add a second mode to `shared/references/questioning-protocol.md`, alongside the existing
4-question "greenfield" cadence.

**When active:** a builder has authoritative source for the document — either handed mapped
content by `egp-import`, or given source directly by the user.

**Behavior:**

- Derive every section the source supports.
- Present **one confirmation batch**: a compact per-section summary of the derived content,
  plus only the *genuine gaps* as questions.
- The existing **4-question pause cadence still governs the gap questions** — even in derive
  mode the user is never faced with an interrogation wall.
- If the user finalizes before confirming derived content, that content is recorded as
  **assumptions / Open Questions — never presented silently as fact** (mirrors the protocol's
  existing "no silent TBDs" discipline).

The greenfield 4-question cadence is unchanged and remains the default when no source exists.

## Component 3 — Builder + workflow wiring

- **`egp-prd-builder`, `egp-sdd-builder`, `egp-adr-builder`:** each gains a branch in its steps —
  "if mapped source / authoritative source is provided, use derive-then-confirm mode per
  `questioning-protocol.md`; otherwise use the gap-question cadence." Builders continue to own
  ID assignment and **reuse source IDs verbatim** for cross-doc traceability (a confirmed
  assumption from the feedback run).
- **`egp-product-workflow`:** the detect-stage step gains two checks at init — if `.product/`
  has no PRD yet but source docs exist (e.g., a `docs/` set), offer `egp-import` first; if
  pre-existing `.product/` docs are detected that predate the front-matter convention, offer
  the migration (Component 4).

## Component 4 — Legacy migration (Phase 3 deferred item)

In `skills/egp-doc-sync/SKILL.md`: add a detection-and-propose step for pre-existing `.product/`
docs that predate the Phase 3 front-matter convention. Detect docs that lack YAML front-matter,
and ADRs that still carry the legacy `## 1. Metadata` table. Propose the corrective edit —
add front-matter populated from the existing content; for ADRs, lift the `## 1. Metadata` rows
into front-matter, drop the table, and renumber the body sections to match the current template.
Confirmation-gated and consistent with `egp-doc-sync`'s existing "propose, then apply on
approval — no silent rewrites" rule.

## Testing

New `tests/import-conventions.test.js` (mirroring the Phase 2/3 convention tests) asserts:

- `skills/egp-import/SKILL.md` exists with valid front-matter (`name: egp-import`, a
  `description`), and its body documents: source ingest / classification, mapping to
  templates, the gap-report artifact path `.product/import-gap-report.md`, SRS-as-read-only-
  reference, read-only treatment of source, and hand-off to builders in derive-then-confirm.
- `commands/egp-import.md` exists.
- `questioning-protocol.md` documents the derive-then-confirm mode (derive, single
  confirmation batch, genuine gaps only, 4-question pause still applies, no silent unconfirmed
  content).
- Each builder SKILL (`egp-prd-builder`, `egp-sdd-builder`, `egp-adr-builder`) mentions the
  source-driven / derive-then-confirm mode.
- `egp-product-workflow` SKILL mentions detecting existing source docs (offer `egp-import`) and
  detecting legacy docs (offer migration).
- `egp-doc-sync` SKILL documents the legacy front-matter / `## 1. Metadata` migration.

The Phase 1, 2, and 3 suites must continue to pass, including `validate-plugin.test.js` (the
new skill must satisfy `name == dir`). Run with `node --test tests/*.test.js`.

## Open Questions

None outstanding. Three points were settled during design: (a) import is a dedicated
`egp-import` skill, not folded into the workflow; (b) the gap report is a durable
`.product/import-gap-report.md` artifact; (c) the legacy migration lives in `egp-doc-sync` (in-
place triad upgrade) rather than `egp-import` (foreign-source onboarding).
