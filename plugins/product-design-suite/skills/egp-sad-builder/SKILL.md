---
name: egp-sad-builder
description: Create or update a System Architecture Document (SAD). Use when a team maintains a macro-architecture document and wants the canonical system context, container/infrastructure topology, data-flow patterns, macro security architecture, and Architectural Requirements (AR-NNN) to live in a dedicated document between the SRS and the SDD. Writes workspace/outputs/current/architecture/sad.md; the SDD then references it.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-sad-builder

Build or update the SAD at `workspace/outputs/current/architecture/sad.md` from the shared template. The SAD is
**optional**: when it exists, it is the canonical home for the macro-architecture — C4
Context (C1) and Container (C2) diagrams, system boundaries, technology/infrastructure
choices, data-flow & integration patterns, the macro security architecture, and the
Architectural Requirements (`AR-NNN`) — and the SDD references it. When no SAD exists, the
SDD owns those as usual — creating this file is what puts the project into "SAD mode".

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/sad-template.md`
- PRD: `workspace/outputs/current/planning/prd.md` (read for product intent and scope)
- SRS (if present): `workspace/outputs/current/specifications/srs.md` — read the non-functional requirements as architectural drivers
- SDD (if present): `workspace/outputs/current/architecture/sdd.md` (read for any existing `AR` table / C4 Context+Container diagrams to migrate)
- Concepts/structure: `${CLAUDE_PLUGIN_ROOT}/shared/references/concepts.md`, `${CLAUDE_PLUGIN_ROOT}/shared/references/structures.md`
- Question cadence: `${CLAUDE_PLUGIN_ROOT}/shared/references/questioning-protocol.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md`
  directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/architecture/` exists. If `sad.md` exists, load it and treat this as an update.
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
   (use a temp path, not `workspace/outputs/current/`), served via `start-server.sh`. Mermaid is vendored
   locally, so the preview works offline. The served preview URL is mandatory for
   approval; the standalone HTML file (`node scripts/mermaid-preview.js <draft.md> <out.html>`)
   is only an offline fallback, never a substitute for the reviewer-facing URL. Avoid the
   conversion footguns: no `;` in `sequenceDiagram` lines, and line breaks in node labels use
   `<br/>` with the label quoted — never a literal `\n` (feedback 005 #1/#3).
   Iterate until the user approves, then write the approved ` ```mermaid ` blocks inline. These inline blocks are the source of truth.

   **Approval bar — ALL diagrams (B1/B3, feedback 005 P0/#6):** Every diagram —
   net-new and derived alike — MUST be rendered in the preview server and explicitly
   approved before it is written into `sad.md`. Derivation is NOT assumed faithful:
   conversion introduces footguns (semicolons, literal `\n`, quoting).
   **Verify the render before presenting the link (007 #1/#4).** Before serving the
   preview, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-preview.js" --verify <scratch.md>`.
   - Exit 0 with "N diagram(s) rendered OK" → every block rendered; proceed to serve
     the preview and present the `markdown_link` as a clickable Markdown link for approval.
   - Exit 1 with "Diagram N failed to render: …" → a block did not parse. Fix it and
     re-verify. **Do NOT present an approval link for a failed render** — server-up is
     not the success signal; a verified render is.
   - "render NOT verified — no browser found" → no system browser is installed; the lint
     ran instead. Present the link but tell the reviewer the figures were **not**
     render-verified in this environment.

   **C4 fallback (007 #2):** if `--verify` names a `C4Context`/`C4Container` block as
   failed, substitute a `flowchart`-with-`subgraph` boundaries equivalent for that block,
   re-verify, and tell the user you fell back from C4. Leave C4 blocks that verify intact.

   STOP for the reviewer's approval or change requests — do not batch-confirm diagrams and
   do not write them until approved. (Derive-then-confirm still covers section *text*, never
   diagrams.) Present the preview as a **clickable Markdown link** (the server's `markdown_link`
   field), never a raw URL. For a portable artifact (006 A2): pass an output path to capture
   the JS-free static page in the same step: `mermaid-preview.js --verify <scratch.md> <out.html>`
   writes it from the rendered SVGs (this closes the former manual `--static` capture step).
6. **Migrate macro-architecture out of the SDD (confirmation-gated).** If `workspace/outputs/current/architecture/sdd.md`
   already holds an `AR` table and/or C4 Context+Container diagrams (an SDD authored before the
   SAD existed), propose the migration: lift the §3 `AR-NNN` rows and the Context/Container
   Mermaid blocks into the SAD verbatim (IDs preserved), then rewrite the SDD's §3 Architecture
   Overview as references to the SAD (`architecture/sad.md`). Show the exact before/after and
   apply only on approval — no silent rewrite. Never touch the SDD's component, data, API,
   testing, or operations content.
7. Identify structural decisions with significant trade-offs and flag them as ADR candidates;
   hand each to `egp-adr-builder` and reference the resulting `ADR-NNN` in §7. Offer to set the
   ADR's `related-sad` front-matter field.
8. On finalize, before writing the file: if any gaps remain unresolved, run the
   interactive gap checkpoint (see `questioning-protocol.md` → *Interactive gap checkpoint*);
   finalize with gaps only on the user's explicit choice.
   Then populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`)
   — bump `version` and refresh `date` on an update — write `workspace/outputs/current/architecture/sad.md`, and record
   unresolved gaps in §8 Open Questions rather than leaving silent TBDs.
   Fill the `MODE-BANNER` slot with a concise orientation note (e.g., "This SAD owns the macro-architecture and AR-NNN")
   to signal the SAD's role in the documentation architecture, or leave it empty if unused.
9. Suggest running `egp-doc-sync` to refresh the traceability matrix and propagate the new
   `AR` source to the SDD.
10. **Snapshot the approved run.** After the user approves the finalized document
    and the consistency gate passes, write an immutable execution package:
    `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill egp-sad-builder --artifact architecture/sad.md`
    This records workspace/outputs/history/<run-id>/ with a manifest and the
    validation reports. Never edit files under history/.

## Rules
- The SAD owns the macro-architecture and `AR-NNN` only; detailed component/code design,
  schemas, and implementation-level security stay in the SDD.
- Confirmation-gated: propose the SDD migration, then apply on approval. No silent rewrites.
- Reuse source IDs verbatim; keep `AR-NNN` IDs stable across updates.
- **ID ownership (006 D):** Only the **owning** document puts an ID in a first
  table cell — SRS owns `FR`/`NFR`, SAD owns `AR`, each ADR owns itself.
  **Referencing** documents cite IDs in prose or in a **non-first column**. Any
  cross-doc reference/coverage table MUST be wrapped in generated markers
  (`COVERAGE-INDEX` / `ADR-INDEX` / `ADR-STATUS`) so `lint-ids` strips it.
- **Output language (006 G):** If `workspace/outputs/current/governance/import-state.json` has `outputLanguage`,
  write all prose in it; if it has `codeAndJargon`, keep identifiers, code, and
  technical jargon in that language. Absent → match the user's language.

## Guards
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored
  artifacts live under `workspace/outputs/current/`.
- **Version bump** (document `version` front-matter): patch = typo/clarification/formatting,
  no requirement change; minor = new section/requirement/ADR added (backward-compatible);
  major = restructure, or removed/renamed requirements.
