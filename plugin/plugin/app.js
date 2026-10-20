import { setLocale, t, format } from './i18n.js';
import UlanziApi from '../sdk-node/index.js';
import { defaultCli } from './orca-client.js';
import { OrcaFleet } from './orca-fleet.js';
import { publicProject, projectKey } from './project-state.js';
import { keyIconSvg, writeKeyIcon } from './key-icon.js';
import { assignSlots, mountedSlots, layoutSlots, slotProject } from './worktree-slots.js';
import { diagnostic } from './diagnostics.js';
import { isQuotaAction } from './quota-state.js';
import { mountQuotaButtons } from './quota-buttons.js';

const api = new UlanziApi();
setLocale(process.argv[4] || 'en');
mountQuotaButtons(api);
const keys = new Map();
const sources = new Map();
const pressed = new Set();
let globalSettings = {};
let globalsLoaded = false;

function source(settings) {
  const cliPath = settings.cliPath || defaultCli;
  const id = cliPath;
  if (!sources.has(id)) sources.set(id, { id, client: new OrcaFleet({ cliPath }), projects: [], slots: globalSettings.slotAssignments?.[id] || [], error: '', updatedAt: 0 });
  return sources.get(id);
}

function enabledSlots(data) {
  return mountedSlots(mountedEntries(data).map(([, settings]) => settings));
}

function mountedEntries(data) {
  return [...keys].filter(([, settings]) => settings.active !== false && source(settings) === data);
}

function updateLayout(data) {
  const entries = mountedEntries(data);
  for (const [context, slot] of layoutSlots(entries)) {
    const settings = keys.get(context);
    if (settings.slot !== slot) settings.lastRender = null;
    settings.slot = slot;
  }
}

function schedulePoll(data) {
  clearTimeout(data.refreshTimer);
  // Studio replays add/clear events in bursts. Collect the mounted layout first.
  data.refreshTimer = setTimeout(() => { void poll(data); }, 150);
}

function sendProjects(context) {
  const settings = keys.get(context);
  if (!settings || settings.active === false) return;
  const data = source(settings);
  api.sendToPropertyInspector({
    projects: data.projects.map(publicProject), error: data.error,
    updatedAt: data.updatedAt, omittedHosts: data.omittedHosts ?? [],
    slot: settings.slot,
    enabledSlots: enabledSlots(data),
    slots: Array.from({ length: Math.max(10, enabledSlots(data).length) }, (_, i) => {
      const project = slotProject(data, i + 1);
      return { number: i + 1, project: project ? publicProject(project) : null };
    }),
    overflow: Math.max(0, data.projects.length - enabledSlots(data).length),
    warnings: data.warnings ?? [],
  }, context);
}

function render(context) {
  const settings = keys.get(context);
  if (!settings || settings.active === false) return;
  const data = source(settings);
  const project = slotProject(data, settings.slot);
  const state = data.error || !data.updatedAt ? 'unknown' :
    project ? publicProject(project).state : 'empty';
  const signature = keyIconSvg({ project, slot: settings.slot, state });
  if (settings.lastRender !== signature) {
    api.setPathIcon(context, writeKeyIcon(signature, context));
    settings.lastRender = signature;
  }
}

async function poll(data) {
  if (!globalsLoaded) return;
  if (!enabledSlots(data).length) return;
  if (data.pending) return data.pending;
  data.pending = (async () => {
    diagnostic({ stage: 'querying', globalsLoaded, keyCount: keys.size });
    try {
      const result = await data.client.projects(data.slots);
      data.projects = result.worktrees;
      data.warnings = result.warnings;
      const mounted = enabledSlots(data);
      // With no buttons left there is no Studio context to persist settings;
      // retain the cache until a layout mounts again, and stop querying it.
      if (!mounted.length) return;
      const layoutId = JSON.stringify(mountedEntries(data).map(([context]) => context).sort());
      const previous = data.layoutId !== layoutId
        ? globalSettings.layoutAssignments?.[data.id]?.[layoutId] || data.slots : data.slots;
      const slots = assignSlots(previous, data.projects, mounted);
      if (data.layoutId !== layoutId || JSON.stringify(slots) !== JSON.stringify(data.slots)) {
        data.slots = slots;
        data.layoutId = layoutId;
        globalSettings.slotAssignments = { ...globalSettings.slotAssignments, [data.id]: slots };
        globalSettings.layoutAssignments = { ...globalSettings.layoutAssignments,
          [data.id]: { ...globalSettings.layoutAssignments?.[data.id], [layoutId]: slots } };
        api.setGlobalSettings(globalSettings, mountedEntries(data)[0][0]);
      }
      data.omittedHosts = result.hostScope?.omittedHostSelectors ?? [];
      data.updatedAt = Date.now();
      data.error = '';
      diagnostic({ stage: 'ready', projectCount: data.projects.length, enabledSlots: mounted, keyCount: keys.size, warnings: data.warnings, error: '' });
    } catch (error) { data.error = error.message; diagnostic({ stage: 'query-failed', error: error.message }); }
    for (const [context, settings] of keys) if (source(settings) === data) {
      render(context);
      sendProjects(context);
    }
  })().finally(() => { data.pending = null; });
  return data.pending;
}

