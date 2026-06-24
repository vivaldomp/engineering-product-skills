---
name: pm-sdd-builder
description: Create or update a Software Design Document (SDD). Use when the user wants to design the technical solution, architecture, C4 diagrams, components, data model, APIs, security, observability, or testing strategy derived from a PRD. Writes .product/sdd/sdd.md and diagrams to .product/diagrams/.
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
4. Render diagrams as self-contained HTML into `.product/diagrams/`:
   - Build a compact spec `{title, nodes, edges}` and run
     `${CLAUDE_PLUGIN_ROOT}/scripts/diagram-render.js <spec.json> .product/diagrams/<name>.html`
     for C4 context/container/component and sequence/flow diagrams.
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
