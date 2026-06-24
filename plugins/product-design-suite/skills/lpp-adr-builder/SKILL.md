---
name: lpp-adr-builder
description: Create or update an Architecture Decision Record (ADR). Use when the user wants to record a single significant architectural decision, capture options considered, trade-offs, the chosen option, consequences, or change an ADR status (proposed/accepted/superseded). Writes .product/adr/ADR-NNN-*.md.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# lpp-adr-builder

Record one architectural decision per file in `.product/adr/`.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/adr-template.md`
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,questioning-protocol}.md`

## Steps
1. Ensure `.product/adr/` exists. Determine the next `ADR-NNN` by scanning
   existing files (zero-padded, starting at 001).
2. Confirm the decision is significant and scoped to exactly ONE decision.
3. Fill the ADR template; ask gap questions per `questioning-protocol.md`.
   Options considered must be real alternatives (include "do nothing" when
   relevant).
4. Link related PRD/SDD sections by their IDs in the Metadata block.
5. Set Status (Proposed/Accepted/Superseded/Deprecated/Rejected) and append to
   the Status History table. When superseding, link the superseding ADR both
   ways.
6. Write `.product/adr/ADR-NNN-<kebab-title>.md`.
7. Suggest running `lpp-doc-sync` so the SDD's "Referenced ADRs" stays current.

## Rules
- One decision per ADR. If the user describes several, create several ADRs.
- Keep it durable: explain *why*, not just *what*.
