---
name: lpp-doc-sync
description: Propagate changes across PRD, SDD, and ADR documents. Use after editing any product document, or when the user asks to sync docs, check cross-document impact, refresh the traceability matrix, or find stale/affected sections. Produces an impact report and confirmation-gated edits in .product/.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# lpp-doc-sync

Keep the PRD/SDD/ADR triad consistent after a change. Never rewrite a document
without explicit user confirmation.

## Steps
1. Refresh the traceability index:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/traceability.js" .product`
   This writes `.product/traceability.md` and `.product/traceability.html`.
2. Determine what changed (use git diff if available, else ask the user which
   document/section changed).
3. Using the traceability matrix, build an **impact report** listing each
   affected downstream and upstream item, for example:
   - A changed PRD `FR-NNN` -> SDD sections referencing it, ADRs referencing it.
   - A changed/ superseded ADR -> SDD "Referenced ADRs" and design choices.
   - A changed SDD contract -> PRD acceptance criteria that depend on it.
4. For each impact, propose a **concrete edit** (show the exact before/after).
5. Apply only the edits the user approves. Re-run step 1 afterward so the matrix
   reflects the applied edits.
6. Report any requirements with `In SDD = NO` in the matrix as coverage gaps.

## Rules
- Confirmation-gated: propose, then apply on approval. No silent rewrites.
- Bidirectional: check both downstream (PRD->SDD->ADR) and back-references.
