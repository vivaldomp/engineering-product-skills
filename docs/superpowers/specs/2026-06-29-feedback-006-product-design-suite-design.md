# Design — feedback 006 improvements (product-design-suite)

Source: `docs/feedbacks/006-improvements.md` (real end-to-end run on the Strata
Control Tower project). Scope decided with the user: **implement everything in 006**,
with the diagram-serving fix done as **function-replacer + static-SVG mode**.

All paths below are under `plugins/product-design-suite/` unless noted. The four
existing test files (`tests/preview-server.test.js`, `tests/mermaid-preview.test.js`,
`tests/mermaid-lint.test.js`, `tests/lint-ids.test.js`) are extended; skill/template
changes are doc-only and ride the existing `*-conventions.test.js` structure tests.

Current-state facts that anchor the design:
- The diagram approval gate is **already enforced** in `egp-sdd-builder` and
  `egp-sad-builder` (005 P0/#6). Only `egp-product-workflow` still calls preview
  "optional" (step 5).
- `start-server.sh` already supports `--open` (sets `PDS_OPEN=1`). The server JSON
  has `url` but no `markdown_link`.
- `mermaid-preview.js` renders **client-side only** (inlines `vendor/mermaid.min.js`,
  `mermaid.initialize({startOnLoad:true})`). No pure-Node SVG path exists.
- `egp-import` writes `import-gap-report.md`, `import-map.json`, `import-state.json`
  (fields: `sad`, `adrGranularity`, `srs`). No reconciliation/supersedes concept.
- `lint-ids.js` treats any first table cell matching `MEMBER_RE` as a definition and
  strips `COVERAGE-INDEX`/`ADR-INDEX`/`ADR-STATUS` generated blocks first.
- `stop-server.sh` requires `SESSION_DIR` as a mandatory arg.

---

## Group A — Preview/diagram serving (P1)

### A1. `preview-server.cjs` `$`-corruption fix (root cause)

`String.prototype.replace(needle, replacement)` interprets `$&`, `` $` ``, `$'`,
`$$` in a **string** replacement. The served HTML inlines the 3.3 MB minified
Mermaid bundle (full of `$`); when that HTML is passed as the *replacement*
argument, the bundle is corrupted, Mermaid never defines its global, and every
diagram fails. Same on-disk file served raw (no rewriting) renders all diagrams.

Fix — use **function replacers** so `$` sequences are inert:
- `wrapInFrame` (`preview-server.cjs:242`):
  `renderBranding(frameTemplate).replace('<!-- CONTENT -->', () => content)`
  — this is the path the agent actually hit (a Mermaid *fragment*, not a full
  document, gets wrapped).
- `</body>` helper injection (`preview-server.cjs:391`):
  `html.replace('</body>', () => helperInjection + '\n</body>')` — latent
  same-class risk (`helper.js` could contain `$`).
- Audit: no other `.replace()` on served/content HTML passes a content-bearing
  string as the replacement. `renderBranding` uses `.split().join()` (already safe).

Test (`preview-server.test.js`): write a content fragment containing `${e}`,
`$&`, `$$`, `` $` ``; serve it; assert the served HTML contains each sequence
verbatim and is not mangled.

### A2. Static-SVG "assemble" mode in `mermaid-preview.js`

Rationale: A1 already fixes the live preview (client-side render is correct once
the bundle isn't corrupted). Static-SVG is a **portable, JS-free artifact** that
no server-side rewriting can break — the exact workaround the agent hand-built.
A true standalone Node renderer would require bundling a headless browser
(puppeteer/mmdc); rejected as a heavy runtime dependency. Instead:

- Add `renderStaticSvgPage(svgs, opts = {})` to `mermaid-preview.js` and export it.
  Input: an array of already-rendered SVG strings (one per diagram, document
  order) + optional title/captions. Output: a self-contained JS-free HTML page
  (`<figure>` per SVG, same styling as `renderPreview`). No `<script>`.
- CLI: extend the existing `require.main` block with a static mode — e.g.
  `mermaid-preview.js --static <svg-dir> <out.html>` reading `*.svg` in name
  order, or read SVG paths from argv. Keep the existing
  `<input.md> <out.html>` live-preview path unchanged.
- Document the capture flow in the SDD/SAD gate (Group B/D wording): render live
  (A1-fixed) → agent captures each `<svg>` from the page via its browser tool →
  assemble the JS-free page with the static mode.

Test (`mermaid-preview.test.js`): `renderStaticSvgPage(['<svg>…</svg>', …])`
produces HTML with one figure per SVG, no `<script>`, and the SVG markup intact.

---

## Group B — Diagram gate + clickable link + nav (P1)

### B1. Workflow gate wording (`egp-product-workflow/SKILL.md`)

Rewrite step 5 from "**Preview (optional)** during iteration…" to a **mandatory
approval gate**: any document containing Mermaid MUST have its diagrams rendered
in the preview server and explicitly approved before the document is marked done;
the SDD/SAD builders own and enforce this gate (already true since 005). Document
the **single-newest-screen** behavior (`getNewestScreen` returns only the most
recently modified `.html`; there is no multi-screen nav) and the practical
consequence: to review several documents' diagrams at once, concatenate them into
one screen file.

### B2. Clickable Markdown link

- `preview-server.cjs` `onListen`: add a `markdown_link` field to the
  `server-started` JSON: `[Open diagram preview](<companionUrl()>)`. The label is
  generic English; builders localize it via the Group G language setting.
- `egp-product-workflow` + `egp-sdd-builder` + `egp-sad-builder`: instruct the
  agent to present the **Markdown link, never a raw copy-paste URL**, and to start
  the server with `--open` *after* the user opts into review, still printing the
  clickable link as a fallback for headless/remote.

---

## Group C — `mermaid-lint` erDiagram false-positive (P1)

`mermaid-lint.js` lines 16-20 count `{`/`}` globally. `erDiagram` cardinality uses
brace tokens (`o{`, `}o`, e.g. `a ||..o{ b`) that are not block braces, so valid
diagrams fail with `unbalanced {}`.

Fix: in `lintBlock`, when the diagram type is `erDiagram`, skip the `{`/`}` balance
check (keep `[]`/`()` checks). Simplest correct change; avoids stripping individual
cardinality tokens. Test (`mermaid-lint.test.js`): an erDiagram with
`||..o{` / `}o..||` relationships lints clean.

---

## Group D — Duplicate-ID ownership rule (P2)

The gate (`lint-ids.js`) flags the same ID defined (first table cell) in two docs
as `duplicate-definition`. Builders had no ownership guidance and put canonical IDs
first-cell in reference tables across SRS/SAD/SDD.

Add an **explicit ownership rule** to the builder skills (`egp-srs-builder`,
`egp-sad-builder`, `egp-sdd-builder`) and the corresponding templates:
- Only the **owning** document puts an ID in a first table cell: SRS owns
  `FR`/`NFR`, SAD owns `AR`, each ADR owns itself.
- **Referencing** documents cite IDs in prose or a **non-first column**.
- Any cross-doc reference/coverage table is wrapped in generated markers
  (`COVERAGE-INDEX` / `ADR-INDEX` / `ADR-STATUS`) so `lint-ids` strips it.
- `egp-sdd-builder` emits its requirement-coverage and AR-realization tables in
  generated-marker form **by default**, not hand-authored first-cell tables.

Doc-only change; covered by `traceability-conventions.test.js` /
`id-conventions.test.js` if they assert structure, otherwise no new test.

---

## Group E — Reconciliation pass (P2)

`egp-import` is currently "classify + map + gap report" with no concept of a source
being partially obsolete vs. decisions made elsewhere.

Add an **optional reconciliation pass**:
- Trigger: when prior decisions (existing ADRs, prior `.product/`, or user-supplied
  "these decisions override the source") contradict the source document.
- Output: a first-class **Reconciliation Overlay** section in
  `import-gap-report.md`, and `supersedes` links per affected decision in
  `import-map.json` (mirroring the ADR supersedes/amends machinery).
- Builders MUST honor the overlay: they do not carry superseded source content
  forward.
- `egp-import/SKILL.md` steps updated to include the reconciliation pass; the
  builder hand-off notes the overlay.

---

## Group F — Batch / derive-all mode (P2)

`egp-product-workflow` dispatches builders strictly one-at-a-time interactively.

Add a documented **batch / derive-all** mode:
- State the inter-document **dependency order explicitly**: ADRs → SRS/SAD →
  SDD/PRD (ADR IDs exist before docs cite them; SAD mints `AR-NNN` the SDD
  references; SRS owns `FR`/`NFR` the PRD/SDD reference).
- Allow authoring all **derivable** content first and surfacing only the
  consolidated gap questions at the end (instead of per-document interruption).
- State that it is safe to parallelize across **non-conflicting files** (different
  target docs), respecting the dependency order.
- The default interactive derive-then-confirm mode is unchanged; batch is opt-in.

Doc-only change to `egp-product-workflow/SKILL.md`.

---

## Group G — Output-language setting (P2)

No skill carries an output-language preference today, so the agent must repeat the
language rule in every builder prompt.

- `import-state.json` gains two honored fields: `outputLanguage` (e.g. `pt-BR`) and
  `codeAndJargon` (e.g. `en` — keep identifiers/jargon/code in this language).
- Every builder skill (`prd/srs/sad/sdd/adr`) reads these and applies them to prose
  output; the workflow sets them once (from the user) and they propagate.
- `egp-import` / `egp-product-workflow` document the fields. Defaults: unset →
  current behavior (agent/user language).

---

## Group H — Skill-step presentation + stop-server (P3)

### H1. Skill-step presentation

Generalize the 005 `egp-import` note ("If a skill does not present its steps when
invoked, read its `SKILL.md` directly — invocation output is host-dependent") so
each builder skill states its concrete Steps/Rules, and the `egp-product-workflow`
orchestrator is instructed to read/inline the target builder's `SKILL.md` when
invocation output is silent. Doc-only.

### H2. `stop-server.sh` ergonomics

Add a `--latest` / no-arg mode: glob the newest session directory (project
`<project>/.product/preview/*` when `--project-dir` given, else
`/tmp/pds-preview-*`), read its `state/server.pid`, and stop that server. Keep the
existing explicit `SESSION_DIR` positional arg working. Optional `--project-dir`
to scope the search.

---

## Out of scope / explicitly not doing

- Standalone headless-browser Mermaid renderer (puppeteer/mmdc) — rejected in A2
  for the zero-dep assemble mode.
- Multi-screen navigation route in `preview-server.cjs` — documented behavior +
  concatenation guidance instead (B1); revisit only if concatenation proves
  insufficient.

## Build order

A1 and C are the independent root-cause bug fixes (do first, each with its test).
A2, B2, H2 are script changes. B1, D, E, F, G, H1 are skill/template doc changes
(parallelizable across distinct files). Run the test suite after the script
changes; run the `*-conventions` structure tests after the doc changes.