function register(message) {
  if (isQuotaAction(message.uuid)) return;
  if (!message.context) return;
  const previous = keys.get(message.context) || {};
  const oldSource = keys.has(message.context) ? source(previous) : null;
  const settings = { ...previous, ...message.param, lastRender: null,
    active: message.active ?? (message.cmd === 'add' ? true : previous.active ?? true),
    position: message.key ?? previous.position, device: message.device ?? previous.device };
  keys.set(message.context, settings);
  const data = source(settings);
  updateLayout(data);
  if (oldSource && oldSource !== data) updateLayout(oldSource);
  diagnostic({ keyCount: keys.size, globalsLoaded });
  if (!globalsLoaded) { diagnostic({ stage: 'waiting-for-settings' }); api.getGlobalSettings(message.context); }
  render(message.context);
  schedulePoll(data);
  if (oldSource && oldSource !== data) schedulePoll(oldSource);
}

api.onAdd(register);
api.onParamFromApp(register);
api.onParamFromPlugin(register);
api.onSetActive(message => {
  const settings = keys.get(message.context);
  if (!settings || typeof message.active !== 'boolean') return;
  settings.active = message.active;
  const data = source(settings);
  updateLayout(data);
  schedulePoll(data);
  if (message.active) { settings.lastRender = null; render(message.context); }
});
api.onClear(message => {
  const affected = new Set();
  for (const item of message.param ?? []) {
    const settings = keys.get(item.context);
    if (settings) affected.add(source(settings));
    keys.delete(item.context);
  }
  for (const data of affected) { updateLayout(data); schedulePoll(data); }
  diagnostic({ keyCount: keys.size });
});
api.onSendToPlugin(message => {
  if (!keys.has(message.context)) register({ ...message, param: {} });
  const settings = keys.get(message.context);
  if (settings) schedulePoll(source(settings));
});
api.onRun(async message => {
  if (pressed.has(message.context)) return;
  const settings = keys.get(message.context);
  if (!settings || settings.active === false) return;
  pressed.add(message.context);
  try {
    const data = source(settings);
    const expectedKey = data.slots[settings.slot - 1];
    await poll(data);
    if (data.error) throw new Error(data.error);
    if (!globalsLoaded) throw new Error(t('正在加载坑位设置，请稍后重试'));
    const project = slotProject(data, settings.slot);
    if (!project) throw new Error(format(`坑位 ${settings.slot} 暂无运行中的 worktree`, `No running worktree in slot ${settings.slot}`));
    if (!expectedKey || expectedKey !== projectKey(project)) throw new Error(t('坑位已更新，请查看按键后再按一次'));
    await data.client.switchProject(project);
  } catch (error) { api.toast(error.message); api.showAlert(message.context); }
  finally { pressed.delete(message.context); }
});

// Studio owns restarting the process. Avoid unhandled EventEmitter error events.
api.on('error', () => {});
api.on('close', () => process.exit(0));
api.onConnected(() => { diagnostic({ stage: 'connected', connected: true }); });
api.onDidReceiveGlobalSettings(message => {
  if (globalsLoaded) return;
  globalSettings = message.settings && typeof message.settings === 'object' ? message.settings : {};
  globalsLoaded = true;
  diagnostic({ globalsLoaded: true });
  for (const data of sources.values()) {
    data.slots = globalSettings.slotAssignments?.[data.id] || [];
    schedulePoll(data);
  }
});
api.connect('com.ulanzi.ulanzistudio.orcaprojects');
api.websocket.on('message', raw => {
  try {
    const message = JSON.parse(String(raw));
    if (/globalsettings/i.test(message.cmd || '')) diagnostic({ lastSettingsMessage: {
      cmd: message.cmd, code: message.code, cmdType: message.cmdType, fields: Object.keys(message),
    } });
  } catch { /* Ignore non-JSON transport diagnostics. */ }
});
setInterval(() => {
  if (!globalsLoaded) {
    const context = [...keys].find(([, settings]) => settings.active !== false)?.[0];
    if (context) api.getGlobalSettings(context);
    return;
  }
  const active = new Set([...keys.values()].filter(settings => settings.active !== false).map(source));
  for (const data of sources.values()) {
    if (active.has(data)) void poll(data);
    // Keep cached assignment state when switching pages; Studio persists it too.
  }
}, 2500);
