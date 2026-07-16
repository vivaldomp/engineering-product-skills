---
name: egp-discovery-builder
description: Create or update a Discovery document that captures problem-space research, user findings, opportunities, and a recommendation before a PRD is written. Use at the start of an initiative when the problem, users, or opportunity still need validation. Writes workspace/outputs/current/discovery/discovery.md; the PRD then builds on it.
metadata:
  author: Vivaldo
  version: "0.1.0"
---

# egp-discovery-builder

Build or update the Discovery document at `workspace/outputs/current/discovery/discovery.md` from the shared template. Discovery is **optional** and sits upstream of the PRD: it records what was learned about the problem and users so the PRD starts from evidence rather than assumption. It introduces no requirement IDs — reference any that emerge in prose; the PRD owns them.

## Inputs
- Template: `${CLAUDE_PLUGIN_ROOT}/shared/templates/discovery-template.md`
- References: `${CLAUDE_PLUGIN_ROOT}/shared/references/{concepts,structures,questioning-protocol}.md`

## Steps
- **If these steps were not surfaced on invocation (006 H1):** read this `SKILL.md` directly and follow the Steps/Rules below — invocation output is host-dependent.

1. Ensure `workspace/outputs/current/discovery/` exists. If `discovery.md` exists, load it and treat this as an update.
2. Read the discovery template. Fill each section per `questioning-protocol.md`: when authoritative research is supplied, use **derive-then-confirm mode** (derive the sections, present one confirmation batch, ask only about genuine gaps); otherwise ask gap questions (pause after every 4 and summarize remaining gaps).
3. Keep every finding evidence-backed; record unknowns in §5 rather than guessing.
4. On finalize, populate the YAML front-matter (`title`, `status`, `version`, `owner`, `date`) — bump `version` and refresh `date` on an update — and write the file.
5. Hand off: the §6 Recommendation seeds `egp-prd-builder`. Suggest running it next.

## Rules
- Discovery is analysis, not commitment: it never assigns `FR`/`NFR` IDs.
- **`docs/` is read-only.** Never write under `docs/` — it is the import source. All authored artifacts live under `workspace/outputs/current/`.
- **Version bump** (`version` front-matter): patch = typo/clarification; minor = new finding/section (backward-compatible); major = restructure or reversed recommendation.
