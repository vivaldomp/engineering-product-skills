const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const dir = path.join('plugins/product-design-suite/scripts');

test('preview-server.cjs parses without syntax errors', () => {
  const r = cp.spawnSync('node', ['--check', path.join(dir, 'preview-server.cjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('frame-template.html loads no external http(s) resources', () => {
  const html = fs.readFileSync(path.join(dir, 'frame-template.html'), 'utf8');
  assert.ok(!/(src|href)=("|')https?:\/\//.test(html), 'frame template must be self-contained');
});

test('start/stop scripts reference preview-server.cjs, not bare server.cjs', () => {
  for (const f of ['start-server.sh', 'stop-server.sh']) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    // any reference to the server file must be the renamed one
    const bare = txt.match(/(?<!preview-)server\.cjs/);
    assert.equal(bare, null, `${f} still references bare server.cjs`);
  }
});
