# Phase 6 — SAD Support Design

> Status: Approved · Date: 2026-06-24 · Owner: Vivaldo
> Source: `docs/feedbacks/002-improvements.md`
> Scope: Sixth phase improving the `product-design-suite` plugin.

## Context

The suite models four documents — PRD, SDD, ADR, and an opt-in SRS — each with a
template (YAML front-matter), a builder skill, a command, and integration into
`egp-product-workflow`, `traceability.js`, `egp-doc-sync`, and `egp-import`. The
lifecycle is `PRD → (optional) SRS → SDD → ADR`.

`002-improvements.md` surfaces a structural gap: the suite jumps from *what the
system must do* (SRS) straight to *how a specific module is built* (SDD), skipping
the **macro-architecture** — system boundaries, container/infrastructure topology,
data-flow and integration patterns, the macro security posture, and the
technology stack. That layer is the industry-standard **System Architecture
Document (SAD)**, which sits between the SRS and the SDD:

```text
[PRD] → [SRS] → [SAD] → [SDD] → [ADR]
 why     what    where    how     why-this
```

Today this macro layer is partly squatting in the SDD's §3 Architecture Overview
(C4 Context + Container diagrams) and its `AR-NNN` (Architectural Requirements)
table. This spec promotes the SAD to a first-class, **opt-in** fifth document and
relocates the macro layer to it when a SAD exists.

This is **Phase 6** of the roadmap improving the plugin:

1. Diagrams (B1+B2+B3+B10) — shipped.
2. Traceability (B4+B8) — shipped.
3. Template metadata & ADR relationships (B5) — shipped.
4. Authoring flow: import + derive-then-confirm (B6+B7) — shipped.
5. SRS support (B9) — shipped.
6. **SAD support** — this spec.

## Decisions (confirmed)

- **First-class SAD:** a dedicated `sad-template.md`, a `egp-sad-builder` skill, a
  `/egp-sad` command, and full wiring — parallel to PRD/SRS/SDD/ADR.
- **SAD owns the macro layer:** when a SAD exists it is the canonical home for the
  C4 Context (C1) + Container (C2) diagrams, system boundaries, technology/infra
  choices, data-flow & integration patterns, the macro security & compliance
  architecture, **and the `AR-NNN` (Architectural Requirements) table**. The SDD
  drops to the micro level — C3 Component design, APIs, schemas, code-level
  design — and references the SAD's `AR-NNN`.
- **Opt-in / backward-compatible:** with **no SAD**, the SDD owns `AR-NNN` and the
  C4 Context/Container diagrams exactly as today — zero behavior change. With a
  SAD, those become canonical in the SAD.
- **ID family split:** `AR` moves to the SAD (when present). `FR`/`NFR` stay in
  the SRS (or PRD); `BR`/`UAT` stay in the PRD. The SDD introduces no new ID
  family — its component design maps to the SAD's `AR-NNN` by reference.
- **ADR linkage:** ADR front-matter gains an optional `related-sad` field, closing
  the feedback's "SAD states the structural choice, ADR states the why" loop.

## Mode detection (keystone)

**SAD mode is detected by the existence of `.product/sad/sad.md`** — the same
file-existence mechanism the workflow already uses to detect stages (mirroring the
SRS keystone). No stored flag, no config:

- `.product/sad/sad.md` **absent** → **SDD-macro mode**: current behavior,
  untouched. The SDD §3 owns the C4 Context/Container diagrams and `AR-NNN`.
- `.product/sad/sad.md` **present** → **SAD mode**: macro-architecture and `AR-NNN`
  are canonical in the SAD; the SDD's §3 references the SAD.

Every component (builders, workflow, traceability, doc-sync) keys off this one
signal.

Because the SDD is normally authored before a SAD exists, `egp-sad-builder` carries
a **confirmation-gated migration**: when it runs against an SDD that already holds
an `AR` table and/or C4 Context+Container diagrams, it lifts those into the SAD
(reusing `AR` IDs verbatim), rewrites the SDD's §3 as references to the SAD, and
leaves the SDD's component/data/API content untouched. This reuses the established
"propose-then-apply, no silent rewrite" pattern. Creating the SAD is the trigger —
no upfront mode question.

## Goal & Non-Goals

**Goal:** Give the suite a first-class, opt-in SAD that fills the macro-architecture
gap between SRS and SDD. A `sad-template.md` provides a lean C4-based home for the
system context, container/infra topology, data flow, macro security, and the
canonical `AR-NNN`; `egp-sad-builder` authors it (and migrates that content out of
an existing SDD); the workflow offers it between SRS and SDD; traceability,
doc-sync, and import become SAD-aware; ADRs can link back to the SAD. The
non-SAD path keeps working unchanged. Lock the conventions with tests.

