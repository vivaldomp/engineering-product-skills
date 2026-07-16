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
const M = require('./meta.js');
const G = require('./graph.js');

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

module.exports = { snapshot, runId, listFiles, ensureConfig, pluginVersion, writeReceipt };

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
