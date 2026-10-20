import { cp, access, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.platform !== 'darwin') throw new Error('Only macOS installation is currently supported');
const name = 'com.ulanzi.orcaprojects.ulanziPlugin';
const target = path.join(homedir(), 'Library/Application Support/Ulanzi/UlanziDeck/Plugins', name);
let exists = false;
try { await access(target); exists = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (exists) throw new Error(`插件目录已存在，请先备份并手动移走后重试：${target}`);
await mkdir(path.dirname(target), { recursive: true });
await cp(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)), target, { recursive: true, errorOnExist: true, force: false });
console.log(`Installed ${target}\n请在 Ulanzi Studio 加载插件；如未显示，可重启 Studio。`);
