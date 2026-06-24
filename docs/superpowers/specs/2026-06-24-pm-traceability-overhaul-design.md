# Phase 2 — Traceability Robustness + Auto Coverage Index Design

> Status: Approved · Date: 2026-06-24 · Owner: Vivaldo
> Source: `docs/feedbacks/001-assumptions.md` (items B4, B8)
> Scope: Second of five phases improving the `product-design-suite` plugin.

## Context

`scripts/traceability.js` extracts only canonical `XX-NNN` IDs via
`\b(?:FR|BR|NFR|AR|UAT|ADR)-\d+\b`, builds rows for PRD `FR/BR/NFR` IDs, and reports
`In SDD` (boolean) plus `Related ADRs`. A prior fix added word boundaries, which
killed the *longest-substring* false-positive (`FR-001` no longer matches `FR-0012`)
— there is a regression test for it.

What remains broken (B4): the extractor cannot see compressed notation. `FR-036…042`
yields only `FR-036`; sub-IDs like `FR-003a`, `FR-010a/b` are not matched at all; lists
like `FR-001/002/003` collapse to a single ID. This is the real source of the 28/56
false "In SDD = NO" rows the feedback author hit. The matrix is also PRD→SDD only — no
UAT/AR rows, no section anchors, no distinction between a genuine orphan and a notation
artifact.

B8: the SDD template ends at §15 (no Appendices provision), and the requirement coverage
index had to be hand-authored as an ad-hoc §16. The coverage index should be
auto-generated. The consumer already exists — `pm-doc-sync` step 1 runs the script.

This spec covers **Phase 2** of the five-phase roadmap derived from the feedback:

1. Diagrams (B1+B2+B3+B10) — shipped (Phase 1).
2. **Traceability (B4+B8)** — this spec.
3. Template metadata & ADR relationships (B5) — later cycle.
4. Authoring flow: import + derive-then-confirm (B6+B7) — later cycle.
5. SRS support (B9) — later cycle.

## Decisions (confirmed)

- **Coverage index delivery:** Embed into SDD §16 via a marker-delimited auto-region
  (`<!-- COVERAGE-INDEX:START/END -->`), regenerated in place. Standalone
  `.product/traceability.{md,html}` are still written so the index also exists outside
  the document.
- **Matrix richness:** Full per feedback — parse ranges/lists/sub-IDs; rows for
  `FR/BR/NFR` plus secondary `UAT` and `AR` linkage; bidirectional links with section
  anchors; classify genuine orphans distinctly from notation artifacts.
- **File structure:** Keep `traceability.js` a single file (matches the plugin's
  one-file-per-script convention; `preview-server.cjs` is 24 KB in one file). No split
  into a module directory.
- **No new runtime dependencies:** dependency-free Node ≥18 CommonJS, consistent with
  every other plugin script.

## Goal & Non-Goals

**Goal:** Rewrite `traceability.js` so it understands real-world ID notation, produces a
bidirectional matrix with section anchors and UAT/AR linkage, distinguishes genuine
orphans from notation artifacts, and auto-injects the coverage index into SDD §16. Add an
Appendices provision to the SDD template.

**Non-goals:** Phases 3–5. No change to the PRD/ADR template bodies. No new runtime deps.
No GUI/preview-server changes.

## ID Notation Grammar (the parser contract)

A *reference* is a base ID plus optional continuations:

| Form | Example | Expands to |
|---|---|---|
| Canonical | `FR-001` | `FR-001` |
| Sub-ID | `FR-003a`, `FR-006a` | `FR-003a` (distinct from `FR-003`) |
| Ellipsis range | `FR-001…FR-042`, `FR-036…042` | `FR-001`…`FR-042` (numeric span) |
| Dotted/hyphen range | `FR-001..005`, `FR-001-005` | `FR-001`…`FR-005` |
| Slash/comma list | `FR-001/002/003a`, `FR-010a/b` | each member; bare tails inherit the prefix |

Rules:

- Ranges expand **numeric base IDs only**; sub-IDs are explicit members, never
  auto-spanned. A range endpoint with a sub-ID suffix (e.g. `FR-001a…003`) expands from
  the numeric base, ignoring the suffix for span purposes.
- **Expansion cap:** a single range spanning more than 200 IDs is rejected and the raw
  endpoints are emitted instead, with a `console.warn`. Guards `FR-001…FR-9999` blowups.
