---
name: pm-prd-builder
description: Create or update a Product Requirements Document (PRD). Use when the user wants to write, draft, or revise a PRD, define product requirements, problem statement, personas, scope, functional/non-functional requirements, or acceptance criteria. Writes .product/prd/prd.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-prd-builder

Build or update the PRD at `.product/prd/prd.md` from the shared template.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/prd-template.md`
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
1. Ensure `.product/prd/` exists. If `prd.md` exists, load it and treat this as an update.
2. Read the PRD template and the concepts/structures references.
3. Fill each required section from what the user has provided.
4. For any missing required section, ask questions following
   `questioning-protocol.md`. When authoritative source is provided — mapped
   content from `pm-import`, or source supplied by the user — use **derive-then-confirm mode**: derive the sections, present one confirmation batch, and ask
   only about genuine gaps. Otherwise use the gap-question cadence (pause after
   every 4 questions and summarize remaining gaps).
5. Assign stable IDs: functional `FR-NNN`, business rules `BR-NNN`,
   non-functional `NFR-NNN`, UAT `UAT-NNN`. Keep IDs stable across updates.
6. On finalize, populate the YAML front-matter (`title`, `status`, `version`,
   `owner`, `date`) — bump `version` and refresh `date` on an update — write
   `.product/prd/prd.md`, and record unresolved gaps in the **Open Questions**
   table.
7. Optionally produce `.product/prd/prd-summary.html` (objectives + success
   metrics) by authoring OpenUI Lang and rendering with
   `${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js`.
8. After writing, hand off: suggest running `pm-doc-sync` if a prior SDD/ADR
   exists, then offer to proceed to `pm-sdd-builder`.

## Rules
- Stay product-level: no architecture, schemas, or technology choices unless a
  hard constraint (see concepts.md "What a PRD should avoid").
- Do not invent requirements; ask instead.
