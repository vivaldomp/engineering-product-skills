# Canonical ID Conventions

The single, shared specification for requirement, architecture, test, decision,
and constraint identifiers. The traceability tooling (`scripts/traceability.js`),
the linter (`scripts/lint-ids.js`), and the consistency gate all derive their
notion of a "valid ID" from `scripts/id-conventions.js`, which implements this
spec. Keep documents and tooling in sync by following the forms below.

## Prefixes

| Prefix | Meaning                       | Owning document |
| ------ | ----------------------------- | --------------- |
| FR     | Functional requirement        | PRD             |
| BR     | Business requirement          | PRD             |
| NFR    | Non-functional requirement    | PRD             |
| AR     | Architectural requirement     | SAD (or SDD)    |
| UAT    | User acceptance test          | PRD             |
| ADR    | Architecture decision record  | ADR files       |
| C      | Constraint                    | SAD/SDD         |

## Member form

```
<PREFIX>-[CATEGORY][NUMBER][suffix]
```

- **CATEGORY** — 0 to 2 uppercase letters, optional. Lets you group by category,
  e.g. `NFR-P1` (performance), `NFR-S4` (security), `NFR-PR1`. Both the plain
  form `NFR-001` and the category form `NFR-P1` are valid and accepted.
- **NUMBER** — one or more digits. Zero-pad for stable sorting (`FR-001`).
- **suffix** — a single lowercase letter for sub-items, e.g. `FR-003a`.

Examples: `FR-001`, `BR-002`, `NFR-003`, `NFR-P1`, `AR-004`, `UAT-005`,
`ADR-006`, `C-007`, `FR-003a`.

## Ranges and lists

- Range: `FR-001..FR-005`, `FR-036…042`, `NFR-P1..P3`.
- List: `FR-001/002/003a`, `FR-010a, FR-010b`.

## Linting

Run `node scripts/lint-ids.js` (defaults to `workspace/outputs/current`) to flag
identifiers that look like IDs but do not match this spec, and duplicate IDs
across files.