**Non-goals:** No change to non-SAD behavior (projects without `.product/sad/` are
untouched). No new runtime dependency or parsing script beyond the existing
`traceability.js` (mapping stays skill-driven, consistent with Phases 3–6). No new
diagram tooling — reuse inline Mermaid + `mermaid-preview.js`. No auto-migration
without user confirmation. `FR`/`NFR`/`BR`/`UAT` do not move.

## Component 1 — `sad-template.md` (C1)

`shared/templates/sad-template.md`, mirroring the other templates' YAML
front-matter (`title`, `status`, `version`, `owner`, `date`) and a lean,
C4-based SAD structure:

1. **Introduction** — Purpose, Scope, Audience, References (incl. links back to the
   PRD and SRS), Related ADRs, Glossary.
2. **Architectural Drivers & Requirements** — the canonical **`AR-NNN` table**
   (ID, Requirement, Source, Design Impact — matching the columns the SDD §3 AR
   table uses today so migration is a verbatim row lift), architectural drivers
   sourced from SRS/PRD non-functional requirements, and technical constraints.
3. **System Context** — C4 Context (C1) diagram (inline `C4Context`) showing how
   the system interacts with users and external third-party systems.
4. **Container / Infrastructure** — C4 Container (C2) diagram (`C4Container` /
   `C4Deployment`), high-level technology choices, and deployment landscape.
5. **Data Flow & Integration Patterns** — how containers communicate (REST,
   GraphQL, async/event-driven messaging); a DFD with `subgraph` trust boundaries
   where privacy/security review warrants it.
6. **Security & Compliance Architecture** — *macro* level: authentication model
   (OAuth2/JWT), encryption posture (in transit / at rest), network perimeters,
   and compliance boundaries. Implementation-level security stays in SDD §8.
7. **Architecture Decisions** — the structural choices made here, each linking to
   its ADR for the rationale.
8. **Open Questions / Assumptions.**

The `AR` table is column-compatible with the SDD's existing §3 `AR` table so the
migration is a verbatim row move (IDs preserved).

## Component 2 — `egp-sad-builder` skill + `/egp-sad` command (C2)

`skills/egp-sad-builder/SKILL.md` (`name: egp-sad-builder`) and `commands/egp-sad.md`.

Responsibilities:

- Author `.product/sad/sad.md` from `sad-template.md`. Creating this file is what
  puts the project into SAD mode.
- **Own `AR-NNN` ID assignment** (stable across updates), mirroring how the SDD
  owns `AR` in non-SAD mode. Read non-functional requirements from the SRS (or the
  PRD when no SRS exists) as architectural drivers. Reuse source IDs verbatim when
  ingesting.
- **Questioning:** follow `questioning-protocol.md` — greenfield gap-question
  cadence by default; **derive-then-confirm mode** when authoritative source is
  provided (mapped content from `egp-import`, or source supplied by the user),
  exactly like the other builders.
- **SDD migration (confirmation-gated):** if `.product/sdd/sdd.md` already holds an
  `AR` table and/or C4 Context+Container diagrams, propose lifting them into the
  SAD verbatim (IDs preserved) and rewriting the SDD's §3 Architecture Overview as
  references to the SAD. Show exact before/after; apply only on approval; never
  touch the SDD's component, data, API, or testing content.
- **Diagrams:** author C4 Context (C1), C4 Container (C2), deployment, and DFD
  trust-boundary diagrams as **inline Mermaid**, drafted and previewed via
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js"` served by the preview
  server — the same flow `egp-sdd-builder` uses. Inline blocks are the source of
  truth; optional exports go to `.product/diagrams/`.
- Flag structural decisions with significant trade-offs as ADR candidates; hand
  each to `egp-adr-builder` and reference the resulting `ADR-NNN` in §7.
- On finalize, populate front-matter (bump `version`, refresh `date` on update);
  record unresolved gaps in Open Questions; suggest `egp-doc-sync`.

The skill sits between the SRS (or PRD) and the SDD in the lifecycle.

## Component 3 — Builder + workflow wiring (C3)

- **`egp-sdd-builder`:** gains a mode branch — in **SAD mode**
  (`.product/sad/sad.md` exists), the SDD §3 references the SAD's `AR-NNN` and C4
  Context/Container instead of enumerating them, and the SDD focuses on C3
  Component design, APIs, schemas, and code-level design, mapping its components to
  the SAD's `AR-NNN`. In non-SAD mode, behavior is unchanged. The SDD builder does
  not move content itself — that migration is `egp-sad-builder`'s job; the SDD
  builder only honors the active mode.
