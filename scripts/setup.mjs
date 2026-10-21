import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sdk = path.join(root, 'vendor/UlanziDeckPlugin-SDK');
const versions = JSON.parse(readFileSync(path.join(root, 'sdk-versions.json'), 'utf8'));
for (const name of ['sdk', 'common-node', 'common-html']) {
  if (!/^[a-f0-9]{40}$/.test(versions[name] || '')) throw new Error(`Invalid SDK commit: ${name}`);
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const atSdk = (...args) => git('-C', sdk, ...args);

if (existsSync(sdk)) {
  // Never treat the enclosing worktree as the SDK, or discard local SDK edits.
  if (!existsSync(path.join(sdk, '.git')) || realpathSync(atSdk('rev-parse', '--show-toplevel')) !== realpathSync(sdk)) {
    throw new Error(`SDK path is not a Git checkout: ${sdk}`);
  }
  if (atSdk('status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none')) {
    throw new Error(`SDK has local changes; save them before running setup: ${sdk}`);
  }
} else {
  mkdirSync(path.dirname(sdk), { recursive: true });
  git('clone', '--no-checkout', 'https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK.git', sdk);
}

// Fetch only when this checkout does not already contain the locked commit.
try { atSdk('cat-file', '-e', `${versions.sdk}^{commit}`); }
catch { atSdk('fetch', 'origin', versions.sdk); }
atSdk('checkout', '--detach', versions.sdk);
atSdk('submodule', 'sync', '--recursive');
// Upstream declares public submodules with SSH URLs. Keep HTTPS rewriting local
// to this invocation so fresh machines need no GitHub SSH key or global Git edits.
atSdk('-c', 'url.https://github.com/.insteadOf=git@github.com:', 'submodule', 'update', '--init', '--recursive', '--checkout');
for (const [name, directory] of [['sdk', sdk], ['common-node', path.join(sdk, 'common-node')], ['common-html', path.join(sdk, 'common-html')]]) {
  const actual = git('-C', directory, 'rev-parse', 'HEAD');
  if (actual !== versions[name]) throw new Error(`SDK version mismatch: ${name}; expected ${versions[name]}, got ${actual}`);
}

// Use the same Node installation that mise used to launch this script.
const npm = path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm');
execFileSync(npm, ['ci'], { cwd: root, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}` } });
console.log('Development environment ready: locked SDK, submodules and npm dependencies.');
