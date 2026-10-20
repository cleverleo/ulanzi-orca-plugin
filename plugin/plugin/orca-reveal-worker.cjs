// Reveal a paired terminal on this desktop even when the remote GUI reports success.
const { realpathSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const [cliPath, environmentId, worktreeId, tabId, leafId] = process.argv.slice(2);
  const out = path.join(path.dirname(path.dirname(realpathSync(cliPath))), 'app.asar.unpacked/out');
  const { RuntimeClient } = require(path.join(out, 'cli/runtime/client.js'));
  const { toRuntimeExecutionHostId } = require(path.join(out, 'shared/execution-host.js'));
  const result = await new RuntimeClient(undefined, 10000, null, null).call('terminal.reveal', {
    worktreeId, tabId, leafId: leafId || null, executionHostId: toRuntimeExecutionHostId(environmentId),
  });
  process.stdout.write(JSON.stringify({ navigated: result.result.reveal.navigated === true }));
})().catch(() => { process.stdout.write(JSON.stringify({ navigated: false })); process.exitCode = 1; });
