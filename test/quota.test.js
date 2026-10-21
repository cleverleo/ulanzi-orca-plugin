import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { normalizeQuotas, quotaEntries, selectQuota, resetLabel, quotaAction } from '../plugin/plugin/quota-state.js';
import { quotaIconSvg } from '../plugin/plugin/quota-icon.js';
import { OrcaQuotas } from '../plugin/plugin/orca-quotas.js';
import { mountQuotaButtons } from '../plugin/plugin/quota-buttons.js';

const now = 1800000000000;
const snapshot = normalizeQuotas({ account: 'SECRET', rateLimits: {
  claude: { provider: 'claude', status: 'ok', session: { usedPercent: 0, windowMinutes: 300 }, weekly: { usedPercent: 14, resetsAt: now + 86400000 }, updatedAt: now, apiKey: 'SECRET' },
  codex: { provider: 'codex', status: 'ok', weekly: { usedPercent: 2, resetsAt: now + 3600000 }, updatedAt: now },
} });
test('quota normalization keeps zero distinct from missing limits and excludes account data', () => {
  assert.equal(snapshot.claude.windows[0].usedPercent, 0);
  assert.equal(snapshot.codex.windows.length, 1);
  assert.equal(snapshot.codex.windows[0].kind, 'weekly');
  assert.ok(!JSON.stringify(snapshot).includes('SECRET'));
  const invalid = normalizeQuotas({ rateLimits: { a: { provider: 'claude', status: 'ok', weekly: { usedPercent: NaN } }, b: { provider: 'codex', status: 'ok', weekly: { usedPercent: -1 } } } });
  assert.equal(invalid.claude.status, 'unavailable');
  assert.equal(invalid.codex.status, 'unavailable');
});
test('local quota takes priority; remote is a fallback only when local data is unavailable', () => {
  const sources = [
    { environmentId: '', environmentName: '本机', quotas: snapshot },
    { environmentId: 'remote', environmentName: 'Remote', quotas: { claude: { ...snapshot.claude, windows: [{ usedPercent: 80 }] } } },
  ];
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).environmentId, '');
  sources[0].error = 'offline';
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).environmentId, 'remote');
  delete sources[0].error;
  const updatedAt = sources[0].quotas.claude.updatedAt;
  sources[0].quotas.claude.updatedAt = now - 600000;
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).environmentId, '');
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).stale, true);
  sources[0].quotas.claude.updatedAt = updatedAt;
  sources[1].error = 'offline';
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).environmentId, '');
  delete sources[1].error;
  sources[1].quotas.claude.updatedAt = now - 600000;
  assert.equal(selectQuota(quotaEntries(sources, 'claude', now)).environmentId, '');
});
test('reset labels handle missing timestamps and elapsed windows without claiming unused quota', () => {
  assert.equal(resetLabel(null, now), '重置时间未知');
  assert.equal(resetLabel(now - 1, now), '等待重置更新');
  assert.equal(resetLabel(now + 120000, now), '2分后重置');
  assert.equal(resetLabel(now + 3600000, now), '1时0分后');
  const svg = quotaIconSvg('codex', { ...snapshot.codex, environmentName: '<Remote>', stale: false }, now);
  assert.ok(svg.includes('2%'));
  assert.ok(!svg.includes('5小时已用'));
  assert.ok(svg.includes('&lt;Remote&gt;'));
  assert.equal((svg.match(/<svg\b/g) || []).length, 1);
});
test('quota fleet discovers remotes and marks failed cached sources unavailable', async () => {
  let fail = false;
  const fleet = new OrcaQuotas({ run: async () => ({ stdout: JSON.stringify({ ok: true, result: { environments: [{ id: 'remote', name: 'MacBook' }] } }) }),
    query: async id => { if (id && fail) throw new Error('offline'); return snapshot; } });
  const first = await fleet.read();
  assert.equal(first.sources.length, 2);
  fail = true;
  const second = await fleet.read();
  assert.equal(second.sources[1].error, 'offline');
  assert.equal(quotaEntries(second.sources, 'claude', now)[1].status, 'error');
});
test('isolated worker calls only accounts.list and outputs sanitized quota metrics', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-quota-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const resources = path.join(root, 'Resources');
  await mkdir(path.join(resources, 'bin'), { recursive: true });
  await mkdir(path.join(resources, 'app.asar.unpacked/out/cli/runtime'), { recursive: true });
  const cli = path.join(resources, 'bin/orca');
  await writeFile(cli, '');
  await writeFile(path.join(resources, 'app.asar.unpacked/out/cli/runtime/client.js'), `exports.RuntimeClient=class {
    constructor(home, timeout, pairing, environment){this.environment=environment;}
    async call(method,params){if(method!=='accounts.list'||params.refreshUsage!==false) throw Error('unsafe');
    return {result:{secret:'SECRET',rateLimits:{claude:{provider:'claude',status:'ok',apiKey:'SECRET',weekly:{usedPercent:this.environment==='remote'?73:21},updatedAt:${now}}}}};}
  };`);
  const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../plugin/plugin/orca-quota-worker.cjs', import.meta.url)), cli, 'remote']);
  const response = JSON.parse(stdout);
  assert.equal(response.quotas.claude.windows[0].usedPercent, 73);
  assert.ok(!stdout.includes('SECRET'));
});
test('one quota action binds each button provider independently', async t => {
  class Host extends EventEmitter {
    setPathIcon() {}
    sendToPropertyInspector(payload, context) { this.emit('result', { payload, context }); }
  }
  for (const [method, event] of Object.entries({ onAdd: 'add', onParamFromApp: 'paramfromapp', onParamFromPlugin: 'paramfromplugin', onSetActive: 'setactive', onClear: 'clear', onSendToPlugin: 'sendToPlugin', onRun: 'run' })) Host.prototype[method] = function (callback) { this.on(event, callback); };
  const host = new Host();
  const controller = mountQuotaButtons(host, { report: () => {}, writeIcon: () => 'test.svg', createClient: () => ({ read: async () => ({ sources: [{ environmentId: '', environmentName: '本机', quotas: snapshot }], warnings: [] }) }) });
  t.after(() => controller.stop());
  const ready = once(host, 'result');
  host.emit('add', { uuid: quotaAction, context: 'quota1', param: { provider: 'claude' } });
  await ready;
  host.emit('add', { uuid: quotaAction, context: 'quota2', param: { provider: 'codex' } });
  await new Promise(resolve => setImmediate(resolve));
  const results = [];
  host.on('result', value => results.push(value));
  host.emit('paramfromapp', { uuid: quotaAction, context: 'quota1', param: { provider: 'cursor' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(results.some(r => r.context === 'quota1' && r.payload.provider === 'cursor'));
  assert.ok(results.some(r => r.context === 'quota2' && r.payload.provider === 'codex'));
});
