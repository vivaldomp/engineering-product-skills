# Feedback 008 — Phase 2: Metadata, Releases, Graph, Receipts

**Date:** 2026-07-15
**Source:** `docs/feedbacks/008-improvements.md`
**Builds on:** `docs/superpowers/specs/2026-07-15-feedback-008-workspace-structure-design.md` (foundation phase, shipped)
**Status:** Approved design

## Summary

The foundation phase delivered the workspace layout, immutable run packages with
`manifest.json`, and validation-first outputs. This phase builds the four
subsystems that phase deferred: per-file metadata sidecars, release promotion,
a machine-readable engineering graph, and per-run receipts plus telemetry.

Nothing in the foundation layout changes shape. `snapshot.js` gains steps;
three new scripts and one new command join the suite.

## Scope

All four deferred subsystems are in scope. Two carry deliberate deviations from
the feedback document, recorded under "Deviations from the feedback" below.

## Directory layout (additions only)

```text
workspace/outputs/
├── current/
│   ├── planning/prd.md
│   ├── planning/prd.meta.json          NEW  sidecar, live
│   └── governance/
│       ├── traceability.{md,html}           (existing)
│       ├── traceability.json           NEW  requirement matrix, serialized
│       └── artifacts.graph.json        NEW  nodes + edges
├── history/<run-id>/                        (existing shape, unchanged)
│   └── artifacts/**/*.meta.json        NEW  frozen sidecars
└── releases/                           NEW
    └── v1/
        ├── release.json                     provenance for the release
        └── artifacts/                       full copy from the promoted run

.engineering/
├── config.yaml                              (existing)
├── receipts/<run-id>.json              NEW  full per-run receipt
└── telemetry/runs.jsonl                NEW  one compact line per run
```

## Metadata sidecars

### Shape

`planning/prd.md` gets `planning/prd.meta.json`:

```json
{
  "skill": "egp-prd-builder",
  "template": "prd-template.md",
  "author": "product-design-suite@0.1.1",
  "generatedAt": "2026-07-15T19:34:22.000Z",
  "runId": "2026-07-15T193422",
  "hash": "sha256:<hex of the document bytes>",
  "inputs": [],
  "dependsOn": []
}
```

### Coverage

Sidecars cover **authored** artifacts:

- the four known documents (`prd.md`, `srs.md`, `sad.md`, `sdd.md`),
- every file under `architecture/adr/`,
- `egp-import`'s governance artifacts: `governance/import-gap-report.md`,
  `governance/import-map.json`, `governance/import-state.json`.

They do **not** cover **regenerated** outputs: `traceability.{md,html,json}`
and `artifacts.graph.json`. Hashing a file the suite rewrites on every finalize
carries no information — its hash can never signal drift, because nothing but
the generator ever changes it. Import artifacts, by contrast, are authored once
and then read by downstream builders, so provenance and drift both matter.

Sidecars are named by replacing the artifact's extension: `prd.md` →
`prd.meta.json`, `import-map.json` → `import-map.meta.json`.

The `template` value resolves as `TEMPLATE_FOR[rel]` for the four known
documents, `'adr-template.md'` for any file under `architecture/adr/`, and
`null` for import artifacts (they have no template). `TEMPLATE_FOR`
deliberately gains **no** ADR entry: it is keyed by exact document path, and
`validate-structure.js` iterates its entries calling `existsSync` on each key,
so a directory-shaped key would break that loop. ADR resolution lives in
`meta.js`.

### Refresh rule (load-bearing)

On each snapshot, for every covered document:

- If a sidecar exists and its `hash` **still matches** the file, the sidecar is
  left byte-for-byte alone. Original provenance is preserved.
- If the hash differs, or no sidecar exists, the sidecar is rewritten with the
  current run's `runId`, `hash`, and `generatedAt`. When an earlier sidecar was
  present, its `skill` value is preserved; `skill` is taken from the finalizing
  run only when creating a sidecar from scratch.

A sidecar therefore records the run that last **changed** that document, not
merely the last run that occurred. This is what makes the drift signal work:
after a finalize, `--check` reports `MODIFIED` for exactly those documents
hand-edited since.

Attribution has a known limit: if a document is hand-edited and a *different*
skill finalizes the next run, that document's sidecar gets the new `runId`
while keeping its original `skill`. The common case — a document's sidecar
created during its own builder's run — attributes correctly.

### `--check` exit code

`node scripts/meta.js --check [dir]` prints one line per covered document
(`OK` / `MODIFIED` / `MISSING`) and **always exits 0**. `MODIFIED` is the normal
state while authoring; a non-zero exit would pull drift into the consistency
gate, where it does not belong.

## Release promotion

### Model

Promotion sources **only** from `workspace/outputs/history/<run-id>/`. Promoting
the live `current/` tree is not supported — it would produce a release that no
gate ever validated.

```bash
node scripts/promote.js --run 2026-07-15T193422 [--as v1] [--force] [--root .]
```

