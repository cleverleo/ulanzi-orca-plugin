import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assignSlots, eligibleWorktrees, layoutSlots, mountedSlots } from '../plugin/plugin/worktree-slots.js';
import { projectKey, projectState } from '../plugin/plugin/project-state.js';
import { OrcaFleet } from '../plugin/plugin/orca-fleet.js';

const project = (id, extra = {}) => ({ worktreeId: `repo::/${id}`, hostId: 'local', repo: id, liveTerminalCount: 1, ...extra });
const a = project('a');
const b = project('b');
const c = project('c');
test('initial slots and newcomers use newest activity across all environments', () => {
  const older = project('a', { lastActivityAt: 100, lastOutputAt: 999 });
  const newest = project('z', { lastActivityAt: 300, environmentId: 'remote' });
  const fallback = project('b', { lastOutputAt: 200 });
  const missing = project('c', { lastActivityAt: NaN, lastOutputAt: -1 });
  const slots = assignSlots([], [missing, older, fallback, newest]);
  assert.deepEqual(slots.slice(0, 4), [newest, fallback, older, missing].map(projectKey));
  assert.deepEqual(assignSlots(slots, [{ ...older, lastActivityAt: 1000 }, fallback, newest, missing]), slots);
  const filled = assignSlots([projectKey(older), null, projectKey(missing)], [older, missing, fallback, newest]);
  assert.deepEqual(filled.slice(0, 4), [older, newest, missing, fallback].map(projectKey));
});
test('slots survive activity updates and reloads, but closing a worktree reorders survivors', () => {
  const slots = assignSlots([], [b, a]);
  assert.deepEqual(slots.slice(0, 3), [projectKey(a), projectKey(b), null]);
  assert.deepEqual(assignSlots(JSON.parse(JSON.stringify(slots)), [b, a]), slots);
  assert.deepEqual(assignSlots(slots, [b, c]).slice(0, 3), [projectKey(b), projectKey(c), null]);
  assert.deepEqual(assignSlots([projectKey(a), projectKey(a)], [a]).slice(0, 3), [projectKey(a), null, null]);
});
test('one worktree per slot including distinct branches and hosts, capped at ten', () => {
  const remote = project('a', { environmentId: 'remote' });
  const branch = project('a-feature');
  const rows = [a, remote, branch, ...Array.from({ length: 10 }, (_, i) => project(`x${i}`))];
  const slots = assignSlots([], rows);
  assert.equal(slots.length, 10);
  assert.equal(new Set(slots).size, 10);
  assert.notEqual(projectKey(a), projectKey(remote));
  assert.equal(eligibleWorktrees([a, project('closed', { liveTerminalCount: 0 }), project('archived', { isArchived: true })]).length, 1);
});
test('one generic action is numbered by physical rows and columns', async () => {
  const manifest = JSON.parse(await readFile(new URL('../plugin/manifest.json', import.meta.url)));
  assert.equal(manifest.Actions[0].UUID, 'com.ulanzi.ulanzistudio.orcaprojects.project');
  assert.equal(manifest.Actions.filter(a => a.UUID.endsWith('.project')).length, 1);
  assert.ok(!manifest.Actions.some(a => /\.slot\d+$/.test(a.UUID)));
  const entries = [['b', { position: '0_1' }], ['c', { position: '10_0' }], ['a', { position: '2_0' }]];
  assert.deepEqual([...layoutSlots(entries)], [['a', 1], ['c', 2], ['b', 3]]);
  assert.deepEqual([...layoutSlots([['a', { position: '0_2' }], entries[0], entries[1]])], [['c', 1], ['b', 2], ['a', 3]]);
});
test('only mounted slots receive assignments; unused slots do not consume worktrees', () => {
  const projects = [a, b, c];
  const active = mountedSlots([{ slot: 1 }, { slot: 2 }, { slot: 2 }]);
  assert.deepEqual(active, [1, 2]);
  const first = assignSlots([], projects, active);
  assert.deepEqual(first.slice(0, 4), [projectKey(a), projectKey(b), null, null]);
  assert.deepEqual(assignSlots(first, projects, [1]).slice(0, 3), [projectKey(a), null, null]);
  assert.deepEqual(assignSlots([], projects, [1, 3]).slice(0, 4), [projectKey(a), null, projectKey(b), null]);
  assert.ok(assignSlots(first, projects, []).every(p => p === null));
  const many = Array.from({ length: 12 }, (_, i) => project(String(i).padStart(2, '0')));
  assert.equal(assignSlots([], many, Array.from({ length: 12 }, (_, i) => i + 1)).filter(Boolean).length, 12);
});

