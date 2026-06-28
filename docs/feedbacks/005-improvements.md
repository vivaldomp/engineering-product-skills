# Plugin Improvement Notes — `product-design-suite` (v0.1.1)

From an end-to-end run: `egp-import` → `egp-prd-builder` → `egp-adr-builder` → `egp-sdd-builder`
→ `consistency-gate`. Captured so the original plugin can fix these at the source.
Each item: **what happened → root cause → recommended fix**, with evidence.

---

## P0 — Reviewer feedback (verbatim): diagram approval was skipped

> At no point was I asked to review and approve the diagrams. The server located on
> the scripts page was not invoked. I expect the agent to provide a URL for
> browser-based previewing so that I can provide feedback for approval or suggest
> improvements.

- **What happened:** The agent authored all 8 SDD diagrams, treated them as "derived"
  (batch-confirmable), and wrote them straight into `sdd.md` — **without ever presenting
  them for human review**, without running `scripts/start-server.sh`, and without handing
  over a preview **URL**. The broken sequence diagram only surfaced later, during the
  reviewer's manual UAT.
- **Root cause:** The SDD builder's B1/B3 rule permits derived diagrams to be
  batch-confirmed, and the agent collapsed that into *no* visual confirmation at all. The
  approval gate and the preview **server** (which serves a real `http://…` URL) were
  bypassed.
- **Expected behavior:** Before writing diagrams into the doc, the agent must
  **start the preview server** (`scripts/start-server.sh`), render the diagrams, and give
  the reviewer a **browser URL** to inspect — then wait for explicit approval or change
  requests. A self-contained HTML *file path* is not a substitute for an interactive
  preview URL the reviewer can open and iterate against.
- **Fix (plugin):** Make "serve diagrams at a URL and obtain explicit reviewer approval"
  a **mandatory, blocking** step in the SDD builder for **all** diagrams (derived included),
  not an optional loop reserved for net-new ones. The builder should print the URL and stop
  for feedback rather than proceeding to write `sdd.md`.

---

## P1 — Bugs that produced broken/failing output

### 1. `mermaid-lint` misses semicolons in `Note`/non-arrow lines → broke the SDD sequence diagram
- **What happened:** The SDD sequence diagram failed to render in Mermaid (caught by manual UAT, *not* by the gate). The offending line was a `Note over L: ... reachable;<br/>...` — a semicolon in note text, which Mermaid treats as a statement terminator.
- **Root cause:** `scripts/mermaid-lint.js` *knows* semicolons are a sequenceDiagram footgun, but only checks **arrow lines**:
  ```js
  if (/(--?>>?|-->>?)/.test(l) && l.includes(';')) errs.push(...)
  ```
  A `Note`, `alt`, `loop`, `par`, or `activate` line with a `;` slips through. `mermaid-lint: clean` was reported on a diagram that does not render.
