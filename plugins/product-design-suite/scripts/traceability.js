const fs = require('node:fs');
const path = require('node:path');

function extractIds(text) {
  const re = /\b(?:FR|BR|NFR|AR|UAT|ADR)-\d+\b/g;
  return [...new Set((text || '').match(re) || [])];
}

function buildMatrix({ prd = '', sdd = '', adrs = {} } = {}) {
  const prdIds = extractIds(prd).filter(id => /^(FR|BR|NFR)-/.test(id));
  return prdIds.map(id => ({
    id,
    inSdd: sdd.includes(id),
    adrs: Object.entries(adrs).filter(([, txt]) => txt.includes(id)).map(([a]) => a),
  }));
}

function renderMatrixMarkdown(rows) {
  const head = '| Requirement | In SDD | Related ADRs |\n| --- | --- | --- |';
  const body = rows.map(r =>
    `| ${r.id} | ${r.inSdd ? 'yes' : 'NO'} | ${r.adrs.join(', ') || '-'} |`).join('\n');
  return `# Traceability Matrix\n\n${head}\n${body}\n`;
}

function renderMatrixHtml(rows) {
  const trs = rows.map(r =>
    `<tr><td>${r.id}</td><td class="${r.inSdd ? 'ok' : 'gap'}">${r.inSdd ? 'yes' : 'NO'}</td><td>${r.adrs.join(', ') || '-'}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Traceability Matrix</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.4rem .6rem}.gap{color:#b00;font-weight:bold}.ok{color:#070}</style>
</head><body><h1>Traceability Matrix</h1>
<table><thead><tr><th>Requirement</th><th>In SDD</th><th>Related ADRs</th></tr></thead>
<tbody>${trs}</tbody></table></body></html>`;
}

function loadProduct(dir) {
  const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const adrDir = path.join(dir, 'adr');
  const adrs = {};
  if (fs.existsSync(adrDir)) {
    for (const f of fs.readdirSync(adrDir)) {
      if (f.endsWith('.md')) {
        const m = f.match(/ADR-\d+/);
        adrs[m ? m[0] : f] = read(path.join(adrDir, f));
      }
    }
  }
  return { prd: read(path.join(dir, 'prd', 'prd.md')), sdd: read(path.join(dir, 'sdd', 'sdd.md')), adrs };
}

module.exports = { extractIds, buildMatrix, renderMatrixMarkdown, renderMatrixHtml, loadProduct };

if (require.main === module) {
  const dir = process.argv[2] || '.product';
  const rows = buildMatrix(loadProduct(dir));
  fs.writeFileSync(path.join(dir, 'traceability.md'), renderMatrixMarkdown(rows));
  fs.writeFileSync(path.join(dir, 'traceability.html'), renderMatrixHtml(rows));
  console.log(`Wrote traceability for ${rows.length} requirements.`);
}
