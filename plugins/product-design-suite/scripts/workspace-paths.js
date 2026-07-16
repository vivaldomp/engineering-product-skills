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
