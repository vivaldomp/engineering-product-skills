---
description: Promote a run package from workspace/outputs/history/ to a named release under workspace/outputs/releases/. Use when a finalized run should become v1, v2, or a named release.
argument-hint: --run <run-id> [--as <name>] [--force]
---
Promote an immutable run package to a named release.

Run:

`node "${CLAUDE_PLUGIN_ROOT}/scripts/promote.js" --run <run-id> [--as <name>] [--force]`

- `--run` is a directory name under `workspace/outputs/history/`, e.g. `2026-07-15T103422`.
- `--as` names the release; omit it to take the next free `vN`.
- A gate-failed run is refused. `--force` promotes it anyway and records
  `"forced": true` in `release.json`.

Releases land in `workspace/outputs/releases/<name>/` with `release.json` and a
full `artifacts/` copy. Releases are immutable: never edit files under
`workspace/outputs/releases/` or `workspace/outputs/history/`.

To list available runs: `ls workspace/outputs/history/`
