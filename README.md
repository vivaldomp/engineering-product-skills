# pm-skills

Claude Code marketplace containing the **product-design-suite** plugin — a set of
Agent Skills that guide Product Managers through a sequential PRD -> SDD -> ADR
workflow with cross-document sync and framework-free HTML visualizations.

## Install
Add this repo as a plugin marketplace in Claude Code, then install
`product-design-suite`.

## Skills
- `pm-product-workflow` — orchestrator (sequence + question cadence)
- `pm-prd-builder`, `pm-sdd-builder`, `pm-adr-builder` — artifact builders
- `pm-doc-sync` — cross-document impact + sync

## Commands
`/pm-product`, `/pm-prd`, `/pm-sdd`, `/pm-adr`

Generated artifacts are written to `.product/`.

## Development
Run validation and tests:
```bash
node tools/validate-plugin.js .
node --test          # auto-discovers tests/*.test.js (Node >= 18)
```
