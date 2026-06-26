# Assumptions & Plugin Feedback

> Author: Claude (Opus 4.8) · Date: 2026-06-24
> Context: Ran `product-design-suite:egp-product-workflow` to regenerate `docs/PRD.md`,
> `docs/SRS.md`, `docs/ADR.md`, `docs/SDD.md` into the plugin's native templates under
> `.product/`. The SRS was intentionally **not** touched. This file records (A) the assumptions
> I made while generating the documents, and (B) my feedback and proposed improvements to the
> `engineering-product-skills / product-design-suite` plugin, with the assumptions behind each proposal.

---

## A. Assumptions made while generating the documents

These were inferred (and where the builders required it, confirmed via multiple-choice). Anything
the user explicitly chose is marked **[confirmed]**; the rest are my working assumptions.

1. **Regenerate, not migrate** **[confirmed]** — `docs/` is authoritative *source input*; the
   `.product/` set is rewritten in the builders' templates. Original `docs/` files left untouched.
2. **SRS has no native home** — the plugin only models PRD/SDD/ADR. I treated `docs/SRS.md` as a
   read-only reference and did not fold it in or relocate it. **[confirmed: do not touch SRS]**
3. **ID inheritance** — I reused the SRS's `FR-001…FR-042` (including sub-IDs `FR-003a`,
   `FR-010a/b`, `FR-006a`) verbatim in the PRD for traceability, rather than assigning a fresh
   sequential `FR-001…`. Assumption: stable cross-doc IDs matter more than clean numbering.
4. **New ID families** — invented `BR-001…BR-014` (business rules) and `UAT-001…UAT-015` by
   extracting/derived from existing constraints and user-story acceptance criteria. **[confirmed:
   extract BR-NNN]**
5. **Stakeholders** **[confirmed]** — team-level role placeholders (Frontend Platform / Design
   Systems, etc.); named individuals deferred to Open Question OQ-1.
6. **Success-metric baselines** **[confirmed]** — greenfield: current state = manual rebuild +
   copy-paste, no catalog/CLI/telemetry.
7. **OKRs** **[confirmed]** — synthesized from goals G1–G13 + success metrics SM-1…SM-11 (no new
   targets invented).
8. **Operational targets** **[confirmed: proposed defaults, flagged "confirm with Ops"]** — SLO
   99.5% availability, RTO 4h, RPO 24h, p95 ≤ 500ms for gated source. These are *proposals*, not
   commitments.
9. **Deployment** **[confirmed: generic container]** — dev/staging/prod containerized Registry API;
   concrete platform/IaC/GitOps tooling left as Open Questions.
10. **Registry API stack** — took `NestJS + Redis + MongoDB` from the source SDD §1.3 as the
    assumed stack (source marked versions "TBD"); treated as proposed, not locked.
11. **Decision owners (ADRs)** — mapped to PRD stakeholder placeholders: Frontend Platform for
    most; Design System Owner for ADR-002/013; +Platform/Infra for ADR-015/016. Not user-confirmed.
12. **ADR approval** — "Accepted as part of the `001-block-catalog-app` baseline"; decision date
    2026-06-23 (from source), regeneration noted 2026-06-24 in Status History. Assumed, not verified
    against any approval record.
13. **Diagrams to render** **[confirmed selection]** — C4 context, C4 container, install flow,
    telemetry flow. **Not confirmed: the rendering quality/style** (see §B).
14. **Coverage-index fix** **[confirmed]** — the 28 "In SDD = NO" rows were a notation artifact of
    the matrix script's exact-substring matching against compressed IDs, not real design gaps; fixed
    additively via SDD §16.
15. **Open Questions retained (not silent TBDs)**: OQ-1 named stakeholders; OQ-2 telemetry
    retention window; OQ-3 iframe `sandbox` hardening; OQ-4 v1 search deferral confirmation.

### Deviations from the plugin's templates (things I added beyond orientation)

- **SDD §16 "Requirement Coverage Index"** — not in `sdd-template.md` (which ends at §15). Added to
  resolve traceability false-negatives.
- **Metadata header blockquotes** on PRD and SDD (`> Status / Version / Owner / Date`) — templates
  define no metadata block.
- **Disambiguation blockquotes** in ADR-013 / ADR-014 (the two-MCP-servers warning) — not in the
  ADR template.
- **Overloaded `Status` field** in ADRs with parentheticals ("Accepted (amended in scope by …)")
  because the template has no first-class supersede/amend fields.
- **Skipped optional outputs** silently: `prd-summary.html` (OpenUI) and `.product/design/*.openui`
  UI mockups.

---

## B. Plugin feedback & proposed improvements

Ordered by impact. Each item states the **problem observed**, the **proposal**, and my
**assumption** about why it matters.

### B1. Replace the diagram renderer (highest impact)
- **Problem:** `scripts/diagram-render.js` lays nodes out in a single horizontal row with straight
  arrows. It cannot express real **C4** (no container nesting / trust boundaries), **sequence**
  diagrams (no lifelines, activations, ordering), **state machines**, **ER**, **deployment**, or
  **data-flow / trust-boundary** diagrams. The "C4 context/container" outputs are box-and-arrow
  sketches mislabeled as C4 — which reads as generic.
- **Proposal:** Emit **Mermaid** as the default (`C4Container`, `sequenceDiagram`,
  `stateDiagram-v2`, `erDiagram`, `flowchart`+`subgraph`) — renders natively in GitHub, VS Code,
  most IDEs, and Markdown. Offer **Structurizr DSL** or **PlantUML C4** as the rigorous-C4 upgrade.
  Keep the current renderer only for tiny thumbnails, or retire it.
