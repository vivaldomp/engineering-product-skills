---
title: <System or Service Name>
status: <Draft | In Review | Approved | Superseded>
version: <semver, e.g. 0.1.0>
owner: <Name or team>
date: <YYYY-MM-DD>
---

# Operations Runbook: <System or Service Name>

## 1. Service Overview

<What the service does, its owners, and its criticality. Reference the SDD §9 Observability design.>

## 2. Ownership and On-Call

| Role | Owner | Contact / escalation |
| --- | --- | --- |
| <Primary on-call> | <Team> | <Channel / rotation> |

## 3. Observability

| Signal | Where | Notes |
| --- | --- | --- |
| Dashboards | <Link> | <Key panels> |
| Alerts | <Link> | <What each alert means> |
| Logs / traces | <Link> | <Correlation ID field> |

## 4. Common Incidents

| Symptom | Likely cause | Diagnosis | Remediation |
| --- | --- | --- | --- |
| <Symptom> | <Cause> | <How to confirm> | <Fix / mitigation> |

## 5. Routine Operations

- <Scaling, backups, secret rotation, certificate renewal — with cadence.>

## 6. Recovery

<Backup/restore procedure, disaster-recovery steps, and the recovery-time and recovery-point objectives.>
