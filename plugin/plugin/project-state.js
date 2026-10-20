export const labels = {
  waiting: '待确认', working: '工作中', done: '已完成', idle: '空闲',
  error: '异常', unknown: '未知', offline: '未运行', unconfigured: '请选择项目',
};

export function agentState(agent) {
  if (['waiting', 'blocked'].includes(agent.state)) return 'waiting';
  if (agent.programStatus?.state === 'blocked') return 'waiting';
  if (agent.state === 'error' || agent.programStatus?.state === 'error') return 'error';
  if (agent.state === 'working') return 'working';
  if (agent.state === 'done') return 'done';
  if (agent.state === 'idle') return 'idle';
  return 'unknown';
}

export function projectState(project) {
  const states = (project.agents ?? []).map(agentState);
  for (const state of ['waiting', 'error', 'working', 'unknown', 'done', 'idle']) {
    if (states.includes(state)) return state;
  }
  if ((project.liveTerminalCount ?? 0) > 0) return 'idle';
  if ((project.unverifiableTerminalCount ?? 0) > 0 || project.terminalVerdict === 'unverifiable') return 'unknown';
  return 'offline';
}

export function projectKey(project) {
  return JSON.stringify([project.hostId ?? 'local', project.worktreeId]);
}

export function publicProject(project) {
  return {
    key: projectKey(project), worktreeId: project.worktreeId,
    hostId: project.hostId ?? 'local', name: project.repo || project.displayName,
    path: project.path, branch: project.branch?.replace(/^refs\/heads\//, '') ?? '',
    state: projectState(project), active: !!project.isActive,
    agents: (project.agents ?? []).map(agent => ({
      type: agent.agentType, state: agentState(agent), paneKey: agent.paneKey,
    })),
  };
}

export function chooseTerminal(terminals, project) {
  const candidates = terminals.filter(t => !t.orphaned && t.connected !== false &&
    t.worktreeId === project.worktreeId &&
    (!t.executionHostId || t.executionHostId === (project.hostId ?? 'local')));
  const priority = { waiting: 0, error: 1, working: 2, unknown: 3, done: 4, idle: 5 };
  const rank = terminal => {
    const pane = `${terminal.tabId}:${terminal.leafId}`;
    const agent = (project.agents ?? []).find(a => a.paneKey === pane);
    return agent ? priority[agentState(agent)] : 6;
  };
  return candidates.sort((a, b) => rank(a) - rank(b) || (b.lastOutputAt ?? 0) - (a.lastOutputAt ?? 0))[0];
}