- **`egp-product-workflow`:** the sequence becomes **PRD → (optional) SRS →
  (optional) SAD → SDD → ADR**. The detect-stage step gains: after requirements
  exist (PRD, and the SRS if used) and before the SDD, offer `egp-sad-builder` for
  teams that maintain a SAD (optional — skipping it keeps the macro-architecture in
  the SDD). If a `docs/` SAD was imported, offer the SAD builder here. When
  `.product/sad/sad.md` exists, treat the SAD as the macro-architecture source for
  the SDD stage. `.product/sad/` is created on demand by `egp-sad-builder` (the
  workflow need not pre-create it).

## Component 4 — `traceability.js` SAD-aware (C4)

- **`loadProduct(dir)`** also reads `.product/sad/sad.md` (empty string if absent)
  and returns it as `sad`.
- **`buildMatrix({ prd, sdd, adrs, srs, sad })`** sources the `AR` set by mode:
  - SAD present → `AR` parsed from the **SAD**.
  - SAD absent → `AR` parsed from the **SDD** (current behavior, unchanged).
  - `FR`/`NFR` still come from the SRS-or-PRD; `BR`/`UAT` from the PRD; UAT-verifies
    and AR-traces links are ID-based and unchanged.
- The coverage index is still injected into the SDD §16. All linking is by ID, so
  reused `AR-NNN` IDs resolve across SAD/SDD regardless of which document defines
  them.

The default-arg shape stays backward-compatible (`sad = ''`), so existing callers
and the non-SAD path behave identically.

## Component 5 — `egp-doc-sync`, `egp-import`, ADR linkage, `concepts.md`/`structures.md` (C5)

- **`egp-doc-sync`:** include the SAD in the impact graph — a changed SAD `AR`
  propagates to SDD component design and to linked ADRs; a changed SRS NFR
  propagates to the SAD's architectural drivers; a changed SDD reference points
  back to the SAD. Confirmation-gated as today. Recognize ADR↔SAD links
  (`related-sad`) symmetrically, as it already does for `related-prd`/`related-sdd`.
- **ADR template / `egp-adr-builder`:** ADR front-matter gains an optional
  `related-sad` field alongside `related-prd`/`related-sdd`. The builder offers to
  populate it when an ADR records a structural decision made in the SAD.
- **`egp-import`:** a SAD source now maps to `sad-template.md` (drop any "SAD has no
  native template / linked read-only reference" language). The gap report gains a
  SAD target table. Source remains read-only; IDs reused verbatim.
- **`concepts.md`:** document the SAD as a supported optional document, its
  lifecycle slot (PRD → optional SRS → optional SAD → SDD → ADR), and its
  macro/micro boundary with the SDD (SAD = where/big-picture; SDD = how/code).
- **`structures.md`:** add the SAD structure tree and an SAD quality checklist, and
  note the macro/micro `AR` ownership split with the SDD.

## Testing

New `tests/sad-conventions.test.js` (mirroring `srs-conventions.test.js`) asserts:

- `shared/templates/sad-template.md` exists with valid front-matter (`title`,
  `status`, `version`, `owner`, `date`) and documents the `AR-NNN` table and the
  C4 Context/Container/data-flow/security sections.
- `skills/egp-sad-builder/SKILL.md` exists with `name: egp-sad-builder` and a
  `description`, and its body documents: authoring `.product/sad/sad.md`, `AR-NNN`
  ID ownership, the derive-then-confirm branch, and the confirmation-gated
  SDD→SAD macro-architecture migration.
- `commands/egp-sad.md` exists.
- `egp-sdd-builder` documents the SAD-mode branch (SDD §3 references the SAD;
  components map to the SAD's `AR` when present).
- `egp-product-workflow` documents the PRD → optional SRS → optional SAD → SDD →
  ADR sequence and offering `egp-sad-builder`.
- `egp-doc-sync` and `egp-import` document SAD handling; the ADR template documents
  the `related-sad` field.

Extend `tests/traceability.test.js`: with a SAD present, `AR` is sourced from the
SAD; with no SAD, `AR` is sourced from the SDD (regression guard).

The Phase 1–5 suites must continue to pass, including `validate-plugin.test.js`
(the new skill must satisfy `name == dir`). Run with `node --test tests/*.test.js`.

## Open Questions

None outstanding. The pivotal point was settled during design: when a SAD exists it
owns the macro-architecture (C4 Context/Container, infra, data-flow, macro security)
**and** the `AR-NNN` table, with the SDD shrinking to C3 component/code level and
referencing the SAD; the SAD is opt-in, detected by `.product/sad/sad.md` existence,
with non-SAD behavior unchanged; and ADRs gain an optional `related-sad` link.
