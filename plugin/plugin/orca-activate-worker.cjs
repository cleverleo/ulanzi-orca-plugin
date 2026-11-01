// Open a worktree in the local Orca window. Native chat sessions have no
// terminal handle, so `terminal switch` cannot reach them.
const { realpathSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const [cliPath, worktreeId] = process.argv.slice(2);
  const out = path.join(path.dirname(path.dirname(realpathSync(cliPath))), 'app.asar.unpacked/out');
  const { RuntimeClient } = require(path.join(out, 'cli/runtime/client.js'));
  const result = await new RuntimeClient(undefined, 10000, null, null).call('worktree.activate', {
    worktree: `id:${worktreeId}`, navigation: 'host',
  });
  process.stdout.write(JSON.stringify({ navigated: result.result.activated === true }));
})().catch(() => { process.stdout.write(JSON.stringify({ navigated: false })); process.exitCode = 1; });
