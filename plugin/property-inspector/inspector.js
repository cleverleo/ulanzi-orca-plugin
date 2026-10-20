/* global $UD */
const fields = Object.fromEntries(['project', 'label', 'environment', 'cliPath', 'status'].map(id => [id, document.getElementById(id)]));
let settings = {};
let projects = [];
const states = { waiting: '待确认', working: '工作中', done: '已完成', idle: '空闲', error: '异常', unknown: '未知', offline: '未运行' };

function options() {
  fields.project.replaceChildren(new Option('请选择项目', ''));
  for (const p of projects) fields.project.add(new Option(`${p.active ? '● ' : ''}${p.name} / ${p.branch} · ${states[p.state] || p.state} · ${p.hostId}`, p.key));
  if (settings.projectKey && !projects.some(p => p.key === settings.projectKey)) {
    fields.project.add(new Option(`${settings.projectName || '已选项目'}（暂不可用）`, settings.projectKey));
  }
  fields.project.value = settings.projectKey || '';
}
function load(message) {
  settings = { ...settings, ...message.param };
  for (const id of ['label', 'environment', 'cliPath']) fields[id].value = settings[id] || '';
  options();
  $UD.sendToPlugin({ type: 'projects' });
}
function save() {
  const project = projects.find(p => p.key === fields.project.value);
  settings = { ...settings, projectKey: fields.project.value, projectName: project?.name || settings.projectName,
    label: fields.label.value, environment: fields.environment.value.trim(), cliPath: fields.cliPath.value.trim() };
  $UD.sendParamFromPlugin(settings);
  $UD.sendToPlugin({ type: 'projects' });
}
for (const id of ['project', 'label', 'environment', 'cliPath']) fields[id].addEventListener('change', save);
document.getElementById('refresh').addEventListener('click', () => { fields.status.textContent = '正在刷新…'; $UD.sendToPlugin({ type: 'projects' }); });
$UD.onAdd(load);
$UD.onParamFromApp(load);
$UD.onConnected(() => $UD.sendToPlugin({ type: 'projects' }));
$UD.onSendToPropertyInspector(message => {
  const data = message.payload;
  if (!data) return;
  projects = data.projects || [];
  options();
  fields.status.textContent = data.error || `已读取 ${projects.length} 个工作区 · ${new Date(data.updatedAt).toLocaleTimeString()}`;
  if (data.omittedHosts?.length) fields.status.textContent += '\n未包含远端：' + data.omittedHosts.map(h => h.selector).join('、');
});
$UD.connect('com.ulanzi.ulanzistudio.orcaprojects.project');