- Numeric width is preserved on expansion (`FR-036…042` → `FR-036`, `FR-037`, … padded to
  the endpoint's digit count).
- The **same parser runs on both sides** — PRD definitions and SDD/ADR mentions.
  Symmetric expansion is what dissolves the notation-artifact false-negatives: if the PRD
  defines `FR-036…042` and the SDD says "FR-036 through FR-042", both expand to the same
  seven IDs and match. Anything still unmatched is a **genuine** orphan.
- A bare list separator only continues a reference when the preceding token was a
  same-family ID. `FR-001/002` continues; `service/002` does not start a reference.

## Rewritten `traceability.js` API

Single file. Public exports:

```
parseRefs(text) -> string[]
    // extract every reference in text and expand to a de-duplicated, sorted
    // array of canonical IDs (FR-001, FR-003a, …).

sectionAnchors(markdown, id) -> [{ section, slug }]
    // for each mention of id, the nearest preceding ## / ### heading,
    // with a GitHub-style slug. De-duplicated.

buildMatrix({ prd = '', sdd = '', adrs = {} }) -> {
    requirements: [{ id, family, inSdd, sections: [{section, slug}], adrs: [string],
                     uats: [string], coverage: 'covered' | 'orphan' }],
    ars:  [{ id, tracesTo: [string], adrs: [string] }],
    uats: [{ id, verifies: [string] }],
    orphans: [string]   // requirement ids with coverage === 'orphan'
}

renderMarkdown(matrix) -> string        // standalone .product/traceability.md
renderHtml(matrix) -> string            // standalone .product/traceability.html
renderCoverageBlock(matrix) -> string   // the §16 region body (markers added by injector)
injectCoverage(sddMarkdown, block) -> string
    // idempotent: replace content between COVERAGE-INDEX markers if present,
    // else append a "## 16. Requirement Coverage Index" section containing the
    // marked block.

loadProduct(dir) -> { prd, sdd, adrs }  // unchanged on-disk layout
```

CLI (`node traceability.js [dir]`, default `.product`):

1. `loadProduct(dir)` → build matrix.
2. Write `dir/traceability.md` (`renderMarkdown`) and `dir/traceability.html`
   (`renderHtml`).
3. Read `dir/sdd/sdd.md`, run `injectCoverage(sdd, renderCoverageBlock(matrix))`, write it
   back. Skip with a warning if `sdd/sdd.md` is absent.
4. Log requirement count and orphan count.

## Matrix Model (full)

**Primary table** — one row per PRD-defined `FR/BR/NFR`:

| Requirement | In SDD | SDD Sections | Related ADRs | UAT | Coverage |
|---|---|---|---|---|---|
| FR-001 | yes | [§4 Components](#4-components-and-responsibilities) | ADR-003 | UAT-002 | ✅ Covered |
| FR-040 | no | — | — | — | ⚠️ Orphan |

- `In SDD` is `yes` when the expanded id appears anywhere in the SDD text.
- `SDD Sections` are anchor links from `sectionAnchors`.
- `UAT` lists UATs whose text references this requirement (back-reference).
- `Coverage` is ✅ Covered when `inSdd`, else ⚠️ Orphan.

**Secondary tables:**

- `AR → traces-to` — ARs are defined in the SDD and reference FR IDs:
  `| AR | Traces to | In ADRs |`.
- `UAT → verifies` — `| UAT | Verifies |`.

**Orphans** are also listed distinctly at the top of the coverage block with a one-line
note: *"Genuine coverage gaps — a requirement defined in the PRD with no matching mention
in the SDD. Notation-only artifacts are already resolved by symmetric ID expansion."*

## Coverage Index Embedding (B8)

`renderCoverageBlock(matrix)` returns the orphans note + primary table + secondary tables.
`injectCoverage` wraps it:

```
<!-- COVERAGE-INDEX:START — generated by traceability.js, do not edit between markers -->
…block…
<!-- COVERAGE-INDEX:END -->
```

Behaviour:

- If both markers are present, replace everything between them (preserving the marker
  lines). Idempotent across repeated runs.
- If markers are absent, append `\n## 16. Requirement Coverage Index\n\n` + the wrapped
  block to the end of the SDD.
- Content outside the markers is never touched.

## SDD Template Changes

`shared/templates/sdd-template.md` (currently ends at §15 Referenced ADRs):

- Add **§16 Requirement Coverage Index** shipping with the marker region and a note:
  *"Auto-generated by `traceability.js`; do not edit between the markers. Run
  `pm-doc-sync` to refresh."* So generated SDDs already contain the injection target.
- Add **§17 Appendices** — a free provision for material like the author's ad-hoc
  additions, closing B8's "fixed at 15 sections" gap.

## Workflow Wiring

- `skills/pm-doc-sync/SKILL.md`: step 1 already runs the script; update its description to
  state the script now also injects SDD §16, and change step 6 from "report In SDD = NO"
  to "report ⚠️ Orphan rows."
- `shared/references/structures.md`: update the traceability description to cover
  ranges/anchors/orphans and the auto-generated §16.
- `skills/pm-sdd-builder/SKILL.md`: note that §16 is generated, not hand-written.

## Testing

`tests/traceability.test.js` extended (existing word-boundary + substring tests retained):

- **Parsing:** ellipsis/dotted/hyphen ranges, slash/comma lists, sub-IDs, mixed
  (`FR-001/002/003a`); width-preserving expansion; bare-tail prefix inheritance;
  non-reference separators (`service/002`) ignored.
- **Expansion cap:** a >200-span range emits raw endpoints + warning, not 9000 ids.
- **Symmetric match:** PRD `FR-036…042` + SDD "FR-036 through FR-042" → all seven Covered
  (artifact dissolved).
- **Orphan:** a PRD requirement absent from the SDD is flagged ⚠️ Orphan.
- **Anchors:** `sectionAnchors` returns the nearest heading + correct GitHub slug.
- **Linkage:** UAT back-references and AR→FR trace populate.
- **Embedding:** `injectCoverage` replaces between markers (idempotent) and appends a §16
  when markers are absent; content outside markers is preserved.

The `e2e-smoke` and `validate-plugin` tests continue to pass.

## Open Questions

None outstanding. Three points were settled during design: (a) coverage index is embedded
in SDD §16 *and* written standalone; (b) the matrix is the full bidirectional model with
UAT/AR secondary tables; (c) `traceability.js` stays a single file rather than a module
directory.
