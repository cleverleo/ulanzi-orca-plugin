import test from 'node:test';
import assert from 'node:assert/strict';
import { projectState, chooseTerminal, publicProject } from '../plugin/plugin/project-state.js';
import { OrcaClient } from '../plugin/plugin/orca-client.js';

test('waiting approval overrides a working screen; management status does not imply activity', () => {
  assert.equal(projectState({ workspaceStatus: 'in-progress', liveTerminalCount: 1, agents: [] }), 'idle');
  assert.equal(projectState({ agents: [{ state: 'waiting', programStatus: { state: 'working' } }, { state: 'working' }] }), 'waiting');
  assert.equal(projectState({ agents: [{ state: 'done' }], liveTerminalCount: 1 }), 'done');
  assert.equal(projectState({ unverifiableTerminalCount: 1 }), 'unknown');
  assert.equal(projectState({ liveTerminalCount: 0, unverifiableTerminalCount: 0 }), 'offline');
});
test('terminal selection respects workspace, host and the agent requiring attention', () => {
  const project = { worktreeId: 'repo::/a', hostId: 'local', agents: [{ paneKey: 't1:p1', state: 'waiting' }] };
  const rows = [
    { handle: 'wrong-host', worktreeId: project.worktreeId, executionHostId: 'remote', tabId: 't1', leafId: 'p1' },
    { handle: 'recent', worktreeId: project.worktreeId, lastOutputAt: 999 },
    { handle: 'approval', worktreeId: project.worktreeId, tabId: 't1', leafId: 'p1' },
  ];
  assert.equal(chooseTerminal(rows, project).handle, 'approval');
  assert.equal(chooseTerminal([{ worktreeId: 'other' }], project), undefined);
});
test('public status omits prompts, terminal output and tool arguments', () => {
  const result = JSON.stringify(publicProject({ worktreeId: 'a', preview: 'SECRET', agents: [{ state: 'working', prompt: 'SECRET', toolInput: 'SECRET' }] }));
  assert.ok(!result.includes('SECRET'));
});
test('CLI uses argument arrays, remote routing and fresh terminal handles', async () => {
  const calls = [];
  const project = { worktreeId: 'repo::/path with spaces', hostId: 'local' };
  const client = new OrcaClient({ environment: 'home', run: async (file, args, options) => {
    calls.push({ file, args, options });
    return { stdout: JSON.stringify({ ok: true, result: args[1] === 'list'
      ? { terminals: [{ worktreeId: project.worktreeId, handle: 'fresh' }] } : { switched: true } }) };
  } });
  await client.switchProject(project);
  assert.ok(calls[0].args.includes(`id:${project.worktreeId}`));
  assert.deepEqual(calls[1].args, ['terminal', 'switch', '--terminal', 'fresh', '--environment', 'home', '--json']);
  assert.equal(calls[0].options.timeout, 12000);
  assert.ok(!Object.keys(calls[0].options.env).some(k => k.startsWith('ORCA_')));
});
test('failed and truncated queries do not masquerade as empty success', async () => {
  const client = new OrcaClient({ run: async () => ({ stdout: JSON.stringify({ ok: true, result: { worktrees: [], truncated: true } }) }) });
  await assert.rejects(client.projects(), /上限/);
  client.run = async () => { throw Object.assign(new Error('failure'), { stdout: JSON.stringify({ error: { message: 'Host unavailable' } }) }); };
  await assert.rejects(client.projects(), /Host unavailable/);
});