test('fleet auto-discovers all saved environments, preserves unavailable occupants and routes jumps', async () => {
  let failRemote = false;
  let removed = false;
  const calls = [];
  const run = async (file, args) => {
    calls.push(args);
    const environment = args.includes('--environment') ? args[args.indexOf('--environment') + 1] : '';
    if (environment && failRemote) throw new Error('offline');
    const result = args[0] === 'environment' ? { environments: removed ? [] : [{ id: 'remote', name: 'MacBook' }] } :
      args[0] === 'worktree' ? { worktrees: [environment ? b : a] } :
      args[1] === 'list' ? { terminals: [{ worktreeId: b.worktreeId, handle: 'remote-terminal' }] } : { switched: true };
    return { stdout: JSON.stringify({ ok: true, result }) };
  };
  const fleet = new OrcaFleet({ run, reveal: async () => true });
  const first = await fleet.projects();
  assert.equal(first.worktrees.length, 2);
  const remote = first.worktrees.find(p => p.environmentId === 'remote');
  await fleet.switchProject(remote);
  assert.ok(calls.some(args => args[1] === 'switch' && args.includes('remote') && args.includes('remote-terminal')));
  failRemote = true;
  const offline = await fleet.projects();
  assert.equal(projectState(offline.worktrees.find(p => p.environmentId === 'remote')), 'unknown');
  const cold = await new OrcaFleet({ run }).projects([projectKey(remote)]);
  assert.ok(cold.worktrees.some(p => projectKey(p) === projectKey(remote) && p.unavailable));
  removed = true;
  const afterRemoval = await fleet.projects();
  assert.equal(afterRemoval.worktrees.length, 1);
  failRemote = false;
  removed = false;
  const recovered = await fleet.projects();
  assert.ok(recovered.worktrees.some(p => p.environmentId === 'remote' && !p.unavailable));
});

test('discovery failure and total outage cannot silently empty saved slots', async () => {
  const fleet = new OrcaFleet({ run: async () => { throw new Error('offline'); } });
  await assert.rejects(fleet.projects([projectKey(a)]), /暂不可用/);
});

test('closing any workspace reorders all mounted slots by latest activity, including overflow', () => {
  const first = [project('a', { lastActivityAt: 300 }), project('b', { lastActivityAt: 200 }), project('c', { lastActivityAt: 100 })];
  const slots = assignSlots([], first, [1, 3]);
  const updated = [{ ...first[0], lastActivityAt: 400 }, { ...first[1], lastActivityAt: 500 }, first[2]];
  assert.deepEqual(assignSlots(slots, updated, [1, 3], first.map(projectKey)), slots);
  // Closing an overflow workspace also triggers a complete activity sort.
  const remaining = updated.slice(0, 2);
  assert.deepEqual(assignSlots(slots, remaining, [1, 3], updated.map(projectKey)).slice(0, 4),
    [projectKey(first[1]), null, projectKey(first[0]), null]);
  // An unavailable environment remains represented and must not trigger reordering.
  assert.deepEqual(assignSlots(slots, [updated[0], { ...updated[1], unavailable: true }, first[2]], [1, 3], first.map(projectKey)), slots);
  // Closing a visible workspace allows the most active overflow workspace to move first.
  const survivors = [updated[0], { ...first[2], lastActivityAt: 600 }];
  assert.deepEqual(assignSlots(slots, survivors, [1, 3], updated.map(projectKey)).slice(0, 4),
    [projectKey(first[2]), null, projectKey(first[0]), null]);
});
