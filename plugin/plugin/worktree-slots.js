import { projectKey } from './project-state.js';

export const SLOT_COUNT = 10;

export function mountedSlots(settings) {
  return [...new Set([...settings].map(item => item.slot).filter(number =>
    Number.isInteger(number) && number >= 1))].sort((a, b) => a - b);
}

export function layoutSlots(entries) {
  const coordinate = settings => {
    const match = /^(\d+)_(\d+)$/.exec(settings.position || '');
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: Infinity, y: Infinity };
  };
  const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const ordered = [...entries].sort(([contextA, a], [contextB, b]) => {
    const pa = coordinate(a);
    const pb = coordinate(b);
    return compareText(a.device || '', b.device || '') ||
      (pa.y === pb.y ? 0 : pa.y - pb.y) || (pa.x === pb.x ? 0 : pa.x - pb.x) ||
      compareText(a.position || '', b.position || '') || compareText(contextA, contextB);
  });
  return new Map(ordered.map(([context], i) => [context, i + 1]));
}

export function eligibleWorktrees(projects) {
  return projects.filter(p => !p.isArchived &&
    (p.agents ?? []).some(a => a.agentType && !['terminal', 'shell'].includes(a.agentType.toLowerCase())) &&
    ((p.liveTerminalCount ?? 0) > 0 ||
    (p.unverifiableTerminalCount ?? 0) > 0 || p.terminalVerdict === 'unverifiable' ||
    (p.agents ?? []).some(a => ['working', 'waiting', 'blocked'].includes(a.state))));
}

function activityTime(project) {
  for (const value of [project.lastActivityAt, project.lastOutputAt]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

// Keep positions during activity updates; a closed workspace triggers a fresh activity sort.
export function assignSlots(previous, projects, enabledSlots = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1), previousKeys = previous) {
  const enabled = new Set(enabledSlots);
  const available = new Set(projects.map(projectKey));
  const closed = (previousKeys ?? []).some(key => typeof key === 'string' && !available.has(key));
  if (closed) previous = [];
  const used = new Set();
  const count = Math.max(SLOT_COUNT, ...enabledSlots);
  const slots = Array.from({ length: count }, (_, index) => {
    if (!enabled.has(index + 1)) return null;
    const key = previous?.[index];
    if (typeof key !== 'string' || !available.has(key) || used.has(key)) return null;
    used.add(key);
    return key;
  });
  const newcomers = [...new Map(projects.map(p => [projectKey(p), p])).values()]
    .filter(p => !used.has(projectKey(p)))
    .sort((a, b) => activityTime(b) - activityTime(a) ||
      (projectKey(a) < projectKey(b) ? -1 : projectKey(a) > projectKey(b) ? 1 : 0))
    .map(projectKey);
  for (let i = 0; i < count && newcomers.length; i++) {
    if (enabled.has(i + 1) && slots[i] === null) slots[i] = newcomers.shift();
  }
  return slots;
}

export function slotProject(data, number) {
  const key = data.slots?.[number - 1];
  return key ? data.projects.find(project => projectKey(project) === key) : undefined;
}
