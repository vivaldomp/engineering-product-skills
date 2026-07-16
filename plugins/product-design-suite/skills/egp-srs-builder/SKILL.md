---
name: egp-srs-builder
description: Create or update an IEEE-830 Software Requirements Specification (SRS). Use when a team maintains a formal SRS and wants the canonical functional (FR-NNN) and non-functional (NFR-NNN) requirements to live in a dedicated document rather than the PRD. Writes workspace/outputs/current/specifications/srs.md; the PRD then references these requirements.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-srs-builder

Build or update the SRS at `workspace/outputs/current/specifications/srs.md` from the shared template. The SRS is
**optional**: when it exists, it is the canonical home for functional (`FR-NNN`) and
non-functional (`NFR-NNN`) requirements, and the PRD references them. When no SRS exists,
the PRD owns those requirements as usual — creating this file is what puts the project into
"SRS mode".

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/srs-template.md`
- PRD: `workspace/outputs/current/planning/prd.md` (read for product intent and any existing `FR`/`NFR` to migrate)
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md`
  directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/specifications/` exists. If `srs.md` exists, load it and treat this as an update.
2. Read the SRS template and the PRD. The SRS owns detailed functional (`FR-NNN`) and
   non-functional (`NFR-NNN`) requirements; business rules (`BR-NNN`) and user-acceptance
   tests (`UAT-NNN`) stay in the PRD and must not be moved here.
3. Fill each required section per `questioning-protocol.md`. When authoritative source is
   provided — mapped content from `egp-import`, or source supplied by the user — use
   **derive-then-confirm mode**: derive the sections, present one confirmation batch (see the one-confirmation-batch contract in `questioning-protocol.md`), and ask
   only about genuine gaps. Otherwise ask gap questions (pause after every 4 questions and
   summarize remaining gaps).
4. **Own the `FR-NNN`/`NFR-NNN` IDs.** Assign stable, zero-padded IDs and keep them stable
   across updates. When ingesting from a source (PRD or imported docs), **reuse source IDs
   verbatim** so cross-document traceability is preserved.
5. **Migrate requirements out of the PRD (confirmation-gated).** If `workspace/outputs/current/planning/prd.md`
   already enumerates `FR`/`NFR` (a PRD authored before the SRS existed), propose the
   migration: lift the §7 Functional Requirements and §9 Non-Functional Requirements rows into
   the SRS verbatim (IDs preserved), then rewrite those PRD sections as references to the SRS
   (`specifications/srs.md`). Show the exact before/after and apply only on approval — no silent
   rewrite. Never touch the PRD's business rules (`BR-NNN`) or UAT (`UAT-NNN`).
6. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`)
   — bump `version` and refresh `date` on an update — write `workspace/outputs/current/specifications/srs.md`, and record
   unresolved gaps in the SRS's traceability/assumptions notes rather than leaving silent TBDs.
   Fill the `MODE-BANNER` slot with a concise orientation note (e.g., "This SRS owns the canonical FR/NFR")
   to signal the SRS's role in the documentation architecture, or leave it empty if unused.
7. Suggest running `egp-doc-sync` to refresh the traceability matrix and propagate the new
   requirements source to the SDD and PRD references.
8. **Snapshot the approved run.** After the user approves the finalized document
   and the consistency gate passes, write an immutable execution package:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill egp-srs-builder --artifact specifications/srs.md`
   This records workspace/outputs/history/<run-id>/ with a manifest and the
   validation reports. Never edit files under history/.

## Rules
- The SRS owns `FR`/`NFR` only; `BR` and `UAT` remain the PRD's responsibility.
- Confirmation-gated: propose the PRD migration, then apply on approval. No silent rewrites.
- Reuse source IDs verbatim; keep IDs stable across updates.
- **ID ownership (006 D):** Only the **owning** document puts an ID in a first
  table cell — SRS owns `FR`/`NFR`, SAD owns `AR`, each ADR owns itself.
  **Referencing** documents cite IDs in prose or in a **non-first column**. Any
  cross-doc reference/coverage table MUST be wrapped in generated markers
  (`COVERAGE-INDEX` / `ADR-INDEX` / `ADR-STATUS`) so `lint-ids` strips it.
- **Output language (006 G):** If `workspace/outputs/current/governance/import-state.json` has `outputLanguage`,
  write all prose in it; if it has `codeAndJargon`, keep identifiers, code, and
  technical jargon in that language. Absent → match the user's language.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `workspace/outputs/current/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
