# Documentation Structures

This document defines recommended structures for PRD, SDD, and ADR artifacts. The structures are intentionally complete, but teams should scale the level of detail to the size, risk, and permanence of the initiative.

## 1. PRD (Product Requirements Document)

A PRD should make the product intent unambiguous. It should describe the problem, the desired outcome, the users, the scope, the business rules, the requirements, and the acceptance criteria.

```text
PRD
|-- 1. Overview
|   |-- Executive summary
|   |-- Problem statement
|   |-- Opportunity
|   |-- Background and context
|   |-- Goals and non-goals
|   `-- Glossary
|
|-- 2. Objectives and success metrics
|   |-- Business objectives
|   |-- Product objectives
|   |-- OKRs or target outcomes
|   |-- Success metrics
|   `-- Baseline and target values
|
|-- 3. Stakeholders and ownership
|   |-- Sponsor
|   |-- Product owner
|   |-- Business owner
|   |-- Users and customer segments
|   |-- Impacted teams
|   |-- Approvers
|   `-- RACI or responsibility matrix
|
|-- 4. Users, personas, and journeys
|   |-- Personas
|   |-- User needs
|   |-- Current journey
|   |-- Target journey
|   `-- Accessibility and inclusion considerations
|
|-- 5. Scope
|   |-- In scope
|   |-- Out of scope
|   |-- Assumptions
|   |-- Constraints
|   |-- Dependencies
|   `-- Open questions
|
|-- 6. Use cases and scenarios
|   |-- Primary flow
|   |-- Alternative flows
|   |-- Exception flows
|   |-- Edge cases
|   `-- User story mapping
|
|-- 7. Functional requirements
|   |-- FR-001
|   |-- FR-002
|   `-- FR-NNN
|
|-- 8. Business rules
|   |-- BR-001
|   |-- BR-002
|   `-- BR-NNN
|
|-- 9. Non-functional requirements
|   |-- Performance
|   |-- Security
|   |-- Privacy
|   |-- Availability
|   |-- Reliability
|   |-- Accessibility
|   |-- Observability
|   |-- Compliance
|   `-- Scalability
|
|-- 10. Data and reporting needs
|   |-- Required data
|   |-- Data sensitivity
|   |-- Analytics
|   |-- Reports
|   `-- Retention expectations
|
|-- 11. Dependencies
|   |-- External systems
|   |-- APIs
|   |-- Internal teams
|   |-- Vendors
|   `-- Regulatory or compliance dependencies
|
|-- 12. Acceptance criteria
|   |-- Positive scenarios
|   |-- Negative scenarios
|   |-- Completion criteria
|   |-- UAT criteria
|   `-- Definition of done
|
|-- 13. Risks and mitigations
|   |-- Product risks
|   |-- Technical risks
|   |-- Business risks
|   |-- Operational risks
|   `-- Mitigation plan
|
`-- 14. Roadmap and rollout
    |-- MVP
    |-- Phase 1
    |-- Phase 2
    |-- Migration or transition plan
    |-- Launch plan
    `-- Future opportunities
