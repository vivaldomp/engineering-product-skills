const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const STOP = 'plugins/product-design-suite/scripts/stop-server.sh';

test('stop-server.sh --latest resolves and stops the newest session (006 H2)', () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-proj-'));
  const stateDir = path.join(proj, 'workspace', 'cache', 'preview', 'sess1', 'state');
  fs.mkdirSync(stateDir, { recursive: true });

  // Create a temporary sleeper script to pass --pds-server-id as argv
  const sleeperScript = path.join(os.tmpdir(), `sleeper-${Date.now()}.js`);
  fs.writeFileSync(sleeperScript, 'setInterval(()=>{}, 1e9);');

  const idArg = 'a'.repeat(40); // matches [A-Za-z0-9_-]{32,64}

  // Spawn the sleeper process via bash (like a normal terminal) to ensure proper signal handling
  const spawnCmd = `node "${sleeperScript}" --pds-server-id=${idArg} > /dev/null 2>&1 & echo $!`;
  const pidOutput = cp.execSync(spawnCmd, { encoding: 'utf8' }).trim();
  const pid = parseInt(pidOutput);

  fs.writeFileSync(path.join(stateDir, 'server.pid'), String(pid));
  fs.writeFileSync(path.join(stateDir, 'server-instance-id'), idArg);

  // Give the sleeper process time to fully start before stop-server tries to kill it
  cp.spawnSync('sleep', ['0.2']);

  try {
    const r = cp.spawnSync('bash', [STOP, '--latest', '--project-dir', proj], { encoding: 'utf8' });
    assert.match(r.stdout, /"status": "stopped"/, r.stdout + r.stderr);

    // process is gone
    let alive = true;
    try { process.kill(pid, 0); } catch (e) { alive = false; }
    assert.equal(alive, false, 'sleeper process should be killed');
  } finally {
    if (fs.existsSync(sleeperScript)) fs.unlinkSync(sleeperScript);
  }
});
