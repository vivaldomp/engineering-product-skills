// Release promotion (feedback 008 phase 2): history/<run-id> -> releases/<name>.
//
// Promotion sources only from history. Promoting the live current/ tree is not
// supported: it would produce a release no gate ever validated.
const fs = require('node:fs');
const path = require('node:path');
const W = require('./workspace-paths.js');

function nextVersion(releasesDir) {
  let max = 0;
  if (fs.existsSync(releasesDir)) {
    for (const f of fs.readdirSync(releasesDir)) {
      const m = f.match(/^v(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `v${max + 1}`;
}

function gateErrorCount(runDir) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(runDir, 'validation', 'gate.json'), 'utf8'));
    return g.checks.filter(c => c.level === 'error' && !c.pass).length;
  } catch { return 0; }
}

function promote({ run, as, force = false, projectRoot = '.', now = new Date() } = {}) {
  if (!run) throw new Error('promote: --run <run-id> is required');
  const runDir = path.resolve(projectRoot, W.HISTORY, run);
  const manifestPath = path.join(runDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`promote: no run ${run} under ${W.HISTORY}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.status !== 'success' && !force) {
    throw new Error(
      `promote: run ${run} is ${manifest.status} (${gateErrorCount(runDir)} gate error(s); see ` +
      `${path.join(W.HISTORY, run, 'validation', 'gate.json')}). ` +
      'Refusing — re-run the gate, or pass --force.');
  }

  const releasesDir = path.resolve(projectRoot, W.RELEASES);
  const name = as || nextVersion(releasesDir);
  const dest = path.join(releasesDir, name);
  if (fs.existsSync(dest)) {
    throw new Error(`promote: ${path.join(W.RELEASES, name)} already exists; pick another --as name`);
  }

  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(runDir, 'artifacts'), path.join(dest, 'artifacts'), { recursive: true });

  const release = {
    release: name,
    runId: manifest.runId,
    promotedAt: now.toISOString(),
    fromStatus: manifest.status,
    // Only true when a failing status was overridden, so the override stays
    // visible for the life of the release.
    forced: manifest.status !== 'success',
    artifacts: manifest.artifacts,
  };
  fs.writeFileSync(path.join(dest, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  return { dest, release };
}

module.exports = { promote, nextVersion };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf('--' + n); return i === -1 ? undefined : args[i + 1]; };
  try {
    const { dest, release } = promote({
      run: opt('run'), as: opt('as'), force: args.includes('--force'), projectRoot: opt('root') || '.',
    });
    console.log(`promote: wrote ${path.relative(process.cwd(), dest)}${release.forced ? ' (forced)' : ''} ` +
      `from run ${release.runId} (${release.artifacts.length} artifact(s))`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
