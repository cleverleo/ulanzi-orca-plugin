import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const pluginName = 'com.ulanzi.orcaprojects.ulanziPlugin';
export const output = path.join(root, 'dist', pluginName);
const sdk = path.join(root, 'vendor/UlanziDeckPlugin-SDK');
const versions = JSON.parse(await readFile(path.join(root, 'sdk-versions.json'), 'utf8'));
for (const [name, directory] of [['sdk', sdk], ['common-node', path.join(sdk, 'common-node')], ['common-html', path.join(sdk, 'common-html')]]) {
  const actual = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (actual !== versions[name]) throw new Error(`SDK version mismatch: ${name}; expected ${versions[name]}`);
}

await mkdir(output, { recursive: true });
// Runtime/test icons are regenerated on demand; do not ship cached project names.
await rm(path.join(output, 'resources/live'), { recursive: true, force: true });
await rm(path.join(output, 'diagnostics.json'), { force: true });
await cp(path.join(root, 'plugin'), output, { recursive: true,
  filter: source => source !== path.join(root, 'plugin/diagnostics.json') && source !== path.join(root, 'plugin/resources/live') });
await cp(path.join(sdk, 'common-node/libs'), path.join(output, 'sdk-node/libs'), { recursive: true });
for (const name of ['index.js', 'LICENSE']) await cp(path.join(sdk, 'common-node', name), path.join(output, 'sdk-node', name));
for (const name of ['js', 'css', 'assets']) await cp(path.join(sdk, 'common-html', name), path.join(output, 'libs', name), { recursive: true });
await cp(path.join(sdk, 'common-html/LICENSE'), path.join(output, 'libs/LICENSE'));
await cp(path.join(root, 'node_modules/ws'), path.join(output, 'node_modules/ws'), { recursive: true });
const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
await writeFile(path.join(output, 'package.json'), JSON.stringify({ name: 'orca-projects', version: manifest.Version, type: 'module', private: true }, null, 2));
await mkdir(path.join(output, 'resources'), { recursive: true });
const colors = { waiting: '#fbbf24', working: '#38bdf8', done: '#4ade80', idle: '#94a3b8', error: '#f87171', unknown: '#a78bfa', offline: '#64748b', empty: '#475569', unconfigured: '#94a3b8' };
for (const [state, color] of Object.entries(colors)) {
  await writeFile(path.join(output, 'resources', `${state}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="18" fill="#111827"/><rect x="5" y="5" width="134" height="134" rx="14" fill="none" stroke="${color}" stroke-width="5"/><path d="M43 38h16l7 9h35v26H43z" fill="${color}"/><circle cx="102" cy="36" r="9" fill="${color}"/></svg>`);
}
for (const target of [manifest.CodePath, manifest.Icon, ...manifest.Actions.flatMap(action => [action.Icon, action.PropertyInspectorPath])]) await readFile(path.join(output, target));
console.log(`Built ${output}`);
