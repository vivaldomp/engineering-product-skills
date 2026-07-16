---
name: egp-ops-builder
description: Create or update an Operations Runbook covering service overview, on-call ownership, observability signals, common incidents, routine operations, and recovery. Use when a released service needs a support and incident-response guide. Writes workspace/outputs/current/operations/runbook.md; it follows the SDD.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-ops-builder

Build or update the Operations Runbook at `workspace/outputs/current/operations/runbook.md` from the shared template. The runbook is **optional** and follows the SDD: it operationalizes the SDD §9 Observability design into an on-call support guide. It introduces no requirement IDs — reference any in prose; the PRD owns them.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/runbook-template.md`
- SDD (if present): `workspace/outputs/current/architecture/sdd.md` — read §9 Observability (dashboards, alerts, correlation IDs)
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol}.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md` directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/operations/` exists. If `runbook.md` exists, load it and treat this as an update.
2. Read the runbook template and, when present, the SDD's observability section. Fill each section per `questioning-protocol.md` (derive-then-confirm when the SDD or user supplies the material; otherwise gap questions, pausing after every 4).
3. Make §4 Common Incidents actionable: each row pairs a symptom with a diagnosis step and a concrete remediation.
4. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`) — bump `version` and refresh `date` on an update — and write the file.

## Rules
- A runbook assigns no `FR`/`NFR`/`AR` IDs; it references them.
- Keep it operational: dashboards, alerts, and remediations must be real links/steps, not placeholders, before finalize.
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored artifacts live under `workspace/outputs/current/`.
- **Version bump** (`version` front-matter): patch = typo/clarification; minor = new incident/procedure (backward-compatible); major = restructured operations model.