- Reads the run's `manifest.json`. If `status !== 'success'` and `--force` is
  absent, exits non-zero naming the gate error count and pointing at the run's
  `validation/gate.json`.
- Destination is `workspace/outputs/releases/<name>`, where `name` is `--as` or
  the next free `vN` (scan `/^v(\d+)$/`, max + 1). An existing destination is
  refused.
- Copies the run's `artifacts/` into `releases/<name>/artifacts/`.
- Writes `release.json`.

### release.json

```json
{
  "release": "v1",
  "runId": "2026-07-15T193422",
  "promotedAt": "2026-07-15T20:10:00.000Z",
  "fromStatus": "success",
  "forced": false,
  "artifacts": ["planning/prd.md", "..."]
}
```

`--force` sets `"forced": true`, making an override permanently visible.

### Command

`/egp-promote` — one new user-facing command wrapping the script. Promotion is a
deliberate human action; `meta` and `graph` need no command because `snapshot`
drives them automatically.

## Engineering graph

### Files

Both written into `governance/` on each finalize:

- **`traceability.json`** — the object `traceability.js`'s `buildMatrix()`
  already returns, serialized. No second computation.
- **`artifacts.graph.json`** — document-level nodes and edges.

`lineage.json` is **not** emitted. PRD→SRS→SAD→SDD is a fixed pipeline in this
suite; a file restating a constant carries no information. The constant lives
once, in code, where it generates real edges.

### Shape

```js
buildGraph(root) -> {
  nodes: [{ id: 'planning/prd.md', type: 'prd', skill, runId, hash }],
  edges: [{ from, to, kind: 'dependsOn' | 'shared-refs', count }]
}
impact(graph, fileRel) -> [{ file, via }]
```

- Nodes come from the sidecars, so the graph inherits their provenance.
- `dependsOn` edges come from the `DEPENDS` constant: srs→prd, sad→srs,
  sdd→sad, and every `architecture/adr/*` → sad.
- `shared-refs` edges are derived per-run from the requirement matrix: two
  documents citing the same requirement IDs get one edge carrying the shared-ID
  `count`. These are undirected in meaning, so `from`/`to` are normalized in
  lexicographic order to avoid duplicate pairs.

### Impact query

```bash
node scripts/graph.js --impact architecture/sad.md
```

Walks `dependsOn` transitively in reverse (what depends on this, and what
depends on those), then lists `shared-refs` neighbours with their counts. This
answers the feedback's stated motivation: "Architecture changed → regenerate
OpenAPI, Tests, ADRs."

## Receipts and telemetry

### Storage

No `execution.db`. `.engineering/receipts/<run-id>.json` holds the full per-run
receipt; `.engineering/telemetry/runs.jsonl` is an append-only compact index,
one line per run. Rationale: the suite is strictly zero-dependency, and the only
built-in SQLite (`node:sqlite`) is experimental and version-gated — depending on
it would break the plugin on older Node while still requiring a fallback path.
JSONL answers every query at this scale, greps cleanly, and merges under git
where a binary database conflicts.

### Receipt vs manifest

They do not overlap beyond the `runId`/`status` join key:

- `manifest.json` (inside the package) — **what the run produced**: artifact
  list, primary artifact, status.
- `receipt.json` (in `.engineering/`) — **how it ran**: skill, plugin version,
  Node version, `finishedAt`, status, gate error details, lint counts.

Receipts live outside the packages deliberately: pruning old history to reclaim
space still leaves the audit trail intact.

### runs.jsonl line

```json
{"runId":"2026-07-15T193422","skill":"egp-prd-builder","status":"success","finishedAt":"...","artifactCount":9,"gateErrors":0}
```

### Failure policy

If the receipt or telemetry write fails, `snapshot` **warns and exits 0**. The
history package is already written, validated, and complete at that point;
failing the finalize would discard a good package to protect a derived index.

## Changes to snapshot.js

The existing flow gains three steps and one reordering:

1. `runId` and destination computation move **before** the copy (sidecars need
   the run id).
2. Gate + lint run (unchanged).
3. `meta.writeSidecars({ root: current, skill, runId, now, version, inputs })`,
   where `inputs` is the `workspace/inputs/` listing when
   `skill === 'egp-import'` and `[]` otherwise.
4. `graph` writes `traceability.json` and `artifacts.graph.json` into
   `current/governance/`.
5. Copy `current/` → `<dest>/artifacts/` (unchanged) — the package is
   self-contained, carrying sidecars and graph files.
6. Validation files + `manifest.json` (unchanged). Sidecars appear in
   `manifest.artifacts`: they are real files the run produced.
7. Receipt written to `.engineering/receipts/<run-id>.json`; one line appended
   to `.engineering/telemetry/runs.jsonl`.
8. `ensureConfig` (unchanged).

## Code-change map

### New modules