```

### PRD quality checklist

- The problem and target outcome are measurable.
- Every requirement has a clear owner or source.
- Scope and non-scope are explicit.
- Acceptance criteria can be tested by QA or users.
- Business rules are separate from implementation details.
- Non-functional requirements are measurable where possible.
- Dependencies, assumptions, risks, and open questions are visible.

## 2. SDD (Software Design Document)

An SDD should define the technical solution in enough detail for implementation, review, testing, deployment, and operations.

```text
SDD
|-- 1. Introduction
|   |-- Purpose
|   |-- Scope
|   |-- Audience
|   |-- References
|   |-- Related PRD
|   |-- Related ADRs
|   `-- Glossary
|
|-- 2. Solution context
|   |-- Problem summary
|   |-- Existing architecture
|   |-- Target architecture
|   |-- Architectural drivers
|   |-- Architectural requirements
|   |-- Technical constraints
|   `-- Assumptions and open questions
|
|-- 3. Architecture overview
|   |-- System context diagram
|   |-- C4 context diagram
|   |-- C4 container diagram
|   |-- C4 component diagram
|   |-- Deployment landscape
|   |-- Runtime view
|   `-- Major design decisions
|
|-- 4. Components and responsibilities
|   |-- Frontend
|   |-- Backend
|   |-- Backend for Frontend (BFF)
|   |-- Services
|   |-- Workers and batch jobs
|   |-- Shared libraries
|   |-- External integrations
|   `-- Ownership boundaries
|
|-- 5. Data design
|   |-- Entities
|   |-- Relationships
|   |-- Relational model
|   |-- NoSQL model
|   |-- Event schemas
|   |-- Data contracts
|   |-- Data migration
|   |-- Retention
|   `-- Privacy classification
|
|-- 6. APIs and integration contracts
|   |-- REST APIs
|   |-- GraphQL APIs
|   |-- gRPC services
|   |-- Events and messaging
|   |-- Webhooks
|   |-- Error contracts
|   |-- Versioning strategy
|   `-- Backward compatibility
|
|-- 7. Flows and behavior
|   |-- Sequence diagrams
|   |-- Activity diagrams
|   |-- State diagrams
|   |-- Orchestration
|   |-- Failure flows
|   `-- Recovery flows
|
|-- 8. Security and compliance
|   |-- Authentication
|   |-- Authorization
|   |-- Identity propagation
|   |-- Encryption in transit
|   |-- Encryption at rest
|   |-- Secrets management
|   |-- Audit logging
|   |-- Threat model
|   `-- Compliance requirements
|
|-- 9. Observability
|   |-- Logs
|   |-- Metrics
|   |-- Distributed traces
|   |-- Dashboards
|   |-- Alerts
|   |-- Correlation IDs
|   `-- Operational diagnostics
|
|-- 10. Resilience and reliability
|   |-- Retry policy
|   |-- Circuit breakers
|   |-- Timeouts
|   |-- Fallbacks
|   |-- Idempotency
|   |-- Disaster recovery
|   `-- Recovery objectives
|
|-- 11. Performance and scalability
|   |-- Caching
|   |-- CDN
|   |-- Rate limiting
|   |-- Load profile
|   |-- Capacity model
|   |-- Benchmarks
|   `-- Scaling strategy
|
|-- 12. Deployment and release
|   |-- Environments
|   |-- Build pipeline
|   |-- Deployment pipeline
|   |-- Infrastructure as Code
|   |-- GitOps
|   |-- Feature flags
|   |-- Rollback strategy
|   `-- Release strategy
|
|-- 13. Testing strategy
|   |-- Unit tests
|   |-- Integration tests
|   |-- Contract tests
|   |-- End-to-end tests
|   |-- Performance tests
|   |-- Security tests
|   `-- Acceptance traceability
|
|-- 14. Operations
|   |-- Runbooks
|   |-- Support model
|   |-- SLOs
|   |-- SLAs
|   |-- Capacity planning
|   |-- Incident response
|   `-- Maintenance plan
|
`-- 15. Referenced ADRs
    |-- ADR-001
    |-- ADR-002
    `-- ADR-NNN
```

### SDD quality checklist

- The design maps back to PRD requirements.
- Components have clear responsibilities and ownership boundaries.
- Interfaces and contracts are explicit.
- Failure modes, security, observability, and operations are covered.
- Major trade-offs link to ADRs.
- The testing strategy proves the most important requirements and risks.

### Diagram archetypes (Mermaid)

Diagrams are authored as inline Mermaid fenced blocks in the SDD, so they render
in GitHub/GitLab/VS Code/IDEs with no build step. Choose diagrams by the system's
shape, not a fixed C4 default. The SDD builder reads the PRD/SDD and recommends a
set from this catalog:

| Archetype | Mermaid kind | Recommend when |
| --- | --- | --- |
| C4 Context | `C4Context` | always — system boundary and external actors |
| C4 Container | `C4Container` | multi-container / multi-service systems |
| C4 Component | `C4Component` | a container with nontrivial internal structure |
| Sequence | `sequenceDiagram` | auth handshakes, multi-step protocols (e.g. a gated-install 401-abort) |
| State machine | `stateDiagram-v2` | background jobs, export/install lifecycles, run states |
| ER / data | `erDiagram` | multi-entity data models, multiple datastores |
| Deployment | `C4Deployment` or `flowchart` | multiple runtime environments / infra topology |
| DFD + trust boundary | `flowchart` with `subgraph` boundaries | privacy/security/LGPD review, data crossing trust zones |
| Flow / activity | `flowchart` | general process or branching logic |

## 3. ADR (Architecture Decision Record)

Each ADR documents one decision. It should be concise, traceable, and durable enough for future maintainers to understand the reasoning without reopening old discussions.

```text
ADR
|-- 1. Metadata
|   |-- ID
|   |-- Title
|   |-- Status
|   |-- Date
|   |-- Author
|   |-- Reviewers
|   |-- Related PRD sections
|   |-- Related SDD sections
|   `-- Related ADRs
|
|-- 2. Context
|   |-- Problem
|   |-- Current state
|   |-- Drivers
|   |-- Constraints
|   |-- Assumptions
|   `-- Decision scope
|
|-- 3. Options considered
|   |-- Option A
|   |-- Option B
|   |-- Option C
|   `-- Option N
|
|-- 4. Evaluation
|   |-- Benefits
|   |-- Costs
|   |-- Risks
|   |-- Complexity
|   |-- Security impact
|   |-- Operational impact
|   |-- Delivery impact
|   `-- Trade-offs
|
|-- 5. Decision
|   |-- Chosen solution
|   |-- Rationale
|   |-- Decision owner
|   `-- Approval notes
|
|-- 6. Consequences
|   |-- Positive consequences
|   |-- Negative consequences
|   |-- Neutral consequences
|   |-- Accepted risks
|   `-- Mitigations
|
|-- 7. Implementation plan
|   |-- Steps
|   |-- Dependencies
|   |-- Migration notes
|   |-- Rollback plan
|   `-- Validation plan
|
`-- 8. References
    |-- RFCs
    |-- Standards
    |-- Articles
    |-- Benchmarks
    `-- Related ADRs
```

