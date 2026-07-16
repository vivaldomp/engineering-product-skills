# Feedback 008 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four subsystems the 008 foundation phase deferred — metadata sidecars, release promotion, a machine-readable engineering graph, and per-run receipts plus telemetry.

**Architecture:** Three new zero-dependency Node scripts (`meta.js`, `graph.js`, `promote.js`) join the existing suite; `snapshot.js` calls the first two at finalize and writes receipts afterward. All layout constants land in `workspace-paths.js`, which is already the single source of truth for the layout. Nothing in the foundation layout changes shape.

**Tech Stack:** Node built-ins only (`node:fs`, `node:path`, `node:crypto`), CommonJS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-15-feedback-008-phase2-design.md`

## Global Constraints

- Node built-ins only — **zero dependencies**. Never add a package.
- CommonJS (`require`/`module.exports`), matching every existing script.
- Test command is `node --test tests/*.test.js`. The bare-directory form (`node --test tests/`) **fails** on this Node version — never use it.
- `workspace-paths.js` is the single source of truth for layout constants. No script hardcodes a workspace path.
- `TEMPLATE_FOR` is keyed by **exact relative document path**. Consumers iterate its entries calling `existsSync` on each key, so it must never gain a directory-shaped key.
- Sidecars cover **authored** artifacts only (the four documents, ADRs, import artifacts) — never **regenerated** ones (`traceability.{md,html,json}`, `artifacts.graph.json`).
- `meta.js --check` **always exits 0**. `MODIFIED` is normal while authoring; a non-zero exit would pull drift into the consistency gate.
- Receipt/telemetry write failure **warns and exits 0** — never fails a finalize whose package is already valid.
- No `duration` field, no `execution.db`, no `current -> run` symlink. These are recorded deviations, not oversights.
- Existing suite is 188 passing tests. Never break one to make a new one pass.

## File Structure

| File | Responsibility |
| --- | --- |
| `plugins/product-design-suite/scripts/workspace-paths.js` | **Modify.** Add phase-2 layout constants + `TEMPLATE_FOR` (moved here) + `DEPENDS` + `IMPORT_ARTIFACTS`. |
| `plugins/product-design-suite/scripts/validate-structure.js` | **Modify.** Import `TEMPLATE_FOR` instead of defining it. |
| `plugins/product-design-suite/scripts/meta.js` | **Create.** Sidecar write/check. Owns which artifacts are covered and how they're named. |
| `plugins/product-design-suite/scripts/graph.js` | **Create.** `traceability.json` + `artifacts.graph.json` + `--impact`. |
| `plugins/product-design-suite/scripts/promote.js` | **Create.** `history/<run-id>` → `releases/<name>`. |
| `plugins/product-design-suite/scripts/snapshot.js` | **Modify.** Call meta + graph before the copy; write receipt + telemetry after. |
| `plugins/product-design-suite/commands/egp-promote.md` | **Create.** User-facing promotion command. |
| `plugins/product-design-suite/skills/egp-import/SKILL.md` | **Modify.** Add the finalize snapshot step. |
| `plugins/product-design-suite/shared/references/structures.md` | **Modify.** Reserved-names paragraph + workspace tree. |
| `tests/{meta,graph,promote}.test.js` | **Create.** One per new script. |
| `tests/{workspace-paths,snapshot}.test.js` | **Modify.** New constants; new snapshot behaviour. |

**Task order matters:** Task 1 defines constants every later task imports. Task 5 consumes Tasks 2 and 3.

---

### Task 1: Layout constants

**Files:**
- Modify: `plugins/product-design-suite/scripts/workspace-paths.js`
- Modify: `plugins/product-design-suite/scripts/validate-structure.js:8-14`
- Test: `tests/workspace-paths.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `W.RELEASES`, `W.RECEIPTS`, `W.TELEMETRY`, `W.RUNS_LOG`, `W.IMPORT_ARTIFACTS` (array of relative paths), `W.TEMPLATE_FOR` (object: relative doc path → template filename), `W.DEPENDS` (object: relative doc path → array of relative doc paths).

- [ ] **Step 1: Write the failing test**

Append to `tests/workspace-paths.test.js`:

```js
test('phase-2 layout constants', () => {
  assert.equal(W.RELEASES, path.join('workspace', 'outputs', 'releases'));
  assert.equal(W.RECEIPTS, path.join('.engineering', 'receipts'));
  assert.equal(W.TELEMETRY, path.join('.engineering', 'telemetry'));
  assert.equal(W.RUNS_LOG, path.join('.engineering', 'telemetry', 'runs.jsonl'));
});

test('TEMPLATE_FOR is keyed by exact doc path, with no directory keys', () => {
  assert.equal(W.TEMPLATE_FOR[W.REL.prd], 'prd-template.md');
  assert.equal(W.TEMPLATE_FOR[W.REL.sdd], 'sdd-template.md');
  assert.equal(Object.keys(W.TEMPLATE_FOR).length, 4);
  // A directory-shaped key would break validate-structure's existsSync loop.
  assert.equal(W.TEMPLATE_FOR[W.REL.adrDir], undefined);
});

test('DEPENDS encodes the authoring pipeline', () => {
  assert.deepEqual(W.DEPENDS[W.REL.srs], [W.REL.prd]);
  assert.deepEqual(W.DEPENDS[W.REL.sad], [W.REL.srs]);
  assert.deepEqual(W.DEPENDS[W.REL.sdd], [W.REL.sad]);
  assert.equal(W.DEPENDS[W.REL.prd], undefined);
});

test('IMPORT_ARTIFACTS names egp-import outputs', () => {
  assert.deepEqual(W.IMPORT_ARTIFACTS, [
    path.join('governance', 'import-gap-report.md'),
    path.join('governance', 'import-map.json'),
    path.join('governance', 'import-state.json'),
  ]);
});
```

If `tests/workspace-paths.test.js` does not already require `node:path`, add `const path = require('node:path');` to its requires.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/workspace-paths.test.js`
Expected: FAIL — `W.RELEASES` is `undefined`, so `assert.equal` reports `undefined !== 'workspace/outputs/releases'`.

- [ ] **Step 3: Add the constants**

In `plugins/product-design-suite/scripts/workspace-paths.js`, after the `CONFIG` line, add:

```js
const RELEASES = path.join(WORKSPACE, 'outputs', 'releases');
const RECEIPTS = path.join(ENGINEERING, 'receipts');
const TELEMETRY = path.join(ENGINEERING, 'telemetry');
const RUNS_LOG = path.join(TELEMETRY, 'runs.jsonl');
```

After the `REL` object, add:

```js
// Template per authored document. Keyed by exact relative path: consumers
// iterate these entries calling existsSync, so no directory-shaped keys.
const TEMPLATE_FOR = {
  [REL.prd]: 'prd-template.md',
  [REL.srs]: 'srs-template.md',
  [REL.sad]: 'sad-template.md',
  [REL.sdd]: 'sdd-template.md',
};

// The suite's fixed authoring pipeline. ADRs depend on the SAD; that edge is
// resolved in meta.js because ADR filenames vary.
const DEPENDS = {
  [REL.srs]: [REL.prd],
  [REL.sad]: [REL.srs],
  [REL.sdd]: [REL.sad],
};

// Authored once by egp-import and read by downstream builders — unlike
// traceability.*, which is regenerated on every finalize.
const IMPORT_ARTIFACTS = [
  path.join('governance', 'import-gap-report.md'),
  path.join('governance', 'import-map.json'),
  path.join('governance', 'import-state.json'),
];
```

Extend `module.exports` to:

```js
module.exports = {
  WORKSPACE, CURRENT, HISTORY, INPUTS, CACHE, ENGINEERING, CONFIG,
  RELEASES, RECEIPTS, TELEMETRY, RUNS_LOG,
  REL, TEMPLATE_FOR, DEPENDS, IMPORT_ARTIFACTS,
  docPath, adrDir, governanceDir, resolveCurrent,
};
```

- [ ] **Step 4: Point validate-structure.js at the shared constant**

In `plugins/product-design-suite/scripts/validate-structure.js`, delete the local definition on lines 9-14:

```js
const TEMPLATE_FOR = {
  [W.REL.prd]: 'prd-template.md',
  [W.REL.srs]: 'srs-template.md',
  [W.REL.sad]: 'sad-template.md',
  [W.REL.sdd]: 'sdd-template.md',
};
```

Replace it with:

```js
const TEMPLATE_FOR = W.TEMPLATE_FOR;
```

Leave `TEMPLATE_DIR` and everything else in the file untouched.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS — the 4 new tests pass and all 188 existing tests still pass. The structure tests exercise `validate-structure.js` against the moved constant.

- [ ] **Step 6: Commit**

```bash
git add plugins/product-design-suite/scripts/workspace-paths.js plugins/product-design-suite/scripts/validate-structure.js tests/workspace-paths.test.js
git commit -m "feat(paths): phase-2 layout constants; TEMPLATE_FOR moves to the layout module"
```

---

### Task 2: Metadata sidecars

**Files:**
- Create: `plugins/product-design-suite/scripts/meta.js`
- Test: `tests/meta.test.js`

**Already verified — do not re-investigate:** this task drops `.meta.json` files
into `architecture/adr/`, which three scripts list. All three already filter for
`.md` (`adr-index.js:18`, `consistency-gate.js:48`, `traceability.js:300`), as do
the generic `.md` walkers in `lint-ids.js` and `mermaid-lint.js`. Sidecars in the
ADR directory are safe and require no changes to those scripts.

**Interfaces:**
- Consumes: `W.TEMPLATE_FOR`, `W.DEPENDS`, `W.IMPORT_ARTIFACTS`, `W.REL`, `W.adrDir`, `W.resolveCurrent` from Task 1.
- Produces:
  - `writeSidecars({ root, skill, runId, now, version, inputs }) -> { written: string[], preserved: string[] }` — `root` is the **current root** (an absolute path to `workspace/outputs/current`), not the project root. Returned paths are relative to `root`.
  - `checkSidecars(root) -> [{ file, status: 'OK'|'MODIFIED'|'MISSING', runId }]`
  - `coveredDocs(root) -> string[]` (relative paths)
  - `sidecarPath(rel) -> string`, `hashFile(abs) -> string`, `readSidecar(abs) -> object|null`, `templateFor(rel)`, `dependsOn(rel)`

- [ ] **Step 1: Write the failing tests**

Create `tests/meta.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const M = require('../plugins/product-design-suite/scripts/meta.js');

// meta.js operates on a current root directly, so fixtures write relative paths under it.
function current(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

const read = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('sidecars cover authored artifacts but not regenerated reports', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'governance/traceability.md': 'generated every finalize',
    'governance/import-map.json': '{}',
  });
  const { written } = M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  assert.deepEqual(written.sort(), [
    path.join('governance', 'import-map.json'),
    path.join('planning', 'prd.md'),
  ].sort());
  assert.ok(fs.existsSync(path.join(root, 'planning', 'prd.meta.json')));
  assert.ok(fs.existsSync(path.join(root, 'governance', 'import-map.meta.json')));
  assert.ok(!fs.existsSync(path.join(root, 'governance', 'traceability.meta.json')));
});

test('a hand-edited doc reports MODIFIED, naming the run that last wrote it', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: '2026-07-15T103422', version: '0.1.1' });
  assert.deepEqual(M.checkSidecars(root).map(r => r.status), ['OK']);
  fs.writeFileSync(path.join(root, 'planning', 'prd.md'), 'FR-001 edited by hand');
  const [r] = M.checkSidecars(root);
  assert.equal(r.status, 'MODIFIED');
  assert.equal(r.runId, '2026-07-15T103422');
});

test('a doc with no sidecar reports MISSING', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  assert.deepEqual(M.checkSidecars(root), [
    { file: path.join('planning', 'prd.md'), status: 'MISSING', runId: null },
  ]);
});

// The load-bearing behaviour: an untouched doc keeps its provenance across runs,
// while a doc that actually changed is re-attributed to the run that changed it.
test('unchanged docs keep provenance; changed docs take the new run', () => {
  const root = current({ 'planning/prd.md': 'FR-001', 'specifications/srs.md': 'FR-001 detail' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  fs.writeFileSync(path.join(root, 'specifications', 'srs.md'), 'FR-001 detail, revised');
  const { written, preserved } = M.writeSidecars({ root, skill: 'egp-srs-builder', runId: 'R2', version: '0.1.1' });

  assert.deepEqual(written, [path.join('specifications', 'srs.md')]);
  assert.deepEqual(preserved, [path.join('planning', 'prd.md')]);

  const prd = read(root, 'planning/prd.meta.json');
  assert.equal(prd.runId, 'R1');
  assert.equal(prd.skill, 'egp-prd-builder');

  const srs = read(root, 'specifications/srs.meta.json');
  assert.equal(srs.runId, 'R2');
  assert.equal(srs.skill, 'egp-srs-builder');
});

test('ADR sidecars resolve the ADR template and depend on the SAD', () => {
  const root = current({ 'architecture/adr/ADR-001-cache.md': 'Decision body' });
  M.writeSidecars({ root, skill: 'egp-adr-builder', runId: 'R1', version: '0.1.1' });
  const m = read(root, 'architecture/adr/ADR-001-cache.meta.json');
  assert.equal(m.template, 'adr-template.md');
  assert.deepEqual(m.dependsOn, [W.REL.sad]);
  assert.equal(m.author, 'product-design-suite@0.1.1');
  assert.match(m.hash, /^sha256:[0-9a-f]{64}$/);
});

test('inputs are recorded on an import run and empty otherwise', () => {
  const root = current({ 'governance/import-map.json': '{}', 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-import', runId: 'R1', version: '0.1.1', inputs: ['legacy-spec.md'] });
  const imp = read(root, 'governance/import-map.meta.json');
  assert.deepEqual(imp.inputs, ['legacy-spec.md']);
  assert.equal(imp.template, null);
  assert.deepEqual(imp.dependsOn, []);

  const root2 = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root: root2, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  assert.deepEqual(read(root2, 'planning/prd.meta.json').inputs, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/meta.test.js`
Expected: FAIL — `Cannot find module '.../scripts/meta.js'`.

- [ ] **Step 3: Write meta.js**

Create `plugins/product-design-suite/scripts/meta.js`:

```js
// Per-artifact metadata sidecars (feedback 008 phase 2). A sidecar records the
// run that last CHANGED its artifact — not merely the last run that occurred.
// That is what makes `--check` a drift signal: after a finalize, a hash that no
// longer matches means a human edited the file since.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const W = require('./workspace-paths.js');

const isAdr = rel => rel.startsWith(W.REL.adrDir + path.sep);

// prd.md -> prd.meta.json; import-map.json -> import-map.meta.json
function sidecarPath(rel) {
  return rel.replace(/\.[^.\\/]+$/, '.meta.json');
}

function hashFile(abs) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

// Authored artifacts only. Regenerated outputs (traceability.*, the graph
// files) are deliberately excluded: their hash can never signal drift, because
// nothing but the generator ever changes them.
function coveredDocs(root) {
  const out = [];
  for (const rel of [...Object.keys(W.TEMPLATE_FOR), ...W.IMPORT_ARTIFACTS]) {
    if (fs.existsSync(path.join(root, rel))) out.push(rel);
  }
  const adrs = W.adrDir(root);
  if (fs.existsSync(adrs)) {
    for (const f of fs.readdirSync(adrs).sort()) {
      if (f.endsWith('.md')) out.push(path.join(W.REL.adrDir, f));
    }
  }
  return out;
}

// TEMPLATE_FOR carries no ADR key by design (it is keyed by exact path and
// validate-structure existsSync-loops it), so ADRs resolve here.
function templateFor(rel) {
  return W.TEMPLATE_FOR[rel] || (isAdr(rel) ? 'adr-template.md' : null);
}

function dependsOn(rel) {
  return W.DEPENDS[rel] || (isAdr(rel) ? [W.REL.sad] : []);
}

function readSidecar(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return null; }
}

function writeSidecars({ root, skill, runId, now = new Date(), version = 'unknown', inputs = [] } = {}) {
  const written = [], preserved = [];
  for (const rel of coveredDocs(root)) {
    const metaAbs = path.join(root, sidecarPath(rel));
    const hash = hashFile(path.join(root, rel));
    const prior = readSidecar(metaAbs);
    if (prior && prior.hash === hash) { preserved.push(rel); continue; }
    fs.writeFileSync(metaAbs, JSON.stringify({
      skill: skill || 'unknown',
      template: templateFor(rel),
      author: `product-design-suite@${version}`,
      generatedAt: now.toISOString(),
      runId: runId || null,
      hash,
      inputs,
      dependsOn: dependsOn(rel),
    }, null, 2) + '\n');
    written.push(rel);
  }
  return { written, preserved };
}

function checkSidecars(root) {
  return coveredDocs(root).map(rel => {
    const prior = readSidecar(path.join(root, sidecarPath(rel)));
    if (!prior) return { file: rel, status: 'MISSING', runId: null };
    const status = prior.hash === hashFile(path.join(root, rel)) ? 'OK' : 'MODIFIED';
    return { file: rel, status, runId: prior.runId || null };
  });
}

module.exports = {
  sidecarPath, hashFile, coveredDocs, templateFor, dependsOn,
  readSidecar, writeSidecars, checkSidecars,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = W.resolveCurrent(args.find(a => !a.startsWith('--')));
  if (args.includes('--check')) {
    for (const r of checkSidecars(dir)) {
      console.log(`${r.file}: ${r.status}${r.status === 'MODIFIED' ? ` since run ${r.runId}` : ''}`);
    }
    // Informational by design: MODIFIED is the normal state while authoring, so
    // this must not become a gate. Always exit 0.
    process.exit(0);
  }
  const { written, preserved } = writeSidecars({ root: dir });
  console.log(`meta: ${written.length} written, ${preserved.length} preserved`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/meta.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run the full suite**

Run: `node --test tests/*.test.js`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add plugins/product-design-suite/scripts/meta.js tests/meta.test.js
git commit -m "feat(meta): per-artifact sidecars with hash-based drift detection"
```

---

### Task 3: Engineering graph

**Files:**
- Create: `plugins/product-design-suite/scripts/graph.js`
- Test: `tests/graph.test.js`

**Interfaces:**
- Consumes: `M.coveredDocs`, `M.sidecarPath`, `M.readSidecar`, `M.dependsOn` (Task 2); `trace.parseRefs`, `trace.buildMatrix`, `trace.loadProduct` (existing `traceability.js` exports); `W.REL`, `W.governanceDir`, `W.resolveCurrent` (Task 1).
- Produces:
  - `buildGraph(root) -> { nodes: [{ id, type, skill, runId, hash }], edges: [{ from, to, kind, count }] }` — `id` values are POSIX-style relative paths.
  - `impact(graph, fileRel) -> [{ file, via }]`
  - `writeGraph(root) -> { matrix, graph }`

`trace.parseRefs(text) -> string[]` returns sorted unique requirement IDs. `trace.buildMatrix(trace.loadProduct(root))` returns `{ requirements, ars, uats, orphans, unclassified, constraints }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/graph.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../plugins/product-design-suite/scripts/meta.js');
const G = require('../plugins/product-design-suite/scripts/graph.js');

function current(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

const edgesOf = (g, kind) => g.edges.filter(e => e.kind === kind);

test('dependsOn edges follow the authoring pipeline, only between present docs', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'specifications/srs.md': 'FR-001',
    'architecture/sdd.md': 'FR-001',
  });
  const g = G.buildGraph(root);
  const deps = edgesOf(g, 'dependsOn').map(e => `${e.from}->${e.to}`);
  assert.ok(deps.includes('specifications/srs.md->planning/prd.md'));
  // sad.md is absent, so sdd->sad must not appear.
  assert.ok(!deps.some(d => d.endsWith('->architecture/sad.md')));
});

test('nodes carry sidecar provenance and are typed', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  const [node] = G.buildGraph(root).nodes;
  assert.equal(node.id, 'planning/prd.md');
  assert.equal(node.type, 'prd');
  assert.equal(node.skill, 'egp-prd-builder');
  assert.equal(node.runId, 'R1');
  assert.match(node.hash, /^sha256:/);
});

test('shared-refs edges carry the shared id count, one normalized pair each', () => {
  const root = current({
    'planning/prd.md': 'FR-001 and FR-002 and FR-003',
    'architecture/sdd.md': 'covers FR-001 and FR-002',
  });
  const shared = edgesOf(G.buildGraph(root), 'shared-refs');
  assert.equal(shared.length, 1);
  assert.equal(shared[0].from, 'architecture/sdd.md');
  assert.equal(shared[0].to, 'planning/prd.md');
  assert.equal(shared[0].count, 2);
});

test('impact walks dependsOn transitively', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'specifications/srs.md': 'FR-001',
    'architecture/sad.md': 'AR-001 traces to FR-001',
    'architecture/sdd.md': 'FR-001',
  });
  const rows = G.impact(G.buildGraph(root), 'planning/prd.md');
  const files = rows.map(r => r.file);
  assert.ok(files.includes('specifications/srs.md'));
  assert.ok(files.includes('architecture/sad.md'));  // transitive: sad -> srs -> prd
  assert.ok(files.includes('architecture/sdd.md'));  // transitive: sdd -> sad
  assert.ok(!files.includes('planning/prd.md'));     // never itself
});

test('missing documents produce no node rather than a crash', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  const g = G.buildGraph(root);
  assert.deepEqual(g.nodes.map(n => n.id), ['planning/prd.md']);
  assert.deepEqual(g.edges, []);
});

test('writeGraph emits both json files into governance', () => {
  const root = current({ 'planning/prd.md': 'FR-001', 'architecture/sdd.md': 'covers FR-001' });
  const { matrix, graph } = G.writeGraph(root);
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'governance', 'traceability.json'), 'utf8'));
  assert.deepEqual(onDisk.requirements.map(r => r.id), ['FR-001']);
  assert.equal(matrix.orphans.length, 0);
  const g = JSON.parse(fs.readFileSync(path.join(root, 'governance', 'artifacts.graph.json'), 'utf8'));
  assert.deepEqual(g, graph);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/graph.test.js`
Expected: FAIL — `Cannot find module '.../scripts/graph.js'`.

- [ ] **Step 3: Write graph.js**

Create `plugins/product-design-suite/scripts/graph.js`:

```js
// Engineering graph (feedback 008 phase 2). Two views, both regenerated on
// every finalize: traceability.json (the requirement matrix, serialized) and
// artifacts.graph.json (document-level nodes and edges).
//
// No lineage.json: PRD->SRS->SAD->SDD is a fixed pipeline in this suite, so a
// file restating it carries no information. The constant lives once, in
// workspace-paths.js, where it generates real edges.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');
const M = require('./meta.js');
const trace = require('./traceability.js');

const toPosix = p => p.split(path.sep).join('/');

function typeOf(rel) {
  for (const key of ['prd', 'srs', 'sad', 'sdd']) {
    if (W.REL[key] === rel) return key;
  }
  return rel.startsWith(W.REL.adrDir + path.sep) ? 'adr' : 'import';
}

function buildGraph(root) {
  const covered = M.coveredDocs(root);
  const present = new Set(covered);

  const nodes = covered.map(rel => {
    const meta = M.readSidecar(path.join(root, M.sidecarPath(rel))) || {};
    return {
      id: toPosix(rel),
      type: typeOf(rel),
      skill: meta.skill || null,
      runId: meta.runId || null,
      hash: meta.hash || null,
    };
  });

  const edges = [];
  for (const rel of covered) {
    for (const dep of M.dependsOn(rel)) {
      if (present.has(dep)) edges.push({ from: toPosix(rel), to: toPosix(dep), kind: 'dependsOn', count: 1 });
    }
  }

  // shared-refs: two documents citing the same requirement IDs. Undirected in
  // meaning, so pairs are emitted once in lexicographic order.
  const refs = new Map();
  for (const rel of covered) {
    if (!rel.endsWith('.md')) continue;
    refs.set(rel, new Set(trace.parseRefs(fs.readFileSync(path.join(root, rel), 'utf8'))));
  }
  const withRefs = [...refs.keys()].sort();
  for (let i = 0; i < withRefs.length; i++) {
    for (let j = i + 1; j < withRefs.length; j++) {
      const a = withRefs[i], b = withRefs[j];
      const count = [...refs.get(a)].filter(id => refs.get(b).has(id)).length;
      if (count) edges.push({ from: toPosix(a), to: toPosix(b), kind: 'shared-refs', count });
    }
  }
  return { nodes, edges };
}

// "Architecture changed -> what do I regenerate?" Walks dependsOn in reverse
// (who depends on this, and who depends on those), then lists shared-ref peers.
function impact(graph, fileRel) {
  const id = toPosix(fileRel);
  const seen = new Set([id]);
  const out = [];
  let frontier = [id];
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) {
      for (const e of graph.edges) {
        if (e.kind === 'dependsOn' && e.to === cur && !seen.has(e.from)) {
          seen.add(e.from);
          out.push({ file: e.from, via: 'dependsOn' });
          next.push(e.from);
        }
      }
    }
    frontier = next;
  }
  for (const e of graph.edges) {
    if (e.kind !== 'shared-refs') continue;
    const other = e.from === id ? e.to : (e.to === id ? e.from : null);
    if (other && !seen.has(other)) {
      seen.add(other);
      out.push({ file: other, via: `${e.count} shared requirement ref(s)` });
    }
  }
  return out;
}

function writeGraph(root) {
  const gov = W.governanceDir(root);
  fs.mkdirSync(gov, { recursive: true });
  const matrix = trace.buildMatrix(trace.loadProduct(root));
  fs.writeFileSync(path.join(gov, 'traceability.json'), JSON.stringify(matrix, null, 2) + '\n');
  const graph = buildGraph(root);
  fs.writeFileSync(path.join(gov, 'artifacts.graph.json'), JSON.stringify(graph, null, 2) + '\n');
  return { matrix, graph };
}

module.exports = { buildGraph, impact, writeGraph, typeOf };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf('--' + n); return i === -1 ? undefined : args[i + 1]; };
  const target = opt('impact');
  const dir = W.resolveCurrent(args.find(a => !a.startsWith('--') && a !== target));
  if (args.includes('--impact')) {
    if (!target) {
      console.error('graph: --impact needs a file, e.g. --impact architecture/sad.md');
      process.exit(1);
    }
    const rows = impact(buildGraph(dir), target);
    console.log(`downstream of ${target}:`);
    for (const r of rows) console.log(`  ${r.file}  (${r.via})`);
    if (!rows.length) console.log('  (nothing)');
    process.exit(0);
  }
  const { matrix, graph } = writeGraph(dir);
  console.log(`wrote governance/traceability.json (${matrix.requirements.length} requirements)`);
  console.log(`wrote governance/artifacts.graph.json (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/graph.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Verify the impact CLI by hand**

Run:
```bash
node -e "
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const r=fs.mkdtempSync(path.join(os.tmpdir(),'g-'));
for(const [p,c] of [['planning/prd.md','FR-001'],['specifications/srs.md','FR-001'],['architecture/sad.md','AR-001 traces to FR-001'],['architecture/sdd.md','FR-001']]){
  fs.mkdirSync(path.join(r,path.dirname(p)),{recursive:true});fs.writeFileSync(path.join(r,p),c);
}
console.log(r);
" 
```
Take the printed temp path and run:
`node plugins/product-design-suite/scripts/graph.js --impact planning/prd.md <printed-path>`
Expected: prints `downstream of planning/prd.md:` followed by `specifications/srs.md  (dependsOn)` and the transitive `architecture/sad.md` / `architecture/sdd.md` lines.

- [ ] **Step 6: Run the full suite**

Run: `node --test tests/*.test.js`
Expected: PASS — no regressions.

- [ ] **Step 7: Commit**

```bash
git add plugins/product-design-suite/scripts/graph.js tests/graph.test.js
git commit -m "feat(graph): traceability.json + artifacts.graph.json with impact query"
```

---

### Task 4: Release promotion

**Files:**
- Create: `plugins/product-design-suite/scripts/promote.js`
- Create: `plugins/product-design-suite/commands/egp-promote.md`
- Test: `tests/promote.test.js`

**Interfaces:**
- Consumes: `W.HISTORY`, `W.RELEASES` (Task 1).
- Produces: `promote({ run, as, force, projectRoot, now }) -> { dest, release }`; `nextVersion(releasesDir) -> string`.

Note `promote` takes a **project root** (the directory containing `workspace/`), unlike `meta.js`/`graph.js` which take a current root. It reads the run's `manifest.json` for the artifact list rather than re-walking the tree — the manifest already lists exactly those files.

- [ ] **Step 1: Write the failing tests**

Create `tests/promote.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const P = require('../plugins/product-design-suite/scripts/promote.js');

// Hand-built history package: keeps promote's tests independent of snapshot.
function project(runId, status, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prom-'));
  const dir = path.join(root, W.HISTORY, runId);
  for (const [rel, c] of Object.entries(files)) {
    const p = path.join(dir, 'artifacts', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  }
  fs.mkdirSync(path.join(dir, 'validation'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'validation', 'gate.json'), JSON.stringify({
    pass: status === 'success',
    checks: [{ name: 'traceability', level: 'error', pass: status === 'success', detail: 'orphans: FR-002' }],
  }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    runId, status, artifacts: Object.keys(files),
  }));
  return root;
}

const GOOD = { 'planning/prd.md': 'FR-001' };

test('promoting a successful run writes releases/v1 with provenance', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const { dest, release } = P.promote({ run: '2026-07-15T103422', projectRoot: root, now: new Date('2026-07-15T20:10:00Z') });
  assert.equal(path.basename(dest), 'v1');
  assert.equal(release.release, 'v1');
  assert.equal(release.runId, '2026-07-15T103422');
  assert.equal(release.fromStatus, 'success');
  assert.equal(release.forced, false);
  assert.deepEqual(release.artifacts, ['planning/prd.md']);
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.md')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'release.json'), 'utf8')), release);
});

test('the next promotion auto-names v2', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  P.promote({ run: '2026-07-15T103422', projectRoot: root });
  const { dest } = P.promote({ run: '2026-07-15T103422', projectRoot: root });
  assert.equal(path.basename(dest), 'v2');
});

test('--as overrides the name', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  const { dest } = P.promote({ run: '2026-07-15T103422', as: 'v1.2.0', projectRoot: root });
  assert.equal(path.basename(dest), 'v1.2.0');
});

test('a gate-failed run is refused, naming the error count', () => {
  const root = project('2026-07-15T103422', 'gate-failed', GOOD);
  assert.throws(
    () => P.promote({ run: '2026-07-15T103422', projectRoot: root }),
    /gate-failed \(1 gate error\(s\)/,
  );
  assert.ok(!fs.existsSync(path.join(root, W.RELEASES)));
});

test('--force promotes a gate-failed run and records the override', () => {
  const root = project('2026-07-15T103422', 'gate-failed', GOOD);
  const { release } = P.promote({ run: '2026-07-15T103422', force: true, projectRoot: root });
  assert.equal(release.forced, true);
  assert.equal(release.fromStatus, 'gate-failed');
});

test('an existing destination is refused', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  P.promote({ run: '2026-07-15T103422', as: 'v1', projectRoot: root });
  assert.throws(() => P.promote({ run: '2026-07-15T103422', as: 'v1', projectRoot: root }), /already exists/);
});

test('an unknown run is refused', () => {
  const root = project('2026-07-15T103422', 'success', GOOD);
  assert.throws(() => P.promote({ run: 'nope', projectRoot: root }), /no run nope/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/promote.test.js`
Expected: FAIL — `Cannot find module '.../scripts/promote.js'`.

- [ ] **Step 3: Write promote.js**

Create `plugins/product-design-suite/scripts/promote.js`:

```js
// Release promotion (feedback 008 phase 2): history/<run-id> -> releases/<name>.
//
// Promotion sources only from history. Promoting the live current/ tree is not
// supported: it would produce a release no gate ever validated.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');

function nextVersion(releasesDir) {
  let max = 0;
  if (fs.existsSync(releasesDir)) {
    for (const f of fs.readdirSync(releasesDir)) {
      const m = f.match(/^v(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `v${max + 1}`;
}

function gateErrorCount(runDir) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(runDir, 'validation', 'gate.json'), 'utf8'));
    return g.checks.filter(c => c.level === 'error' && !c.pass).length;
  } catch { return 0; }
}

function promote({ run, as, force = false, projectRoot = '.', now = new Date() } = {}) {
  if (!run) throw new Error('promote: --run <run-id> is required');
  const runDir = path.resolve(projectRoot, W.HISTORY, run);
  const manifestPath = path.join(runDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`promote: no run ${run} under ${W.HISTORY}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.status !== 'success' && !force) {
    throw new Error(
      `promote: run ${run} is ${manifest.status} (${gateErrorCount(runDir)} gate error(s); see ` +
      `${path.join(W.HISTORY, run, 'validation', 'gate.json')}). ` +
      'Refusing — re-run the gate, or pass --force.');
  }

  const releasesDir = path.resolve(projectRoot, W.RELEASES);
  const name = as || nextVersion(releasesDir);
  const dest = path.join(releasesDir, name);
  if (fs.existsSync(dest)) {
    throw new Error(`promote: ${path.join(W.RELEASES, name)} already exists; pick another --as name`);
  }

  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(runDir, 'artifacts'), path.join(dest, 'artifacts'), { recursive: true });

  const release = {
    release: name,
    runId: manifest.runId,
    promotedAt: now.toISOString(),
    fromStatus: manifest.status,
    // Only true when a failing status was overridden, so the override stays
    // visible for the life of the release.
    forced: manifest.status !== 'success',
    artifacts: manifest.artifacts,
  };
  fs.writeFileSync(path.join(dest, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  return { dest, release };
}

module.exports = { promote, nextVersion };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf('--' + n); return i === -1 ? undefined : args[i + 1]; };
  try {
    const { dest, release } = promote({
      run: opt('run'), as: opt('as'), force: args.includes('--force'), projectRoot: opt('root') || '.',
    });
    console.log(`promote: wrote ${path.relative(process.cwd(), dest)}${release.forced ? ' (forced)' : ''} ` +
      `from run ${release.runId} (${release.artifacts.length} artifact(s))`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/promote.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write the command**

Read an existing command first to match its front-matter and tone: `plugins/product-design-suite/commands/egp-adr.md`.

Create `plugins/product-design-suite/commands/egp-promote.md` following that file's front-matter shape, with this body:

```markdown
Promote an immutable run package to a named release.

Run:

`node "${CLAUDE_PLUGIN_ROOT}/scripts/promote.js" --run <run-id> [--as <name>] [--force]`

- `--run` is a directory name under `workspace/outputs/history/`, e.g. `2026-07-15T103422`.
- `--as` names the release; omit it to take the next free `vN`.
- A gate-failed run is refused. `--force` promotes it anyway and records
  `"forced": true` in `release.json`.

Releases land in `workspace/outputs/releases/<name>/` with `release.json` and a
full `artifacts/` copy. Releases are immutable: never edit files under
`workspace/outputs/releases/` or `workspace/outputs/history/`.

To list available runs: `ls workspace/outputs/history/`
```

Set the front-matter `description` to: `Promote a run package from workspace/outputs/history/ to a named release under workspace/outputs/releases/. Use when a finalized run should become v1, v2, or a named release.`

- [ ] **Step 6: Run the full suite**

Run: `node --test tests/*.test.js`
Expected: PASS — no regressions.

- [ ] **Step 7: Commit**

```bash
git add plugins/product-design-suite/scripts/promote.js plugins/product-design-suite/commands/egp-promote.md tests/promote.test.js
git commit -m "feat(promote): history -> releases with gate-failed refusal and /egp-promote"
```

---

### Task 5: Snapshot integration

**Files:**
- Modify: `plugins/product-design-suite/scripts/snapshot.js`
- Modify: `plugins/product-design-suite/skills/egp-import/SKILL.md`
- Test: `tests/snapshot.test.js`

**Interfaces:**
- Consumes: `M.writeSidecars` (Task 2), `G.writeGraph` (Task 3), `W.RECEIPTS`, `W.RUNS_LOG`, `W.INPUTS` (Task 1).
- Produces: `snapshot()` keeps its existing `{ dest, manifest }` return — no signature change. Adds `writeReceipt({ projectRoot, manifest, gate, lint, now }) -> receipt` to the exports.

- [ ] **Step 1: Write the failing tests**

Append to `tests/snapshot.test.js`:

```js
test('the package carries sidecars and graph, and the run leaves a receipt', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  const now = new Date('2026-07-15T10:34:22');
  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', artifact: 'planning/prd.md', projectRoot: root, now });

  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.meta.json')));
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'governance', 'traceability.json')));
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'governance', 'artifacts.graph.json')));
  assert.ok(manifest.artifacts.includes('planning/prd.meta.json'));

  const receipt = JSON.parse(fs.readFileSync(path.join(root, W.RECEIPTS, `${manifest.runId}.json`), 'utf8'));
  assert.equal(receipt.runId, manifest.runId);
  assert.equal(receipt.skill, 'egp-prd-builder');
  assert.equal(receipt.status, 'success');
  assert.equal(receipt.nodeVersion, process.version);
  assert.deepEqual(receipt.gate.errors, []);
  // Deliberate: duration is unobservable from a finalize-time script.
  assert.equal(receipt.duration, undefined);
});

test('each run appends exactly one telemetry line', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  fs.writeFileSync(path.join(root, W.CURRENT, 'planning', 'prd.md'), 'FR-001 onboarding, revised.');
  S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:35:00') });

  const lines = fs.readFileSync(path.join(root, W.RUNS_LOG), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]);
  assert.equal(first.runId, '2026-07-15T103422');
  assert.equal(first.skill, 'egp-prd-builder');
  assert.equal(first.status, 'success');
  assert.equal(first.gateErrors, 0);
  assert.ok(first.artifactCount > 0);
});

test('an import run records its workspace inputs on the sidecars it writes', () => {
  const root = project({ 'governance/import-map.json': '{"targets":[]}' });
  const inputAbs = path.join(root, W.INPUTS, 'legacy-spec.md');
  fs.mkdirSync(path.dirname(inputAbs), { recursive: true });
  fs.writeFileSync(inputAbs, 'legacy content');

  S.snapshot({ skill: 'egp-import', artifact: 'governance/import-map.json', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  const meta = JSON.parse(fs.readFileSync(path.join(root, W.CURRENT, 'governance', 'import-map.meta.json'), 'utf8'));
  assert.deepEqual(meta.inputs, ['legacy-spec.md']);
  assert.equal(meta.skill, 'egp-import');
});

test('a receipt failure warns but never fails a finalize whose package is valid', (t) => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  // Occupy the receipts path with a file so mkdirSync of it throws.
  const eng = path.join(root, W.ENGINEERING);
  fs.mkdirSync(eng, { recursive: true });
  fs.writeFileSync(path.join(root, W.RECEIPTS), 'not a directory');
  t.mock.method(console, 'warn', () => {});

  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', projectRoot: root, now: new Date('2026-07-15T10:34:22') });
  assert.equal(manifest.status, 'success');
  assert.ok(fs.existsSync(path.join(dest, 'manifest.json')));
  assert.equal(console.warn.mock.callCount(), 1);
});
```

The import test uses a `governance/import-map.json`-only fixture: the gate's `inputs-present` check counts `*.md` files, so this run is `gate-failed`, which is fine — sidecars are written regardless of gate status, and this test asserts only on the sidecar.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/snapshot.test.js`
Expected: FAIL — no `prd.meta.json` in the package; `W.RECEIPTS` path does not exist.

- [ ] **Step 3: Wire meta and graph into snapshot**

In `plugins/product-design-suite/scripts/snapshot.js`, add to the requires:

```js
const M = require('./meta.js');
const G = require('./graph.js');
```

Replace the whole `snapshot` function with:

```js
function snapshot({ skill, artifact, projectRoot = '.', now = new Date() } = {}) {
  const current = path.resolve(projectRoot, W.CURRENT);
  if (!fs.existsSync(current)) throw new Error(`no ${W.CURRENT} under ${path.resolve(projectRoot)}`);
  const version = pluginVersion();

  // Run id is settled first: the sidecars written below record it.
  const historyRoot = path.resolve(projectRoot, W.HISTORY);
  const base = runId(now);
  let dest = path.join(historyRoot, base);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(historyRoot, `${base}-${i}`);
  const id = path.basename(dest);

  const gate = runGate(current);
  const lint = lintProduct(current);

  // Provenance and graph land in current/ BEFORE the copy, so the package is
  // self-contained. egp-import is the one skill that genuinely reads
  // workspace/inputs/, so it is the one whose inputs can be recorded honestly.
  const inputsDir = path.resolve(projectRoot, W.INPUTS);
  const inputs = (skill === 'egp-import' && fs.existsSync(inputsDir)) ? listFiles(inputsDir) : [];
  M.writeSidecars({ root: current, skill, runId: id, now, version, inputs });
  G.writeGraph(current);

  fs.mkdirSync(path.join(dest, 'artifacts'), { recursive: true });
  fs.cpSync(current, path.join(dest, 'artifacts'), { recursive: true });
  const valDir = path.join(dest, 'validation');
  fs.mkdirSync(valDir);
  fs.writeFileSync(path.join(valDir, 'gate.json'), JSON.stringify(gate, null, 2));
  fs.writeFileSync(path.join(valDir, 'lint.json'), JSON.stringify(lint, null, 2));
  const traceMd = path.join(W.governanceDir(current), 'traceability.md');
  if (fs.existsSync(traceMd)) fs.copyFileSync(traceMd, path.join(valDir, 'traceability.md'));

  const manifest = {
    runId: id,
    skill: skill || 'unknown',
    pluginVersion: version,
    status: gate.pass ? 'success' : 'gate-failed',
    finishedAt: now.toISOString(),
    primaryArtifact: artifact || null,
    artifacts: listFiles(path.join(dest, 'artifacts')),
    validation: { gatePass: gate.pass },
  };
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
  ensureConfig(projectRoot, version);

  // Derived bookkeeping. The package above is already written and validated, so
  // never fail a good finalize to protect an index.
  try {
    writeReceipt({ projectRoot, manifest, gate, lint, now });
  } catch (err) {
    console.warn(`snapshot: package written, but receipt/telemetry failed: ${err.message}`);
  }
  return { dest, manifest };
}
```

- [ ] **Step 4: Add writeReceipt**

In the same file, above `snapshot`, add:

```js
// Receipt = how the run went; manifest = what it produced. They share only the
// runId/status join key. Receipts live outside the packages so pruning old
// history still leaves the audit trail.
//
// No `duration`: this script is invoked at finalize and can measure only its own
// runtime, not the session that authored the documents.
function writeReceipt({ projectRoot, manifest, gate, lint, now }) {
  const errors = gate.checks.filter(c => c.level === 'error' && !c.pass).map(c => ({ name: c.name, detail: c.detail }));
  const receipt = {
    runId: manifest.runId,
    skill: manifest.skill,
    pluginVersion: manifest.pluginVersion,
    nodeVersion: process.version,
    status: manifest.status,
    finishedAt: now.toISOString(),
    gate: { pass: gate.pass, errors },
    lint: { malformed: lint.malformed.length, definitionDuplicates: lint.definitionDuplicates.length },
  };
  const dir = path.resolve(projectRoot, W.RECEIPTS);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${manifest.runId}.json`), JSON.stringify(receipt, null, 2) + '\n');

  const log = path.resolve(projectRoot, W.RUNS_LOG);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.appendFileSync(log, JSON.stringify({
    runId: manifest.runId,
    skill: manifest.skill,
    status: manifest.status,
    finishedAt: receipt.finishedAt,
    artifactCount: manifest.artifacts.length,
    gateErrors: errors.length,
  }) + '\n');
  return receipt;
}
```

Extend the exports line to:

```js
module.exports = { snapshot, runId, listFiles, ensureConfig, pluginVersion, writeReceipt };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/snapshot.test.js`
Expected: PASS — the 4 new tests plus the existing snapshot tests.

- [ ] **Step 6: Give egp-import a finalize snapshot**

Read `plugins/product-design-suite/skills/egp-import/SKILL.md`, then read `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md:50` to see how the five builders word their finalize step.

Add a matching finalize step to `egp-import`, after the step that writes `import-state.json`, worded to match the builders:

```markdown
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill egp-import --artifact governance/import-gap-report.md`

   This records the import as an immutable run package and stamps the
   `workspace/inputs/` listing onto the import artifacts' metadata sidecars.
   Never edit files under `workspace/outputs/history/`.
```

- [ ] **Step 7: Run the full suite**

Run: `node --test tests/*.test.js`
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add plugins/product-design-suite/scripts/snapshot.js plugins/product-design-suite/skills/egp-import/SKILL.md tests/snapshot.test.js
git commit -m "feat(snapshot): write sidecars, graph, receipts and telemetry at finalize"
```

---

### Task 6: Documentation

**Files:**
- Modify: `plugins/product-design-suite/shared/references/structures.md:418-438`

**Interfaces:**
- Consumes: the layout produced by Tasks 1-5.
- Produces: nothing consumed by code.

- [ ] **Step 1: Update the workspace tree**

In `plugins/product-design-suite/shared/references/structures.md`, replace the `text` code block in section 4 (currently lines 419-433) with:

```text
workspace/
|-- inputs/                      # user-supplied source material
`-- outputs/
    |-- current/                 # live, editable working tree
    |   |-- planning/prd.md
    |   |-- specifications/srs.md
    |   |-- architecture/{sad.md, sdd.md, adr/ADR-NNN-<slug>.md}
    |   |-- ux/                  # UI previews (openui, prd-summary.html)
    |   |-- governance/          # traceability, import reports, graph
    |   `-- exports/             # rendered diagram previews
    |-- history/
    |   `-- <run-id>/            # immutable snapshot: manifest.json, artifacts/, validation/
    `-- releases/
        `-- v1/                  # promoted run: release.json, artifacts/
.engineering/
|-- config.yaml
|-- receipts/<run-id>.json       # how each run went
`-- telemetry/runs.jsonl         # one line per run
```

- [ ] **Step 2: Document sidecars and the graph**

Immediately after that code block, before the **Reserved names** paragraph, add:

```markdown
**Metadata sidecars.** Each authored artifact has a `*.meta.json` beside it
(`planning/prd.meta.json`) recording the skill, template, plugin version, run id,
and a `sha256:` hash of the file. Regenerated outputs — `traceability.{md,html,json}`
and `artifacts.graph.json` — deliberately have none: their hash could never signal
drift, because nothing but the generator changes them.

A sidecar records the run that last *changed* its artifact, so
`node scripts/meta.js --check` reports `MODIFIED` for exactly those documents
hand-edited since the last finalize. It is informational and always exits 0 —
editing a document between runs is normal, not a gate failure.

**Engineering graph.** Every finalize regenerates `governance/traceability.json`
(the requirement matrix) and `governance/artifacts.graph.json` (document nodes,
`dependsOn` and `shared-refs` edges). `node scripts/graph.js --impact architecture/sad.md`
answers "the architecture changed — what do I regenerate?"

**Releases.** `node scripts/promote.js --run <run-id> [--as v1]` copies an immutable
run package to `workspace/outputs/releases/<name>/`. Gate-failed runs are refused
unless `--force`, which records `"forced": true` in `release.json`. Promotion sources
only from `history/` — `current/` is the live editable tree, never a release pointer.
```

- [ ] **Step 3: Rewrite the reserved-names paragraph**

Replace the **Reserved names** paragraph (currently lines 434-438) with:

```markdown
**Reserved names.** Taxonomy dirs `discovery/`, `implementation/`, `tests/`, `deployment/`,
`operations/`; roots `workspace/reports/`, `workspace/state/` — reserved for later phases.
Directories are created only when something writes into them.

**Rejected, not pending.** `.engineering/execution.db`: the suite is strictly
zero-dependency, and the only built-in SQLite (`node:sqlite`) is experimental and
version-gated, so depending on it would break the plugin on older Node while still
needing a fallback. `receipts/` plus `telemetry/runs.jsonl` answer every query at this
scale, grep cleanly, and merge under git where a binary database conflicts.
```

- [ ] **Step 4: Verify no stale reserved claims remain**

Run: `grep -nE "reserved|execution\.db|later phase" plugins/product-design-suite/shared/references/structures.md`
Expected: only the two paragraphs written above. No line claims `releases/`, `receipts/`, `telemetry/`, sidecars, or the engineering graph are reserved or deferred.

- [ ] **Step 5: Run the full suite**

Run: `node --test tests/*.test.js`
Expected: PASS — `structures.md` is referenced by concept tests; confirm none break.

- [ ] **Step 6: Commit**

```bash
git add plugins/product-design-suite/shared/references/structures.md
git commit -m "docs(structures): document sidecars, graph, releases, receipts; reject execution.db"
```

---

## Acceptance verification

After Task 6, verify the spec's acceptance criteria end-to-end:

```bash
node --test tests/*.test.js
```
Expected: 188 existing + ~27 new tests, 0 failures.

```bash
grep -rn "execution\.db\|lineage\.json" plugins/ --include=*.js
```
Expected: no hits — neither was built, by design.
