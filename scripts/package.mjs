import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', `${dist}com.ulanzi.orcaprojects.ulanziPlugin`, `${dist}OrcaProjects.zip`]);
console.log(`${dist}OrcaProjects.zip（解压后安装完整插件文件夹）`);
