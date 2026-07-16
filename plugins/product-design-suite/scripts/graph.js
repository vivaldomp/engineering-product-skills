// Engineering graph (feedback 008 phase 2). Two views, both regenerated on
// every finalize: traceability.json (the requirement matrix, serialized) and
// artifacts.graph.json (document-level nodes and edges).
//
// No lineage.json: PRD->SAD->SDD is a fixed pipeline in this suite, so a
// file restating it carries no information. The constant lives once, in
// workspace-paths.js, where it generates real edges.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');
const M = require('./meta.js');
const trace = require('./traceability.js');

const toPosix = p => p.split(path.sep).join('/');

function typeOf(rel) {
  for (const key of ['discovery', 'prd', 'sad', 'sdd', 'release', 'runbook']) {
    if (W.REL[key] === rel) return key;
  }
  return rel.startsWith(W.REL.adrDir + path.sep) ? 'adr' : 'import';
}

function buildGraph(root) {
  const covered = M.coveredDocs(root);
  const present = new Set(covered);

  const nodes = covered.map(rel => {
    const meta = M.readSidecar(path.join(root, M.sidecarPath(rel))) || {};
    return {
      id: toPosix(rel),
      type: typeOf(rel),
      skill: meta.skill || null,
      runId: meta.runId || null,
      hash: meta.hash || null,
    };
  });

  const edges = [];
  for (const rel of covered) {
    for (const dep of M.dependsOn(rel)) {
      if (present.has(dep)) edges.push({ from: toPosix(rel), to: toPosix(dep), kind: 'dependsOn', count: 1 });
    }
  }

  // shared-refs: two documents citing the same requirement IDs. Undirected in
  // meaning, so pairs are emitted once in lexicographic order.
  const refs = new Map();
  for (const rel of covered) {
    if (!rel.endsWith('.md')) continue;
    refs.set(rel, new Set(trace.parseRefs(fs.readFileSync(path.join(root, rel), 'utf8'))));
  }
  const withRefs = [...refs.keys()].sort();
  for (let i = 0; i < withRefs.length; i++) {
    for (let j = i + 1; j < withRefs.length; j++) {
      const a = withRefs[i], b = withRefs[j];
      const count = [...refs.get(a)].filter(id => refs.get(b).has(id)).length;
      if (count) edges.push({ from: toPosix(a), to: toPosix(b), kind: 'shared-refs', count });
    }
  }
  return { nodes, edges };
}

// "Architecture changed -> what do I regenerate?" Walks dependsOn in reverse
// (who depends on this, and who depends on those), then lists shared-ref peers.
function impact(graph, fileRel) {
  const id = toPosix(fileRel);
  const seen = new Set([id]);
  const out = [];
  let frontier = [id];
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) {
      for (const e of graph.edges) {
        if (e.kind === 'dependsOn' && e.to === cur && !seen.has(e.from)) {
          seen.add(e.from);
          out.push({ file: e.from, via: 'dependsOn' });
          next.push(e.from);
        }
      }
    }
    frontier = next;
  }
  for (const e of graph.edges) {
    if (e.kind !== 'shared-refs') continue;
    const other = e.from === id ? e.to : (e.to === id ? e.from : null);
    if (other && !seen.has(other)) {
      seen.add(other);
      out.push({ file: other, via: `${e.count} shared requirement ref(s)` });
    }
  }
  return out;
}

function writeGraph(root) {
  const gov = W.governanceDir(root);
  fs.mkdirSync(gov, { recursive: true });
  const matrix = trace.buildMatrix(trace.loadProduct(root));
  fs.writeFileSync(path.join(gov, 'traceability.json'), JSON.stringify(matrix, null, 2) + '\n');
  const graph = buildGraph(root);
  fs.writeFileSync(path.join(gov, 'artifacts.graph.json'), JSON.stringify(graph, null, 2) + '\n');
  return { matrix, graph };
}

module.exports = { buildGraph, impact, writeGraph, typeOf };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf('--' + n); return i === -1 ? undefined : args[i + 1]; };
  const target = opt('impact');
  const dir = W.resolveCurrent(args.find(a => !a.startsWith('--') && a !== target));
  if (args.includes('--impact')) {
    if (!target) {
      console.error('graph: --impact needs a file, e.g. --impact architecture/sad.md');
      process.exit(1);
    }
    const rows = impact(buildGraph(dir), target);
    console.log(`downstream of ${target}:`);
    for (const r of rows) console.log(`  ${r.file}  (${r.via})`);
    if (!rows.length) console.log('  (nothing)');
    process.exit(0);
  }
  const { matrix, graph } = writeGraph(dir);
  console.log(`wrote governance/traceability.json (${matrix.requirements.length} requirements)`);
  console.log(`wrote governance/artifacts.graph.json (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
}
