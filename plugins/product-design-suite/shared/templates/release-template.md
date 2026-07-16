---
title: <System or Release Name>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.1.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---

# Release Plan: <System or Release Name>

## 1. Release Overview

### Scope

<What ships in this release and the requirements (`FR-NNN`/`NFR-NNN`) it satisfies. Reference IDs in prose — the PRD owns them.>

### Release Strategy

<Big-bang / rolling / canary / blue-green — and why.>

## 2. Environments and Promotion

| Environment | Purpose | Promotion gate |
| --- | --- | --- |
| <dev / staging / prod> | <Purpose> | <Automated checks / approval> |

## 3. Rollout

- **Steps:** <Ordered rollout steps.>
- **Feature flags:** <Flags gating this release and their default state.>
- **Data migrations:** <Migrations and their reversibility.>

## 4. Rollback

<Trigger conditions and the concrete rollback procedure. State the recovery-time objective.>

## 5. Release Checklist

| Item | Owner | Status |
| --- | --- | --- |
| <Tests green in CI> | <Owner> | <Open/Done> |
| <Observability dashboards ready (see runbook)> | <Owner> | <Open/Done> |
| <Stakeholder sign-off> | <Owner> | <Open/Done> |

## 6. Communications

<Who is notified, when, and through which channel — before, during, and after the release.>
