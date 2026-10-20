export const quotaProviders = Object.freeze({
  claude: 'Claude', codex: 'Codex', cursor: 'Cursor', antigravity: 'Antigravity',
  gemini: 'Gemini', grok: 'Grok', kimi: 'Kimi', minimax: 'MiniMax',
  'opencode-go': 'OpenCode Go', zcode: 'ZCode',
});
export const quotaAction = 'com.ulanzi.ulanzistudio.orcaprojects.usage';
export const isQuotaAction = uuid => uuid === quotaAction;
export const quotaProvider = value => Object.hasOwn(quotaProviders, value) ? value : 'claude';

function windowData(value, kind, label) {
  if (!value || typeof value.usedPercent !== 'number' || !Number.isFinite(value.usedPercent) || value.usedPercent < 0) return null;
  return { kind, label, usedPercent: value.usedPercent,
    windowMinutes: Number.isFinite(value.windowMinutes) ? value.windowMinutes : null,
    resetsAt: Number.isFinite(value.resetsAt) && value.resetsAt > 0 ? value.resetsAt : null };
}

// Only quota metrics cross the adapter boundary; credentials and account identities never do.
export function normalizeQuotas(snapshot) {
  const result = {};
  for (const value of Object.values(snapshot?.rateLimits ?? {})) {
    if (!value || !Object.hasOwn(quotaProviders, value.provider)) continue;
    const windows = [windowData(value.session, 'session', '会话'), windowData(value.weekly, 'weekly', '每周'), windowData(value.monthly, 'monthly', '每月')].filter(Boolean);
    const buckets = (Array.isArray(value.buckets) ? value.buckets : []).map((bucket, i) =>
      windowData(bucket, `bucket${i}`, String(bucket.name || bucket.group || '额度').slice(0, 80))).filter(Boolean);
    result[value.provider] = { provider: value.provider,
      status: value.status === 'ok' && (windows.length || buckets.length) ? 'ok' : value.status === 'error' ? 'error' : 'unavailable',
      windows: windows.length ? windows : buckets.slice(0, 2), buckets,
      updatedAt: Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? value.updatedAt : 0 };
  }
  return result;
}

export function quotaEntries(sources, provider, now = Date.now()) {
  return sources.map(source => {
    const quota = source.quotas?.[provider];
    return { environmentId: source.environmentId, environmentName: source.environmentName,
      provider, ...quota, error: source.error || '',
      ageUnknown: !quota?.updatedAt,
      stale: !quota?.updatedAt || now - quota.updatedAt > 5 * 60 * 1000,
      status: source.error ? 'error' : quota?.status || 'unavailable' };
  });
}

export function selectQuota(entries) {
  const score = entry => Math.max(0, ...(entry.windows ?? []).map(w => w.usedPercent));
  return [...entries].sort((a, b) => {
    const rank = entry => entry.status === 'ok' ? entry.stale ? 1 : 0 : 2;
    return rank(a) - rank(b) || score(b) - score(a) ||
      (b.updatedAt || 0) - (a.updatedAt || 0) || (a.environmentId || '').localeCompare(b.environmentId || '');
  })[0];
}

export function resetLabel(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '重置时间未知';
  const minutes = Math.ceil((timestamp - now) / 60000);
  if (minutes <= 0) return '等待重置更新';
  if (minutes < 60) return `${minutes}分后重置`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}时${minutes % 60}分后`;
  return `${Math.floor(minutes / 1440)}天${Math.floor(minutes % 1440 / 60)}时后`;
}
