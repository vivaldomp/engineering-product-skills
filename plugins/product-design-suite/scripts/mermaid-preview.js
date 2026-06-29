const fs = require('node:fs');
const path = require('node:path');

const VENDOR_MERMAID = path.join(__dirname, 'vendor', 'mermaid.min.js');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// Inner source of every ```mermaid fenced block, in document order.
function extractMermaidBlocks(markdown) {
  const re = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g;
  const out = [];
  let mm;
  while ((mm = re.exec(String(markdown || ''))) !== null) {
    out.push(mm[1].replace(/\s+$/, ''));
  }
  return out;
}

// Self-contained preview page. mermaidJs is inlined (no external src), so the
// page renders offline / in restricted networks.
function renderPreview(blocks, opts = {}) {
  const title = opts.title || 'Diagram Preview';
  // Guard against a stray </script> inside the minified lib closing the tag early.
  const mermaidJs = String(opts.mermaidJs || '').replace(/<\/script>/gi, '<\\/script>');
  const figures = (blocks || []).length
    ? blocks.map((code, i) =>
        `<figure><figcaption>Diagram ${i + 1}</figcaption>` +
        `<pre class="mermaid">${esc(code)}</pre></figure>`).join('\n')
    : '<p class="empty">No mermaid diagrams found.</p>';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#fff}` +
    `h1{font-size:1.2rem}figure{margin:0 0 2rem}` +
    `figcaption{font-size:.8rem;color:#666;margin-bottom:.4rem}.empty{color:#666}</style>` +
    `</head><body><h1>${esc(title)}</h1>${figures}` +
    `<script>${mermaidJs}</script>` +
    `<script>mermaid.initialize({startOnLoad:true});</script>` +
    `</body></html>`;
}

// JS-free page assembled from already-rendered SVG strings (006 A2). The SVGs are
// captured from the live preview; no client-side runtime, so no serving path can
// break it. Inputs are trusted rendered SVG markup and are inlined as-is.
function renderStaticSvgPage(svgs, opts = {}) {
  const title = opts.title || 'Diagram Preview';
  const figures = (svgs || []).length
    ? (svgs || []).map((svg, i) =>
        `<figure><figcaption>Diagram ${i + 1}</figcaption>${String(svg == null ? '' : svg)}</figure>`).join('\n')
    : '<p class="empty">No diagrams.</p>';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#fff}` +
    `h1{font-size:1.2rem}figure{margin:0 0 2rem}` +
    `figcaption{font-size:.8rem;color:#666;margin-bottom:.4rem}.empty{color:#666}svg{max-width:100%}</style>` +
    `</head><body><h1>${esc(title)}</h1>${figures}</body></html>`;
}

module.exports = { extractMermaidBlocks, renderPreview, renderStaticSvgPage };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--static') {
    const [, outPath, ...svgPaths] = argv;
    if (!outPath || !svgPaths.length) {
      console.error('usage: mermaid-preview.js --static <out.html> <a.svg> [b.svg ...]');
      process.exit(1);
    }
    const svgs = svgPaths.map(p => fs.readFileSync(p, 'utf8'));
    const abs = path.resolve(outPath);
    fs.writeFileSync(abs, renderStaticSvgPage(svgs, { title: path.basename(outPath) }));
    console.log(`Wrote ${abs} (${svgs.length} static svg${svgs.length === 1 ? '' : 's'}) — JS-free; open directly.`);
    process.exit(0);
  }
  const [inPath, outPath] = argv;
  if (!inPath || !outPath) {
    console.error('usage: mermaid-preview.js <input.md> <out.html>');
    process.exit(1);
  }
  const markdown = fs.readFileSync(inPath, 'utf8');
  const mermaidJs = fs.existsSync(VENDOR_MERMAID) ? fs.readFileSync(VENDOR_MERMAID, 'utf8') : '';
  const blocks = extractMermaidBlocks(markdown);
  const abs = path.resolve(outPath);
  fs.writeFileSync(abs, renderPreview(blocks, { title: path.basename(inPath), mermaidJs }));
  console.log(`Wrote ${abs} (${blocks.length} diagram${blocks.length === 1 ? '' : 's'}) — open this file directly; no server needed.`);
}
