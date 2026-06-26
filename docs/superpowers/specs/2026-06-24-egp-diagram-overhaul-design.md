# Phase 1 — Diagram Overhaul Design

> Status: Approved · Date: 2026-06-24 · Owner: Vivaldo
> Source: `docs/feedbacks/001-assumptions.md` (items B1, B2, B3, B10)
> Scope: First of five phases improving the `product-design-suite` plugin.

## Context

The plugin's `scripts/diagram-render.js` lays nodes out in a single horizontal row
with straight arrows and emits self-contained SVG/HTML. It cannot express real C4
(no nesting or trust boundaries), sequence diagrams (no lifelines/ordering), state
machines, ER, deployment, or data-flow/trust-boundary diagrams. The "C4
context/container" outputs are box-and-arrow sketches mislabeled as C4. The feedback
author's net assessment ranks diagram tooling as the plugin's single weakest area.

This spec covers **Phase 1** of a five-phase roadmap derived from the feedback:

1. **Diagrams (B1+B2+B3+B10)** — this spec.
2. Traceability (B4+B8) — later cycle.
3. Template metadata & ADR relationships (B5) — later cycle.
4. Authoring flow: import + derive-then-confirm (B6+B7) — later cycle.
5. SRS support (B9) — later cycle.

Each phase gets its own spec → plan → implementation cycle. Phases 2–5 are out of
scope here.

## Decisions (confirmed)

- **Emission strategy:** Inline Mermaid fenced code blocks written directly into
  `sdd.md`. Renders natively on GitHub/GitLab/VS Code/IDEs with no build step and no
  new runtime dependency. The diagram source version-controls as part of the document.
- **Engine scope:** Mermaid-only. PlantUML and Structurizr are dropped — they do not
  render inline on GitHub and would force a separate-file render path that contradicts
  the inline decision. The "engine preference" collapses to *which diagram types to
  include* plus a "none" opt-out.
- **Approval gate:** Draft diagrams are presented as Mermaid source inline in the chat,
  **plus** an optional rendered view via the existing preview server. Mermaid is
  vendored locally (no CDN) so preview works in restricted/offline networks.
- **Catalog logic:** The SDD builder reasons about which diagram types fit by reading
  the PRD/SDD against an archetype catalog — no keyword/substring matching (which is
  the brittleness the author criticized in `traceability.js`).

## Goal & Non-Goals

**Goal:** Replace the box-row SVG "C4" sketches with inline Mermaid authored into the
SDD, recommended by system shape, and approved before being written.

**Non-goals:** Traceability (Phase 2), template metadata (Phase 3), import/derive
(Phase 4), SRS (Phase 5), and PlantUML/Structurizr support (dropped).

## Components Changed

| File | Change |
|---|---|
| `scripts/diagram-render.js` | **Retired.** The box-row SVG generator is removed. |
| `scripts/mermaid-preview.js` | **New.** Extracts ` ```mermaid ` fences from a markdown file (or accepts a single snippet) and emits a self-contained preview HTML that loads a vendored `mermaid.min.js` via a relative `src` (no external `http`; works offline). Served by the existing preview server. |
| `scripts/vendor/mermaid.min.js` | **New, pinned.** Vendored Mermaid build; no CDN. Version pinned and recorded. |
| `shared/references/structures.md` | Add the diagram archetype catalog (below). Rewrite the diagram-folder guidance to inline-first + optional exports so guidance matches actual builder behavior. |
| `shared/templates/sdd-template.md` | §3 (Architecture Overview) and §7 (Flows and Behavior) diagram placeholders become inline ` ```mermaid ` fenced stubs with guidance comments, replacing the HTML-render references. |
| `skills/egp-sdd-builder/SKILL.md` | Rework the diagram step into the recommend → draft → preview → approve → write loop (below). |
| `skills/egp-product-workflow/SKILL.md` | Point the preview step at `mermaid-preview.js` instead of `diagram-render.js`. |
| `tests/diagram-render.test.js` | Rewrite against the new `mermaid-preview` API; keep the "self-contained HTML, no external `http` src" assertion. |
| `tests/e2e-smoke.test.js` | Update the diagram require/usage (lines ~8, ~27) to the new module. |

