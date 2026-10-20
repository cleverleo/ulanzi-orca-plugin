import { mkdir, writeFile } from 'node:fs/promises';
import { OrcaQuotas } from '../plugin/plugin/orca-quotas.js';
import { quotaProviders, quotaEntries, selectQuota } from '../plugin/plugin/quota-state.js';
import { quotaIconSvg } from '../plugin/plugin/quota-icon.js';

const result = await new OrcaQuotas().read();
const selected = Object.keys(quotaProviders).map(provider => ({ provider, quota: selectQuota(quotaEntries(result.sources, provider)) }));
console.log(JSON.stringify({ environments: result.sources.map(source => ({ name: source.environmentName, error: source.error })),
  quotas: selected, warnings: result.warnings }, null, 2));
if (process.argv.includes('--preview')) {
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const svg = selected.filter(row => row.quota?.status === 'ok').map(({ provider, quota }) => quotaIconSvg(provider, quota));
  await writeFile(new URL('../dist/quota-preview.html', import.meta.url), `<html><body style="margin:0;padding:16px;background:#202124;display:flex;gap:12px">${svg.join('')}</body></html>`);
}