- **Fix:** In a `sequenceDiagram` block, flag `;` on **any** statement line (notes, fragments), not just messages. Better: replace the heuristic with a real parse (see #2).

### 2. Rule-based `mermaid-lint` gives false confidence (it is not a parser)
- **What happened:** The gate's `mermaid-lint` PASSed while the diagram was genuinely broken. The file header even says *"Lightweight … NOT a full parser."*
- **Root cause:** No stage actually parses the Mermaid. The bundled `vendor/mermaid.min.js` is a 3.2 MB **browser** bundle that hard-requires a DOM, so it cannot be driven headlessly in Node for CI (I tried DOM/Proxy stubs — it dies at init reading `.mermaid` on undefined and `window.addEventListener`).
- **Fix:** Add a real parse gate using a DOM-free path:
  - `@mermaid-js/parser` (the Langium grammar package) parses without a DOM, or
  - run the existing bundle under `jsdom`/`playwright` in `mermaid-preview.js` and surface parse errors as a non-zero exit.
  Wire its result into `consistency-gate` so a broken diagram fails the gate, not the user.

### 2b. `mermaid-preview.js` output does not render in a real browser (inlined bundle breaks)
- **What happened:** The generated preview HTML showed **raw diagram text, not rendered SVG**. Playwright evaluation of the served page reported `ReferenceError: mermaid is not defined`, an `Invalid or unexpected token`, plus downstream 404s for `${e}` / `'+Zr.escape(this.src)+'` and an invalid `${FAt}` sandbox flag.
- **Root cause:** `mermaid-preview.js` **inlines** the entire 3.2 MB minified bundle into a single `<script>…</script>` tag (line 37). It guards only a literal `</script>`, but the inlined bundle still fails to parse/execute in-browser, so the `mermaid` global is never defined and `startOnLoad` never runs. Every `<pre class="mermaid">` is left as raw text.
- **Verified fix:** Serve Mermaid as an **external** script instead of inlining it — `<script src="/files/mermaid.min.js"></script>` (the preview server already exposes a `/files/` route) + `mermaid.initialize({startOnLoad:true})`. With that change all 8 SDD diagrams rendered to SVG with 0 syntax errors (confirmed via Playwright `querySelector('svg')` count = 8 and a full-page screenshot).
- **Fix (plugin):**
  1. Switch `mermaid-preview.js` to external-src when a server/`/files/` route is available (keep inlining only as an explicit offline fallback, and if inlining, verify it actually executes — the current guard is insufficient).
  2. Add a **Playwright/headless render check** to the diagram gate: load the page, assert `typeof mermaid === 'object'`, assert every `.mermaid` figure contains an `svg` and no `Syntax error` text. This catches both diagram-syntax bugs (#1) and rendering-pipeline bugs (this one) that the rule-based lint cannot.

### 3. SDD builder emitted `\n` inside flowchart node labels
- **What happened:** Two flowchart nodes used `ingest[Ingest API\nscrub free text]`. Mermaid flowcharts render `\n` **literally** (it is not a line break) — labels read `Ingest API\nscrub free text`.
- **Root cause:** No builder guidance / lint rule about Mermaid label line-break syntax (`<br/>`, with quotes around labels that contain markup).
- **Fix:** Add a lint rule: flag a literal `\n` inside `[...]`/`(...)`/`{...}` node labels in `graph`/`flowchart`. Add a one-line note to the SDD builder's diagram guidance: "line breaks in node labels use `<br/>` and the label must be quoted."

---

## P2 — Gate trust: a clean doc set cannot pass

### 4. `id-lint` counts generated coverage tables as duplicate "definitions" → permanent FAIL
- **What happened:** `consistency-gate` reported `[FAIL] id-lint: 80 duplicate-definitions` on a correct, freshly generated doc set (every `FR/BR/ADR` flagged). There was no way to reach a green gate by following the documented workflow.
- **Root cause:** `lint-ids.js` defines a "definition" as *any ID in the first cell of a table row*. But the plugin's **own generators** emit ID-first-cell tables:
  - `traceability.js` writes the requirement table into **both** SDD §16 (between `COVERAGE-INDEX` markers) **and** the standalone `traceability.md`;
  - `adr-index.js` writes the ADR table into **both** `adr/index.md` (`ADR-INDEX`) **and** SDD §15 (`ADR-STATUS`).
  So each ID is "defined" in 2–3 generated files plus its one authored home → flagged as duplicate.
- **Fix:** `lint-ids.js` should ignore content inside generated marker blocks (`COVERAGE-INDEX`, `ADR-STATUS`, `ADR-INDEX`) and the generated `traceability.md`, **or** distinguish an *authored* definition (PRD §7/§8/§12, SDD §2 AR table) from a *generated reference* table. Only authored duplicates should fail.

### 5. `consistency-gate` exit code conflates known-artifact with real failure
- **What happened:** The gate prints `81 cross-doc mentions (expected)` — acknowledging the noise — yet still hard-fails the whole run on #4. A gate that is permanently red on valid output trains users to ignore it.
- **Root cause:** No separation between "authoring error" and "expected toolchain artifact" in the pass/fail decision.
- **Fix:** Once #4 is fixed this largely resolves; additionally, classify checks into *blocking* vs *informational* and only set a non-zero exit on blocking findings.

---

## P3 — Workflow friction & polish

### 6. Builder skills should always run a render before finalize — even for "derived" diagrams
- **What happened:** The SDD builder's B1/B3 rule lets **derived** diagrams be batch-confirmed *without* the preview-render loop (only net-new diagrams must render). The broken sequence diagram was treated as derived → never rendered → shipped broken.
- **Root cause:** Derivation is assumed faithful, but conversion still introduces footguns (semicolons, `\n`, quoting).
- **Fix:** Make "render all diagrams at least once and confirm they parse" a mandatory finalize step for the SDD builder regardless of provenance. The render gate from #2 makes this cheap and automatic.

### 7. `egp-import` did not surface its steps when invoked via the Skill tool
- **What happened:** Invoking the import skill returned only `Launching skill: …` with no instructions; I had to `cat` the `SKILL.md` manually to proceed.
- **Root cause:** Unknown (may be host-specific), but every builder depends on its steps being presented on invocation.
- **Fix:** Verify skills reliably emit their body on load in this host; if not, document the fallback.

### 8. Builders invent a date
- **What happened:** PRD/ADR/SDD front-matter `date:` was set from conversational context (`2026-06-26`); a builder run without that context would guess.
- **Fix:** Have the workflow pass the current date into each builder so front-matter dates are consistent and never fabricated.

### 9. `validate-structure` requires every subsection heading even when N/A
- **What happened:** A `[WARN] structure: missing backend for frontend (bff)` until I added an explicit `### Backend for Frontend (BFF)` → `n/a` stub.
- **Fix (minor):** Reasonable check, but the SDD builder could auto-emit `n/a` stubs for inapplicable subsections so authors don't trip the warning.

---

## What worked well (keep)
- `mermaid-preview.js` produces a **self-contained, offline** HTML (Mermaid vendored) — exactly the right verification artifact; it should be the default pre-finalize step (see #6).
- `traceability.js` cleanly reported **0 orphans** with symmetric ID expansion (e.g. `FR-007/009`), and the AR→FR / UAT back-reference tables are genuinely useful.
- `adr-index.js` bidirectional supersede/amend reciprocity check is a strong guard.
- Derive-then-confirm + the single confirmation-batch contract kept the question load low while importing a complete existing doc set.

---

## Suggested priority order
1. **P0 (diagram approval)** — make "serve at a URL + get explicit approval" a mandatory, blocking step for all diagrams. Closes the process gap that let a broken diagram ship to the reviewer.
2. **#4 / #5** — make the gate pass on valid output (highest trust impact).
3. **#1 / #2 / #3 / #6** — real Mermaid parse gate + always-render; closes the class of bug that reached UAT.
4. **#7 / #8 / #9** — polish.
