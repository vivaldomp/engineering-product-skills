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
