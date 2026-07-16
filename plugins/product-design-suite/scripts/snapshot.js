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
