// Template-structure drift validator (feedback IMP-3). Warn-level: surfaces
// dropped/merged/renamed headings without failing the gate. Required headings
// are derived from the matching template at runtime — no hardcoded list.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');

const TEMPLATE_DIR = path.join(__dirname, '..', 'shared', 'templates');
const TEMPLATE_FOR = W.TEMPLATE_FOR;

function normalizeHeading(t) {
  return t.replace(/^\d+\.?\s*/, '').replace(/[<>]/g, '').trim().toLowerCase();
}

function headings(md) {
  return [...String(md || '').matchAll(/^#{2,3}\s+(.*\S)\s*$/gm)]
    .map(m => normalizeHeading(m[1]))
    .filter(Boolean);
}

function validateDoc(producedMd, templateMd) {
  const required = [...new Set(headings(templateMd))];
  const produced = headings(producedMd);
  const missing = [];
  const merged = [];
  for (const r of required) {
    if (produced.includes(r)) continue;
    if (produced.some(p => p !== r && p.includes(r))) merged.push(r);
    else missing.push(r);
  }
  return { missing, merged };
}

function validateProduct(dir) {
  const out = [];
  for (const [rel, tplName] of Object.entries(TEMPLATE_FOR)) {
    const docPath = path.join(dir, rel);
    if (!fs.existsSync(docPath)) continue;
    const tplPath = path.join(TEMPLATE_DIR, tplName);
    const r = validateDoc(fs.readFileSync(docPath, 'utf8'), fs.readFileSync(tplPath, 'utf8'));
    if (r.missing.length || r.merged.length) out.push({ file: rel, ...r });
  }
  return out;
}

module.exports = { validateDoc, validateProduct, headings, normalizeHeading };

if (require.main === module) {
  if (fs.existsSync('.product')) {
    console.warn('validate-structure: legacy .product/ detected — run `node scripts/migrate-workspace.js` to move it into workspace/outputs/current/.');
  }
  const results = validateProduct(W.resolveCurrent(process.argv[2]));
  for (const r of results) {
    if (r.missing.length) console.log(`structure: ${r.file} missing: ${r.missing.join(', ')}`);
    if (r.merged.length) console.log(`structure: ${r.file} merged: ${r.merged.join(', ')}`);
  }
  console.log(results.length ? 'validate-structure: drift found (advisory)' : 'validate-structure: clean');
}