### ADR quality checklist

- The ADR records exactly one decision.
- The decision is significant enough to preserve.
- Alternatives are real options, not placeholders.
- Trade-offs and consequences are honest and specific.
- Status is clear and maintained over time.
- Superseded decisions link to the replacing ADR.

## 4. Recommended repository structure

For a modern product, platform, AI, or agent-assisted engineering initiative, this structure keeps product intent, technical design, decisions, diagrams, and contracts easy to navigate.

```text
docs/
|-- prd/
|   |-- vision.md
|   |-- requirements.md
|   |-- business-rules.md
|   |-- acceptance-criteria.md
|   `-- roadmap.md
|
|-- sdd/
|   |-- architecture.md
|   |-- components.md
|   |-- data-model.md
|   |-- integrations.md
|   |-- security.md
|   |-- observability.md
|   |-- testing.md
|   `-- operations.md
|
|-- adr/
|   |-- ADR-001-native-federation.md
|   |-- ADR-002-opentelemetry.md
|   |-- ADR-003-github-copilot.md
|   |-- ADR-004-workflow-engine.md
|   `-- ADR-005-kubernetes.md
|
|-- diagrams/            # optional exports; inline mermaid in the SDD is the source of truth
|   |-- c4/
|   |-- sequence/
|   |-- state/
|   |-- data/
|   |-- deployment/
|   `-- flow/
|
|-- api/
|   |-- openapi.yaml
|   |-- asyncapi.yaml
|   `-- schemas/
|
`-- templates/
    |-- prd-template.md
    |-- sdd-template.md
    `-- adr-template.md
```

## 5. Traceability model

The documents should reference each other instead of duplicating the same information everywhere.

```text
PRD requirement
 |-- maps to SDD design section
 |-- maps to test or acceptance criterion
 `-- may produce one or more ADRs

SDD design choice
 |-- implements one or more PRD requirements
 |-- links to ADRs for significant decisions
 `-- defines implementation, testing, deployment, and operations guidance

ADR decision
 |-- explains one significant choice
 |-- links to the relevant SDD section
 `-- can be superseded when the architecture evolves
```

This traceability allows teams to answer three practical questions quickly: why the product exists, how it is designed, and why the design uses its chosen architectural path.

`scripts/traceability.js` makes this concrete. It understands compressed ID notation
(ranges like `FR-036…042`, lists like `FR-001/002/003a`, and sub-IDs like `FR-010a`),
expanding both PRD and SDD references symmetrically so notation differences never read as
gaps. It emits `.product/traceability.{md,html}` and injects a Requirement Coverage Index
into SDD §16 — linking each requirement to its SDD sections (anchored) and ADRs, listing
AR→FR traces and UAT back-references, and flagging genuine **orphans** (a PRD requirement
with no matching SDD mention) distinctly from resolved notation artifacts.