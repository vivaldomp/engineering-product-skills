const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../plugins/product-design-suite/scripts/meta.js');
const G = require('../plugins/product-design-suite/scripts/graph.js');

function current(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

const edgesOf = (g, kind) => g.edges.filter(e => e.kind === kind);

test('dependsOn edges follow the authoring pipeline, only between present docs', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'specifications/srs.md': 'FR-001',
    'architecture/sdd.md': 'FR-001',
  });
  const g = G.buildGraph(root);
  const deps = edgesOf(g, 'dependsOn').map(e => `${e.from}->${e.to}`);
  assert.ok(deps.includes('specifications/srs.md->planning/prd.md'));
  // sad.md is absent, so sdd->sad must not appear.
  assert.ok(!deps.some(d => d.endsWith('->architecture/sad.md')));
});

test('nodes carry sidecar provenance and are typed', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  M.writeSidecars({ root, skill: 'egp-prd-builder', runId: 'R1', version: '0.1.1' });
  const [node] = G.buildGraph(root).nodes;
  assert.equal(node.id, 'planning/prd.md');
  assert.equal(node.type, 'prd');
  assert.equal(node.skill, 'egp-prd-builder');
  assert.equal(node.runId, 'R1');
  assert.match(node.hash, /^sha256:/);
});

test('shared-refs edges carry the shared id count, one normalized pair each', () => {
  const root = current({
    'planning/prd.md': 'FR-001 and FR-002 and FR-003',
    'architecture/sdd.md': 'covers FR-001 and FR-002',
  });
  const shared = edgesOf(G.buildGraph(root), 'shared-refs');
  assert.equal(shared.length, 1);
  assert.equal(shared[0].from, 'architecture/sdd.md');
  assert.equal(shared[0].to, 'planning/prd.md');
  assert.equal(shared[0].count, 2);
});

test('impact walks dependsOn transitively', () => {
  const root = current({
    'planning/prd.md': 'FR-001',
    'specifications/srs.md': 'FR-001',
    'architecture/sad.md': 'AR-001 traces to FR-001',
    'architecture/sdd.md': 'FR-001',
  });
  const rows = G.impact(G.buildGraph(root), 'planning/prd.md');
  const files = rows.map(r => r.file);
  assert.ok(files.includes('specifications/srs.md'));
  assert.ok(files.includes('architecture/sad.md'));  // transitive: sad -> srs -> prd
  assert.ok(files.includes('architecture/sdd.md'));  // transitive: sdd -> sad
  assert.ok(!files.includes('planning/prd.md'));     // never itself
});

test('missing documents produce no node rather than a crash', () => {
  const root = current({ 'planning/prd.md': 'FR-001' });
  const g = G.buildGraph(root);
  assert.deepEqual(g.nodes.map(n => n.id), ['planning/prd.md']);
  assert.deepEqual(g.edges, []);
});

test('writeGraph emits both json files into governance', () => {
  const root = current({ 'planning/prd.md': 'FR-001', 'architecture/sdd.md': 'covers FR-001' });
  const { matrix, graph } = G.writeGraph(root);
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'governance', 'traceability.json'), 'utf8'));
  assert.deepEqual(onDisk.requirements.map(r => r.id), ['FR-001']);
  assert.equal(matrix.orphans.length, 0);
  const g = JSON.parse(fs.readFileSync(path.join(root, 'governance', 'artifacts.graph.json'), 'utf8'));
  assert.deepEqual(g, graph);
});
