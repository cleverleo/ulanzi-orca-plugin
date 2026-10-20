import { t } from './i18n.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chooseTerminal } from './project-state.js';

const execute = promisify(execFile);
export const defaultCli = '/Applications/Orca.app/Contents/Resources/bin/orca';

export class OrcaClient {
  constructor({ cliPath = defaultCli, environment = '', run = execute } = {}) {
    this.cliPath = cliPath;
    this.environment = environment.trim();
    this.run = run;
  }

  async call(args) {
    const env = { ...process.env };
    // A plugin query must not inherit the launching agent's project/runtime routing.
    for (const key of Object.keys(env)) if (key.startsWith('ORCA_')) delete env[key];
    const flags = this.environment ? ['--environment', this.environment] : [];
    let stdout;
    try {
      ({ stdout } = await this.run(this.cliPath, [...args, ...flags, '--json'], {
        timeout: 12000, maxBuffer: 8 * 1024 * 1024, env, windowsHide: true,
      }));
    } catch (error) {
      let response;
      try { response = JSON.parse(error.stdout); } catch { /* No JSON response. */ }
      throw new Error(response?.error?.message || (error.code === 'ENOENT'
        ? t('找不到 Orca CLI，请检查路径') : t('无法连接 Orca，请确认应用已运行')));
    }
    const response = JSON.parse(stdout);
    if (!response.ok) throw new Error(response.error?.message || t('Orca 查询失败'));
    return response.result;
  }

  async projects() {
    const result = await this.call(['worktree', 'ps', '--limit', '1000']);
    if (!Array.isArray(result.worktrees)) throw new Error(t('Orca 返回了无法识别的项目列表'));
    if (result.truncated) throw new Error(t('项目列表超出查询上限，未显示全部项目'));
    return result;
  }

  async switchProject(project) {
    const result = await this.call(['terminal', 'list', '--worktree', `id:${project.worktreeId}`, '--limit', '1000']);
    const terminal = chooseTerminal(result.terminals ?? [], project);
    if (!terminal) throw new Error(t('项目没有可跳转的终端，请先在 Orca 打开终端'));
    // Handles are resolved immediately before use; never persist them in settings.
    return this.call(['terminal', 'switch', '--terminal', terminal.handle]);
  }
}
