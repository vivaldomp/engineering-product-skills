---
name: pm-doc-sync
description: Propagate changes across PRD, SDD, and ADR documents. Use after editing any product document, or when the user asks to sync docs, check cross-document impact, refresh the traceability matrix, or find stale/affected sections. Produces an impact report and confirmation-gated edits in .product/.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-doc-sync

Keep the PRD/SDD/ADR triad consistent after a change. Never rewrite a document
without explicit user confirmation.

## Steps
1. Refresh the traceability index:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/traceability.js" .product`
   This writes `.product/traceability.md` and `.product/traceability.html`, and injects
   the coverage index into `.product/sdd/sdd.md` §16 between the COVERAGE-INDEX markers
   (content outside the markers is never touched).
1b. Regenerate the ADR index and sync ADR status:
    `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr-index.js" .product`
    This writes `.product/adr/index.md` from each ADR's front-matter and populates
    the SDD §15 `Status` column between the ADR-STATUS markers. Front-matter is the
    single source of truth — never hand-edit the §15 Status column.
2. Determine what changed (use git diff if available, else ask the user which
   document/section changed).
3. Using the traceability matrix, build an **impact report** listing each
   affected downstream and upstream item, for example:
   - A changed requirement `FR-NNN`/`NFR-NNN` -> `AR-NNN` and sections referencing it,
     ADRs referencing it, and PRD `UAT-NNN` that verify it. When `.product/srs/srs.md` exists,
     the SRS is the canonical source of `FR`/`NFR` and the PRD references them; otherwise they
     live in the PRD. Business rules (`BR-NNN`) and UAT (`UAT-NNN`) always live in the PRD.
   - A changed `AR-NNN` or macro-architecture choice -> SDD component design referencing it and
     linked ADRs. When `.product/sad/sad.md` exists, the SAD is the canonical source of `AR-NNN`
     and the macro-architecture, and the SDD references it; otherwise `AR-NNN` lives in the SDD.
     A changed SRS `NFR-NNN` also propagates to the SAD's architectural drivers.
   - A changed/ superseded ADR -> SDD "Referenced ADRs" and design choices.
   - Read each ADR's front-matter relationship fields (`supersedes`,
     `superseded-by`, `amends`, `amended-by`) to find linked ADRs, and verify the
     links are symmetric: if ADR-A lists `supersedes: [ADR-B]` but ADR-B lacks
     `superseded-by: [ADR-A]` (or the reciprocal amend link is missing), report
     the asymmetric/dangling link and propose the corrective edit.
   - Read each ADR's `related-prd`, `related-srs`, `related-sdd`, and `related-sad`
     fields to link decisions to the documents they affect; a changed SAD structural
     choice propagates to ADRs that list it in `related-sad`.
   - A changed SDD contract -> PRD acceptance criteria that depend on it.
4. For each impact, propose a **concrete edit** (show the exact before/after).
5. Apply only the edits the user approves. Re-run step 1 afterward so the matrix
   reflects the applied edits.
6. Report any `⚠️ Orphan` rows in the matrix as genuine coverage gaps (notation-only
   artifacts are already resolved by the range-aware parser).
7. **Migrate legacy docs to the metadata convention.** If a `.product/` document
   predates the YAML front-matter convention — it has no front-matter block, or an
   ADR still carries the legacy `## 1. Metadata` table — propose the migration:
   add a front-matter block populated from the document's existing content; for an
   ADR, lift the `## 1. Metadata` rows into front-matter, drop the table, and
   renumber the body sections (§2 -> §1 … §8 -> §7) to match the current template.
   Show the exact before/after and apply only on approval — no silent rewrite.

8. **Final consistency check**: after applying all edits, run
   `node scripts/consistency-gate.js .product` as the final step — it
   aggregates traceability, ID linting, and ADR supersede/amend reciprocity
   into one pass/fail summary, making it easy to confirm the product is
   internally consistent before committing.

## Rules
- Confirmation-gated: propose, then apply on approval. No silent rewrites.
- Bidirectional: check both downstream (PRD->SDD->ADR) and back-references.
