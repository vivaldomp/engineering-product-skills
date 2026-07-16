# 008 - Improvements Structure Project

Given the direction of **Engineering Product Skills** (product engineering through reusable skills, templates, and agent automation), I would separate **source assets** from **generated artifacts**, making every execution reproducible, diffable, and machine-consumable.

This borrows the good ideas from modern Skill ecosystems (clear separation of skill sources vs. execution outputs) while adapting them for Engineering Product workflows. ([skills.md][1])

## Proposed Structure

```text
engineering-product-skills/
│
├── skills/                    # Source skills (version controlled)
├── templates/                 # Shared templates
├── schemas/                   # JSON/YAML schemas
├── examples/                  # Reference examples
├── docs/
├── scripts/
│
├── workspace/                 # User project (ignored)
│
│   ├── inputs/
│   │   ├── product.yaml
│   │   ├── architecture.md
│   │   ├── requirements.md
│   │   └── ...
│   │
│   ├── outputs/
│   │
│   │   ├── current/           # Latest successful execution
│   │   │
│   │   ├── history/
│   │   │   ├── 2026-07-15T103422/
│   │   │   ├── 2026-07-15T112530/
│   │   │   └── ...
│   │   │
│   │   └── releases/
│   │       ├── v1/
│   │       ├── v2/
│   │       └── ...
│   │
│   ├── reports/
│   │
│   ├── cache/
│   │
│   └── state/
│
└── .engineering/
    ├── config.yaml
    ├── execution.db
    ├── receipts/
    └── telemetry/
```

---

# Output of one execution

Instead of dumping files directly into one folder, every execution should produce a self-contained package.

```text
history/
└── 2026-07-15T103422/
    │
    ├── manifest.json
    ├── metadata.json
    ├── receipt.json
    ├── execution.log
    │
    ├── inputs/
    │   ├── prompt.md
    │   ├── context.json
    │   └── variables.yaml
    │
    ├── artifacts/
    │   ├── documentation/
    │   │
    │   ├── specifications/
    │   │
    │   ├── architecture/
    │   │
    │   ├── design/
    │   │
    │   ├── code/
    │   │
    │   ├── tests/
    │   │
    │   ├── diagrams/
    │   │
    │   ├── images/
    │   │
    │   ├── assets/
    │   │
    │   └── exports/
    │
    └── validation/
        ├── checklist.md
        ├── score.json
        └── evaluation.md
```

---

# Manifest

Every run should expose a machine-readable manifest.

```json
{
  "runId": "2026-07-15T103422",
  "skill": "create-prd",
  "version": "1.8.0",
  "template": "product/prd",
  "status": "success",
  "startedAt": "...",
  "finishedAt": "...",
  "duration": 42,
  "artifacts": [
    "documentation/prd.md",
    "architecture/context.puml",
    "code/openapi.yaml"
  ]
}
```

This is similar to how modern Skill runtimes expose execution outputs and enables automation around generated artifacts. ([skills.md][1])

---

# Stable Artifact Taxonomy

Instead of organizing by file type only, organize by engineering purpose.

```text
artifacts/
│
├── discovery/
│
├── planning/
│
├── specifications/
│
├── architecture/
│
├── ux/
│
├── implementation/
│
├── tests/
│
├── deployment/
│
├── operations/
│
├── governance/
│
└── exports/
```

This scales much better as new skills are added.

---

# Metadata

Every generated file should have adjacent metadata.

Example:

```
prd.md

prd.meta.json
```

```json
{
  "skill": "create-prd",
  "template": "prd-v3",
  "author": "engineering-product-skills",
  "generatedAt": "...",
  "hash": "...",
  "inputs": [
      "requirements.md"
  ],
  "dependsOn": [
      "vision.md"
  ]
}
```

That enables dependency graphs later.

---

# Release Promotion

Rather than copying files manually:

```
history/
    run001/
    run002/
    run003/

current/
```

Promotion becomes

```
eps promote run003
```

Result:

```
releases/

v1/

v2/

current -> run003
```

This resembles CI artifact promotion rather than document copying.

---

# Engineering Graph

One feature I would add that most repositories don't have is an artifact dependency graph.

```
graph/

artifacts.graph.json

traceability.json

lineage.json
```

Example

```text
Vision
    ↓

Requirements
    ↓

PRD
    ↓

Architecture
    ↓

API Spec
    ↓

Tests
    ↓

Implementation
```

That enables impact analysis such as:

> "Architecture changed → regenerate OpenAPI, Tests, ADRs."

---

# Validation

Generated artifacts should never exist without validation.

```
validation/

lint.json

quality.json

checklist.md

score.json

agent-review.md
```

This fits well with your Loop Engineering philosophy, where each artifact has a measurable quality gate before promotion.

---

## Overall Recommendation

I would evolve the project toward a **build system for engineering artifacts**, where skills produce immutable execution packages rather than loose files. The key ideas are:

* **Immutable execution history** (`history/<run-id>/`)
* **Stable promoted outputs** (`current/` and `releases/`)
* **Machine-readable manifests** for every run
* **Artifact metadata** beside each generated file
* **Engineering-domain organization** (planning, architecture, implementation, operations) instead of file-type folders
* **Traceability graph** connecting artifacts from vision through implementation
* **Validation reports** as first-class outputs

This structure aligns well with the trend in modern agent skill ecosystems toward separating skill definitions from generated artifacts while adding the traceability and governance needed for engineering workflows. ([skills.md][1])

[1]: https://skills.md/docs/artifacts?utm_source=chatgpt.com "Artifacts | skills.md docs"

## Output Structure Migration Requirement

## Artifact Output Structure Update

The project must adopt the new artifact output structure for every generated asset.

This migration is **not limited to the runtime output folders**. It must also be reflected across every AI asset responsible for generating, validating, or manipulating project artifacts.

### Scope

Update all AI assets, including but not limited to:

* Skills
* Scripts
* Linters
* Validators
* Templates
* Generators
* Checklists
* Prompt assets
* Workflow definitions
* CLI commands
* Automation pipelines
* Documentation examples

### Required Changes

Every AI asset must:

1. Generate artifacts using the new output directory structure.
2. Read existing artifacts from the new locations.
3. Store references using the new canonical paths.
4. Update internal examples and documentation.
5. Update validations and lint rules to verify the new structure.
6. Update scripts and automation to consume the new layout.
7. Remove assumptions about the previous directory organization.
8. Ensure all generated manifests, metadata, and validation reports reference the new artifact locations.
9. Preserve backward compatibility only when explicitly required; otherwise, the new structure becomes the single source of truth.

### Acceptance Criteria

* Every Skill produces artifacts in the new structure.
* Every Script operates exclusively on the new structure.
* Every Lint and Validation rule recognizes and validates the new layout.
* Every Template generates files in their expected locations.
* Every documentation example reflects the updated organization.
* No AI asset references deprecated output paths.
* All automated workflows execute successfully using the new artifact hierarchy.

### Definition of Done

The migration is complete only when **all AI assets** (Skills, Scripts, Linters, Validators, Templates, Prompts, and related automation) have been updated to fully support the new artifact structure, ensuring a consistent, end-to-end engineering workflow.

