---
name: pm-sdd-builder
description: Create or update a Software Design Document (SDD). Use when the user wants to design the technical solution, architecture, C4 diagrams, components, data model, APIs, security, observability, or testing strategy derived from a PRD. Writes .product/sdd/sdd.md with inline Mermaid diagrams (and optional exports to .product/diagrams/).
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-sdd-builder

Build or update the SDD at `.product/sdd/sdd.md` from the shared template,
derived from the PRD.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/sdd-template.md`
- PRD: `.product/prd/prd.md` (read for requirements to satisfy)
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol,openui-guide}.md`

## Steps
1. If `.product/prd/prd.md` is missing, warn the user that the SDD should follow
   a PRD, and offer to run `pm-prd-builder` first (do not hard-block).
2. Read the SDD template and the PRD. Map PRD `FR-NNN` to Architectural
   Requirements `AR-NNN` in the SDD for traceability (reference the FR IDs).
3. Fill each required section; ask gap questions per `questioning-protocol.md` (pause after every 4 questions and summarize remaining gaps).
4. Author diagrams as **inline Mermaid** in `sdd.md`:
   - **Recommend a set.** Read the PRD/SDD and pick diagram archetypes from the
     catalog in `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
     ("Diagram archetypes (Mermaid)"), driven by the system's shape — e.g. auth
     handshake → `sequenceDiagram`, background jobs → `stateDiagram-v2`,
     privacy/LGPD data crossing zones → `flowchart` DFD with `subgraph` trust
     boundaries, multi-store → `erDiagram`/deployment. Present the recommended set
     with a one-line rationale each and let the user confirm or adjust.
   - **Draft** Mermaid source for each chosen type (`C4Context`/`C4Container`/
     `C4Component`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, `flowchart`).
   - **Present for approval.** Show the Mermaid source in the conversation, and
     offer a rendered preview: write the drafts to a scratch markdown file and run
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js" <scratch.md> <preview.html>`
     (use a temporary path like the system temp dir for both the scratch markdown
     and preview HTML, not `.product/`), served via the preview server (`start-server.sh`).
     Mermaid is vendored locally, so the preview works offline. Iterate until the user approves.
   - **Write** the approved ` ```mermaid ` blocks inline into the relevant `sdd.md`
     sections (§3 Architecture Overview, §7 Flows and Behavior). These inline blocks
     are the source of truth.
   - **Optionally export** standalone files to `.product/diagrams/{c4,sequence,state,data,deployment,flow}/`
     only if the user wants separate artifacts.
5. For UI/frontend sections, author OpenUI Lang in `.product/design/*.openui`
   and render with `${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js` to `.product/design/*.html`.
6. Identify decisions with significant trade-offs and flag them as ADR
   candidates; hand each to `pm-adr-builder`. Reference resulting `ADR-NNN`
   in the SDD's "Referenced ADRs" section.
7. On finalize, write the SDD and record unresolved gaps in Open Questions.
8. Suggest running `pm-doc-sync` to refresh the traceability matrix.

## Rules
- Every major design choice should map back to a PRD requirement or an ADR.
- Cover failure modes, security, observability, and operations — not only happy paths.
