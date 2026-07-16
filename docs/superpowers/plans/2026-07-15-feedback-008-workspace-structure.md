# Feedback 008 — Workspace Artifact Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the product-design-suite from the flat `.product/` output directory to the feedback-008 workspace model: `workspace/outputs/current/` (live docs, engineering-purpose taxonomy), immutable `workspace/outputs/history/<run-id>/` packages with manifests + validation, `.engineering/config.yaml`, and a one-shot `.product/` migration script. Hard cut — no dual-path support.

**Architecture:** A new `scripts/workspace-paths.js` module is the single source of truth for the layout (mirroring how `scripts/id-conventions.js` centralizes ID rules). All six path-aware scripts import it. A new `scripts/snapshot.js` builds history packages at finalize; a new `scripts/migrate-workspace.js` converts legacy `.product/` trees. Skills, commands, templates, references, and README are updated to the new canonical paths.

**Tech Stack:** Node.js built-ins only (`node:fs`, `node:path`), CommonJS modules, `node:test` + `node:assert` for tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-feedback-008-workspace-structure-design.md`

## Global Constraints

- Node built-ins only; no npm dependencies anywhere.
- All plugin scripts are CommonJS (`require`/`module.exports`), matching the existing files.
- Tests run with `node --test` from the repo root: `node --test tests/` (all) or `node --test tests/<file>` (one file).
- Scripts keep their existing CLI contract: first positional arg overrides the target directory; the default changes from `.product` to `workspace/outputs/current`.
- After this plan, `grep -rn "\.product" plugins/ tests/ README.md` must return hits **only** in `plugins/product-design-suite/scripts/migrate-workspace.js` and `tests/migrate-workspace.test.js` (which legitimately name the legacy path).
- Commit after every task with the message shown in its final step.

## Canonical Path Mapping (used by every task)

| Legacy | New |
| --- | --- |
| `.product/` (script target dir) | `workspace/outputs/current/` |
| `.product/prd/prd.md` | `workspace/outputs/current/planning/prd.md` |
| `.product/prd/prd-summary.html` | `workspace/outputs/current/ux/prd-summary.html` |
| `.product/srs/srs.md` | `workspace/outputs/current/specifications/srs.md` |
| `.product/sad/sad.md` | `workspace/outputs/current/architecture/sad.md` |
| `.product/sdd/sdd.md` | `workspace/outputs/current/architecture/sdd.md` |
| `.product/adr/` (incl. `ADR-NNN-<slug>.md`, `index.md`) | `workspace/outputs/current/architecture/adr/` |
| `.product/traceability.md` / `.html` | `workspace/outputs/current/governance/traceability.md` / `.html` |
| `.product/import-gap-report.md`, `import-map.json`, `import-state.json` | `workspace/outputs/current/governance/<same name>` |
| `.product/design/` (openui/UI previews) | `workspace/outputs/current/ux/` |
| `.product/diagrams/` (rendered diagram previews) | `workspace/outputs/current/exports/` |
| `.product/preview/` (preview-server session state) | `workspace/cache/preview/` |

> Spec addendum discovered during planning: the preview server keeps session state under `.product/preview/` (`start-server.sh`, `stop-server.sh`). That is runtime cache, not an artifact; it moves to the spec's reserved `workspace/cache/` name (Task 7).

When updating prose in skills/templates/README, relative mentions shorten naturally: inside a sentence that already establishes the workspace, `workspace/outputs/current/planning/prd.md` may appear as the full path the first time and as `planning/prd.md` after — but every literal `.product` string must go.

---

### Task 1: `workspace-paths.js` — canonical layout module

**Files:**
- Create: `plugins/product-design-suite/scripts/workspace-paths.js`
- Test: `tests/workspace-paths.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces (all later tasks depend on these exact names):
  - constants `WORKSPACE` (`'workspace'`), `CURRENT` (`workspace/outputs/current`), `HISTORY` (`workspace/outputs/history`), `INPUTS` (`workspace/inputs`), `CACHE` (`workspace/cache`), `ENGINEERING` (`'.engineering'`), `CONFIG` (`.engineering/config.yaml`)
  - `REL` object: `{ prd, srs, sad, sdd, adrDir, governance, ux, exports }` — paths relative to the current root
  - `docPath(root, key)` → absolute doc path for key `prd|srs|sad|sdd`
  - `adrDir(root)`, `governanceDir(root)` → joined subdirs
  - `resolveCurrent(cliArg)` → `path.resolve(cliArg || CURRENT)`

- [ ] **Step 1: Write the failing test**

Create `tests/workspace-paths.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');

test('canonical roots', () => {
  assert.equal(W.CURRENT, path.join('workspace', 'outputs', 'current'));
  assert.equal(W.HISTORY, path.join('workspace', 'outputs', 'history'));
  assert.equal(W.CACHE, path.join('workspace', 'cache'));
  assert.equal(W.ENGINEERING, '.engineering');
  assert.equal(W.CONFIG, path.join('.engineering', 'config.yaml'));
});

test('doc paths follow the engineering-purpose taxonomy', () => {
  assert.equal(W.docPath('/x', 'prd'), path.join('/x', 'planning', 'prd.md'));
  assert.equal(W.docPath('/x', 'srs'), path.join('/x', 'specifications', 'srs.md'));
  assert.equal(W.docPath('/x', 'sad'), path.join('/x', 'architecture', 'sad.md'));
  assert.equal(W.docPath('/x', 'sdd'), path.join('/x', 'architecture', 'sdd.md'));
  assert.equal(W.adrDir('/x'), path.join('/x', 'architecture', 'adr'));
  assert.equal(W.governanceDir('/x'), path.join('/x', 'governance'));
  assert.throws(() => W.docPath('/x', 'nope'), /unknown doc key/);
});

test('resolveCurrent defaults to workspace/outputs/current', () => {
  assert.equal(W.resolveCurrent(undefined), path.resolve(W.CURRENT));
  assert.equal(W.resolveCurrent('/tmp/z'), path.resolve('/tmp/z'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/workspace-paths.test.js`
