---
name: egp-import
description: Ingest existing product documents (PRD, SRS, SAD, ADR, SDD) into the suite's templates. Use when the user already has product docs and wants to adopt the plugin without rewriting from scratch — bootstrap, import, or onboard existing docs. Classifies sources, maps them to templates, and writes a gap report at .product/import-gap-report.md before any authoring.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-import

Onboard an existing document set into the plugin. **Import is analysis, not
authoring:** this skill never writes `.product/prd/prd.md`,
`.product/sdd/sdd.md`, or `.product/adr/*.md`. It classifies and maps source
documents and writes a gap report; the builder skills author the documents
afterwards in derive-then-confirm mode.

## Inputs
- Templates: `${CLAUDE_PLUGIN_ROOT}/shared/templates/{prd,sdd,adr,srs,sad}-template.md`
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`,
  `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`
  (derive-then-confirm mode)

## Steps
1. **Locate source.** Ask the user where existing docs live; default to scanning
   `docs/`. Accept explicit paths. Treat the source location as **read-only** —
   never move, rename, or edit source files.
2. **Classify each candidate** by type (PRD / SRS / SAD / ADR / SDD) from filename and
   heading heuristics, and confirm the classification with the user before mapping.
3. **Map to templates.** For each PRD/SDD/ADR/SRS/SAD source, match its content to the
   corresponding template's sections. An **SRS source maps to `srs-template.md`**
   (`.product/srs/srs.md`); its `FR-NNN`/`NFR-NNN` are the canonical functional and
   non-functional requirements (the PRD then references them). The source location stays
   read-only — never relocate or edit it.
   A **SAD source maps to `sad-template.md`** (`.product/sad/sad.md`); its `AR-NNN` are the
   canonical Architectural Requirements and its C4 Context/Container diagrams the canonical
   macro-architecture (the SDD then references them).
4. **Write the gap report** to `.product/import-gap-report.md`. For each target
   document (PRD, SRS, SAD, SDD, ADR), a table mapping every template section to a status:
   - `derived` — source fully covers the section;
   - `partial` — source covers it incompletely;
   - `gap` — no source material (a genuine question for the builder);
   and, per document, an **unmapped source** list of source material that did not map
   to any template section, so nothing is silently dropped.
5. **Hand off.** Offer to run each builder (`egp-prd-builder`, `egp-srs-builder`,
   `egp-sad-builder`, `egp-sdd-builder`, `egp-adr-builder`) in **derive-then-confirm** mode,
   pre-seeded with that document's mapped content and its gap list.

## Output

### Prose gap report

The gap report is written to `.product/import-gap-report.md`, documenting for each target
document (PRD, SRS, SAD, SDD, ADR) a mapping of every template section to a status:
- `derived` — source fully covers the section;
- `partial` — source covers it incompletely;
- `gap` — no source material (a genuine question for the builder);
plus an unmapped source list per document so nothing is silently dropped.

### Machine-readable map

Alongside `.product/import-gap-report.md`, write `.product/import-map.json` so
builders consume a structured map instead of re-reading prose:

```json
{
  "targets": {
    "prd": [{ "sourceRef": "legacy/spec.md#goals", "status": "derived", "mappedTo": "§2" }],
    "sdd": [{ "sourceRef": "legacy/arch.md", "status": "partial", "mappedTo": "§4" }]
  },
  "unmapped": ["legacy/notes.md#misc"]
}
```

`status` is one of `derived | partial | gap`.

### Collected ADR handling (C2)

A single `ADR.md` containing N records defaults to **per-file** output:
split into `.product/adr/ADR-NNN-<slug>.md`, one record per file, preserving
the original IDs. Note to the user that they may opt to keep a single collected
file instead.

### Import state (C3)

Record import decisions in `.product/import-state.json` so downstream builders
read them instead of having them re-passed as arguments:

```json
{ "sad": true, "adrGranularity": "per-file", "srs": false }
```

## Rules
- Read-only on source: never migrate, move, or edit the user's existing files.
- An SRS source maps to the SRS template (`.product/srs/srs.md`); reuse its `FR`/`NFR` IDs
  verbatim so traceability is preserved.
- A SAD source maps to the SAD template (`.product/sad/sad.md`); reuse its `AR` IDs verbatim
  so traceability is preserved.
- Confirmation-gated: confirm classification before mapping, and confirm hand-off.
- Reuse source IDs (`FR-NNN`, `BR-NNN`, `NFR-NNN`, `UAT-NNN`, `ADR-NNN`) verbatim so
  cross-document traceability is preserved.
