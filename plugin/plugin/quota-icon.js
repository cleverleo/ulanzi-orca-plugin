import { t, windowLabel } from './i18n.js';
import { agentArtwork } from './key-icon.js';
import { quotaProviders, resetLabel } from './quota-state.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
const percent = value => `${Math.round(value * 10) / 10}%`;
const windowName = value => value.kind === 'session' && value.windowMinutes === 300 ? t('5小时') : windowLabel(value);

export function quotaIconSvg(provider, quota, now = Date.now()) {
  const windows = quota?.status === 'ok' ? (quota.windows || []).slice(0, 2) : [];
  const max = Math.max(0, ...windows.map(w => w.usedPercent));
  const color = !windows.length || quota.stale ? '#94a3b8' : max >= 90 ? '#f87171' : max >= 70 ? '#fbbf24' : '#38bdf8';
  const source = `${windows.length && quota?.ageUnknown ? t('时间未知 · ') : quota?.stale && windows.length ? t('缓存过期 · ') : ''}${(quota?.environmentId === '' ? t('本机') : quota?.environmentName) || t('自动读取全部环境')}`;
  const title = quotaProviders[provider];
  let content;
  if (!windows.length) {
    content = `<text x="72" y="83" font-size="16" font-weight="bold">${quota?.status === 'error' ? t('读取失败') : quota ? t('暂无额度') : t('正在读取')}</text><text x="72" y="112" font-size="11">${t('按下重新读取')}</text>`;
  } else if (windows.length === 1) {
    const w = windows[0];
    content = `<text x="72" y="59" font-size="13">${escape(windowName(w))} ${t('已用')}</text><text x="72" y="90" font-size="32" font-weight="bold">${percent(w.usedPercent)}</text><rect x="14" y="99" width="116" height="6" rx="3" fill="#4b5563"/><rect x="14" y="99" width="${116 * Math.min(100, w.usedPercent) / 100}" height="6" rx="3" fill="${color}"/><text x="72" y="127" font-size="11">${escape(resetLabel(w.resetsAt, now))}</text>`;
  } else {
    content = windows.map((w, i) => {
      const y = i ? 103 : 62;
      return `<text x="13" y="${y}" text-anchor="start" font-size="12">${escape(windowName(w))} ${t('已用')}</text><text x="131" y="${y}" text-anchor="end" font-size="22" font-weight="bold">${percent(w.usedPercent)}</text><rect x="14" y="${y + 6}" width="116" height="4" rx="2" fill="#4b5563"/><rect x="14" y="${y + 6}" width="${116 * Math.min(100, w.usedPercent) / 100}" height="4" rx="2" fill="${color}"/><text x="72" y="${y + 23}" font-size="10">${escape(resetLabel(w.resetsAt, now))}</text>`;
    }).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><title>${escape(title)}${t('额度')} · ${escape(source)} · ${windows.map(w => `${escape(windowLabel(w))} ${t('已用')}${percent(w.usedPercent)}`).join(' / ')}</title><defs><clipPath id="quota-clip"><rect x="4" y="4" width="136" height="136" rx="12"/></clipPath></defs><rect width="144" height="144" rx="16" fill="#111827"/><g clip-path="url(#quota-clip)"><g opacity="0.25">${agentArtwork(provider)}</g><rect x="7" y="45" width="130" height="90" rx="9" fill="#24282e" fill-opacity="0.7"/><g fill="#ffffff" font-family="Arial, PingFang SC, sans-serif" text-anchor="middle"><text x="72" y="24" font-size="16" font-weight="bold">${escape(title)} ${t('额度')}</text><text x="72" y="39" font-size="10">${escape([...source].slice(0, 22).join(''))}</text>${content}</g></g><rect x="3" y="3" width="138" height="138" rx="13" fill="none" stroke="${color}" stroke-width="3"/></svg>`;
}