Expected: FAIL — `Cannot find module '.../workspace-paths.js'`

- [ ] **Step 3: Write the implementation**

Create `plugins/product-design-suite/scripts/workspace-paths.js`:

```js
// Canonical workspace layout (feedback 008) — the single source of truth for
// artifact paths, mirroring the id-conventions.js centralization pattern.
// Scripts operate on the "current root" (workspace/outputs/current by default);
// snapshot.js and migrate-workspace.js additionally know the workspace root.
const path = require('node:path');

const WORKSPACE = 'workspace';
const CURRENT = path.join(WORKSPACE, 'outputs', 'current');
const HISTORY = path.join(WORKSPACE, 'outputs', 'history');
const INPUTS = path.join(WORKSPACE, 'inputs');
const CACHE = path.join(WORKSPACE, 'cache');
const ENGINEERING = '.engineering';
const CONFIG = path.join(ENGINEERING, 'config.yaml');

// Engineering-purpose taxonomy inside outputs/current. Reserved names not yet
// used by any skill (discovery, implementation, tests, deployment, operations)
// are documented in shared/references/structures.md, not created here.
const REL = {
  prd: path.join('planning', 'prd.md'),
  srs: path.join('specifications', 'srs.md'),
  sad: path.join('architecture', 'sad.md'),
  sdd: path.join('architecture', 'sdd.md'),
  adrDir: path.join('architecture', 'adr'),
  governance: 'governance',
  ux: 'ux',
  exports: 'exports',
};

function docPath(root, key) {
  if (!REL[key]) throw new Error(`unknown doc key: ${key}`);
  return path.join(root, REL[key]);
}
const adrDir = root => path.join(root, REL.adrDir);
const governanceDir = root => path.join(root, REL.governance);
const resolveCurrent = cliArg => path.resolve(cliArg || CURRENT);

module.exports = {
  WORKSPACE, CURRENT, HISTORY, INPUTS, CACHE, ENGINEERING, CONFIG,
  REL, docPath, adrDir, governanceDir, resolveCurrent,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/workspace-paths.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/workspace-paths.js tests/workspace-paths.test.js
git commit -m "feat(workspace): canonical layout module workspace-paths.js (008)"
```

---

### Task 2: Migrate `traceability.js` to the workspace layout

**Files:**
- Modify: `plugins/product-design-suite/scripts/traceability.js` (lines 1–5, 293–312, 319–339)
- Test: `tests/traceability.test.js`, `tests/e2e-smoke.test.js`

**Interfaces:**
- Consumes: `workspace-paths.js` (`docPath`, `adrDir`, `governanceDir`, `resolveCurrent`, `REL`).
- Produces: `loadProduct(dir)` keeps its signature (dir = current root) but reads `planning/prd.md`, `specifications/srs.md`, `architecture/sad.md`, `architecture/sdd.md`, `architecture/adr/*.md`. CLI writes `governance/traceability.{md,html}` under the target dir and injects coverage into `architecture/sdd.md`. Tasks 3, 4, 6 rely on this.

- [ ] **Step 1: Update the test fixtures to the new layout (they become the failing tests)**

In `tests/traceability.test.js` and `tests/e2e-smoke.test.js`, update every temp-dir fixture per the Canonical Path Mapping. The rule for fixtures that call `loadProduct` (or run the CLI): `prd/` → `planning/`, `srs/` → `specifications/`, `sad/` and `sdd/` → `architecture/`, `adr/` → `architecture/adr/`. Fixture content strings are unchanged. Example — the e2e-smoke fixture becomes:

```js
test('traceability over a sample workspace links PRD->SDD->ADR', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-'));
  fs.mkdirSync(path.join(dir, 'planning'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'architecture', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'planning', 'prd.md'), 'FR-001 onboarding. NFR-002 latency.');
  fs.writeFileSync(path.join(dir, 'architecture', 'sdd.md'), 'AR-001 implements FR-001.');
  fs.writeFileSync(path.join(dir, 'architecture', 'adr', 'ADR-001-x.md'), 'Decision impacting FR-001.');
  const m = t.buildMatrix(t.loadProduct(dir));
  const fr = m.requirements.find(r => r.id === 'FR-001');
  assert.equal(fr.inSdd, true);
  assert.deepEqual(fr.adrs, ['ADR-001']);
  assert.equal(m.requirements.find(r => r.id === 'NFR-002').inSdd, false);
});
```

