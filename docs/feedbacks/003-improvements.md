## Proposed plugin improvements

Prioritized by impact. Most come from friction I actually hit in the past run.

### A. Traceability tooling (`scripts/traceability.js`) — highest impact

- **A1 — Recognize category-lettered NFR IDs.** `MEMBER = (FR|BR|NFR|AR|UAT|ADR)-\d+[a-z]?` silently
  drops `NFR-P1`, `NFR-S4`, `NFR-PR1`, etc. The plugin's own templates *example* `NFR-001`, but real
  docs commonly group by category. Either extend the regex to `NFR-[A-Z]{0,2}\d+[a-z]?` or document
  the constraint loudly in the SRS template + skill. **Today the tool and real-world IDs silently
  disagree.**
- **A2 — Parse the SAD/SDD `AR` table's "Source" column directly.** The `sad-template` tells authors
  to put `AR→FR/NFR` traces in a table **column**, but `linksWithin` only links IDs that co-occur in
  the same sentence/line — and a table row whose description ends in a period **before** the Source
  column breaks the link. The generator should read the AR table's columns structurally, not via prose
  co-occurrence. (This forced workaround D4.)
- **A3 — Warn on unrecognized/dropped IDs.** The generator silently ignores IDs it can't classify
  (`NFR-P1`, `C-1`). It should print "saw N tokens it could not classify: …" so coverage gaps caused
  by ID-format drift are visible, not silent.
- **A4 — Make `C-NNN` constraints first-class.** Constraints (`C-1…C-8`) are referenced as trace
  sources but aren't in `PREFIX`, so constraint→design traceability is impossible.

### B. Diagram workflow (sad/sdd builders)

- **B1 — Distinguish derived vs net-new diagrams.** When diagrams are *converted from existing
  source* (import flow), the approval bar should differ from *authored net-new* diagrams. The skill
  should say: net-new diagrams **must** go through the preview loop; faithful conversions **may** be
  batch-confirmed.
- **B2 — Lighter preview path.** The `start-server.sh` + `mermaid-preview.js` round-trip is heavy.
  Offer a one-shot "render to a single HTML file and return the path" without a long-running server.
- **B3 — Make the approval gate explicit in derive-then-confirm mode.** The skills don't say whether
  derive-then-confirm *subsumes* the diagram approval loop or runs *in addition to* it. Clarify.

### C. `egp-import`

- **C1 — Emit a machine-readable mapping** (JSON) alongside the prose gap report, so builders consume
  a structured map instead of re-reading prose.
- **C2 — Prescribe collected-file → per-file ADR handling.** A single `ADR.md` with N records is
  common; the skill made me ask you for granularity. It could default to per-file with a note.
- **C3 — Carry the import decisions (SAD-yes, per-ADR) into a small state file** so downstream
  builders don't need them re-passed in arguments.

### D. Templates & front-matter consistency

- **D1 — Add `related-srs` to the ADR front-matter schema.** SRS mode is first-class in the
  prd/sdd/sad builders, but ADRs can only link `related-prd/sdd/sad/adrs`. When `FR`/`NFR` live in the
  SRS, ADRs need `related-srs`. (This is the gap that led me to invent the field — D2.)
- **D2 — Standardize an optional "mode banner" slot** in the templates so the SRS/SAD-mode orientation
  note is blessed, not ad-hoc (D3).
- **D3 — Add a per-concern status field** (`designed | partial | gap | n/a`) to SDD §9/§10/§14 so
  honest gap-marking is structural, not free-form prose (D5).

### E. ID-convention governance

- **E1 — Publish ONE canonical ID spec** shared by the templates *and* `traceability.js`, with a
  linter that fails when a project's IDs don't match. Right now drift is silent (Part 4-A1/A3).

### F. Workflow orchestration (`egp-product-workflow`)

- **F1 — Enforce the derive-then-confirm "one confirmation batch" contract centrally** instead of
  leaving each builder to self-police; it's applied inconsistently.
- **F2 — A final "consistency gate"** that runs `traceability.js` *and* checks ADR supersede/amend
  reciprocity + front-matter completeness, reporting one pass/fail summary.