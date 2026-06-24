---
name: pm-product-workflow
description: Orchestrate the end-to-end product design workflow (PRD then SDD then ADR). Use when the user wants to start designing a product, run the full product-spec workflow, or is unsure which document to write next. Initializes .product/, enforces the question cadence, and dispatches to the prd/sdd/adr builders and doc-sync.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-product-workflow

Drive the sequential PRD -> (optional) SRS -> (optional) SAD -> SDD -> ADR workflow.

## Steps
1. **Initialize** `.product/` if missing: create `prd/ sdd/ adr/ diagrams/
   design/ research/`.
2. **Detect stage** by inspecting `.product/` and the working tree:
   - `.product/` has no `prd/prd.md` yet but existing product docs are present
     elsewhere (e.g. a `docs/` set with PRD/SRS/ADR/SDD) -> offer `pm-import` first
     to ingest them and write a gap report before authoring.
   - a pre-existing `.product/` document predates the metadata convention (no YAML
     front-matter, or an ADR still carrying a legacy `## 1. Metadata` table) ->
     offer the `pm-doc-sync` migration before continuing.
   - no `prd/prd.md` -> start with `pm-prd-builder`.
   - PRD exists, no `srs/srs.md` -> offer `pm-srs-builder` for teams that maintain a formal
     IEEE-830 SRS (optional; skipping it keeps the PRD as the requirements home). If a `docs/`
     SRS was imported, offer the SRS builder here.
   - PRD exists (and the SRS, if the team uses one), no `sad/sad.md` -> offer `pm-sad-builder`
     for teams that maintain a System Architecture Document (optional; skipping it keeps the
     macro-architecture and `AR-NNN` in the SDD). If a `docs/` SAD was imported, offer the SAD
     builder here.
   - PRD exists (and the SRS/SAD, if the team uses them), no `sdd/sdd.md` -> offer
     `pm-sdd-builder`. When `.product/srs/srs.md` exists, the SRS is the requirements source;
     when `.product/sad/sad.md` exists, the SAD is the macro-architecture source and owns
     `AR-NNN`, so the SDD references it and focuses on C3 component/code design.
   - SDD exists -> offer `pm-adr-builder` for flagged decisions.
   Warn (don't block) if the user wants to skip ahead.
3. **Enforce cadence** from
   `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md` across the
   active builder (gap-only questions; pause after every 4; summarize remaining
   gaps).
4. **Dispatch** to the appropriate builder skill for the current stage.
5. **Preview (optional)** during iteration: start the live preview server with
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/start-server.sh"`. Render SDD diagrams for
   review by extracting their inline Mermaid into a self-contained page —
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js" .product/sdd/sdd.md <content>/sdd-diagrams.html`
   — and OpenUI mockups via `openui-render.js`. The diagram preview HTML should be
   written into the preview server's session content directory (the directory the
   server serves), not into `.product/` proper. Stop the server with
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/stop-server.sh"` when done.
6. **Sync after edits**: whenever a document is created or changed, run
   `pm-doc-sync` to propagate impacts and refresh the traceability matrix.
7. **Advance** to the next stage when the current document is finalized.

## Rules
- Respect the sequence; the PRD anchors the work, an optional SRS (when present) owns the
  detailed `FR`/`NFR`, an optional SAD (when present) owns the macro-architecture and `AR-NNN`
  that the SDD designs against, and ADRs record decisions made during SAD/SDD design.
  `.product/srs/` and `.product/sad/` are created on demand by their builders — the workflow
  need not pre-create them.
- Keep everything inside `.product/`.
