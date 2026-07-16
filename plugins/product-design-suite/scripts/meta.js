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
  const result = rel.replace(/\.[^.\\/]+$/, '.meta.json');
  if (result === rel) {
    throw new Error(`sidecarPath: extensionless path cannot be sidecar-mapped: ${rel}`);
  }
  return result;
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
