# Design Spec: `product-design-suite` plugin

**Date:** 2026-06-23
**Status:** Approved (design phase)
**Author:** Vivaldo (vivaldomp@gmail.com)
**Topic:** A Claude Code marketplace plugin of Agent Skills that drives a Product Manager through a sequential PRD → SDD → ADR workflow, with cross-document propagation and lightweight, framework-free HTML visualizations.

---

## 1. Overview

### Problem
Product Managers need to produce and maintain a connected set of governance artifacts — a PRD (what/why), an SDD (how), and ADRs (why-this-choice) — through a disciplined, sequential workflow. Today the repo holds excellent **content** (`concepts.md`, `structures.md`, full `templates/`) but no **automation layer** that (a) guides a PM through the workflow, (b) asks only the right gap questions without scope creep, (c) keeps the three document types in sync when one changes, and (d) produces shareable visual artifacts (C4 diagrams, UI mockups) under a strict framework-free constraint.

### Solution
A distributable **Claude Code marketplace plugin**, `product-design-suite`, composed of five Agent-Skills-spec-compliant skills plus thin slash-command wrappers. The skills orchestrate the workflow, build each artifact from the existing templates, and propagate changes across documents. All generated artifacts land in a `.product/` folder as Markdown plus self-contained HTML.

### Goals
- Sequential, guided PRD → SDD → ADR authoring driven by skills.
- Gap-only questioning with a pause-after-4 cadence; no scope creep.
- Cross-document propagation: editing one doc surfaces and (on confirmation) applies impacts to related docs.
- Lightweight, offline, framework-free HTML for diagrams and UI mockups.
- Reuse of existing repo content as the plugin's shared knowledge layer.
- Final structure packaged as a marketplace plugin for distribution.

### Non-Goals
- No runtime libraries / CDNs / frameworks in generated output (HTML + CSS + inline JS only).
- Not a replacement for a formal SRS; the suite stays in the PRD/SDD/ADR triad.
- No automatic, unreviewed rewriting of documents (sync is confirmation-gated).

---

## 2. Key Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|---|---|
| D1 | Skill-set architecture | Orchestrator + 3 builders + sync (5 skills) |
| D2 | Cross-document propagation | Impact report → user-confirmed edits, driven by traceability IDs + generated matrix |
| D3 | Diagram / mockup rendering | Agent-authored inline SVG (via bundled `diagram-render.js`) + OpenUI Lang → HTML (via bundled `openui-render.js`); no CDN, no framework |
| D4 | Namespacing | Prefix `pm` applied consistently to all skill names and command wrappers |
| D5 | Command wrappers | Included: `/egp-prd`, `/egp-sdd`, `/egp-adr`, `/egp-product` |
| D6 | Author field | `Vivaldo <vivaldomp@gmail.com>` |
| D7 | Shared content | Existing `concepts.md` / `structures.md` / `templates/` move into the plugin's `shared/` |

---

## 3. Packaging & Repository Layout (marketplace format)

```
engineering-product-skills/                              # git repo = marketplace
├── .claude-plugin/
│   └── marketplace.json                # owner + plugin entry list
├── plugins/
│   └── product-design-suite/
│       ├── .claude-plugin/
│       │   └── plugin.json             # name, version, description, author
│       ├── skills/
│       │   ├── egp-product-workflow/SKILL.md
│       │   ├── egp-prd-builder/SKILL.md
│       │   ├── egp-sdd-builder/SKILL.md
│       │   ├── egp-adr-builder/SKILL.md
│       │   └── egp-doc-sync/SKILL.md
│       ├── commands/
│       │   ├── egp-prd.md
│       │   ├── egp-sdd.md
│       │   ├── egp-adr.md
│       │   └── egp-product.md
│       ├── shared/
│       │   ├── references/
│       │   │   ├── concepts.md             # moved from repo root
│       │   │   ├── structures.md           # moved from repo root
│       │   │   ├── questioning-protocol.md # NEW — shared cadence definition
│       │   │   └── openui-guide.md         # NEW — OpenUI Lang authoring guide
│       │   └── templates/
│       │       ├── prd-template.md          # moved from repo root
│       │       ├── sdd-template.md          # moved from repo root
│       │       └── adr-template.md          # moved from repo root
│       └── scripts/
│           ├── preview-server.cjs          # reused from superpowers brainstorming
│           ├── start-server.sh             # reused
│           ├── stop-server.sh              # reused
│           ├── frame-template.html         # reused
│           ├── helper.js                   # reused
│           ├── openui-render.js            # NEW — OpenUI Lang → self-contained HTML
│           ├── diagram-render.js           # NEW — compact spec → inline-SVG C4/sequence HTML
│           └── traceability.js             # NEW — scan IDs → matrix (md + html)
└── README.md
```

