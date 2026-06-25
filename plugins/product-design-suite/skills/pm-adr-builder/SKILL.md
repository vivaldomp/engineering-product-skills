---
name: pm-adr-builder
description: Create or update an Architecture Decision Record (ADR). Use when the user wants to record a single significant architectural decision, capture options considered, trade-offs, the chosen option, consequences, or change an ADR status (proposed/accepted/superseded). Writes .product/adr/ADR-NNN-*.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-adr-builder

Record one architectural decision per file in `.product/adr/`.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/adr-template.md`
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,questioning-protocol}.md`

## Steps
1. Ensure `.product/adr/` exists. Determine the next `ADR-NNN` by scanning
   existing files (zero-padded, starting at 001).
2. Confirm the decision is significant and scoped to exactly ONE decision.
3. Fill the ADR template per `questioning-protocol.md`. When authoritative source
   is provided — mapped content from `pm-import`, or source supplied by the user —
   use **derive-then-confirm mode**: derive the sections, present one confirmation batch (see the one-confirmation-batch contract in `questioning-protocol.md`), and ask only about genuine gaps. Otherwise ask gap questions (pause after
   every 4 questions and summarize remaining gaps). Options considered must be real
   alternatives (include "do nothing" when relevant).
4. Populate the YAML front-matter (`id`, `title`, `status`, `date`, `author`,
   `reviewers`). Link related PRD/SDD/SAD/ADR references in the `related-prd`,
   `related-srs`, `related-sdd`, `related-sad`, and `related-adrs` front-matter fields.
   When the decision records a structural choice made in the SAD, set `related-sad` (SAD
   section or `AR-NNN`). When FR/NFR live in an SRS, link them via `related-srs`
   (e.g. `["§3 FR-012"]`).
5. Set `status` to a single enum value (Proposed/Accepted/Superseded/Deprecated/
   Rejected) — never overload it with parentheticals. Record supersede/amend
   relationships in the structured front-matter fields: set `supersedes` or
   `amends` on this ADR **and** the reciprocal `superseded-by` or `amended-by`
   on the target ADR (bidirectional). Append the change to the Status History
   table.
6. On finalize, record any unresolved questions or assumptions in the ADR's
   **Assumptions** / **Decision Scope** sections — do not leave silent TBDs.
7. Write `.product/adr/ADR-NNN-<kebab-title>.md`.
8. Suggest running `pm-doc-sync` so the SDD's "Referenced ADRs" stays current.

## Rules
- One decision per ADR. If the user describes several, create several ADRs.
- Keep it durable: explain *why*, not just *what*.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `.product/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
