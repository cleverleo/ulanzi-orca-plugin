/* global $UD */
const fields = Object.fromEntries(['cliPath', 'status', 'occupant'].map(id => [id, document.getElementById(id)]));
const actionUuid = new URLSearchParams(location.search).get('uuid') || '';
let settings = {};
let slots = [];
let currentSlot = 0;
const states = { waiting: '待确认', working: '工作中', done: '已完成', idle: '空闲', error: '异常', unknown: '未知', offline: '未运行' };

function render() {
  document.getElementById('heading').textContent = currentSlot ? `Orca 工作区 · 第 ${currentSlot} 个位置` : 'Orca 工作区 · 自动排序';
  const project = slots.find(s => s.number === currentSlot)?.project;
  fields.occupant.textContent = project ? `当前：${project.name} / ${project.displayName || project.worktreeName} · ${states[project.state] || project.state}\nAgent：${project.agents.map(a => a.type).filter(Boolean).join(' + ') || '普通终端'}\n${project.environmentName || '本机'} · ${project.path}` : '当前坑位为空，新 worktree 会自动补入。';
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
document.getElementById('refresh').addEventListener('click', () => { fields.status.textContent = '正在刷新…'; $UD.sendToPlugin({ type: 'projects' }); });
$UD.onAdd(load);
$UD.onParamFromApp(load);
$UD.onConnected(() => $UD.sendToPlugin({ type: 'projects' }));
$UD.onSendToPropertyInspector(message => {
  const data = message.payload;
  if (!data) return;
  slots = data.slots || [];
  if (data.slot) currentSlot = data.slot;
  render();
  fields.status.textContent = data.error || (data.updatedAt ? `已读取 ${data.projects.length} 个 worktree · ${new Date(data.updatedAt).toLocaleTimeString()}` : '正在加载坑位…');
  if (data.enabledSlots) fields.status.textContent += `\n已挂出 ${data.enabledSlots.length} 个坑位（${data.enabledSlots.join('、')}）`;
  if (data.overflow) fields.status.textContent += `\n另有 ${data.overflow} 个 worktree 等待空位。`;
  if (data.warnings?.length) fields.status.textContent += '\n' + data.warnings.join('\n');
});
$UD.connect(actionUuid || 'com.ulanzi.ulanzistudio.orcaprojects.project');
