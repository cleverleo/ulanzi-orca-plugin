import { t } from './i18n.js';
import { defaultCli } from './orca-client.js';
import { OrcaQuotas } from './orca-quotas.js';
import { isQuotaAction, quotaProvider, quotaProviders, quotaEntries, selectQuota } from './quota-state.js';
import { quotaIconSvg } from './quota-icon.js';
import { writeKeyIcon } from './key-icon.js';
import { diagnostic } from './diagnostics.js';

export function mountQuotaButtons(api, { createClient = options => new OrcaQuotas(options), writeIcon = writeKeyIcon, report = diagnostic } = {}) {
  const keys = new Map();
  const sources = new Map();
  function source(settings) {
    const id = settings.cliPath || defaultCli;
    if (!sources.has(id)) sources.set(id, { client: createClient({ cliPath: id }), sources: [], warnings: [], updatedAt: 0 });
    return sources.get(id);
  }
  function render(context) {
    const settings = keys.get(context);
    if (!settings || settings.active === false) return;
    const data = source(settings);
    const entries = quotaEntries(data.sources, settings.provider);
    const selected = selectQuota(entries);
    const svg = quotaIconSvg(settings.provider, selected);
    if (settings.lastIcon !== svg) {
      api.setPathIcon(context, writeIcon(svg, context));
      settings.lastIcon = svg;
    }
    api.sendToPropertyInspector({ type: 'quota', provider: settings.provider,
      providers: quotaProviders, entries, selectedEnvironment: selected?.environmentId,
      warnings: data.warnings, updatedAt: data.updatedAt }, context);
  }
  async function refresh(data) {
    if (data.pending) return data.pending;
    data.pending = (async () => {
      try {
        const result = await data.client.read();
        data.sources = result.sources;
        data.warnings = result.warnings;
        data.updatedAt = Date.now();
        report({ quotaStage: 'ready', quotaButtonCount: keys.size, quotaEnvironmentCount: data.sources.length });
      } catch {
        data.sources = [{ environmentName: '本机', environmentId: '', error: '额度读取失败', quotas: {} }];
        report({ quotaStage: 'failed' });
      }
      for (const [context, settings] of keys) if (source(settings) === data) render(context);
    })().finally(() => { data.pending = null; });
    return data.pending;
  }
  function register(message) {
    if (!isQuotaAction(message.uuid) || !message.context) return;
    const previous = keys.get(message.context) || {};
    const settings = { ...previous, ...message.param,
      active: message.active ?? (message.cmd === 'add' ? true : previous.active ?? true), lastIcon: null };
    settings.provider = quotaProvider(settings.provider);
    keys.set(message.context, settings);
    render(message.context);
    void refresh(source(settings));
  }
  api.onAdd(register);
  api.onParamFromApp(register);
  api.onParamFromPlugin(register);
  api.onSetActive(message => {
    const settings = keys.get(message.context);
    if (!settings) return;
    settings.active = message.active;
    if (message.active) { render(message.context); void refresh(source(settings)); }
  });
  api.onClear(message => { for (const item of message.param ?? []) keys.delete(item.context); });
  api.onSendToPlugin(message => {
    if (!isQuotaAction(message.uuid)) return;
    if (!keys.has(message.context)) register({ ...message, param: {} });
    const settings = keys.get(message.context);
    if (settings) void refresh(source(settings));
  });
  api.onRun(message => {
    const settings = keys.get(message.context);
    if (settings) void refresh(source(settings));
  });
  const timer = setInterval(() => {
    const active = new Set([...keys.values()].filter(s => s.active !== false).map(source));
    for (const [id, data] of sources) {
      if (active.has(data)) void refresh(data);
      else if (!data.pending) sources.delete(id);
    }
  }, 30000);
  timer.unref();
  return { stop() { clearInterval(timer); } };
}
