---
name: egp-product-workflow
description: Orchestrate the end-to-end product design workflow (PRD then optional SRS then optional SAD then SDD then ADR). Use when the user wants to start designing a product, run the full product-spec workflow, or is unsure which document to write next. Initializes workspace/outputs/current/, enforces the question cadence, and dispatches to the prd/srs/sad/sdd/adr builders and doc-sync.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-product-workflow

Drive the sequential PRD -> (optional) SRS -> (optional) SAD -> SDD -> ADR workflow.

## Steps
1. **Initialize** `workspace/outputs/current/` if missing: create `planning/ architecture/ architecture/adr/ exports/
   ux/ governance/`.
2. **Detect stage** by inspecting `workspace/outputs/current/` and the working tree:
   - `workspace/outputs/current/` has no `planning/prd.md` yet but existing product docs are present
     elsewhere (e.g. a `docs/` set with PRD/SRS/ADR/SDD) -> offer `egp-import` first
     to ingest them and write a gap report before authoring.
   - a pre-existing `workspace/outputs/current/` document predates the metadata convention (no YAML
     front-matter, or an ADR still carrying a legacy `## 1. Metadata` table) ->
     offer the `egp-doc-sync` migration before continuing.
   - no `planning/prd.md` -> start with `egp-prd-builder`.
   - PRD exists, no `specifications/srs.md` -> offer `egp-srs-builder` for teams that maintain a formal
     IEEE-830 SRS (optional; skipping it keeps the PRD as the requirements home). If a `docs/`
     SRS was imported, offer the SRS builder here.
   - PRD exists (and the SRS, if the team uses one), no `architecture/sad.md` -> offer `egp-sad-builder`
     for teams that maintain a System Architecture Document (optional; skipping it keeps the
     macro-architecture and `AR-NNN` in the SDD). If a `docs/` SAD was imported, offer the SAD
     builder here.
   - PRD exists (and the SRS/SAD, if the team uses them), no `architecture/sdd.md` -> offer
     `egp-sdd-builder`. When `specifications/srs.md` exists, the SRS is the requirements source;
     when `architecture/sad.md` exists, the SAD is the macro-architecture source and owns
     `AR-NNN`, so the SDD references it and focuses on C3 component/code design.
   - SDD exists -> offer `egp-adr-builder` for flagged decisions.
   Warn (don't block) if the user wants to skip ahead.
3. **Enforce cadence** from
   `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md` across the
   active builder (gap-only questions; pause after every 4; summarize remaining
   gaps). Each builder follows the confirmation batch contract in
   `shared/references/questioning-protocol.md`.
4. **Dispatch** to the appropriate builder skill for the current stage.
5. **Diagram approval gate (mandatory — 006 B1).** Any document containing Mermaid
   MUST have its diagrams rendered in the preview server and explicitly approved
   before the document is marked done. Diagrams are rendered with `mermaid-preview.js`;
   for a portable JS-free version, use `mermaid-preview.js --static`. The SDD/SAD builders own and enforce this
   gate. Present the server's `markdown_link` field as a **clickable Markdown link —
   never a raw copy-paste URL** — and start the server with `--open` after the user
   opts into review (still print the link as a headless/remote fallback).
   The server serves only the **single newest** `.html` screen (`getNewestScreen`);
   there is no multi-screen navigation, so to review several documents' diagrams at
   once, concatenate them into one screen file.
6. **Sync after edits**: whenever a document is created or changed, run
   `egp-doc-sync` to propagate impacts and refresh the traceability matrix.
7. **Advance** to the next stage when the current document is finalized.
8. **Final consistency check**: before closing a workflow session, run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/consistency-gate.js"` to execute traceability,
   ID linting, and ADR supersede/amend reciprocity in one pass and get a
   single PASS/FAIL summary.

## Batch / derive-all mode (opt-in, 006 F)

Default mode is interactive derive-then-confirm, one builder at a time. For a full
suite, the user may request **batch / derive-all** mode:

- **Dependency order is explicit:** ADRs → SRS/SAD → SDD/PRD. ADR IDs must exist
  before docs cite them; the SAD mints `AR-NNN` the SDD references; the SRS owns
  `FR`/`NFR` the PRD/SDD reference. Author in this order.
- **Author derivable content first.** Produce everything derivable from the source +
  prior decisions without stopping, then surface the **consolidated** gap questions
  once at the end instead of interrupting per document.
- **Safe to parallelize across non-conflicting files** (different target docs),
  provided the dependency order above is respected. Still run the diagram approval
  gate (step 5) and the consistency gate before marking the suite done.

## Rules
- **Inline the builder's steps (006 H1):** Skill invocation output is host-dependent.
  Before dispatching a builder, if its invocation does not surface its Steps/Rules,
  read the builder's `SKILL.md` directly and follow it. Never proceed on a one-line
  launch alone.
- Respect the sequence; the PRD anchors the work, an optional SRS (when present) owns the
  detailed `FR`/`NFR`, an optional SAD (when present) owns the macro-architecture and `AR-NNN`
  that the SDD designs against, and ADRs record decisions made during SAD/SDD design.
  `specifications/` and `architecture/sad.md` are created on demand by their builders — the workflow
  need not pre-create them.
- Keep everything inside `workspace/outputs/current/`.
- **Output language (006 G):** Ask once for the output language and write
  `outputLanguage` (and `codeAndJargon` if jargon/code should stay in another
  language) into `governance/import-state.json`. Every builder reads these — do not
  repeat the language rule per dispatch.