Apply the same mechanical rule to every fixture in `tests/traceability.test.js` that builds `prd/`, `srs/`, `sad/`, `sdd/`, or `adr/` directories. Tests that call pure functions (`parseRefs`, `expandRange`, `buildMatrix` with inline strings) need no change. If any test asserts the output location of `traceability.md`/`.html`, point it at `governance/traceability.md`/`.html`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/traceability.test.js tests/e2e-smoke.test.js`
Expected: FAIL — fixture-based tests read empty docs (loadProduct still looks in `prd/prd.md`), so `inSdd`/`adrs` assertions fail.

- [ ] **Step 3: Update `traceability.js`**

Add the import after the existing requires (top of file):

```js
const W = require('./workspace-paths.js');
```

Replace `loadProduct` (lines 293–312) with:

```js
function loadProduct(dir) {
  const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const adrDir = W.adrDir(dir);
  const adrs = {};
  if (fs.existsSync(adrDir)) {
    for (const f of fs.readdirSync(adrDir)) {
      if (f.endsWith('.md')) {
        const m = f.match(/ADR-\d+/);
        adrs[m ? m[0] : f] = read(path.join(adrDir, f));
      }
    }
  }
  return {
    prd: read(W.docPath(dir, 'prd')),
    sdd: read(W.docPath(dir, 'sdd')),
    srs: read(W.docPath(dir, 'srs')),
    sad: read(W.docPath(dir, 'sad')),
    adrs,
  };
}
```

Replace the CLI block (lines 319–339) with:

```js
if (require.main === module) {
  const dir = W.resolveCurrent(process.argv[2]);
  const matrix = buildMatrix(loadProduct(dir));
  if (matrix.unclassified.length) {
    console.warn(`traceability: saw ${matrix.unclassified.length} token(s) it could not classify: ${matrix.unclassified.join(', ')}`);
  }
  try {
    const gov = W.governanceDir(dir);
    fs.mkdirSync(gov, { recursive: true });
    fs.writeFileSync(path.join(gov, 'traceability.md'), renderMarkdown(matrix));
    fs.writeFileSync(path.join(gov, 'traceability.html'), renderHtml(matrix));
    const sddPath = W.docPath(dir, 'sdd');
    if (fs.existsSync(sddPath)) {
      fs.writeFileSync(sddPath, injectCoverage(fs.readFileSync(sddPath, 'utf8'), renderCoverageBlock(matrix)));
    } else {
      console.warn(`traceability: ${sddPath} not found; skipped coverage-index injection.`);
    }
  } catch (err) {
    console.error(`traceability: failed to write outputs under ${dir}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Wrote traceability for ${matrix.requirements.length} requirements (${matrix.orphans.length} orphan(s)).`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/traceability.test.js tests/e2e-smoke.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/traceability.js tests/traceability.test.js tests/e2e-smoke.test.js
git commit -m "feat(workspace): traceability reads/writes the workspace taxonomy (008)"
```

---

### Task 3: Migrate the remaining five scripts

**Files:**
- Modify: `plugins/product-design-suite/scripts/adr-index.js` (lines 12–22, 63–71), `consistency-gate.js` (lines 42–52, 97–99, 124–125), `validate-structure.js` (lines 8–13, 52–59), `lint-ids.js` (lines 82–84), `mermaid-lint.js` (lines 65–66)
- Test: `tests/adr-index.test.js`, `tests/consistency-gate.test.js`, `tests/validate-structure.test.js`, `tests/lint-ids.test.js`, `tests/mermaid-lint.test.js`

**Interfaces:**
- Consumes: `workspace-paths.js`; Task 2's `loadProduct`.
- Produces: `runGate(dir)`, `lintProduct(dir)`, `loadAdrs(dir)`, `writeIndex(dir)`, `validateProduct(dir)` keep signatures, dir = current root, new sublayout. Task 4 (`snapshot.js`) calls `runGate` and `lintProduct` with the new layout — this task must land first.

- [ ] **Step 1: Update test fixtures to the new layout (failing tests)**

Apply the same fixture rule as Task 2 to `tests/adr-index.test.js` and `tests/consistency-gate.test.js`: `adr/` → `architecture/adr/`, `sdd/sdd.md` → `architecture/sdd.md`, `prd/prd.md` → `planning/prd.md`, `srs/srs.md` → `specifications/srs.md`, `sad/sad.md` → `architecture/sad.md`. Rename the adr-index test title to `'writeIndex writes architecture/adr/index.md and skips itself on re-run'`. `tests/validate-structure.test.js`, `tests/lint-ids.test.js`, and `tests/mermaid-lint.test.js` use inline strings or their own arbitrary fixture dirs — inspect them and update only fixtures that mimic the old sublayout (e.g. a `validateProduct` fixture writing `prd/prd.md` must write `planning/prd.md`).

- [ ] **Step 2: Run tests to verify the fixture-dependent ones fail**

Run: `node --test tests/adr-index.test.js tests/consistency-gate.test.js tests/validate-structure.test.js`
Expected: FAIL on tests exercising directory loading (`loadAdrs`/`writeIndex`/`validateProduct` find nothing at the new fixture paths).

- [ ] **Step 3: Update the five scripts**

In **all five**, add near the top requires: `const W = require('./workspace-paths.js');`

`adr-index.js`:
- Line 13 in `loadAdrFm`: `const adrDir = path.join(dir, 'adr');` → `const adrDir = W.adrDir(dir);`
- `writeIndex` (line 32): `fs.writeFileSync(path.join(dir, 'adr', 'index.md'), renderIndex(adrs));` → `fs.writeFileSync(path.join(W.adrDir(dir), 'index.md'), renderIndex(adrs));`
- CLI (lines 64–66): `const dir = path.resolve(process.argv[2] || '.product');` → `const dir = W.resolveCurrent(process.argv[2]);` and `const sddPath = path.join(dir, 'sdd', 'sdd.md');` → `const sddPath = W.docPath(dir, 'sdd');`

`consistency-gate.js`:
- `loadAdrs` (line 43): `const adrDir = path.join(dir, 'adr');` → `const adrDir = W.adrDir(dir);`
- inputs-present detail (line 99): `` mdCount > 0 ? `${mdCount} .product doc(s)` : `no .product/*.md found under ${dir}` `` → `` mdCount > 0 ? `${mdCount} doc(s)` : `no *.md found under ${dir}` ``
- CLI (line 125): `runGate(process.argv[2] || '.product')` → `runGate(W.resolveCurrent(process.argv[2]))`

`validate-structure.js`:
- `TEMPLATE_FOR` (lines 8–13) becomes:

```js
const TEMPLATE_FOR = {
  [W.REL.prd]: 'prd-template.md',
  [W.REL.srs]: 'srs-template.md',
  [W.REL.sad]: 'sad-template.md',
  [W.REL.sdd]: 'sdd-template.md',
};
```

- CLI (line 53): `validateProduct(path.resolve(process.argv[2] || '.product'))` → `validateProduct(W.resolveCurrent(process.argv[2]))`, and add a legacy-detection advisory as the first lines of the CLI block:

```js
if (fs.existsSync('.product')) {
  console.warn('validate-structure: legacy .product/ detected — run `node scripts/migrate-workspace.js` to move it into workspace/outputs/current/.');
}
```

`lint-ids.js` CLI (line 83): `const dir = process.argv[2] || '.product';` → `const dir = W.resolveCurrent(process.argv[2]);`

`mermaid-lint.js` CLI (line 66): `lintProductDiagrams(path.resolve(process.argv[2] || '.product'))` → `lintProductDiagrams(W.resolveCurrent(process.argv[2]))`

(`mermaid-preview.js` — the seventh script named in the spec — takes explicit file arguments and has no `.product` default; it needs **no change**. Its output location is a skill-level convention handled in Task 6.)

- [ ] **Step 4: Run the script test files**

Run: `node --test tests/adr-index.test.js tests/consistency-gate.test.js tests/validate-structure.test.js tests/lint-ids.test.js tests/mermaid-lint.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/ tests/
git commit -m "feat(workspace): all path-aware scripts target workspace/outputs/current (008)"
```

---

### Task 4: `snapshot.js` — immutable execution packages

**Files:**
- Create: `plugins/product-design-suite/scripts/snapshot.js`
- Test: `tests/snapshot.test.js`

**Interfaces:**
- Consumes: `workspace-paths.js`; `runGate` from `consistency-gate.js`; `lintProduct` from `lint-ids.js`.
- Produces: `snapshot({ skill, artifact, projectRoot, now })` → `{ dest, manifest }`; also exports `runId(date)`, `listFiles(root)`, `ensureConfig(projectRoot, version)`, `pluginVersion()`. Task 5 imports `ensureConfig` and `pluginVersion`. Task 6 skills call the CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill <name> --artifact <rel-path>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/snapshot.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const S = require('../plugins/product-design-suite/scripts/snapshot.js');

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, W.CURRENT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

test('snapshot writes a self-contained package with manifest and validation', () => {
  const root = project({
    'planning/prd.md': 'FR-001 onboarding.',
    'architecture/sdd.md': 'Design covers FR-001.',
  });
  const now = new Date('2026-07-15T10:34:22');
  const { dest, manifest } = S.snapshot({ skill: 'egp-prd-builder', artifact: 'planning/prd.md', projectRoot: root, now });
  assert.equal(manifest.runId, '2026-07-15T103422');
  assert.equal(manifest.skill, 'egp-prd-builder');
  assert.equal(manifest.status, 'success');
  assert.equal(manifest.primaryArtifact, 'planning/prd.md');
  assert.ok(manifest.artifacts.includes('planning/prd.md'));
  assert.ok(manifest.validation.gatePass);
  assert.ok(fs.existsSync(path.join(dest, 'artifacts', 'planning', 'prd.md')));
  assert.ok(fs.existsSync(path.join(dest, 'validation', 'gate.json')));
  assert.ok(fs.existsSync(path.join(dest, 'validation', 'lint.json')));
  assert.ok(fs.existsSync(path.join(root, W.CONFIG)));
  const onDisk = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  assert.deepEqual(onDisk, manifest);
});

test('a failing gate still snapshots, with status gate-failed', () => {
  const root = project({ 'planning/prd.md': 'FR-001 x. FR-002 y.', 'architecture/sdd.md': 'Only FR-001.' });
  const { manifest } = S.snapshot({ skill: 'egp-prd-builder', projectRoot: root });
  assert.equal(manifest.status, 'gate-failed');
  assert.equal(manifest.validation.gatePass, false);
});

test('run-id collisions get a numeric suffix', () => {
  const root = project({ 'planning/prd.md': 'FR-001 x.', 'architecture/sdd.md': 'FR-001.' });
  const now = new Date('2026-07-15T10:34:22');
  const a = S.snapshot({ projectRoot: root, now });
  const b = S.snapshot({ projectRoot: root, now });
  assert.equal(a.manifest.runId, '2026-07-15T103422');
  assert.equal(b.manifest.runId, '2026-07-15T103422-2');
});

test('snapshot refuses a project without workspace/outputs/current', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  assert.throws(() => S.snapshot({ projectRoot: root }), /no workspace/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/snapshot.test.js`
Expected: FAIL — `Cannot find module '.../snapshot.js'`

- [ ] **Step 3: Write the implementation**

Create `plugins/product-design-suite/scripts/snapshot.js`:

```js
// Immutable execution packages (feedback 008): at finalize, copy
// workspace/outputs/current into workspace/outputs/history/<run-id>/ together
// with a machine-readable manifest and the validation reports. A package can
// not exist without validation — the gate runs here, and a failing gate is
// recorded as status "gate-failed" rather than suppressed.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');
const { runGate } = require('./consistency-gate.js');
const { lintProduct } = require('./lint-ids.js');

// Filesystem-safe local timestamp: 2026-07-15T103422 (no colons).
function runId(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version || 'unknown';
  } catch { return 'unknown'; }
}

function listFiles(root, base = root) {
  const out = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

function ensureConfig(projectRoot, version) {
  const cfg = path.join(projectRoot, W.CONFIG);
  if (fs.existsSync(cfg)) return;
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  fs.writeFileSync(cfg, `layoutVersion: 1\ncreatedBy: product-design-suite@${version}\n`);
}

function snapshot({ skill, artifact, projectRoot = '.', now = new Date() } = {}) {
  const current = path.resolve(projectRoot, W.CURRENT);
  if (!fs.existsSync(current)) throw new Error(`no ${W.CURRENT} under ${path.resolve(projectRoot)}`);
  const gate = runGate(current);
  const lint = lintProduct(current);
  const historyRoot = path.resolve(projectRoot, W.HISTORY);
  const base = runId(now);
  let dest = path.join(historyRoot, base);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(historyRoot, `${base}-${i}`);
  fs.mkdirSync(path.join(dest, 'artifacts'), { recursive: true });
  fs.cpSync(current, path.join(dest, 'artifacts'), { recursive: true });
  const valDir = path.join(dest, 'validation');
  fs.mkdirSync(valDir);
  fs.writeFileSync(path.join(valDir, 'gate.json'), JSON.stringify(gate, null, 2));
  fs.writeFileSync(path.join(valDir, 'lint.json'), JSON.stringify(lint, null, 2));
  const traceMd = path.join(W.governanceDir(current), 'traceability.md');
  if (fs.existsSync(traceMd)) fs.copyFileSync(traceMd, path.join(valDir, 'traceability.md'));
  const version = pluginVersion();
  const manifest = {
    runId: path.basename(dest),
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
  return { dest, manifest };
}

module.exports = { snapshot, runId, listFiles, ensureConfig, pluginVersion };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf('--' + n); return i === -1 ? undefined : args[i + 1]; };
  try {
    const { dest, manifest } = snapshot({ skill: opt('skill'), artifact: opt('artifact'), projectRoot: opt('root') || '.' });
    console.log(`snapshot: ${manifest.status} — wrote ${path.relative(process.cwd(), dest)} (${manifest.artifacts.length} artifact(s))`);
  } catch (err) {
    console.error(`snapshot: ${err.message}`);
    process.exit(1);
  }
}
```

Note: the CLI exits 0 on `gate-failed` — the package is the audit record; builders run the gate interactively before calling snapshot, so a failure here is recorded, not fatal.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/snapshot.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/snapshot.js tests/snapshot.test.js
git commit -m "feat(workspace): snapshot.js builds history packages with manifest + validation (008)"
```

---

### Task 5: `migrate-workspace.js` — legacy `.product/` migration

**Files:**
- Create: `plugins/product-design-suite/scripts/migrate-workspace.js`
- Test: `tests/migrate-workspace.test.js`

**Interfaces:**
- Consumes: `workspace-paths.js`; `ensureConfig` + `pluginVersion` from `snapshot.js` (Task 4).
- Produces: `migrate(projectRoot)` → `{ moves: string[] }`. CLI: `node scripts/migrate-workspace.js [projectRoot]`. This file (and its test) are the only allowed remaining `.product` references in the repo.

- [ ] **Step 1: Write the failing tests**

Create `tests/migrate-workspace.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');
const M = require('../plugins/product-design-suite/scripts/migrate-workspace.js');

function legacy(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, '.product', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

test('migrate moves a populated legacy tree into the taxonomy without loss', () => {
  const root = legacy({
    'prd/prd.md': 'FR-001',
    'prd/prd-summary.html': '<html>',
    'srs/srs.md': 'srs',
    'sad/sad.md': 'sad',
    'sdd/sdd.md': 'sdd',
    'adr/ADR-001-x.md': 'adr',
    'adr/index.md': 'idx',
    'traceability.md': 'trace',
    'import-state.json': '{}',
    'design/mock.html': 'ui',
    'diagrams/all.html': 'dg',
    'preview/sess1/state/x': 's',
    'notes/scratch.md': 'unmapped',
  });
  const { moves } = M.migrate(root);
  const cur = path.join(root, W.CURRENT);
  assert.equal(fs.readFileSync(path.join(cur, 'planning', 'prd.md'), 'utf8'), 'FR-001');
  assert.equal(fs.readFileSync(path.join(cur, 'ux', 'prd-summary.html'), 'utf8'), '<html>');
  assert.equal(fs.readFileSync(path.join(cur, 'specifications', 'srs.md'), 'utf8'), 'srs');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'sad.md'), 'utf8'), 'sad');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'sdd.md'), 'utf8'), 'sdd');
  assert.equal(fs.readFileSync(path.join(cur, 'architecture', 'adr', 'ADR-001-x.md'), 'utf8'), 'adr');
  assert.equal(fs.readFileSync(path.join(cur, 'governance', 'traceability.md'), 'utf8'), 'trace');
  assert.equal(fs.readFileSync(path.join(cur, 'governance', 'import-state.json'), 'utf8'), '{}');
  assert.equal(fs.readFileSync(path.join(cur, 'ux', 'mock.html'), 'utf8'), 'ui');
  assert.equal(fs.readFileSync(path.join(cur, 'exports', 'all.html'), 'utf8'), 'dg');
  assert.equal(fs.readFileSync(path.join(root, W.CACHE, 'preview', 'sess1', 'state', 'x'), 'utf8'), 's');
  // unmapped files keep their relative path and are reported
  assert.equal(fs.readFileSync(path.join(cur, 'notes', 'scratch.md'), 'utf8'), 'unmapped');
  // 4 whole-directory moves (adr, design, diagrams, preview) + 8 file moves
  assert.equal(moves.length, 12);
  assert.ok(!fs.existsSync(path.join(root, '.product')));
  assert.ok(fs.existsSync(path.join(root, W.CONFIG)));
});

test('migrate refuses when workspace/ already exists', () => {
  const root = legacy({ 'prd/prd.md': 'x' });
  fs.mkdirSync(path.join(root, W.WORKSPACE));
  assert.throws(() => M.migrate(root), /refusing/);
});

test('migrate refuses when there is no .product/', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  assert.throws(() => M.migrate(root), /no \.product/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/migrate-workspace.test.js`
Expected: FAIL — `Cannot find module '.../migrate-workspace.js'`

- [ ] **Step 3: Write the implementation**

Create `plugins/product-design-suite/scripts/migrate-workspace.js`:

```js
// One-shot migration: legacy .product/ -> workspace/ (feedback 008 hard cut).
// Known files map to the engineering-purpose taxonomy; whole directories (adr,
// design, diagrams, preview) move wholesale; anything unrecognized keeps its
// relative path under outputs/current and is listed in the summary.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');
const { ensureConfig, pluginVersion } = require('./snapshot.js');

const FILE_MAP = {
  'prd/prd.md': W.REL.prd,
  'prd/prd-summary.html': path.join(W.REL.ux, 'prd-summary.html'),
  'srs/srs.md': W.REL.srs,
  'sad/sad.md': W.REL.sad,
  'sdd/sdd.md': W.REL.sdd,
  'traceability.md': path.join(W.REL.governance, 'traceability.md'),
  'traceability.html': path.join(W.REL.governance, 'traceability.html'),
  'import-gap-report.md': path.join(W.REL.governance, 'import-gap-report.md'),
  'import-map.json': path.join(W.REL.governance, 'import-map.json'),
  'import-state.json': path.join(W.REL.governance, 'import-state.json'),
};

function migrate(projectRoot = '.') {
  const legacy = path.resolve(projectRoot, '.product');
  const workspace = path.resolve(projectRoot, W.WORKSPACE);
  if (!fs.existsSync(legacy)) throw new Error('no .product/ directory to migrate');
  if (fs.existsSync(workspace)) throw new Error('workspace/ already exists — refusing to overwrite');
  const current = path.resolve(projectRoot, W.CURRENT);
  const moves = [];
  const move = (src, dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    moves.push(`${path.relative(projectRoot, src)} -> ${path.relative(projectRoot, dest)}`);
  };
  // Whole-directory moves first, so the file walk below never descends into them.
  const DIR_MAP = {
    adr: path.join(current, W.REL.adrDir),
    design: path.join(current, W.REL.ux),
    diagrams: path.join(current, W.REL.exports),
    preview: path.resolve(projectRoot, W.CACHE, 'preview'),
  };
  for (const [name, dest] of Object.entries(DIR_MAP)) {
    const src = path.join(legacy, name);
    if (fs.existsSync(src)) move(src, dest);
  }
  const walk = dir => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const src = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(src); continue; }
      const rel = path.relative(legacy, src).split(path.sep).join('/');
      move(src, path.join(current, FILE_MAP[rel] || rel));
    }
  };
  walk(legacy);
  fs.rmSync(legacy, { recursive: true, force: true }); // only empty dirs remain
  ensureConfig(projectRoot, pluginVersion());
  return { moves };
}

module.exports = { migrate, FILE_MAP };

if (require.main === module) {
  try {
    const { moves } = migrate(process.argv[2] || '.');
    for (const m of moves) console.log(m);
    console.log(`migrate-workspace: moved ${moves.length} item(s) into ${W.WORKSPACE}/`);
  } catch (err) {
    console.error(`migrate-workspace: ${err.message}`);
    process.exit(1);
  }
}
```

Note the ordering constraint encoded above: `design/mock.html` maps via the **directory** move (`design` → `ux/`), which must run before the file walk so `prd/prd-summary.html` (a **file** mapping into `ux/`) can land in the already-moved directory. `fs.renameSync` on `design` moves the whole tree; the later `mkdirSync(..., { recursive: true })` for `prd-summary.html` is then a no-op on the existing `ux/` dir.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/migrate-workspace.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/migrate-workspace.js tests/migrate-workspace.test.js
git commit -m "feat(workspace): one-shot .product -> workspace migration script (008)"
```

---

### Task 6: Update all skills and commands

**Files:**
- Modify: `plugins/product-design-suite/skills/egp-prd-builder/SKILL.md`, `egp-srs-builder/SKILL.md`, `egp-sad-builder/SKILL.md`, `egp-sdd-builder/SKILL.md`, `egp-adr-builder/SKILL.md`, `egp-doc-sync/SKILL.md`, `egp-import/SKILL.md`, `egp-product-workflow/SKILL.md`
- Modify: `plugins/product-design-suite/commands/egp-prd.md`, `egp-srs.md`, `egp-sad.md`, `egp-sdd.md`, `egp-adr.md`, `egp-import.md`, `egp-product.md`
- Test: `tests/sad-conventions.test.js`, `tests/srs-conventions.test.js`, `tests/import-conventions.test.js`

**Interfaces:**
- Consumes: canonical paths from the mapping table; `snapshot.js` CLI from Task 4.
- Produces: skill/command text later tasks' grep sweep depends on.

- [ ] **Step 1: Update the conventions tests to expect the new paths (failing tests)**

- `tests/sad-conventions.test.js` lines 44, 58, 82: `assert.match(s, /\.product\/sad\/sad\.md/)` → `assert.match(s, /workspace\/outputs\/current\/architecture\/sad\.md/)`; line 71: `assert.match(imp, /sad-template|\.product\/sad/i)` → `assert.match(imp, /sad-template|architecture\/sad/i)`
- `tests/srs-conventions.test.js` lines 43, 58, 61, 81: `/\.product\/srs\/srs\.md/` → `/workspace\/outputs\/current\/specifications\/srs\.md/`; line 74: `/srs-template|\.product\/srs/i` → `/srs-template|specifications\/srs/i`
- `tests/import-conventions.test.js` line 19: `/\.product\/import-gap-report\.md/` → `/workspace\/outputs\/current\/governance\/import-gap-report\.md/`

- [ ] **Step 2: Run the conventions tests to verify they fail**

Run: `node --test tests/sad-conventions.test.js tests/srs-conventions.test.js tests/import-conventions.test.js`
Expected: FAIL on every updated `assert.match`.

- [ ] **Step 3: Rewrite paths in all 15 files**

For each file, replace every `.product/...` reference using the Canonical Path Mapping table (top of this plan). File-specific notes:

- **Commands** (one line each): e.g. `egp-prd.md` line 5 becomes `` Use the egp-prd-builder skill to create or update `workspace/outputs/current/planning/prd.md`. $ARGUMENTS `` — same pattern for srs (`specifications/srs.md`), sad (`architecture/sad.md`), sdd (`architecture/sdd.md`), adr (`architecture/adr/`), import (gap report at `workspace/outputs/current/governance/import-gap-report.md`), product.
- **egp-doc-sync/SKILL.md**: the tool invocations change to `node "${CLAUDE_PLUGIN_ROOT}/scripts/traceability.js"` (no positional arg — the default is now correct) or keep the explicit arg as `workspace/outputs/current`; outputs described as `governance/traceability.{md,html}`; ADR index at `architecture/adr/index.md`; gate call `node "${CLAUDE_PLUGIN_ROOT}/scripts/consistency-gate.js"` (default dir). Keep explicit args where the surrounding text explains them.
- **egp-import/SKILL.md**: gap report / import-map / import-state move to `governance/`; ADR splits to `architecture/adr/ADR-NNN-<slug>.md`; SRS/SAD targets per mapping. The description line (front-matter) also contains a path — update it.
- **egp-prd-builder/SKILL.md**: doc at `planning/prd.md`; summary HTML at `ux/prd-summary.html`; import-state read from `governance/import-state.json`; SRS-mode detection keys off `specifications/srs.md`.
- **egp-sdd-builder / egp-sad-builder**: doc paths per mapping; any `.product/diagrams/` preview output → `workspace/outputs/current/exports/`; SAD-mode detection keys off `architecture/sad.md`.
- **egp-product-workflow/SKILL.md**: the stage table/paths per mapping.

- [ ] **Step 4: Add the snapshot finalize step to the five builders**

In each of `egp-prd-builder`, `egp-srs-builder`, `egp-sad-builder`, `egp-sdd-builder`, `egp-adr-builder` SKILL.md, append a numbered step at the end of the main flow (after the existing finalize/gate step), adapting the skill name and artifact path:

```markdown
N. **Snapshot the approved run.** After the user approves the finalized document
   and the consistency gate passes, write an immutable execution package:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.js" --skill egp-prd-builder --artifact planning/prd.md`
   This records workspace/outputs/history/<run-id>/ with a manifest and the
   validation reports. Never edit files under history/.
```

Artifact values: prd → `planning/prd.md`; srs → `specifications/srs.md`; sad → `architecture/sad.md`; sdd → `architecture/sdd.md`; adr → the specific file just written, e.g. `architecture/adr/ADR-007-<slug>.md`.

- [ ] **Step 5: Verify no legacy references remain in skills/commands, run tests**

Run: `grep -rn "\.product" plugins/product-design-suite/skills/ plugins/product-design-suite/commands/`
Expected: no output.
Run: `node --test tests/sad-conventions.test.js tests/srs-conventions.test.js tests/import-conventions.test.js tests/metadata-conventions.test.js tests/diagram-conventions.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/product-design-suite/skills/ plugins/product-design-suite/commands/ tests/
git commit -m "feat(workspace): skills and commands use the workspace taxonomy + snapshot finalize (008)"
```

---

### Task 7: Preview server session state → `workspace/cache/preview/`

**Files:**
- Modify: `plugins/product-design-suite/scripts/start-server.sh` (lines 9, 117, 120–121), `plugins/product-design-suite/scripts/stop-server.sh` (lines 6, 26)
- Test: `tests/stop-server.test.js` (line 12), `tests/preview-server.test.js` (check for path assumptions; update likewise if any)

**Interfaces:**
- Consumes: layout constants (as literal strings — shell scripts can't import the JS module; the canonical value `workspace/cache/preview` is documented in `workspace-paths.js` as `CACHE`).
- Produces: session dirs under `<project>/workspace/cache/preview/<session-id>/`.

- [ ] **Step 1: Update the test (failing test)**

`tests/stop-server.test.js` line 12: `const stateDir = path.join(proj, '.product', 'preview', 'sess1', 'state');` → `const stateDir = path.join(proj, 'workspace', 'cache', 'preview', 'sess1', 'state');`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/stop-server.test.js`
Expected: FAIL (stop-server.sh does not look in the new location yet).

- [ ] **Step 3: Update the shell scripts**

`start-server.sh`:
- Line 9 comment: `Store session files under <path>/.product/preview/` → `Store session files under <path>/workspace/cache/preview/`
- Line 117: `SESSION_DIR="${PROJECT_DIR}/.product/preview/${SESSION_ID}"` → `SESSION_DIR="${PROJECT_DIR}/workspace/cache/preview/${SESSION_ID}"`
- Lines 120–121: `PDS_PORT_FILE="${PROJECT_DIR}/.product/preview/.last-port"` → `.../workspace/cache/preview/.last-port"`; same for `PDS_TOKEN_FILE` (`.last-token`)

`stop-server.sh`:
- Line 6 comment: `(.product/preview/)` → `(workspace/cache/preview/)`
- Line 26: `candidates=("$root"/.product/preview/*/)` → `candidates=("$root"/workspace/cache/preview/*/)`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/stop-server.test.js tests/preview-server.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/scripts/start-server.sh plugins/product-design-suite/scripts/stop-server.sh tests/stop-server.test.js tests/preview-server.test.js
git commit -m "feat(workspace): preview session state moves to workspace/cache/preview (008)"
```

---

### Task 8: Templates, references, README, and the final sweep

**Files:**
- Modify: `plugins/product-design-suite/shared/templates/sad-template.md` (lines 32–33), `srs-template.md` (line 34)
- Modify: `plugins/product-design-suite/shared/references/structures.md` (§2b AR-ownership note, §4 recommended repository structure, §5 traceability output paths), `concepts.md` (lines 221, 230), `id-conventions.md` (line 43)
- Modify: `README.md` (16 `.product` references)
- Test: none new — full suite + grep sweep

**Interfaces:**
- Consumes: everything prior; this is the documentation + acceptance task.
- Produces: the final acceptance state (spec criteria 1–5).

- [ ] **Step 1: Update templates**

`sad-template.md` lines 32–33 and `srs-template.md` line 34 (reference tables): `.product/prd/prd.md` → `workspace/outputs/current/planning/prd.md`; `.product/srs/srs.md` → `workspace/outputs/current/specifications/srs.md`.

- [ ] **Step 2: Update shared references**

- `id-conventions.md` line 43: `` Run `node scripts/lint-ids.js .product` `` → `` Run `node scripts/lint-ids.js` (defaults to `workspace/outputs/current`) ``
- `concepts.md` line 221: `.product/srs/srs.md` → `workspace/outputs/current/specifications/srs.md`; line 230: `.product/sad/sad.md` → `workspace/outputs/current/architecture/sad.md`
- `structures.md`:
  - §2b AR-ownership note: `` `traceability.js` keys off `.product/sad/sad.md` existence `` → `` `traceability.js` keys off `workspace/outputs/current/architecture/sad.md` existence ``
  - §5: `.product/traceability.{md,html}` → `workspace/outputs/current/governance/traceability.{md,html}`
  - Replace §4 "Recommended repository structure" tree with the workspace layout, including run packages and the reserved names:

```text
workspace/
|-- inputs/                      # user-supplied source material
`-- outputs/
    |-- current/                 # live, editable working tree
    |   |-- planning/prd.md
    |   |-- specifications/srs.md
    |   |-- architecture/{sad.md, sdd.md, adr/ADR-NNN-<slug>.md}
    |   |-- ux/                  # UI previews (openui, prd-summary.html)
    |   |-- governance/          # traceability, import reports
    |   `-- exports/             # rendered diagram previews
    `-- history/
        `-- <run-id>/            # immutable snapshot: manifest.json, artifacts/, validation/
.engineering/
`-- config.yaml
```

  Followed by a short "Reserved names" paragraph: taxonomy dirs `discovery/`, `implementation/`, `tests/`, `deployment/`, `operations/`; roots `workspace/outputs/releases/`, `workspace/reports/`, `workspace/cache/` (in use for preview session state), `workspace/state/`; `.engineering/{execution.db, receipts/, telemetry/}` — reserved for later phases (metadata sidecars, release promotion, engineering graph, telemetry); directories are created only when something writes into them.

- [ ] **Step 3: Update README.md**

Replace all 16 `.product` references per the mapping (the prose "Everything is written to a local `.product/` directory" becomes "Everything is written to a local `workspace/` directory — live docs under `workspace/outputs/current/`, immutable per-approval run packages under `workspace/outputs/history/`"). Add one migration sentence to an appropriate section: existing users run `node plugins/product-design-suite/scripts/migrate-workspace.js` (or the installed-plugin equivalent path) once to convert a legacy `.product/`.

- [ ] **Step 4: Acceptance sweep + full suite**

Run: `grep -rn "\.product" plugins/ tests/ README.md`
Expected: hits only in `plugins/product-design-suite/scripts/migrate-workspace.js` and `tests/migrate-workspace.test.js`.

Run: `node --test tests/`
Expected: ALL PASS (previous 178 tests adjusted + ~10 new).

- [ ] **Step 5: Commit**

```bash
git add plugins/product-design-suite/shared/ README.md
git commit -m "docs(workspace): templates, references, README on the workspace layout (008)"
```

---

## Task order & dependencies

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Tasks 2–3 need Task 1; Task 4 needs Task 3 (`runGate` on the new layout); Task 5 needs Task 4 (`ensureConfig`/`pluginVersion`); Tasks 6–8 need 1–5. Task 7 is independent of 4–6 but sequenced late to keep the sweep in Task 8 meaningful.
