import { t, format, setLocale, getLocale, windowLabel } from '../plugin/i18n.js';
setLocale(new URLSearchParams(location.search).get('language') || navigator.language);
document.documentElement.lang = getLocale();
for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.textContent);
/* global $UD */
const fields = Object.fromEntries(['cliPath', 'status', 'occupant'].map(id => [id, document.getElementById(id)]));
const actionUuid = new URLSearchParams(location.search).get('uuid') || '';
let settings = {};
let slots = [];
let currentSlot = 0;
const states = { waiting: t('待确认'), working: t('工作中'), done: t('已完成'), idle: t('空闲'), error: t('异常'), unknown: t('未知'), offline: t('未运行') };

function render() {
  document.getElementById('heading').textContent = currentSlot ? format(`Orca 工作区 · 第 ${currentSlot} 个位置`, `Orca Workspaces · Slot ${currentSlot}`) : format('Orca 工作区 · 自动排序', 'Orca Workspaces · Automatic order');
  const project = slots.find(s => s.number === currentSlot)?.project;
  fields.occupant.textContent = project ? `${format('当前：', 'Current: ')}${project.name} / ${project.displayName || project.worktreeName} · ${states[project.state] || project.state}\nAgent: ${project.agents.map(a => a.type).filter(Boolean).join(' + ') || t('普通终端')}\n${project.environmentId === '' ? t('本机') : project.environmentName || t('本机')} · ${project.path}` : t('当前坑位为空，新 worktree 会自动补入。');
}
function load(message) {
  settings = { ...settings, ...message.param };
  fields.cliPath.value = settings.cliPath || '';
  render();
  $UD.sendToPlugin({ type: 'projects' });
}
function save() {
  settings = { cliPath: fields.cliPath.value.trim() };
  slots = [];
  render();
  $UD.sendParamFromPlugin(settings);
  $UD.sendToPlugin({ type: 'projects' });
}
fields.cliPath.addEventListener('change', save);
document.getElementById('refresh').addEventListener('click', () => { fields.status.textContent = t('正在刷新…'); $UD.sendToPlugin({ type: 'projects' }); });
$UD.onAdd(load);
$UD.onParamFromApp(load);
$UD.onConnected(() => $UD.sendToPlugin({ type: 'projects' }));
$UD.onSendToPropertyInspector(message => {
  const data = message.payload;
  if (!data) return;
  slots = data.slots || [];
  if (data.slot) currentSlot = data.slot;
  render();
  fields.status.textContent = data.error || (data.updatedAt ? format(`已读取 ${data.projects.length} 个 worktree · ${new Date(data.updatedAt).toLocaleTimeString()}`, `${data.projects.length} worktrees · ${new Date(data.updatedAt).toLocaleTimeString()}`) : t('正在加载坑位…'));
  if (data.enabledSlots) fields.status.textContent += format(`\n已挂出 ${data.enabledSlots.length} 个坑位（${data.enabledSlots.join('、')}）`, `\n${data.enabledSlots.length} slots mounted (${data.enabledSlots.join(', ')})`);
  if (data.overflow) fields.status.textContent += format(`\n另有 ${data.overflow} 个 worktree 等待空位。`, `\n${data.overflow} more worktrees waiting for slots.`);
  if (data.warnings?.length) fields.status.textContent += '\n' + data.warnings.join('\n');
});
$UD.connect(actionUuid || 'com.ulanzi.ulanzistudio.orcaprojects.project');
