import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('built plugin restores assignments, numbers mounted buttons, handles layout changes and switches terminals', { timeout: 20000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'orca-plugin-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const log = path.join(temp, 'calls.jsonl');
  const cli = path.join(temp, 'fake-orca');
  const fixture = path.join(temp, 'projects.json');
  const demo = { worktreeId: 'repo::/project', path: '/worktrees/shrimp', displayName: 'A session title', hostId: 'local', repo: 'Demo', branch: 'refs/heads/feature', liveTerminalCount: 1, agents: [{ state: 'waiting', agentType: 'codex', paneKey: 'tab:pane' }] };
  await writeFile(fixture, JSON.stringify({ worktrees: [demo] }));
  await writeFile(cli, `#!${process.execPath}\nconst fs = require('node:fs');
const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');
const result=args[0]==='environment'?{environments:[]}:args[0]==='worktree'?JSON.parse(fs.readFileSync(${JSON.stringify(fixture)},'utf8')):args[1]==='list'?{terminals:[{handle:'fresh',worktreeId:'repo::/project',tabId:'tab',leafId:'pane'}]}:{switched:true};
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
  socket.on('message', raw => {
    const message = JSON.parse(raw);
    // Studio 3.4.4 does not answer main-service requests without a key context.
    if (message.cmd === 'getGlobalSettings' && message.key && message.actionid) socket.send(JSON.stringify({ cmd: 'didReceiveGlobalSettings', settings: {
      slotAssignments: { [cli]: [JSON.stringify(['', 'local', 'repo::/project'])] },
    } }));
  });
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
  const address = { uuid: 'com.ulanzi.ulanzistudio.orcaprojects.project', key: '0_0', actionid: 'action1' };
  const param = { cliPath: cli };
  socket.send(JSON.stringify({ ...address, cmd: 'add', param }));
  const iconSvg = message => readFileSync(path.join('dist/com.ulanzi.orcaprojects.ulanziPlugin', message.param.statelist[0].path), 'utf8');
  const icon = await waitFor(m => m.cmd === 'state' && iconSvg(m).includes('1 · 待确认'));
  assert.ok(iconSvg(icon).includes('Demo'));
  assert.ok(iconSvg(icon).includes('A session title'));
  assert.ok(iconSvg(icon).includes('Codex'));
  assert.ok(!iconSvg(icon).includes('shrimp'));
  assert.equal(icon.param.statelist[0].showtext, false);
  const inspector = await waitFor(m => m.cmd === 'sendToPropertyInspector' && m.payload.projects?.length === 1);
  assert.equal(inspector.payload.projects[0].agents[0].state, 'waiting');
  assert.equal(inspector.payload.slots[0].project.name, 'Demo');
  assert.deepEqual(inspector.payload.enabledSlots, [1]);
  assert.ok(messages.filter(m => m.cmd === 'getGlobalSettings').every(m => m.key && m.actionid));
  const persisted = await waitFor(m => m.cmd === 'setGlobalSettings');
  assert.equal(persisted.key, '0_0');
  assert.equal(persisted.actionid, 'action1');
  const emptyAddress = { uuid: address.uuid, key: '1_0', actionid: 'action2' };
  socket.send(JSON.stringify({ ...emptyAddress, cmd: 'add', param }));
  await waitFor(m => m.cmd === 'state' && m.param.statelist[0].key === '1_0' && iconSvg(m).includes('2 · 空坑位'));
  socket.send(JSON.stringify({ ...emptyAddress, cmd: 'run' }));
  await waitFor(m => m.cmd === 'toast' && JSON.stringify(m).includes('暂无运行中的'));
  socket.send(JSON.stringify({ ...address, cmd: 'run' }));
  let calls = [];
  for (let i = 0; i < 100; i++) {
    calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
    if (calls.some(a => a[1] === 'switch')) break;
    await delay(50);
  }
  assert.ok(calls.some(a => a[1] === 'switch' && a.includes('fresh')));
  assert.equal(calls.filter(a => a[1] === 'switch').length, 1);
  const quotaAddress = { uuid: 'com.ulanzi.ulanzistudio.orcaprojects.usage', key: '9_9', actionid: 'quota1' };
  socket.send(JSON.stringify({ ...quotaAddress, cmd: 'add', param: { cliPath: cli, provider: 'codex' } }));
  await waitFor(m => m.cmd === 'sendToPropertyInspector' && m.payload.type === 'quota' && m.payload.provider === 'codex' && m.payload.updatedAt > 0);
  const quotaMountedAt = messages.length;
  socket.send(JSON.stringify({ ...address, cmd: 'sendToPlugin', payload: { type: 'projects' } }));
  const withoutQuota = await waitFor(m => messages.indexOf(m) >= quotaMountedAt && m.cmd === 'sendToPropertyInspector' && m.payload.enabledSlots?.length === 2);
  assert.deepEqual(withoutQuota.payload.enabledSlots, [1, 2]);
  await writeFile(fixture, JSON.stringify({ worktrees: [demo,
    { worktreeId: 'repo::/beta', hostId: 'local', repo: 'Beta', liveTerminalCount: 1, lastActivityAt: 200 },
    { worktreeId: 'repo::/gamma', hostId: 'local', repo: 'Gamma', liveTerminalCount: 1, lastActivityAt: 100 },
  ] }));
  socket.send(JSON.stringify({ ...address, cmd: 'sendToPlugin', payload: { type: 'projects' } }));
  const expanded = await waitFor(m => m.cmd === 'sendToPropertyInspector' && m.payload.projects?.length === 3 && m.payload.slots[1].project?.name === 'Beta');
  assert.deepEqual(expanded.payload.enabledSlots, [1, 2]);
  assert.equal(expanded.payload.overflow, 1);
  assert.ok(expanded.payload.slots.slice(2).every(s => s.project === null));
  socket.send(JSON.stringify({ cmd: 'clear', param: [address] }));
  const reduced = await waitFor(m => m.cmd === 'sendToPropertyInspector' && m.payload.projects?.length === 3 && m.payload.enabledSlots?.length === 1);
  assert.equal(reduced.payload.slot, 1);
  assert.equal(reduced.payload.overflow, 2);
  assert.ok(reduced.payload.slots.slice(1).every(s => s.project === null));
  // Repeated registration is idempotent; hidden pages stop consuming visible capacity.
  const after = messages.length;
  socket.send(JSON.stringify({ ...emptyAddress, cmd: 'add', param }));
  await waitFor(m => messages.indexOf(m) >= after && m.cmd === 'sendToPropertyInspector' && m.payload.enabledSlots?.length === 1);
  socket.send(JSON.stringify({ ...emptyAddress, cmd: 'setactive', active: false }));
  await delay(300);
  const hiddenCount = messages.filter(m => m.cmd === 'state').length;
  await delay(300);
  assert.equal(messages.filter(m => m.cmd === 'state').length, hiddenCount);
  socket.send(JSON.stringify({ ...emptyAddress, cmd: 'setactive', active: true }));
  const resumedAt = messages.length;
  const resumed = await waitFor(m => messages.indexOf(m) >= resumedAt && m.cmd === 'sendToPropertyInspector' && m.payload.enabledSlots?.length === 1);
  assert.equal(resumed.payload.slots[0].project.name, 'Demo');
  socket.send(JSON.stringify({ ...address, cmd: 'add', param }));
  await waitFor(m => messages.indexOf(m) >= after && m.cmd === 'sendToPropertyInspector' && m.payload.enabledSlots?.length === 2);
  // Moving the first button below the second changes its computed ordinal.
  const movedAddress = { ...address, key: '0_1' };
  const movedAt = messages.length;
  socket.send(JSON.stringify({ cmd: 'clear', param: [address] }));
  socket.send(JSON.stringify({ ...movedAddress, cmd: 'add', param }));
  const moved = await waitFor(m => messages.indexOf(m) >= movedAt && m.cmd === 'sendToPropertyInspector' && m.key === '0_1' && m.payload.slot === 2);
  assert.deepEqual(moved.payload.enabledSlots, [1, 2]);
  assert.equal(moved.payload.slots[1].project.name, 'Beta');
  socket.send(JSON.stringify({ cmd: 'clear', param: [movedAddress, emptyAddress, quotaAddress] }));
  await delay(100);
  const count = messages.filter(m => m.cmd === 'state').length;
  await delay(2700);
  assert.equal(messages.filter(m => m.cmd === 'state').length, count);
});
