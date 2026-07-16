---
name: egp-prd-builder
description: Create or update a Product Requirements Document (PRD). Use when the user wants to write, draft, or revise a PRD, define product requirements, problem statement, personas, scope, functional/non-functional requirements, or acceptance criteria. Writes workspace/outputs/current/planning/prd.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-prd-builder

Build or update the PRD at `workspace/outputs/current/planning/prd.md` from the shared template.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/prd-template.md`
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md`
  directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/planning/` exists. If `prd.md` exists, load it and treat this as an update.
2. Read the PRD template and the concepts/structures references.
3. Fill each required section from what the user has provided.
4. For any missing required section, ask questions following
   `questioning-protocol.md`. When authoritative source is provided — mapped
   content from `egp-import`, or source supplied by the user — use **derive-then-confirm mode**: derive the sections, present one confirmation batch (see the one-confirmation-batch contract in `questioning-protocol.md`), and ask
   only about genuine gaps. Otherwise use the gap-question cadence (pause after
   every 4 questions and summarize remaining gaps).
5. Assign stable IDs (keep them stable across updates): the PRD is the canonical
   home and owns functional `FR-NNN` (§7), business rules `BR-NNN` (§8),
   non-functional `NFR-NNN` (§9), and UAT `UAT-NNN` (§12). Give every §9 NFR row an
   `NFR-NNN` ID so it is machine-traceable by `traceability.js`.
6. On finalize, populate the YAML front-matter (`title`, `status`, `version`,
   `owner`, `date`) — bump `version` and refresh `date` on an update — write
   `workspace/outputs/current/planning/prd.md`, and record unresolved gaps in the **Open Questions**
   table.
7. Optionally produce `workspace/outputs/current/ux/prd-summary.html` (objectives + success
   metrics) by authoring OpenUI Lang and rendering with
   `${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js`.
8. After writing, hand off: suggest running `egp-doc-sync` if a prior SDD/ADR
   exists, then offer to proceed to `egp-sdd-builder`.
9. **Snapshot the approved run.** After the user approves the finalized document
   and the consistency gate passes, write an immutable execution package:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill egp-prd-builder --artifact planning/prd.md`
   This records workspace/outputs/history/<run-id>/ with a manifest and the
   validation reports. Never edit files under history/.

## Rules
- Stay product-level: no architecture, schemas, or technology choices unless a
  hard constraint (see concepts.md "What a PRD should avoid").
- Do not invent requirements; ask instead.
- **Output language (006 G):** If `workspace/outputs/current/governance/import-state.json` has `outputLanguage`,
  write all prose in it; if it has `codeAndJargon`, keep identifiers, code, and
  technical jargon in that language. Absent → match the user's language.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `workspace/outputs/current/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
