# Phase 3 — Template Metadata & ADR Relationships Design

> Status: Approved · Date: 2026-06-24 · Owner: Vivaldo
> Source: `docs/feedbacks/001-assumptions.md` (item B5)
> Scope: Third of five phases improving the `product-design-suite` plugin.

## Context

The plugin's three document templates carry no first-class metadata block. When the
feedback author regenerated the doc set, they had to invent ad-hoc `> Status / Version /
Owner / Date` blockquotes on the PRD and SDD because the templates define no such block.

The ADR template *does* have a `## 1. Metadata` table (Status, Date, Author, Reviewers,
Related PRD/SDD/ADRs), but it has no first-class relationship fields for one ADR
superseding or amending another. The author worked around this by overloading the `Status`
string with parentheticals — e.g. `Accepted (amended in scope by ADR-014)` — which is not
machine-readable and mixes lifecycle state with cross-references.

This spec covers **Phase 3** of the five-phase roadmap derived from the feedback:

1. Diagrams (B1+B2+B3+B10) — shipped (Phase 1).
2. Traceability (B4+B8) — shipped (Phase 2).
3. **Template metadata & ADR relationships (B5)** — this spec.
4. Authoring flow: import + derive-then-confirm (B6+B7) — later cycle.
5. SRS support (B9) — later cycle.

## Decisions (confirmed)

- **Metadata format:** YAML front-matter at the top of every generated doc — the single
  source of truth. GitHub renders it as a table, and it is cleanly machine-readable for
  future automation. The author's ad-hoc blockquotes are replaced by it.
- **Automation scope:** Templates + builder/doc-sync wiring + convention tests. **No new
  runtime script** this phase (a metadata-lint script that flags asymmetric supersede/amend
  links was considered and deferred — YAGNI; `egp-doc-sync` reports asymmetry as a
  confirmation-gated proposed edit instead).
- **ADR `## 1. Metadata` table:** dropped. Everything it held moves into front-matter,
  joined by the new relationship fields. No duplication. The remaining ADR body sections
  renumber down by one (§2→§1 … §8→§7); `## Status History` stays at the end.

## Goal & Non-Goals

**Goal:** Give all three templates a first-class YAML front-matter metadata block, add
structured `supersedes` / `superseded-by` / `amends` / `amended-by` relationship fields to
the ADR, restore `Status` to a clean enum, and wire the builder skills and `egp-doc-sync` to
populate and maintain the metadata. Lock the convention with tests.

**Non-goals:** Phases 4–5. No metadata-lint script. No new ID families. No change to the
PRD/SDD body section structure. No diagram or traceability-engine changes. PRD/SDD keep
their relationship references in their existing body sections — only the ADR gains
structured relationship fields, since that is what B5 calls out.

## Metadata Model (front-matter contract)

**PRD and SDD** — identical five-field block:

```yaml
---
title: <Document title>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.2.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---
```

**ADR** — scalar metadata + structured relationships:

```yaml
---
id: ADR-<NNN>
title: <Decision title>
status: <Proposed | Accepted | Superseded | Deprecated | Rejected>
date: <YYYY-MM-DD>
author: <Name or team>
reviewers: [<Name or team>, ...]
supersedes: [ADR-<NNN>, ...]
superseded-by: [ADR-<NNN>, ...]
amends: [ADR-<NNN>, ...]
amended-by: [ADR-<NNN>, ...]
related-prd: ["<PRD section/ID reference>", ...]
related-sdd: ["<SDD section reference>", ...]
related-adrs: [ADR-<NNN>, ...]
---
```

Rules:

- Front-matter is delimited by `---` on its own line at the very start of the file and a
  closing `---` before the first heading.
- List fields are always present; an empty relationship is `[]`, not omitted, so the field
  set is stable for parsing.
- `status` is a single enum value — lifecycle state only. Supersede/amend relationships live
  exclusively in their own fields, never as parenthetical text appended to `status`.
- Relationship fields are **bidirectional**: if ADR-A lists `supersedes: [ADR-B]`, then
  ADR-B must list `superseded-by: [ADR-A]`. Likewise for `amends`/`amended-by`. The builder
  sets both ends; `egp-doc-sync` reports any asymmetry.

## ADR Template Restructure

`shared/templates/adr-template.md`:

- Add the front-matter block above the `# ADR-<NNN>: <Decision Title>` H1.
- **Remove** the `## 1. Metadata` table entirely (its rows are now front-matter).
- Renumber the remaining sections: `## 2. Context` → `## 1. Context`, `## 3. Options
  Considered` → `## 2. Options Considered`, … `## 8. References` → `## 7. References`.
- Keep `## Status History` (unnumbered) at the end — it is the human-readable chronological
  log, complementary to the machine-readable front-matter.

## PRD / SDD Template Changes

- `shared/templates/prd-template.md`: add the five-field front-matter block above the
  `# PRD: <Product or Initiative Name>` H1. Body unchanged.
- `shared/templates/sdd-template.md`: add the five-field front-matter block above the
  `# SDD: <System or Initiative Name>` H1. The Phase 2 additions (§16 Requirement Coverage
  Index marker region, §17 Appendices) are untouched. Front-matter at the top does not
  intersect the coverage-index region near the end, so `traceability.js` injection still
  works unchanged.

## Workflow Wiring

- `skills/egp-adr-builder/SKILL.md`: populate the front-matter; keep `status` a clean enum;
  on supersede/amend, set the field on the new ADR **and** the reciprocal field
  (`superseded-by` / `amended-by`) on the target ADR. Update the step that currently says
  "Link related PRD/SDD sections in the Metadata block" to reference the front-matter fields,
  and the supersede step to set the structured fields rather than overload Status.
- `skills/egp-prd-builder/SKILL.md` and `skills/egp-sdd-builder/SKILL.md`: populate the
  front-matter on create; bump `version` and refresh `date` on update.
- `skills/egp-doc-sync/SKILL.md`: in the impact-report step, read the ADR relationship fields
  to find affected ADRs, and add a check that supersede/amend links are symmetric — report
  any asymmetric or dangling link as a concrete proposed edit (confirmation-gated, no
  auto-fix, consistent with the skill's existing rules).
- `shared/references/structures.md` and `shared/references/concepts.md`: document the
  front-matter convention and the ADR relationship fields, and note that `Status` is a clean
  enum with supersede/amend tracked structurally.

## Testing

New `tests/metadata-conventions.test.js` asserts:

- Each of the three templates begins with a `---` front-matter block (opening `---` on line
  1, a matching closing `---`).
- ADR front-matter declares the keys `id`, `status`, `supersedes`, `superseded-by`,
  `amends`, `amended-by` (and `related-adrs`).
- PRD and SDD front-matter declare `title`, `status`, `version`, `owner`, `date`.
- The ADR template no longer contains a `## 1. Metadata` heading, and its Context section is
  now `## 1. Context`.
- (Doc wiring, mirroring the Phase 2 convention test) the builder skills and references
  mention the front-matter / relationship fields.

The Phase 1 and Phase 2 suites — including `traceability-conventions.test.js` (SDD §16
markers + §16/§17 headings) and `e2e-smoke` — must continue to pass. Run with
`node --test tests/*.test.js`.

## Open Questions

None outstanding. Three points were settled during design: (a) front-matter is the single
source of truth and the ad-hoc blockquotes are dropped; (b) the ADR `## 1. Metadata` table
is removed and sections renumber, rather than keeping a near-empty pointer section;
(c) no metadata-lint script this phase — `egp-doc-sync` reports asymmetry as a proposed edit.
