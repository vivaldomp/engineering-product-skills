---
name: pm-product-workflow
description: Orchestrate the end-to-end product design workflow (PRD then SDD then ADR). Use when the user wants to start designing a product, run the full product-spec workflow, or is unsure which document to write next. Initializes .product/, enforces the question cadence, and dispatches to the prd/sdd/adr builders and doc-sync.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-product-workflow

Drive the sequential PRD -> SDD -> ADR workflow.

## Steps
1. **Initialize** `.product/` if missing: create `prd/ sdd/ adr/ diagrams/
   design/ research/`.
2. **Detect stage** by inspecting `.product/`:
   - no `prd/prd.md` -> start with `pm-prd-builder`.
   - PRD exists, no `sdd/sdd.md` -> offer `pm-sdd-builder`.
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
- Respect the sequence; the PRD anchors the SDD, and ADRs record decisions made
  during SDD design.
- Keep everything inside `.product/`.
