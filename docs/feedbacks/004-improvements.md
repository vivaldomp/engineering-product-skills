# assumptions004 — Feedback on the `product-design-suite` plugin

**Date:** 2026-06-25
**Reviewer:** Claude (Opus 4.8) — based on building the full `.product/` suite for Application Demo
**Plugin reviewed:** `product-design-suite` v0.1.1 (`~/.claude/plugins/cache/engineering-product-skills/product-design-suite/0.1.1`)
**Basis:** Read all 5 templates (`prd/srs/sad/sdd/adr`), the `egp-import` skill, the
references (`id-conventions.md`, `concepts.md`, `structures.md`, `questioning-protocol.md`),
and the `traceability.js` / `consistency-gate.js` scripts; compared them against the
documents actually produced this session.

---

## 1. Did I create anything outside the plugin's orientations?

### Files / artifacts — **No.**
Everything was authored inside `.product/` as the workflow requires. The only non-`.product/`
files are scratch render/preview files (written to the system temp dir and cleaned up) and
**this file**, which exists only because it was explicitly requested. The two import JSONs
(`import-map.json`, `import-state.json`) and `import-gap-report.md` are **prescribed outputs**
of `egp-import` (confirmed in its SKILL.md Output section), not improvised artifacts. `docs/`
was never touched.

### Sections / structure inside files — **Yes, a few genuine deviations.**
After comparing the produced SDD to `sdd-template.md`, I introduced structural divergences
(content-complete, but off-template):

1. **Collapsed discrete template subsections into combined headings (SDD).**
   - §9 Observability: the template has separate `Distributed Traces`, `Dashboards`,
     `Correlation IDs`, `Operational Diagnostics` subsections; I merged them under one heading
     `Distributed Traces / Dashboards / Correlation IDs / Operational Diagnostics`.
   - §10 Resilience: template has separate `Retry Policy`, `Circuit Breakers`, `Timeouts`,
     `Fallbacks`, `Idempotency`, `Disaster Recovery`; I merged into `Retry / Timeouts / Fallbacks`.
   - §14 Operations: template has separate `SLOs`, `SLAs`, `Capacity Planning`; I merged
     SLO/SLA into `Service-Level Objectives` and folded Capacity Planning into the status-table
     note, and reordered the subsections.
2. **Altered a prescribed table schema (SDD §9 Alerts).** Template columns are
   `Alert | Condition | Severity | Runbook | Owner`; I authored `Alert | Condition | Routes to`,
   dropping Severity/Runbook/Owner.
3. **Minor embellishments** beyond the bare template (color-coded zones + legend on the SAD
   data-flow diagram; RED-method framing in §9). These are within the builders' stated latitude
   (the `egp-sad-builder` explicitly allows a trust-boundary flowchart), but worth noting.

Everything *else* I might have suspected as an addition turned out to be **template- or
skill-sanctioned**: the `designed|partial|gap|n/a` concern-status tables, the §16 COVERAGE-INDEX
markers, the §17 "add subsections as needed" escape hatch, OKRs/personas/stakeholders in the PRD,
the ADR `Decision Owner` / `Approval Notes` / `Decision Scope` / `Accepted Risks` subsections,
the C4 Deployment diagram, and the MODE-BANNER slots.

**Net:** no rogue files; a handful of structural consolidations in the SDD that a strict
template-structure validator would (rightly) flag. These were reasonable editorial choices for a
small system, but they are off-template and I should have either kept the prescribed headings or
surfaced the consolidation explicitly.

---

## 2. Proposed plugin improvements (prioritized)

### High value

- **IMP-1 — Template placeholder IDs collide with the traceability scanner.**
  `srs-template.md` (lines 72, 85–86), `prd-template.md`, `adr-template.md`, etc. use *real-looking*
  example IDs (`FR-001`, `NFR-001`, `NFR-002`, `AR-001`, `UAT-001`, `ADR-001`). The scanner
  (`traceability.js` TOKEN_RE/GROUP_RE) treats any ID-shaped token in prose as a requirement, so
  leftover/example IDs surface as **phantom orphans** — this cost a manual fix this session
  (the "NFR-001" orphan). Fix options: (a) use non-matching placeholders in templates
  (`FR-NNN` / `NFR-«n»`); (b) make the scanner ignore IDs inside inline-code/example fences;
  (c) only treat an ID as *defined* when it appears in its owning document's canonical
  requirement **table**, not anywhere in prose.

- **IMP-2 — Scripts are cwd-sensitive and can report a false PASS.**
  `traceability.js`/`consistency-gate.js` resolve the target via a relative path. When the shell
  cwd had drifted into `.product/`, `traceability.js` threw `ENOENT` on write **but the gate still
  printed `PASS`** against an effectively empty read. Harden: resolve the base dir to an absolute
  path, and **fail loudly** when zero requirements/files are found instead of passing vacuously.

- **IMP-3 — Add a template-structure validator to the consistency gate.**
  Nothing detects when a builder drops, renames, or merges a template subsection (see §1). A
  `validate-structure.js` that checks each `.product/*.md` against its template's required headings
  (and flags merged/renamed ones) would catch drift like my §9/§10/§14 consolidations and the
  altered Alerts table.

- **IMP-4 — Auto-generate an ADR index and auto-sync ADR status.**
  ADR status + titles are duplicated by hand in `SDD §15`, `SDD §2 Related ADRs`, and
  `SAD §7/§1`. Driving ADR-017→Accepted and adding ADR-018 meant editing **5–7 places** and risked
  drift. Generate `.product/adr/index.md` and **populate the SDD §15 `Status` column from each
  ADR's front-matter** during `egp-doc-sync` (same mechanism as the §16 coverage index), so
  front-matter is the single source of truth.

### Medium value

- **IMP-5 — Add a `planned` (not-yet-built) status distinct from `gap`.**
  The `designed|partial|gap|n/a` enum forced me to mark whole subsystems (Registry API,
  telemetry) as `gap` purely because they aren't built yet — conflating "designed but unbuilt"
  with "design missing." A first-class `planned` value (or a per-section maturity tag) would read
  far more honestly.

- **IMP-6 — Lint inline Mermaid in the gate.**
  A real syntax error (semicolons in `sequenceDiagram` text) was caught only by a manual headless
  render. A `mermaid-lint` step (render every inline block, fail on parse error) in
  `consistency-gate.js` would catch this automatically.

- **IMP-7 — Extend reciprocity checks to `related-*` links.**
  The gate verifies `supersedes`/`amends` reciprocity but not `related-adrs`. Adding ADR-018 meant
  manually editing ADR-015's `related-adrs`. At minimum, warn on one-directional `related-adrs`
  links.

- **IMP-8 — Clarify the gate's "duplicate" report.**
  `id-lint: 0 malformed, 139 duplicate` always passes and looks alarming. Cross-document *mentions*
  of the same ID are expected; *duplicate definitions* are not. Separate the two counts (or label
  the expected one) so the number is meaningful.

### Lower value / polish

- **IMP-9 — Guard the `docs/` read-only convention.** It's enforced only by discipline; an optional
  pre-write check or explicit reminder in each builder would prevent accidental edits to the import
  source.
- **IMP-10 — Consolidated decision ledger.** Derive-then-confirm still produced many separate
  question rounds. A single structured "open decisions + recommended defaults" doc per builder run
  would streamline confirmation.
- **IMP-11 — Version-bump guidance.** No builder rule says when to bump `version` semver on edits;
  I chose patch/minor by judgment. A short heuristic in the builders would keep this consistent.