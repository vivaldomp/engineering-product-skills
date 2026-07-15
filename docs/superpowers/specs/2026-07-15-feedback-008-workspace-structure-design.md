# Feedback 008 — Workspace Artifact Structure (Foundation Phase)

**Date:** 2026-07-15
**Source:** `docs/feedbacks/008-improvements.md`
**Status:** Approved design, foundation phase only

## Summary

Migrate the product-design-suite's output layout from a flat `.product/` directory
to the 008 feedback's workspace model: a `workspace/` tree in the user's project
holding inputs, a live editable `outputs/current/` organized by engineering-purpose
taxonomy, and immutable `outputs/history/<run-id>/` execution packages with
machine-readable manifests and first-class validation reports, plus a minimal
`.engineering/config.yaml`. The migration is a hard cut: the new structure is the
single source of truth, with a one-shot migration script for existing `.product/`
directories.

## Scope decision (phasing)

The 008 feedback bundles six subsystems. This spec covers the **foundation phase**
only:

1. New directory layout + engineering-purpose taxonomy — **in scope**
2. Run packaging with `manifest.json` + validation reports — **in scope**
3. Per-file metadata sidecars (`*.meta.json`) — **deferred** (phase 2+)
4. Release promotion (`releases/`, `eps promote`) — **deferred** (phase 2+)
5. Engineering graph (`artifacts.graph.json`, lineage) — **deferred** (phase 2+)
6. Receipts / telemetry / `execution.db` — **deferred** (phase 2+, may never be
   needed; git covers most of it)

Deferred subsystems get **reserved directory names** documented in
`structures.md` so future phases have a home, but no code and no empty
directories are created for them.

## Directory layout (user's project)

```text
workspace/
├── inputs/                      # user-supplied source material (briefs, legacy docs for egp-import)
└── outputs/
    ├── current/                 # live, editable working tree — replaces .product/
    │   ├── planning/
    │   │   └── prd.md
    │   ├── specifications/
    │   │   └── srs.md
    │   ├── architecture/
    │   │   ├── sad.md
    │   │   ├── sdd.md
    │   │   └── adr/ADR-NNN-<slug>.md
    │   ├── ux/                  # openui HTML previews
    │   ├── governance/          # traceability.{md,html}, import-map.json, import-state.json, gap reports
    │   └── exports/             # rendered diagram previews (mermaid-preview output)
    └── history/
        └── <run-id>/            # immutable snapshot packages

.engineering/
└── config.yaml                  # layout schema version + plugin version that created it
```

### Taxonomy mapping

| Artifact | Location |
| --- | --- |
| PRD | `planning/prd.md` |
| SRS | `specifications/srs.md` |
| SAD | `architecture/sad.md` |
| SDD | `architecture/sdd.md` |
| ADRs | `architecture/adr/ADR-NNN-<slug>.md` |
| Traceability reports | `governance/traceability.{md,html}` |
| Import artifacts (`import-map.json`, `import-state.json`, gap report) | `governance/` |
| UI previews (openui) | `ux/` |
| Rendered diagram previews | `exports/` |

Reserved (documented, not created): `discovery/`, `implementation/`, `tests/`,
`deployment/`, `operations/` under the taxonomy; `outputs/releases/`,
`workspace/reports/`, `workspace/cache/`, `workspace/state/`;
`.engineering/{execution.db,receipts/,telemetry/}`.

Directories are created only when a skill actually writes into them.

## Run model: snapshot on finalize

Skills edit documents live in `workspace/outputs/current/`, exactly as they edit
`.product/` today. A history package is written **only at finalize** — when a
document passes its consistency gate and the user approves. The builder's
finalize step calls:

```bash
node scripts/snapshot.js --skill egp-prd-builder --artifact planning/prd.md
```

### Package contents

```text
workspace/outputs/history/<run-id>/     # run-id = local ISO timestamp, filesystem-safe
├── manifest.json
├── artifacts/            # full copy of outputs/current/ at that moment
└── validation/
    ├── gate.json          # consistency-gate result (machine-readable)
    ├── lint.json          # lint-ids result
    └── traceability.md    # copy of the traceability report, when present
```

- **Full copy of `current/`**, not just the finalized doc: packages stay
  self-contained and any two runs are diffable with `diff -r`.
