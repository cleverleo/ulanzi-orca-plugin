// Run Orca's version-matched client in isolation, without importing its application code into Studio.
const { realpathSync, existsSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const [cliPath, environment = ''] = process.argv.slice(2);
  const resources = path.dirname(path.dirname(realpathSync(cliPath)));
  const clientPath = path.join(resources, 'app.asar.unpacked/out/cli/runtime/client.js');
  if (!existsSync(clientPath)) throw new Error('incompatible');
  const { RuntimeClient } = require(clientPath);
  const response = await new RuntimeClient(undefined, 10000, null, environment || null)
    .call('accounts.list', { refreshUsage: false });
  const { normalizeQuotas } = await import('./quota-state.js');
  process.stdout.write(JSON.stringify({ ok: true, quotas: normalizeQuotas(response.result) }));
})().catch(() => {
  process.stdout.write(JSON.stringify({ ok: false, error: '无法读取 Orca 额度，请确认 Orca 已运行且版本兼容' }));
  process.exitCode = 1;
});
