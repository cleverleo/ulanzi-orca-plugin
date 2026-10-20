import { cp, access, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.platform !== 'darwin') throw new Error('Only macOS installation is currently supported');
const name = 'com.ulanzi.orcaprojects.ulanziPlugin';
const target = path.join(homedir(), 'Library/Application Support/Ulanzi/UlanziDeck/Plugins', name);
let exists = false;
try { await access(target); exists = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
const update = process.argv.includes('--update');
if (exists && !update) throw new Error(`插件目录已存在；可使用 mise run update 备份并更新：${target}`);
if (exists) {
  const current = JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8'));
  if (current.UUID !== 'com.ulanzi.ulanzistudio.orcaprojects') throw new Error('目标不是 Orca Projects 插件，拒绝更新');
  const backup = path.join(path.dirname(path.dirname(target)), 'bak', `${name}-${Date.now()}`);
  await mkdir(path.dirname(backup), { recursive: true });
  await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
  console.log(`Backup ${backup}`);
}
await mkdir(path.dirname(target), { recursive: true });
await cp(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)), target, { recursive: true, errorOnExist: !update, force: update });
console.log(`Installed ${target}\n请在 Ulanzi Studio 加载插件；如未显示，可重启 Studio。`);