| File | Purpose |
| --- | --- |
| `scripts/meta.js` | `writeSidecars({root, skill, runId, now, version, inputs}) -> {written, preserved}`; `checkSidecars(root) -> [{file, status, runId}]`; `coveredDocs(root)`; `sidecarPath(rel)`; `hashFile(abs)`. CLI: `--check`. |
| `scripts/graph.js` | `buildGraph(root)`; `impact(graph, fileRel)`. CLI: writes both JSON files, or `--impact <rel>`. |
| `scripts/promote.js` | `promote({run, as, force, projectRoot}) -> {dest, release}`; `nextVersion(releasesDir)`. CLI: `--run/--as/--force/--root`. |
| `commands/egp-promote.md` | User-facing promotion command. |

### Updated assets

- `scripts/workspace-paths.js` — add `RELEASES`, `RECEIPTS`, `TELEMETRY`,
  `DEPENDS`, and `TEMPLATE_FOR`. The last one **moves here** from
  `validate-structure.js`, which now imports it: `meta.js` is a second consumer,
  and the layout module is already the single source of truth for such
  constants.
- `scripts/validate-structure.js` — import `TEMPLATE_FOR` from
  `workspace-paths.js` instead of defining it.
- `scripts/snapshot.js` — the flow above.
- `skills/egp-import/SKILL.md` — gains the finalize snapshot step described
  under "The `inputs` field".
- `shared/references/structures.md` — the four names this phase makes real
  (`outputs/releases/`, `.engineering/receipts/`, `.engineering/telemetry/`, and
  sidecars) move out of the reserved list and get documented. `execution.db`
  moves from reserved to explicitly rejected, with the JSONL rationale.

## Deviations from the feedback

Three, each recorded so a later reader does not mistake them for oversights:

1. **No `duration` field.** The feedback's `"duration": 42` cannot be honestly
   produced. `snapshot.js` is invoked at finalize and can measure only its own
   runtime — milliseconds — not the session that authored the document. Same
   reasoning that kept conversation capture out of the foundation phase. Only
   `finishedAt` is recorded.
2. **No `execution.db`.** Replaced by receipts + JSONL, per the rationale above.
3. **No `current -> run003` symlink.** The feedback models `current/` as a
   pointer to a promoted run. The foundation phase established `current/` as the
   live, editable working tree, which the whole suite now depends on. Promotion
   therefore flows `history/<run-id>` → `releases/<name>` only, and `current/`
   is never a symlink.

### The `inputs` field

`egp-import` is the one skill that genuinely reads `workspace/inputs/`, so it is
the one skill whose `inputs` can be populated honestly. It currently has **no**
finalize snapshot — only the five builders do — so this phase gives it one:

```bash
node scripts/snapshot.js --skill egp-import --artifact governance/import-gap-report.md
```

On a run where `skill === 'egp-import'`, `snapshot` lists `workspace/inputs/`
and passes it to `writeSidecars`, which records it as `inputs` on the sidecars
it writes during that run. Every other run passes an empty array rather than
inventing values. This is why import artifacts must be sidecar-covered: they are
the only artifacts an import run writes.

A side effect worth stating: import runs now produce history packages like any
other finalize, which they arguably always should have.

## Testing

Test command is `node --test tests/*.test.js` — the bare-directory form fails on
this Node version.

- **`tests/meta.test.js`** — drift detection (write → hand-edit → `MODIFIED`);
  provenance preservation across two snapshots (an untouched document keeps its
  original `runId`/`skill` while a changed one takes the new run's); `MISSING`
  for an absent sidecar; regenerated reports (`traceability.md`) get no sidecar
  while import artifacts do; `inputs` recorded on an `egp-import` run and empty
  otherwise.
- **`tests/graph.test.js`** — `dependsOn` edges from the constant;
  `shared-refs` edges derived from real requirement IDs, with counts and no
  duplicate pairs; transitive `--impact`; missing documents produce no node
  rather than a crash.
- **`tests/promote.test.js`** — first promote → `v1`, second → `v2`;
  gate-failed refused; `--force` promotes and records `"forced": true`;
  existing destination refused; `--as` honoured.
- **`tests/snapshot.test.js`** (updated) — packages carry sidecars and both
  graph files; receipt written; two runs append exactly two `runs.jsonl` lines.

## Acceptance criteria

1. Finalize writes sidecars into `current/` and frozen copies into the package;
   unchanged documents retain provenance across runs.
2. `governance/traceability.json` and `artifacts.graph.json` are emitted on each
   finalize; `--impact <file>` lists downstream documents.
3. `promote` produces `releases/vN/` with a valid `release.json`, and refuses
   gate-failed runs without `--force`.
4. Each run leaves `.engineering/receipts/<run-id>.json` and exactly one
   `runs.jsonl` line.
5. `structures.md` reflects what is now real; `execution.db` is documented as
   rejected, not pending.
6. Full test suite passes (188 existing + new).

## Global constraints

Carried from the foundation phase:

- Node built-ins only — zero dependencies.
- CommonJS modules; `node:test` for tests.
- Test command: `node --test tests/*.test.js`.
- `workspace-paths.js` remains the single source of truth for layout constants.
