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