- **Assumption:** teams want diagrams that live in version control and render where they already
  read docs, and that can express ordering, boundaries, and nesting — not static SVG rows.

### B2. Add a diagram review/approval gate
- **Problem:** The builder asks *which* diagrams to include but never (a) lets the user pick a
  **diagram tool/style**, (b) shows output for **approval before finalizing**, or (c) surfaces the
  renderer's limitations. I shipped diagrams without a "do you like these?" checkpoint.
- **Proposal:** In `egp-sdd-builder`, after choosing diagram *types*, render drafts, present them,
  and confirm/iterate before writing. Add a one-time "diagram engine" preference (mermaid /
  plantuml / structurizr / none).
- **Assumption:** diagrams are a primary architectural communication artifact; their style is a
  user preference, not an implementation detail to be defaulted silently.

### B3. Offer an architecture-appropriate diagram catalog (not just C4)
- **Problem:** The plugin's structures.md leans on C4 context/container as the canonical set. For
  systems like this (static zone + one gated service + telemetry overlay), the *valuable* diagrams
  are sequence (gated-install 401-abort handshake), state machines (export run / install), a
  deployment diagram, an ER/data diagram, and a **DFD with trust boundaries** for the
  security/LGPD review.
- **Proposal:** Ship a menu of diagram archetypes mapped to system shapes, and let the SDD builder
  recommend a set based on detected concerns (auth → sequence; privacy → DFD+trust-boundary;
  background jobs → state machine; multi-store → deployment).
- **Assumption:** "which diagrams" should be driven by the system's architecture, not a fixed C4
  default.

### B4. Make `traceability.js` robust to real ID notation
- **Problem:** It does naive exact-substring matching, so compressed IDs (`FR-001/002/003a`,
  `FR-036…042`) yield false "In SDD = NO" (28/56 here). It also only reports "In SDD yes/no + ADRs"
  — it ignores NFR/UAT linkage, PRD↔SDD section anchors, and is one-directional.
- **Proposal:** Parse ID ranges/lists and sub-IDs; scan PRD, SDD **and** ADRs; output bidirectional
  links with section anchors; include BR/NFR/UAT rows; flag genuine orphans distinctly from
  notation artifacts.
- **Assumption:** the matrix is the trust anchor of the whole triad — false negatives erode that
  trust and force manual workarounds (the SDD §16 index I had to add).

### B5. First-class template metadata + ADR relationship fields
- **Problem:** No template has a metadata block (owner/version/date/status), so I invented header
  blockquotes. ADRs have no `Supersedes` / `Superseded-by` / `Amends` / `Amended-by` fields, so I
  overloaded the `Status` string.
- **Proposal:** Add YAML front-matter (or a standard metadata table) to all three templates, and
  add structured cross-reference fields to the ADR template's Metadata section.
- **Assumption:** machine-readable metadata enables better sync/automation and avoids ad-hoc prose.

### B6. A sanctioned bootstrap/import path
- **Problem:** The workflow assumes greenfield authoring. There is no first-class "I already have
  docs — ingest them, map to templates, flag gaps" mode. I did this by hand (read docs → map →
  ask only gap questions).
- **Proposal:** Add a `egp-import` / bootstrap step that ingests existing PRD/SRS/ADR/SDD, maps to
  templates, and produces a gap report before any writing.
- **Assumption:** most real teams adopt the plugin with documents already in flight, not from zero.

### B7. "Derive-then-confirm" questioning mode
- **Problem:** The 4-question cadence treats every missing section as a question. In a
  regeneration-from-source run, most sections are *derivable*; asking about all of them is friction.
- **Proposal:** Let builders auto-derive from provided source, then present a single confirmation
  batch of derived content + only the genuine gaps as questions.
- **Assumption:** when authoritative source exists, confirmation is cheaper than interrogation.

### B8. Extensible sections / auto-generated coverage index
- **Problem:** The SDD template is fixed at 15 sections; I had to bolt on §16. There's no provision
  for appendices.
- **Proposal:** Add an "Appendices" provision, and have the SDD builder **auto-generate** a
  requirement coverage index from `traceability.js` (so it's never hand-maintained).
- **Assumption:** coverage ledgers should be generated, not authored.

### B9. SRS support (or explicit "no SRS" stance)
- **Problem:** Teams with an IEEE-830 SRS (like this project) have nowhere to put it; it gets
  orphaned. concepts.md acknowledges many teams skip SRS but offers no handling for those who don't.
- **Proposal:** Offer an optional SRS template or a `reference/` provision so existing SRS material
  is linked, not lost.
- **Assumption:** regulated / bank contexts (BB here) often keep an SRS and won't drop it.

### B10. Align diagram folder structure with the docs
- **Problem:** `structures.md` recommends `diagrams/{c4,sequence,deployment,domain}/` but the
  builder writes flat into `.product/diagrams/`.
- **Proposal:** Have the builder create the recommended subfolders and file diagrams into them.
- **Assumption:** consistency between the plugin's own guidance and its output reduces confusion.

---

## C. Net assessment

The plugin's **document templates and the PRD→SDD→ADR sequencing are strong** and mapped cleanly
onto a mature existing doc set. The **weak points are the diagram tooling (B1–B3) and the
traceability script (B4)** — both are where I had to either lower quality (the box "C4" sketches)
or add content outside the orientation (SDD §16). Fixing those two areas would most improve the
plugin's architectural usefulness for a team.
