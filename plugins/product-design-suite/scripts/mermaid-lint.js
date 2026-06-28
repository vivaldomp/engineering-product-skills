// Lightweight, dependency-free mermaid linter (feedback IMP-6). Catches the
// known footgun class — NOT a full parser. Reads RAW markdown (never stripped).
const fs = require('node:fs');
const path = require('node:path');
const { extractMermaidBlocks } = require('./mermaid-preview.js');

const TYPE_RE = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|C4Context|C4Container|C4Component|C4Dynamic|mindmap|timeline|gitGraph|requirementDiagram|quadrantChart)\b/;

function lintBlock(src) {
  const errs = [];
  const lines = String(src || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) { errs.push('empty mermaid block'); return errs; }
  if (!TYPE_RE.test(lines[0])) errs.push(`unknown/missing diagram type on first line: "${lines[0]}"`);
  // Deliberately-lightweight heuristic: counts all bracket pairs without parsing node-label content.
  // May over-count brackets inside quoted text within node labels, but avoids parser complexity.
  for (const [open, close] of [['[', ']'], ['(', ')'], ['{', '}']]) {
    const o = (src.match(new RegExp('\\' + open, 'g')) || []).length;
    const c = (src.match(new RegExp('\\' + close, 'g')) || []).length;
    if (o !== c) errs.push(`unbalanced ${open}${close} (${o} open, ${c} close)`);
  }
  if (/^sequenceDiagram/.test(lines[0])) {
    // Mermaid treats ';' as a statement separator on ANY line — notes/fragments
    // included, not only arrow messages (feedback 005 #1). Skip the type line.
    for (const l of lines.slice(1)) {
      if (l.includes(';')) errs.push(`semicolon in sequenceDiagram line (';' is a statement separator): "${l}"`);
    }
  }
  if (/^(graph|flowchart)\b/.test(lines[0])) {
    // A literal '\n' in a node label renders as text, not a line break; use <br/>
    // with the label quoted (feedback 005 #3).
    for (const l of lines) {
      if (/[[({].*\\n.*[\])}]/.test(l)) errs.push(`literal \\n inside a node label (use <br/> with a quoted label): "${l}"`);
    }
  }
  return errs;
}

function lintMarkdown(md) {
  return extractMermaidBlocks(md).flatMap((b, i) => lintBlock(b).map(e => `diagram ${i + 1}: ${e}`));
}

function lintProductDiagrams(dir) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) {
        const errs = lintMarkdown(fs.readFileSync(p, 'utf8'));
        if (errs.length) out.push({ file: p, errors: errs });
      }
    }
  };
  walk(dir);
  return out;
}

module.exports = { lintBlock, lintMarkdown, lintProductDiagrams };

if (require.main === module) {
  const results = lintProductDiagrams(path.resolve(process.argv[2] || '.product'));
  for (const r of results) for (const e of r.errors) console.log(`${r.file}: ${e}`);
  console.log(results.length ? 'mermaid-lint: errors found' : 'mermaid-lint: clean');
  process.exit(results.length ? 1 : 0);
}
