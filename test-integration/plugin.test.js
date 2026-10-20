import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('built plugin connects, publishes per-key status, jumps using a fresh handle and clears keys', { timeout: 15000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'orca-plugin-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const log = path.join(temp, 'calls.jsonl');
  const cli = path.join(temp, 'fake-orca');
  await writeFile(cli, `#!${process.execPath}\nconst fs = require('node:fs');
const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');
const result=args[0]==='worktree'?{worktrees:[{worktreeId:'repo::/project',hostId:'local',repo:'Demo',liveTerminalCount:1,agents:[{state:'waiting',agentType:'codex',paneKey:'tab:pane'}]}]}:args[1]==='list'?{terminals:[{handle:'fresh',worktreeId:'repo::/project',tabId:'tab',leafId:'pane'}]}:{switched:true};
console.log(JSON.stringify({ok:true,result}));`, { mode: 0o755 });
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  t.after(() => { for (const socket of server.clients) socket.terminate(); server.close(); });
  const child = spawn(process.execPath, ['dist/com.ulanzi.orcaprojects.ulanziPlugin/plugin/app.js', '127.0.0.1', String(server.address().port)], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const [socket] = await once(server, 'connection');
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw)));
  const waitFor = async predicate => {
    for (let i = 0; i < 100; i++) {
      const found = messages.find(predicate);
      if (found) return found;
      if (child.exitCode !== null) throw new Error(stderr || 'Plugin exited');
      await delay(50);
    }
    throw new Error(`Timed out: ${stderr}`);
  };
  await waitFor(m => m.cmd === 'connected');
  const address = { uuid: 'com.ulanzi.ulanzistudio.orcaprojects.project', key: 'key1', actionid: 'action1' };
  const param = { cliPath: cli, projectKey: JSON.stringify(['local', 'repo::/project']) };
  socket.send(JSON.stringify({ ...address, cmd: 'add', param }));
  const icon = await waitFor(m => m.cmd === 'state' && m.param.statelist[0].path === 'resources/waiting.svg');
  assert.equal(icon.param.statelist[0].textData, 'Demo\n待确认');
  const inspector = await waitFor(m => m.cmd === 'sendToPropertyInspector' && m.payload.projects.length === 1);
  assert.equal(inspector.payload.projects[0].agents[0].state, 'waiting');
  socket.send(JSON.stringify({ ...address, cmd: 'run' }));
  let calls = [];
  for (let i = 0; i < 100; i++) {
    calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
    if (calls.some(a => a[1] === 'switch')) break;
    await delay(50);
  }
  assert.ok(calls.some(a => a[1] === 'switch' && a.includes('fresh')));
  socket.send(JSON.stringify({ cmd: 'clear', param: [address] }));
  await delay(100);
  const count = messages.filter(m => m.cmd === 'state').length;
  await delay(2700);
  assert.equal(messages.filter(m => m.cmd === 'state').length, count);
});