### Conventions
- **Skill name = directory name** (Agent Skills rule). All prefixed with `egp-`.
- Skills reference shared files via `${CLAUDE_PLUGIN_ROOT}/shared/...` and scripts via `${CLAUDE_PLUGIN_ROOT}/scripts/...`. Trade-off: this is a Claude-Code convenience that keeps assets DRY across skills at the cost of strict single-skill portability; acceptable because the unit of distribution is the plugin, not the individual skill.
- Each `SKILL.md` body stays under ~500 lines; detailed material lives in `shared/references/` and is loaded on demand (progressive disclosure).
- `marketplace.json` and `plugin.json` follow the Claude Code plugin schema (name, description, version, author; marketplace lists the plugin path).

---

## 4. The Five Skills

### 4.1 `egp-product-workflow` (orchestrator)
- **Triggers:** "design a product", "start product spec", "run the product workflow", end-to-end intent; backed by `/egp-product`.
- **Responsibilities:**
  - Detect current stage by inspecting `.product/` (no docs → start PRD; PRD present → offer SDD; SDD present → offer ADRs).
  - Enforce the **sequential order** PRD → SDD → ADR; warn (don't block) if a stage is skipped.
  - Initialize the `.product/` structure on first run.
  - Own and apply the **gap-question cadence** (see §5) by delegating to the active builder.
  - Dispatch to the correct builder skill; after any upstream edit, invoke `egp-doc-sync`.
- **Inputs:** user intent, existing `.product/` state. **Outputs:** stage transitions, delegated artifact writes.

### 4.2 `egp-prd-builder`
- **Triggers:** "write/update a PRD"; `/egp-prd`.
- **Responsibilities:** Fill `prd-template.md` into `.product/prd/prd.md`; ask gap questions per §5; assign and register **FR / BR / NFR / UAT** IDs into the traceability backbone; optionally emit `.product/prd/prd-summary.html` (objectives & success-metrics dashboard, inline SVG/CSS).
- **Finalize:** record unresolved gaps in the template's **Open Questions** table.

### 4.3 `egp-sdd-builder`
- **Triggers:** "write/update an SDD"; `/egp-sdd`.
- **Responsibilities:** Fill `sdd-template.md` into `.product/sdd/sdd.md`; derive **Architectural Requirements (AR)** from PRD **FR** for traceability; emit C4 (context/container/component) and sequence/flow diagrams as inline-SVG HTML in `.product/diagrams/`; **flag decisions that warrant an ADR** and hand them to `egp-adr-builder`; author UI/frontend design sections in **OpenUI Lang** on finalize (rendered to `.product/design/*.html`).

### 4.4 `egp-adr-builder`
- **Triggers:** "record/update an ADR"; `/egp-adr`.
- **Responsibilities:** One decision per `ADR-NNN-*.md` in `.product/adr/`; link related PRD/SDD sections; manage the status lifecycle (Proposed → Accepted → Superseded → Deprecated → Rejected) and the Status History table; optional options-comparison HTML.

### 4.5 `egp-doc-sync`
- **Triggers:** invoked by the orchestrator after edits, or "sync docs / check impact".
- **Responsibilities:** Run `traceability.js` to refresh the index; compute what changed; produce an **impact report** (Markdown + `.product/traceability.html`) listing each affected downstream/upstream item; **propose concrete edits the user approves** before any write; never silently rewrite. Bidirectional (PRD→SDD→ADR and back-references).

---

## 5. Gap-Question Cadence (shared `questioning-protocol.md`)

A single definition reused by all skills:
1. Ask **only** about gaps required to complete the **current document's** required sections. Never expand scope to other docs or features.
2. Prefer multiple-choice questions where possible.
3. **After every 4 consecutive questions**, pause and ask: *"Continue answering, or finalize the document now?"* — accompanied by a bulleted **summary of the remaining gaps**.
4. On **finalize**, write the document and record every unresolved gap explicitly in the template's **Open Questions** table — no silent `TBD`s.

---

## 6. `.product/` Output Layout

```
.product/
├── prd/         prd.md            [prd-summary.html]
├── sdd/         sdd.md
├── adr/         ADR-001-*.md …
├── diagrams/    c4-context.html · c4-container.html · c4-component.html · sequence-*.html
├── design/      *.openui  +  *.html         # OpenUI source → rendered mockups
├── research/    *.md / *.html
└── traceability.md  ·  traceability.html
```
- Single initiative by default; multiple products may nest under `.product/<initiative>/`.
- Markdown is the source of record; HTML is the shareable, self-contained view (preferred for UI mockups and C4 diagrams).

---

## 7. Visualization Pipeline

- **During iteration (pre-finalize):** reuse the **superpowers preview server** (`preview-server.cjs`, `frame-template.html`, `helper.js`, `start-server.sh`/`stop-server.sh`) to open a browser tab and show diagrams/mockups live as the user refines them.
- **On finalize (persisted deliverables):**
  - **Diagrams** (C4, sequence/flow): authored as a compact node/edge spec, rendered by `diagram-render.js` into **inline-SVG** self-contained `.html`. No runtime library.
  - **UI mockups:** authored in **OpenUI Lang** (`*.openui`, line-oriented `id = Type(args)`, ~67% fewer tokens than JSON), rendered by `openui-render.js` into offline `*.html` with a small built-in component library (Root, Section, Grid, Card, Navbar, Link, StatCard, Form, Input, Button, Text, and a simple SVG chart).
- **Constraint compliance:** every generated non-Markdown file is HTML + CSS + **inline** JS, opens offline in major browsers, no CDN, no framework.

---

## 8. Traceability & Sync Mechanism

- **Backbone:** the IDs already defined in the templates — **FR / BR / NFR / AR / ADR / UAT** — plus the "Source" / "Acceptance Reference" / "Referenced ADRs" cross-reference columns.
- `traceability.js` scans `.product/` for these IDs and their cross-references and builds `traceability.md` + `traceability.html` (a matrix: PRD requirement → SDD section → test/AC → ADR).
- `egp-doc-sync` consumes the matrix to generate the impact report and propose confirmation-gated edits, keeping the triad consistent in both directions.

---

## 9. Reuse vs. New Build

| Reused from superpowers brainstorming/scripts | New in this plugin |
|---|---|
| `preview-server.cjs`, `start-server.sh`, `stop-server.sh`, `frame-template.html`, `helper.js` (live preview) | `openui-render.js`, `diagram-render.js`, `traceability.js` |
| Existing `concepts.md`, `structures.md`, `templates/*` (moved into `shared/`) | 5 `SKILL.md` files, 4 command wrappers, `questioning-protocol.md`, `openui-guide.md`, `marketplace.json`, `plugin.json`, `README.md` |

---

## 10. Open Questions
None outstanding — all design decisions (D1–D7) resolved.

## 11. Out of Scope (explicit)
- Publishing to a public marketplace registry (the repo is packaged in marketplace format; actual publishing is a separate step).
- Git initialization of this repo (currently not a git repo; commit of this spec is deferred until a repo exists).
