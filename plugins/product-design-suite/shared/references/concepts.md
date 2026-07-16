# Documentation Concepts

Product and architecture documentation works best when each document has a clear job. PRDs, SDDs, and ADRs are complementary: the PRD defines the product need, the SDD explains the technical design, and ADRs preserve the reasoning behind important architectural choices.

| Document | Primary focus | Main question answered | Typical audience |
| --- | --- | --- | --- |
| PRD (Product Requirements Document) | Product, users, business value, scope | What should we build and why? | Product, business, design, engineering, QA, leadership |
| SDD (Software Design Document) | Technical architecture and implementation design | How will we build it? | Engineering, architecture, security, operations, QA |
| ADR (Architecture Decision Record) | A single architectural decision and its rationale | Why did we choose this approach? | Engineering, architecture, technical leadership, future maintainers |

## 1. PRD - Product Requirements Document

A PRD is a product-oriented document that describes the problem, the desired outcome, the users, the expected behavior, and the boundaries of the initiative. It should make the product intent clear enough for design, engineering, QA, and stakeholders to align on what success means.

PRDs are usually written by Product Managers, Product Owners, or Business Analysts, often with input from UX, engineering, data, compliance, operations, and customer-facing teams.

### What a PRD is for

- Align stakeholders around the product problem and business opportunity.
- Define the target users, user journeys, and core use cases.
- Describe functional requirements at a product level.
- Capture business rules, assumptions, constraints, and dependencies.
- Define measurable success criteria and acceptance criteria.
- Clarify what is in scope and what is explicitly out of scope.

### What a PRD should contain

- Executive summary and problem statement.
- Business objectives and product objectives.
- Personas, user segments, and impacted stakeholders.
- Current journey and target journey.
- Use cases, user stories, or scenarios.
- Functional requirements and business rules.
- Non-functional expectations such as availability, accessibility, performance, security, compliance, and observability when they affect product success.
- Scope, non-scope, assumptions, constraints, risks, and dependencies.
- Acceptance criteria, success metrics, and rollout considerations.

### What a PRD should avoid

- Low-level implementation details.
- Premature technology choices unless they are hard constraints.
- Ambiguous phrases such as "fast", "simple", or "secure" without measurable criteria.
- Hidden scope or implied requirements that are not explicitly stated.

### Example PRD statement

> We want to reduce digital account opening time from 15 minutes to 5 minutes by providing a guided onboarding experience with pre-filled data, real-time validation, and clear recovery paths for incomplete applications.

The PRD says what needs to change and why. It does not normally define the final architecture, database schema, API design, deployment model, or integration pattern.

## 2. SDD - Software Design Document

An SDD translates product requirements into a technical solution. It describes how the system will be structured, how components interact, how data moves, how the solution is secured and operated, and how engineering constraints will be handled.

The SDD is usually written by software engineers, architects, or tech leads, with review from security, platform, operations, QA, and product stakeholders. It is commonly derived from the PRD, existing architecture, technical constraints, and ADRs.

### What an SDD is for

- Convert product requirements into an implementable technical design.
- Define system boundaries, components, APIs, integrations, and data models.
- Make architectural drivers and trade-offs explicit.
- Identify risks before implementation starts.
- Provide enough detail for engineers to estimate, implement, test, deploy, and operate the system.
- Give reviewers a stable artifact for security, architecture, reliability, and operational review.

### What an SDD should contain

- Purpose, scope, references, assumptions, and glossary.
- Architectural drivers such as scalability, reliability, compliance, cost, maintainability, and time-to-market.
- System context, C4 diagrams, component diagrams, sequence diagrams, and deployment diagrams where useful.
- Component responsibilities and interfaces.
- API contracts, event contracts, data contracts, and integration protocols.
- Data model, persistence choices, migrations, retention, and privacy considerations.
- Security design, authentication, authorization, secrets management, encryption, auditability, and threat considerations.
- Observability design for logs, metrics, traces, dashboards, alerts, and operational signals.
- Resilience and performance strategies such as retries, timeouts, circuit breakers, caching, rate limiting, backpressure, and capacity planning.
- Deployment, release, rollback, migration, and operations plan.
- Testing strategy and references to relevant ADRs.

### What an SDD should avoid

- Repeating the entire PRD instead of referencing it.
- Encoding decisions without explaining their drivers or linking to ADRs.
- Describing only happy paths while ignoring failure modes.
- Providing diagrams without textual explanation of responsibilities and trade-offs.

### Example SDD flow

```text
Angular frontend
    |
Backend for Frontend (BFF)
    |
Customer onboarding API
    |
Core banking system
```

### Example microfrontend layout

