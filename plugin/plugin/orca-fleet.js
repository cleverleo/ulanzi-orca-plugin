import { t, format } from './i18n.js';
import { OrcaClient } from './orca-client.js';
import { eligibleWorktrees } from './worktree-slots.js';
import { projectKey } from './project-state.js';

export class OrcaFleet {
  constructor(options = {}) {
    this.options = options;
    this.local = new OrcaClient(options);
    this.environments = [];
    this.snapshots = new Map();
  }

  async projects(savedKeys = []) {
    const warnings = [];
    let discovered = true;
    try {
      const result = await this.local.call(['environment', 'list']);
      if (!Array.isArray(result.environments)) throw new Error(t('无法识别环境列表'));
      this.environments = result.environments.filter(e => e.id);
    } catch (error) {
      discovered = false;
      warnings.push(format(`环境列表暂不可用：${error.message}`, `Environment list unavailable: ${error.message}`));
    }
    // Restore failed hosts from persisted slots even after a plugin restart.
    const saved = [];
    for (const key of savedKeys) {
      try {
        const [environmentId, hostId, worktreeId] = JSON.parse(key);
        if (typeof environmentId !== 'string' || typeof hostId !== 'string' || typeof worktreeId !== 'string') continue;
        const path = worktreeId.slice(worktreeId.indexOf('::') + 2);
        saved.push({ environmentId, hostId, worktreeId, path, repo: path.split(/[\\/]/).pop(), unavailable: true });
      } catch { /* Invalid saved slot is ignored. */ }
    }
    const environments = [...this.environments];
    if (!discovered) for (const project of saved) {
      if (project.environmentId && !environments.some(e => e.id === project.environmentId)) environments.push({ id: project.environmentId, name: project.environmentId });
    }
    const targets = [{ id: '', name: '本机' }, ...environments];
    let successfulTargets = 0;
    const results = await Promise.all(targets.map(async target => {
      const client = target.id ? new OrcaClient({ ...this.options, environment: target.id }) : this.local;
      try {
        const result = await client.projects();
        successfulTargets++;
        const rows = eligibleWorktrees(result.worktrees).map(p => ({ ...p, environmentId: target.id, environmentName: target.name }));
        const omitted = new Set(result.hostScope?.omittedHostIds ?? []);
        const previous = this.snapshots.get(target.id) || saved.filter(p => p.environmentId === target.id);
        for (const p of previous) if (omitted.has(p.hostId) && !rows.some(row => projectKey(row) === projectKey(p))) rows.push({ ...p, unavailable: true });
        this.snapshots.set(target.id, rows);
        return rows;
      } catch (error) {
        warnings.push(format(`${target.name} 暂不可用：${error.message}`, `${target.id ? target.name : "Local"} unavailable: ${error.message}`));
        return (this.snapshots.get(target.id) || saved.filter(p => p.environmentId === target.id)).map(p => ({ ...p, unavailable: true }));
      }
    }));
    if (successfulTargets === 0) throw new Error(warnings.join('\n') || t('无法连接 Orca'));
    const worktrees = [...new Map(results.flat().map(p => [projectKey(p), p])).values()];
    return { worktrees, warnings, environmentCount: environments.length };
  }

  async switchProject(project) {
    if (project.unavailable) throw new Error(t('该 worktree 所在环境暂不可用，请稍后重试'));
    const client = project.environmentId ? new OrcaClient({ ...this.options, environment: project.environmentId }) : this.local;
    return client.switchProject(project);
  }
}
