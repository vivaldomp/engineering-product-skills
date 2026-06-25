---
name: pm-sdd-builder
description: Create or update a Software Design Document (SDD). Use when the user wants to design the technical solution, architecture, C4 diagrams, components, data model, APIs, security, observability, or testing strategy derived from a PRD. Writes .product/sdd/sdd.md with inline Mermaid diagrams (and optional exports to .product/diagrams/).
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# pm-sdd-builder

Build or update the SDD at `.product/sdd/sdd.md` from the shared template,
derived from the PRD.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/sdd-template.md`
- PRD: `.product/prd/prd.md` (read for requirements to satisfy)
- SRS (SRS mode): `.product/srs/srs.md` — the canonical `FR`/`NFR` source when it exists
- SAD (SAD mode): `.product/sad/sad.md` — the canonical macro-architecture and `AR-NNN` source when it exists
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol,openui-guide}.md`

## Steps
1. If `.product/prd/prd.md` is missing, warn the user that the SDD should follow
   a PRD, and offer to run `pm-prd-builder` first (do not hard-block).
2. Read the SDD template and the requirements source. **SRS mode** — when `.product/srs/srs.md`
   exists — the canonical `FR-NNN`/`NFR-NNN` live in the SRS; **otherwise** they live in the PRD.
   **SAD mode** — when `.product/sad/sad.md` exists — the macro-architecture and the canonical
   `AR-NNN` table live in the **SAD**, so §3 Architecture Overview **references** the SAD's
   `AR-NNN` and C4 Context/Container instead of enumerating them, and this SDD focuses on C3
   Component design, APIs, schemas, and code-level design, mapping its components to the SAD's
   `AR-NNN`. **No-SAD mode** (default) — the SDD owns `AR-NNN` and the C4 Context/Container
   diagrams as before, mapping the requirement source's `FR-NNN` to `AR-NNN`. The SDD builder
   does not move content itself — the SDD→SAD migration is `pm-sad-builder`'s job; the SDD
   builder only honors the active mode.
3. Fill each required section per `questioning-protocol.md`. When authoritative
   source is provided — mapped content from `pm-import`, or source supplied by the
   user — use **derive-then-confirm mode**: derive the sections, present one confirmation batch (see the one-confirmation-batch contract in `questioning-protocol.md`), and ask only about genuine gaps. Otherwise ask gap questions
   (pause after every 4 questions and summarize remaining gaps).
4. Author diagrams as **inline Mermaid** in `sdd.md`:
   - **Recommend a set.** Read the PRD/SDD and pick diagram archetypes from the
     catalog in `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
     ("Diagram archetypes (Mermaid)"), driven by the system's shape — e.g. auth
     handshake → `sequenceDiagram`, background jobs → `stateDiagram-v2`,
     privacy/LGPD data crossing zones → `flowchart` DFD with `subgraph` trust
     boundaries, multi-store → `erDiagram`/deployment. Present the recommended set
     with a one-line rationale each and let the user confirm or adjust.
   - **Draft** Mermaid source for each chosen type (`C4Context`/`C4Container`/
     `C4Component`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, `flowchart`).
   - **Present for approval.** Show the Mermaid source in the conversation, and
     offer a rendered preview: write the drafts to a scratch markdown file and run
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js" <scratch.md> <preview.html>`
     (use a temporary path like the system temp dir for both the scratch markdown
     and preview HTML, not `.product/`), served via the preview server (`start-server.sh`).
     Mermaid is vendored locally, so the preview works offline. For a quick look without the preview server, run `node scripts/mermaid-preview.js <draft.md> <out.html>` and open the returned file directly.
     Iterate until the user approves.
   - **Write** the approved ` ```mermaid ` blocks inline into the relevant `sdd.md`
     sections (§3 Architecture Overview, §7 Flows and Behavior). These inline blocks
     are the source of truth.
   - **Approval bar by provenance (B1/B3):**
     - **Net-new diagrams** (authored from scratch) MUST go through the preview loop
       one at a time until approved.
     - **Derived diagrams** (faithful conversions of existing source, e.g. from an
       import or a SAD→SDD lift) MAY be batch-confirmed: present them together and
       ask for a single approval. Derive-then-confirm covers *section content*; these
       derived diagrams may be folded into that same confirmation batch. Net-new
       diagrams remain outside the batch and use the preview loop.
   - **Optionally export** standalone files to `.product/diagrams/{c4,sequence,state,data,deployment,flow}/`
     only if the user wants separate artifacts.
5. For UI/frontend sections, author OpenUI Lang in `.product/design/*.openui`
   and render with `${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js` to `.product/design/*.html`.
6. Identify decisions with significant trade-offs and flag them as ADR
   candidates; hand each to `pm-adr-builder`. Reference resulting `ADR-NNN`
   in the SDD's "Referenced ADRs" section.
7. On finalize, populate the YAML front-matter (`title`, `status`, `version`,
   `owner`, `date`) — bump `version` and refresh `date` on an update — write
   the SDD, and record unresolved gaps in Open Questions.
8. Suggest running `pm-doc-sync` to refresh the traceability matrix. The SDD's
   §16 Requirement Coverage Index is generated by that step (between the COVERAGE-INDEX
   markers) — do not hand-author it.

## Rules
- Every major design choice should map back to a PRD requirement or an ADR.
- Cover failure modes, security, observability, and operations — not only happy paths.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `.product/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
