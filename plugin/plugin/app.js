import UlanziApi from '../sdk-node/index.js';
import { OrcaClient, defaultCli } from './orca-client.js';
import { labels, publicProject, projectKey } from './project-state.js';

const api = new UlanziApi();
const keys = new Map();
const sources = new Map();
const pressed = new Set();

function source(settings) {
  const cliPath = settings.cliPath || defaultCli;
  const environment = settings.environment || '';
  const id = JSON.stringify([cliPath, environment]);
  if (!sources.has(id)) sources.set(id, { client: new OrcaClient({ cliPath, environment }), projects: [], error: '', updatedAt: 0 });
  return sources.get(id);
}

function sendProjects(context) {
  const settings = keys.get(context);
  if (!settings) return;
  const data = source(settings);
  api.sendToPropertyInspector({
    projects: data.projects.map(publicProject), error: data.error,
    updatedAt: data.updatedAt, omittedHosts: data.omittedHosts ?? [],
  }, context);
}

function render(context) {
  const settings = keys.get(context);
  if (!settings) return;
  const data = source(settings);
  const project = data.projects.find(p => projectKey(p) === settings.projectKey);
  const state = !settings.projectKey ? 'unconfigured' : data.error ? 'unknown' :
    project ? publicProject(project).state : data.updatedAt ? 'offline' : 'unknown';
  const name = settings.label || (project && publicProject(project).name) || settings.projectName || 'Orca';
  const text = `${name.slice(0, 22)}\n${labels[state]}`;
  const signature = JSON.stringify([state, text]);
  if (settings.lastRender !== signature) {
    api.setPathIcon(context, `resources/${state}.svg`, text);
    settings.lastRender = signature;
  }
}

async function poll(data) {
  if (data.pending) return data.pending;
  data.pending = (async () => {
    try {
      const result = await data.client.projects();
      data.projects = result.worktrees.filter(p => !p.isArchived);
      data.omittedHosts = result.hostScope?.omittedHostSelectors ?? [];
      data.updatedAt = Date.now();
      data.error = '';
    } catch (error) { data.error = error.message; }
    for (const [context, settings] of keys) if (source(settings) === data) {
      render(context);
      sendProjects(context);
    }
  })().finally(() => { data.pending = null; });
  return data.pending;
}

function register(message) {
  if (!message.context) return;
  const previous = keys.get(message.context) || {};
  keys.set(message.context, { ...previous, ...message.param, lastRender: null });
  render(message.context);
  void poll(source(keys.get(message.context)));
}

api.onAdd(register);
api.onParamFromApp(register);
api.onParamFromPlugin(register);
api.onSetActive(message => {
  const settings = keys.get(message.context);
  if (settings && message.active) { settings.lastRender = null; render(message.context); }
});
api.onClear(message => {
  for (const item of message.param ?? []) keys.delete(item.context);
});
api.onSendToPlugin(message => {
  if (!keys.has(message.context)) register({ ...message, param: {} });
  const settings = keys.get(message.context);
  if (settings) void poll(source(settings));
});
api.onRun(async message => {
  if (pressed.has(message.context)) return;
  const settings = keys.get(message.context);
  if (!settings?.projectKey) { api.toast('请先在配置页选择 Orca 项目'); return; }
  pressed.add(message.context);
  try {
    const data = source(settings);
    await poll(data);
    if (data.error) throw new Error(data.error);
    const project = data.projects.find(p => projectKey(p) === settings.projectKey);
    if (!project) throw new Error('项目不在当前 Orca 列表中，请重新选择');
    await data.client.switchProject(project);
  } catch (error) { api.toast(error.message); api.showAlert(message.context); }
  finally { pressed.delete(message.context); }
});

// Studio owns restarting the process. Avoid unhandled EventEmitter error events.
api.on('error', () => {});
api.on('close', () => process.exit(0));
api.connect('com.ulanzi.ulanzistudio.orcaprojects');
setInterval(() => {
  const active = new Set([...keys.values()].map(source));
  for (const [id, data] of sources) {
    if (active.has(data)) void poll(data);
    else if (!data.pending) sources.delete(id);
  }
}, 2500);
