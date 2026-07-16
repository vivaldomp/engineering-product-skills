const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const W = require('../plugins/product-design-suite/scripts/workspace-paths.js');

test('canonical roots', () => {
  assert.equal(W.CURRENT, path.join('workspace', 'outputs', 'current'));
  assert.equal(W.HISTORY, path.join('workspace', 'outputs', 'history'));
  assert.equal(W.CACHE, path.join('workspace', 'cache'));
  assert.equal(W.ENGINEERING, '.engineering');
  assert.equal(W.CONFIG, path.join('.engineering', 'config.yaml'));
});

test('doc paths follow the engineering-purpose taxonomy', () => {
  assert.equal(W.docPath('/x', 'prd'), path.join('/x', 'planning', 'prd.md'));
  assert.equal(W.docPath('/x', 'srs'), path.join('/x', 'specifications', 'srs.md'));
  assert.equal(W.docPath('/x', 'sad'), path.join('/x', 'architecture', 'sad.md'));
  assert.equal(W.docPath('/x', 'sdd'), path.join('/x', 'architecture', 'sdd.md'));
  assert.equal(W.adrDir('/x'), path.join('/x', 'architecture', 'adr'));
  assert.equal(W.governanceDir('/x'), path.join('/x', 'governance'));
  assert.throws(() => W.docPath('/x', 'nope'), /unknown doc key/);
});

test('resolveCurrent defaults to workspace/outputs/current', () => {
  assert.equal(W.resolveCurrent(undefined), path.resolve(W.CURRENT));
  assert.equal(W.resolveCurrent('/tmp/z'), path.resolve('/tmp/z'));
});

test('phase-2 layout constants', () => {
  assert.equal(W.RELEASES, path.join('workspace', 'outputs', 'releases'));
  assert.equal(W.RECEIPTS, path.join('.engineering', 'receipts'));
  assert.equal(W.TELEMETRY, path.join('.engineering', 'telemetry'));
  assert.equal(W.RUNS_LOG, path.join('.engineering', 'telemetry', 'runs.jsonl'));
});

test('TEMPLATE_FOR is keyed by exact doc path, with no directory keys', () => {
  assert.equal(W.TEMPLATE_FOR[W.REL.prd], 'prd-template.md');
  assert.equal(W.TEMPLATE_FOR[W.REL.sdd], 'sdd-template.md');
  assert.equal(Object.keys(W.TEMPLATE_FOR).length, 4);
  // A directory-shaped key would break validate-structure's existsSync loop.
  assert.equal(W.TEMPLATE_FOR[W.REL.adrDir], undefined);
});

test('DEPENDS encodes the authoring pipeline', () => {
  assert.deepEqual(W.DEPENDS[W.REL.srs], [W.REL.prd]);
  assert.deepEqual(W.DEPENDS[W.REL.sad], [W.REL.srs]);
  assert.deepEqual(W.DEPENDS[W.REL.sdd], [W.REL.sad]);
  assert.equal(W.DEPENDS[W.REL.prd], undefined);
});

test('IMPORT_ARTIFACTS names egp-import outputs', () => {
  assert.deepEqual(W.IMPORT_ARTIFACTS, [
    path.join('governance', 'import-gap-report.md'),
    path.join('governance', 'import-map.json'),
    path.join('governance', 'import-state.json'),
  ]);
});