```text
Host shell
|-- Registration microfrontend
|-- Contracting microfrontend
|-- Signature microfrontend
`-- Support microfrontend
```

The SDD says how the solution will work. It should be detailed enough to guide implementation, but it should not become a dumping ground for every line of code or every project management detail.

## 3. ADR - Architecture Decision Record

An ADR records one significant architectural decision. It explains the context, the options considered, the chosen decision, and the consequences. ADRs are intentionally small and focused. They are not a replacement for the SDD; they are the historical decision log that supports it.

ADRs are usually written by engineers, architects, or tech leads at the moment a decision is made. They are especially valuable when the team needs to understand why a choice was made months or years later.

### What an ADR is for

- Preserve the reasoning behind an architectural decision.
- Make trade-offs visible instead of leaving them in chat messages or meetings.
- Help future maintainers understand constraints, alternatives, and consequences.
- Avoid reopening the same decision without new evidence.
- Provide traceability between requirements, design, implementation, and operational outcomes.

### What an ADR should contain

- Metadata: ID, title, status, date, author, reviewers, related documents, and supersede/amend relationships — recorded in a YAML front-matter block.
- Context: the problem, drivers, constraints, and forces influencing the decision.
- Options considered: feasible alternatives, including the option to do nothing when relevant.
- Evaluation: benefits, costs, risks, complexity, operational impact, security impact, and trade-offs.
- Decision: the chosen option and why it fits the current context.
- Consequences: positive, negative, neutral, expected, and accepted consequences.
- Implementation notes, rollback strategy, references, and related ADRs when useful.

### ADR statuses

Common ADR statuses include:

- Proposed: under discussion, not yet accepted.
- Accepted: approved and active.
- Superseded: replaced by another ADR.
- Deprecated: no longer recommended but still historically relevant.
- Rejected: considered and intentionally not chosen.

Supersede and amend relationships are recorded in dedicated front-matter fields
(`supersedes`/`superseded-by`/`amends`/`amended-by`), set on both ADRs, keeping
`status` a single enum value rather than overloaded prose.

### Example ADR summary

```text
Context: Multiple microfrontends need to share UI capabilities without blocking independent deployments.
Options: Module Federation, Native Federation, shared NPM packages, shared iframe-based widgets.
Decision: Adopt Native Federation for runtime composition.
Consequences: Teams gain deployment independence, but platform operations and version governance become more complex.
```

### Common ADR examples

- Choosing Angular, React, or another frontend framework.
- Choosing Kubernetes, serverless, or virtual machines as a runtime platform.
- Choosing PostgreSQL, MongoDB, or another persistence technology.
- Choosing OpenTelemetry as the observability standard.
- Choosing Native Federation for microfrontend composition.
- Choosing OAuth2/OIDC, mTLS, or another authentication strategy.
- Choosing synchronous REST APIs, asynchronous events, or a hybrid integration model.

## 4. How PRD, SDD, and ADR relate to each other

```text
PRD
 |
 | defines product intent, scope, and success criteria
 v
SDD
 |
 | translates requirements into technical design
 v
Implementation

ADRs
 ^
 | record significant decisions made during design and implementation
```

In practical terms:

```text
PRD = What and why from a product and business perspective
SDD = How the system will be designed and implemented
ADR = Why a specific technical choice was made
```

For modern platform, AI, and agent-assisted engineering initiatives, an effective documentation set often looks like this:

```text
PRD
|-- Business goals
|-- User needs
|-- Requirements
|-- Acceptance criteria
`-- Success metrics

SDD
|-- Architecture
|-- Components
|-- Flows
|-- APIs and events
|-- Data model
|-- Security
|-- Observability
`-- Operations

ADR/
|-- ADR-001-native-federation.md
|-- ADR-002-opentelemetry.md
|-- ADR-003-workflow-engine.md
`-- ADR-004-mcp-server.md
```

Many agile teams do not maintain a separate formal SRS; the PRD then owns functional (`FR-NNN`) and non-functional (`NFR-NNN`) requirements directly, alongside the SDD for technical design and ADRs for decision history. This works well where architecture evolves incrementally and decisions need to remain traceable. Teams that do keep an IEEE-830 SRS (often regulated or enterprise contexts) can adopt the optional SRS document: the SRS becomes the canonical home for `FR-NNN`/`NFR-NNN` while the PRD references them and keeps business rules (`BR-NNN`) and acceptance tests (`UAT-NNN`). The suite detects which mode applies by whether `workspace/outputs/current/specifications/srs.md` exists.

Between requirements and detailed design sits the optional **System Architecture Document
(SAD)** — the macro-architecture blueprint. When a team adopts it, the SAD becomes the
canonical home for the system context (C4 Level 1), container/infrastructure topology
(C4 Level 2), data-flow and integration patterns, the macro security architecture, and the
Architectural Requirements (`AR-NNN`); the SDD then drops to the micro level (C3 components,
APIs, schemas, code-level design) and references the SAD. Without a SAD, the SDD owns the
macro-architecture and `AR-NNN` as before. The suite detects SAD mode by whether
`workspace/outputs/current/architecture/sad.md` exists. Where the SRS answers *what* the system must do and the SDD
answers *how* a module is built, the SAD answers *where* components live and the big picture.

## 5. Recommended lifecycle

1. Start with a PRD when the problem, audience, expected outcomes, and scope need alignment.
   - *(Optional)* If the team maintains a formal SRS, author it after the PRD with
     `egp-srs-builder`; the SRS then owns the detailed `FR`/`NFR` that the PRD references and
     the SDD designs against.
   - *(Optional)* If the team maintains a System Architecture Document, author it after the
     requirements with `egp-sad-builder`; the SAD then owns the macro-architecture and `AR-NNN`
     that the SDD designs against and references.
2. Draft or update the SDD when the team is ready to design the technical solution. When a SAD
   exists, the SDD references its macro-architecture and `AR-NNN` and focuses on C3
   component/code design.
3. Create ADRs whenever the design involves meaningful trade-offs, irreversible choices, expensive changes, cross-team standards, or long-lived operational consequences.
4. Keep the documents connected through references: PRD requirements should map to SDD sections, and SDD design choices should link to ADRs.
5. Update documents when reality changes. Documentation is most valuable when it reflects the system as built or intentionally records why it changed.

