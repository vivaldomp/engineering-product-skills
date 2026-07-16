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

const RELEASES = path.join(WORKSPACE, 'outputs', 'releases');
const RECEIPTS = path.join(ENGINEERING, 'receipts');
const TELEMETRY = path.join(ENGINEERING, 'telemetry');
const RUNS_LOG = path.join(TELEMETRY, 'runs.jsonl');

// Engineering-purpose taxonomy inside outputs/current. Reserved names not yet
// used by any skill (implementation, tests) are documented in
// shared/references/structures.md, not created here.
const REL = {
  discovery: path.join('discovery', 'discovery.md'),
  prd: path.join('planning', 'prd.md'),
  sad: path.join('architecture', 'sad.md'),
  sdd: path.join('architecture', 'sdd.md'),
  adrDir: path.join('architecture', 'adr'),
  release: path.join('deployment', 'release.md'),
  runbook: path.join('operations', 'runbook.md'),
  governance: 'governance',
  ux: 'ux',
  exports: 'exports',
};

// Template per authored document. Keyed by exact relative path: consumers
// iterate these entries calling existsSync, so no directory-shaped keys.
const TEMPLATE_FOR = {
  [REL.discovery]: 'discovery-template.md',
  [REL.prd]: 'prd-template.md',
  [REL.sad]: 'sad-template.md',
  [REL.sdd]: 'sdd-template.md',
  [REL.release]: 'release-template.md',
  [REL.runbook]: 'runbook-template.md',
};

// The suite's fixed authoring pipeline. ADRs depend on the SAD; that edge is
// resolved in meta.js because ADR filenames vary. Discovery is an optional
// upstream leaf that feeds the PRD; release and runbook follow the SDD.
const DEPENDS = {
  [REL.sad]: [REL.prd],
  [REL.sdd]: [REL.sad],
  [REL.release]: [REL.sdd],
  [REL.runbook]: [REL.sdd],
};

// Authored once by egp-import and read by downstream builders — unlike
// traceability.*, which is regenerated on every finalize.
const IMPORT_ARTIFACTS = [
  path.join('governance', 'import-gap-report.md'),
  path.join('governance', 'import-map.json'),
  path.join('governance', 'import-state.json'),
];

function docPath(root, key) {
  if (!REL[key]) throw new Error(`unknown doc key: ${key}`);
  return path.join(root, REL[key]);
}
const adrDir = root => path.join(root, REL.adrDir);
const governanceDir = root => path.join(root, REL.governance);
const resolveCurrent = cliArg => path.resolve(cliArg || CURRENT);

module.exports = {
  WORKSPACE, CURRENT, HISTORY, INPUTS, CACHE, ENGINEERING, CONFIG,
  RELEASES, RECEIPTS, TELEMETRY, RUNS_LOG,
  REL, TEMPLATE_FOR, DEPENDS, IMPORT_ARTIFACTS,
  docPath, adrDir, governanceDir, resolveCurrent,
};
