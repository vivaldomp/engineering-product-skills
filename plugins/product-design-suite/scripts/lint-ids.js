// plugins/product-design-suite/scripts/lint-ids.js
// ID linter (feedback E1): flags identifiers that LOOK like requirement IDs but
// do not match the canonical convention in id-conventions.js, plus duplicates.
const fs = require('node:fs');
const path = require('node:path');
const C = require('./id-conventions.js');

// "ID-shaped": a known prefix, a separator, optional category letters, then a
// REQUIRED digit — broad enough to catch near-misses (NFR_P1, FR-01X) the
// canonical regex drops, but a required digit avoids flagging prose like
// "C-suite"/"C-section" (the single-letter C prefix would otherwise match).
const SHAPED_RE = new RegExp('\\b(?:' + C.PREFIXES.join('|') + ')[-_][A-Za-z]{0,2}\\d[A-Za-z0-9]*', 'g');

function lintText(text) {
  const shaped = C.stripCode(text).match(SHAPED_RE) || [];
  const malformed = [...new Set(shaped.filter(tok => !C.MEMBER_RE.test(tok)))];
  return { malformed };
}

function lintProduct(dir) {
  const malformed = [];
  const seen = new Map(); // id -> Set<file>
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf8');
        const stripped = C.stripCode(text);
        for (const tok of lintText(text).malformed) malformed.push({ file: p, token: tok });
        for (const tok of (stripped.match(SHAPED_RE) || [])) {
          if (C.MEMBER_RE.test(tok)) {
            const set = seen.get(tok) || new Set();
            set.add(p);
            seen.set(tok, set);
          }
        }
      }
    }
  };
  walk(dir);
  const duplicates = [...seen.entries()]
    .filter(([, files]) => files.size > 1)
    .map(([id, files]) => ({ id, files: [...files] }));
  return { malformed, duplicates };
}

module.exports = { lintText, lintProduct, SHAPED_RE };

if (require.main === module) {
  const dir = process.argv[2] || '.product';
  const { malformed, duplicates } = lintProduct(dir);
  for (const m of malformed) console.log(`malformed id "${m.token}" in ${m.file}`);
  for (const d of duplicates) console.log(`duplicate id ${d.id} in ${d.files.join(', ')}`);
  if (malformed.length || duplicates.length) {
    console.error(`lint-ids: ${malformed.length} malformed, ${duplicates.length} duplicate id(s).`);
    process.exit(1);
  }
  console.log('lint-ids: all ids match the canonical convention.');
}
