---
name: egp-release-builder
description: Create or update a Release Plan covering release strategy, environments and promotion, rollout, rollback, a release checklist, and communications. Use when a designed system is ready to ship and the team needs a repeatable deployment plan. Writes workspace/outputs/current/deployment/release.md; it follows the SDD.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-release-builder

Build or update the Release Plan at `workspace/outputs/current/deployment/release.md` from the shared template. The release plan is **optional** and follows the SDD: it turns the SDD §12 Deployment and Release design into an executable, per-release plan. It introduces no requirement IDs — reference the `FR`/`NFR` it satisfies in prose; the PRD owns them.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/release-template.md`
- SDD (if present): `workspace/outputs/current/architecture/sdd.md` — read §12 Deployment and Release for pipelines, flags, and rollback design
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol}.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md` directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/deployment/` exists. If `release.md` exists, load it and treat this as an update.
2. Read the release template and, when present, the SDD's deployment/release section. Fill each section per `questioning-protocol.md` (derive-then-confirm when the SDD or user supplies the plan; otherwise gap questions, pausing after every 4).
3. Make rollback concrete: §4 must state the trigger conditions, the exact procedure, and the recovery-time objective — never a placeholder.
4. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`) — bump `version` and refresh `date` on an update — and write the file.
5. Hand off: suggest authoring the operations runbook (`egp-ops-builder`) so the service is supportable once released.

## Rules
- A release plan assigns no `FR`/`NFR`/`AR` IDs; it references them.
- Never finalize with a placeholder rollback procedure.
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored artifacts live under `workspace/outputs/current/`.
- **Version bump** (`version` front-matter): patch = typo/clarification; minor = new checklist item/step (backward-compatible); major = changed release or rollback strategy.