- `snapshot.js` **runs the consistency gate itself** and records the result — a
  package cannot exist without validation. A failing gate still writes the
  package, with `"status": "gate-failed"`, so the audit trail is honest.
- No conversation/prompt capture: the shell script cannot reliably access the
  conversation. The manifest's artifact list is the provenance record.

### manifest.json

```json
{
  "runId": "2026-07-15T193422",
  "skill": "egp-prd-builder",
  "pluginVersion": "<read from plugin.json>",
  "status": "success | gate-failed",
  "finishedAt": "2026-07-15T19:34:22-03:00",
  "primaryArtifact": "planning/prd.md",
  "artifacts": ["planning/prd.md", "..."],
  "validation": { "gatePass": true }
}
```

`artifacts` lists every file under `artifacts/`, relative to it.
`.engineering/config.yaml` holds `layoutVersion: 1` and the plugin version that
created the workspace; `snapshot.js` creates it if missing.

## Backward compatibility: hard cut + migration helper

- All scripts and skills read **only** the new layout. No dual-path fallback.
- New `scripts/migrate-workspace.js` performs a one-shot move of an existing
  `.product/` into `workspace/outputs/current/` using the taxonomy mapping.
  It refuses to run if `workspace/` already exists, and prints a summary of
  what moved where.
- `validate-structure.js` flags a stray legacy `.product/` directory and points
  the user at the migration script.

## Code-change map

### New modules

| File | Purpose |
| --- | --- |
| `scripts/workspace-paths.js` | Single source of truth for the layout: canonical root (`workspace/outputs/current`), taxonomy subpaths, doc locations (`prdPath()`, `srsPath()`, `sadPath()`, `sddPath()`, `adrDir()`, …), history dir, `.engineering/` paths, and the CLI-arg override resolver the scripts already support. Mirrors the `id-conventions.js` centralization pattern. |
| `scripts/snapshot.js` | Builds the run package: copies `current/`, runs consistency gate + ID lint, writes `manifest.json` and `validation/`, creates `.engineering/config.yaml` if missing. |
| `scripts/migrate-workspace.js` | One-shot `.product/` → `workspace/outputs/current/` mover with the taxonomy mapping. Refuses to overwrite; prints a move summary. |

### Updated assets

- **Scripts (7):** `traceability.js`, `lint-ids.js`, `consistency-gate.js`,
  `mermaid-lint.js`, `validate-structure.js`, `adr-index.js`,
  `mermaid-preview.js` import `workspace-paths.js`; default target becomes
  `workspace/outputs/current`. The explicit-directory CLI argument keeps
  working. `traceability.js`'s SAD-existence check (AR ownership) keys off
  `architecture/sad.md`. `validate-structure.js` validates the taxonomy layout.
- **Skills (8 SKILL.md) and commands (7):** every `.product/...` reference
  becomes the new canonical path; each builder's finalize step adds the
  `snapshot.js` call after user approval.
- **Templates (5) and shared references** (`structures.md`, `concepts.md`,
  `id-conventions.md`, and others as applicable) **+ README:** paths, examples,
  and the recommended-structure section updated; reserved taxonomy names
  documented in `structures.md`.

## Testing

- New: `workspace-paths.test.js`; `snapshot.test.js` (manifest shape,
  gate-failed status, full-copy fidelity); `migrate-workspace.test.js`
  (mapping correctness, refuses-overwrite).
- Updated: all existing test files whose fixtures assume `.product/`;
  `e2e-smoke.test.js` exercises a fixture `workspace/` end-to-end.
- Acceptance sweep: `grep -r "\.product" plugins/ tests/ README.md` returns
  zero hits outside `migrate-workspace.js` (which legitimately names the
  legacy path) — satisfying 008's "no AI asset references deprecated output
  paths" criterion.

## Acceptance criteria (foundation phase)

1. Every skill and command references only `workspace/` paths.
2. Every script defaults to `workspace/outputs/current` and operates correctly
   on the taxonomy layout.
3. Finalize in any builder produces a `history/<run-id>/` package with a valid
   manifest and validation reports.
4. `migrate-workspace.js` converts a populated legacy `.product/` fixture into
   the new layout without data loss.
5. Full test suite passes; the legacy-path grep sweep is clean.
