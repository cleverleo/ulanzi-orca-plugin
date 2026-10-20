/* global $UD */
const provider = document.getElementById('provider');
const cliPath = document.getElementById('cliPath');
const status = document.getElementById('status');
const entries = document.getElementById('entries');
let settings = { provider: 'claude' };

function load(message) {
  settings = { ...settings, ...message.param };
  provider.value = settings.provider || 'claude';
  cliPath.value = settings.cliPath || '';
  $UD.sendToPlugin({ type: 'quota' });
}
function save() {
  settings = { provider: provider.value || 'claude', cliPath: cliPath.value.trim() };
  status.textContent = '正在读取…';
  entries.replaceChildren();
  $UD.sendParamFromPlugin(settings);
  $UD.sendToPlugin({ type: 'quota' });
}
provider.addEventListener('change', save);
cliPath.addEventListener('change', save);
document.getElementById('refresh').addEventListener('click', () => { status.textContent = '正在读取…'; $UD.sendToPlugin({ type: 'quota' }); });
$UD.onConnected(() => $UD.sendToPlugin({ type: 'quota' }));
$UD.onAdd(load);
$UD.onParamFromApp(load);
$UD.onSendToPropertyInspector(message => {
  const data = message.payload;
  if (data?.type !== 'quota') return;
  provider.replaceChildren(...Object.entries(data.providers).map(([value, name]) => new Option(name, value)));
  settings.provider = data.provider;
  provider.value = data.provider;
  entries.replaceChildren();
  for (const source of data.entries) {
    const windows = [...(source.windows || []), ...(source.buckets || []).filter(b => !(source.windows || []).some(w => w.kind === b.kind))];
    const rows = source.status === 'ok' && windows.length ? windows : [null];
    for (const window of rows) {
      const row = document.createElement('tr');
      const values = [source.environmentName + (source.stale && window ? '（缓存）' : ''),
        window?.label || '—', window ? `${Math.round(window.usedPercent * 10) / 10}%` : source.status === 'error' ? '读取失败' : '暂无额度',
        window?.resetsAt ? new Date(window.resetsAt).toLocaleString() : '—'];
      for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      entries.append(row);
    }
  }
  status.textContent = data.updatedAt ? `读取于 ${new Date(data.updatedAt).toLocaleTimeString()}` : '正在读取…';
  if (data.warnings?.length) status.textContent += '\n' + data.warnings.join('\n');
});
$UD.connect('com.ulanzi.ulanzistudio.orcaprojects.usage');
