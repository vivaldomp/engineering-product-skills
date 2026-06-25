// plugins/product-design-suite/scripts/consistency-gate.js
// Final consistency gate (feedback F2): runs traceability, the ID linter, and
// ADR supersede/amend reciprocity + front-matter completeness, then prints one
// pass/fail summary.
const fs = require('node:fs');
const path = require('node:path');
const trace = require('./traceability.js');
const { lintProduct } = require('./lint-ids.js');

function readFrontMatter(text) {
  const m = String(text || '').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    fm[kv[1]] = val.startsWith('[')
      ? val.replace(/[[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean)
      : val;
  }
  return fm;
}

function loadAdrs(dir) {
  const adrDir = path.join(dir, 'adr');
  const out = {};
  if (!fs.existsSync(adrDir)) return out;
  for (const f of fs.readdirSync(adrDir)) {
    if (!f.endsWith('.md')) continue;
    const fm = readFrontMatter(fs.readFileSync(path.join(adrDir, f), 'utf8'));
    if (fm.id) out[fm.id] = fm;
  }
  return out;
}

// supersedes/amends on A must be mirrored by superseded-by/amended-by on B.
function checkReciprocity(adrs) {
  const problems = [];
  const pairs = [['supersedes', 'superseded-by'], ['amends', 'amended-by']];
  for (const [id, fm] of Object.entries(adrs)) {
    for (const [fwd, back] of pairs) {
      for (const other of (fm[fwd] || [])) {
        const target = adrs[other];
        if (!target || !(target[back] || []).includes(id)) {
          problems.push(`${id} ${fwd} ${other} but ${other} is missing ${back}: ${id}`);
        }
      }
    }
  }
  return problems;
}

function runGate(dir) {
  const product = trace.loadProduct(dir);
  const matrix = trace.buildMatrix(product);
  const lint = lintProduct(dir);
  const adrs = loadAdrs(dir);
  const recip = checkReciprocity(adrs);

  const checks = [
    { name: 'traceability', pass: matrix.orphans.length === 0,
      detail: matrix.orphans.length ? `orphans: ${matrix.orphans.join(', ')}` : 'no orphans' },
    { name: 'id-lint', pass: lint.malformed.length === 0,
      detail: `${lint.malformed.length} malformed, ${lint.duplicates.length} duplicate` },
    { name: 'unclassified', pass: matrix.unclassified.length === 0,
      detail: matrix.unclassified.join(', ') || 'none' },
    { name: 'adr-reciprocity', pass: recip.length === 0,
      detail: recip.join('; ') || 'reciprocal' },
  ];
  return { pass: checks.every(c => c.pass), checks };
}

module.exports = { runGate, checkReciprocity, readFrontMatter };

if (require.main === module) {
  const { pass, checks } = runGate(process.argv[2] || '.product');
  for (const c of checks) console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
  console.log(pass ? 'consistency-gate: PASS' : 'consistency-gate: FAIL');
  process.exit(pass ? 0 : 1);
}
