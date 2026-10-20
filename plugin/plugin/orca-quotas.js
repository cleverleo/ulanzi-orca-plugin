import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { OrcaClient, defaultCli } from './orca-client.js';

const execute = promisify(execFile);
export class OrcaQuotas {
  constructor({ cliPath = defaultCli, run = execute, query } = {}) {
    this.cliPath = cliPath;
    this.cli = new OrcaClient({ cliPath, run });
    this.query = query || (async environment => {
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.startsWith('ORCA_')) delete env[key];
      let stdout;
      try {
        ({ stdout } = await run(process.execPath, [fileURLToPath(new URL('./orca-quota-worker.cjs', import.meta.url)), cliPath, environment], {
          timeout: 14000, maxBuffer: 2 * 1024 * 1024, env, windowsHide: true,
        }));
      } catch { throw new Error('无法连接 Orca 额度接口'); }
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('Orca 额度接口返回了无法识别的数据'); }
      if (!response.ok || !response.quotas || typeof response.quotas !== 'object') throw new Error('Orca 额度接口暂不可用');
      return response.quotas;
    });
    this.environments = [];
    this.cache = new Map();
  }

  async read() {
    const warnings = [];
    try {
      const result = await this.cli.call(['environment', 'list']);
      if (!Array.isArray(result.environments)) throw new Error('invalid');
      this.environments = result.environments.filter(e => e.id).map(e => ({ id: e.id, name: e.name || e.id }));
    } catch { warnings.push('暂时无法更新远程环境列表，继续读取已知环境'); }
    const sources = await Promise.all([{ id: '', name: '本机' }, ...this.environments].map(async target => {
      try {
        const quotas = await this.query(target.id);
        this.cache.set(target.id, quotas);
        return { environmentId: target.id, environmentName: target.name, quotas, error: '' };
      } catch (error) {
        return { environmentId: target.id, environmentName: target.name, quotas: this.cache.get(target.id) || {}, error: error.message };
      }
    }));
    return { sources, warnings };
  }
}