`scripts/openui-render.js` (UI mockups) is **untouched**.

## Diagram Archetype Catalog (B3)

Lives in `shared/references/structures.md`. The SDD builder reads the PRD/SDD and
reasons about which set fits, then presents a recommendation with rationale.

| Archetype | Mermaid kind | Recommend when |
|---|---|---|
| C4 Context | `C4Context` | always — system boundary & external actors |
| C4 Container | `C4Container` | multi-container / multi-service systems |
| C4 Component | `C4Component` | a container with nontrivial internal structure |
| Sequence | `sequenceDiagram` | auth handshakes, multi-step protocols (e.g. gated-install 401-abort) |
| State machine | `stateDiagram-v2` | background jobs, export/install lifecycles |
| ER / data | `erDiagram` | multi-entity data model, multi-store |
| Deployment | `C4Deployment` / `flowchart` | multiple runtime environments / infra topology |
| DFD + trust boundary | `flowchart` + `subgraph` boundaries | privacy/security/LGPD review, data crossing trust zones |
| Flow / activity | `flowchart` | general process/branching logic |

## New Diagram Step in `egp-sdd-builder`

1. **Recommend** a diagram set from the catalog, each with a one-line rationale tied to
   the system's detected shape → user confirms or adjusts the set of types.
2. **Draft** Mermaid source for each chosen type.
3. **Present** the drafts: Mermaid source inline in the conversation, plus an offer to
   open a rendered preview via the preview server.
4. **Iterate** until the user approves.
5. **Write** the approved Mermaid fences inline into the relevant `sdd.md` sections.
6. **Optionally export** standalone files to `.product/diagrams/{type}/` if the user
   wants them.

## Folder Structure (B10)

Inline Mermaid blocks in `sdd.md` are the **source of truth**. `.product/diagrams/`
becomes an **optional export target** with type subfolders (`c4/ sequence/ state/
data/ deployment/ flow/`). `structures.md` is updated so its stated layout matches
actual builder behavior, resolving the B10 inconsistency (the reference recommended
`diagrams/{c4,sequence,deployment,domain}/` while the builder wrote flat HTML).

## Rendering & Preview Mechanism

- Inline Mermaid fences render natively wherever the SDD is read (GitHub, GitLab,
  VS Code, most IDEs) — no build step.
- `mermaid-preview.js` produces a preview HTML for the approval gate: it extracts the
  ` ```mermaid ` blocks from `sdd.md` (or takes a single draft snippet) and wraps them
  in a self-contained page that references the vendored `mermaid.min.js` by a relative
  path. The preview server (`preview-server.cjs` / `start-server.sh`) serves it with
  live reload via `helper.js`. The "no external `http` src" guarantee is preserved by
  vendoring rather than loading Mermaid from a CDN.

## Testing

- **`mermaid-preview.js`:** extracts fenced blocks from sample markdown; emits valid
  self-contained HTML referencing the vendored asset with no external `http` src;
  handles zero-diagram input gracefully.
- **Validity:** sample `C4Container`, `sequenceDiagram`, and `stateDiagram-v2` snippets
  are syntactically valid Mermaid.
- **`e2e-smoke`:** updated to the new module; `validate-plugin` test continues to pass.

## Open Questions

None outstanding. Three points were raised and resolved during design: (a)
`diagram-render.js` is retired outright (no stub); (b) the full `mermaid.min.js` is
vendored into the plugin (~3 MB), accepted for offline/restricted-network support; (c)
the optional `.product/diagrams/` export is kept, since some teams want standalone
diagram files even though inline is authoritative.
