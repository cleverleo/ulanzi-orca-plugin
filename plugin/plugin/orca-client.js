import { t, format } from './i18n.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chooseTerminal } from './project-state.js';

const execute = promisify(execFile);
export const defaultCli = '/Applications/Orca.app/Contents/Resources/bin/orca';

async function revealOnDesktop(cliPath, environment, terminal) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('ORCA_')) delete env[key];
  const { stdout } = await execute(process.execPath, [fileURLToPath(new URL('./orca-reveal-worker.cjs', import.meta.url)),
    cliPath, environment, terminal.worktreeId, terminal.tabId, terminal.leafId || ''],
  { env, timeout: 12000, maxBuffer: 65536 });
  return JSON.parse(stdout).navigated === true;
}

export class OrcaClient {
  constructor({ cliPath = defaultCli, environment = '', run = execute, reveal = revealOnDesktop } = {}) {
    this.cliPath = cliPath;
    this.environment = environment.trim();
    this.run = run;
    this.reveal = reveal;
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
    const listing = await this.call(['terminal', 'list', '--worktree', `id:${project.worktreeId}`, '--limit', '1000']);
    const terminal = chooseTerminal(listing.terminals ?? [], project);
    if (!terminal) throw new Error(t('项目没有可跳转的终端，请先在 Orca 打开终端'));
    // Handles are resolved immediately before use; never persist them in settings.
    const result = await this.call(['terminal', 'switch', '--terminal', terminal.handle]);
    // A GUI on the remote Mac can report navigated:true without revealing this desktop.
    if (this.environment) {
      let navigated = false;
      try { navigated = await this.reveal(this.cliPath, this.environment, terminal); } catch { /* Report local reveal failure below. */ }
      if (!navigated) throw new Error(format('无法在本机 Orca 显示远程终端，请确认该环境已连接', 'Cannot reveal remote terminal on this desktop. Check the Orca environment connection.'));
      return { ...result, focus: { ...result.focus, navigated: true, desktop: true } };
    }
    if (result?.focus?.navigated === false) throw new Error(format('Orca 未完成终端跳转，请重试', 'Orca did not navigate to the terminal. Try again.'));
    return result;
  }
}
