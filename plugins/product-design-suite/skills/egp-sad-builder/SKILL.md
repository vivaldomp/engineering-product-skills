---
name: egp-sad-builder
description: Create or update a System Architecture Document (SAD). Use when a team maintains a macro-architecture document and wants the canonical system context, container/infrastructure topology, data-flow patterns, macro security architecture, and Architectural Requirements (AR-NNN) to live in a dedicated document between the SRS and the SDD. Writes .product/sad/sad.md; the SDD then references it.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-sad-builder

Build or update the SAD at `.product/sad/sad.md` from the shared template. The SAD is
**optional**: when it exists, it is the canonical home for the macro-architecture — C4
Context (C1) and Container (C2) diagrams, system boundaries, technology/infrastructure
choices, data-flow & integration patterns, the macro security architecture, and the
Architectural Requirements (`AR-NNN`) — and the SDD references it. When no SAD exists, the
SDD owns those as usual — creating this file is what puts the project into "SAD mode".

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/sad-template.md`
- PRD: `.product/prd/prd.md` (read for product intent and scope)
- SRS (if present): `.product/srs/srs.md` — read the non-functional requirements as architectural drivers
- SDD (if present): `.product/sdd/sdd.md` (read for any existing `AR` table / C4 Context+Container diagrams to migrate)
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
1. Ensure `.product/sad/` exists. If `sad.md` exists, load it and treat this as an update.
2. Read the SAD template, the PRD, and the SRS if present. Source the architectural drivers
   from the non-functional requirements (`NFR-NNN`) in the SRS, or the PRD when no SRS exists.
3. Fill each required section per `questioning-protocol.md`. When authoritative source is
   provided — mapped content from `egp-import`, or source supplied by the user — use
   **derive-then-confirm mode**: derive the sections, present one confirmation batch (see the one-confirmation-batch contract in `questioning-protocol.md`), and ask
   only about genuine gaps. Otherwise ask gap questions (pause after every 4 questions and
   summarize remaining gaps).
4. **Own the `AR-NNN` IDs.** Assign stable, zero-padded Architectural Requirement IDs and keep
   them stable across updates. When ingesting from a source (an existing SDD or imported docs),
   **reuse source IDs verbatim** so cross-document traceability is preserved.
5. **Author diagrams as inline Mermaid** in `sad.md`: C4 Context (`C4Context`, §3), C4 Container
   / deployment (`C4Container` / `C4Deployment`, §4), and a data-flow diagram with `subgraph`
   trust boundaries (`flowchart`, §5) where privacy/security review warrants it. Draft the
   Mermaid source, present it for approval, and offer a rendered preview: write the drafts to a
   scratch markdown file and run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js" <scratch.md> <preview.html>`
   (use a temp path, not `.product/`), served via `start-server.sh`. Mermaid is vendored
   locally, so the preview works offline. For a quick look without the preview server, run `node scripts/mermaid-preview.js <draft.md> <out.html>` and open the returned file directly.
   Iterate until the user approves, then write the approved ` ```mermaid ` blocks inline. These inline blocks are the source of truth.

   **Approval bar by provenance (B1/B3):**
   - **Net-new diagrams** (authored from scratch) MUST go through the preview loop
     one at a time until approved.
   - **Derived diagrams** (faithful conversions of existing source, e.g. from an
     import or a SAD→SDD lift) MAY be batch-confirmed: present them together and
     ask for a single approval. Derive-then-confirm covers *section content*; these
     derived diagrams may be folded into that same confirmation batch. Net-new
     diagrams remain outside the batch and use the preview loop.
6. **Migrate macro-architecture out of the SDD (confirmation-gated).** If `.product/sdd/sdd.md`
   already holds an `AR` table and/or C4 Context+Container diagrams (an SDD authored before the
   SAD existed), propose the migration: lift the §3 `AR-NNN` rows and the Context/Container
   Mermaid blocks into the SAD verbatim (IDs preserved), then rewrite the SDD's §3 Architecture
   Overview as references to the SAD (`.product/sad/sad.md`). Show the exact before/after and
   apply only on approval — no silent rewrite. Never touch the SDD's component, data, API,
   testing, or operations content.
7. Identify structural decisions with significant trade-offs and flag them as ADR candidates;
   hand each to `egp-adr-builder` and reference the resulting `ADR-NNN` in §7. Offer to set the
   ADR's `related-sad` front-matter field.
8. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`)
   — bump `version` and refresh `date` on an update — write `.product/sad/sad.md`, and record
   unresolved gaps in §8 Open Questions rather than leaving silent TBDs.
   Fill the `MODE-BANNER` slot with a concise orientation note (e.g., "This SAD owns the macro-architecture and AR-NNN")
   to signal the SAD's role in the documentation architecture, or leave it empty if unused.
9. Suggest running `egp-doc-sync` to refresh the traceability matrix and propagate the new
   `AR` source to the SDD.

## Rules
- The SAD owns the macro-architecture and `AR-NNN` only; detailed component/code design,
  schemas, and implementation-level security stay in the SDD.
- Confirmation-gated: propose the SDD migration, then apply on approval. No silent rewrites.
- Reuse source IDs verbatim; keep `AR-NNN` IDs stable across updates.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `.product/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
