import test from 'node:test';
import assert from 'node:assert/strict';
import { keyIconSvg } from '../plugin/plugin/key-icon.js';
import { worktreeName, primaryAgent } from '../plugin/plugin/project-state.js';

test('auto-generated worktree folder name is distinct from task title and branch', () => {
  const project = { path: '/orca/workspaces/mintegral-skills/shrimp', displayName: 'Health check all l2', branch: 'feature/health' };
  assert.equal(worktreeName(project), 'shrimp');
  assert.equal(worktreeName({ ...project, isMainWorktree: true }), 'main');
  assert.equal(worktreeName({ path: 'C:\\workspaces\\snook\\' }), 'snook');
  const svg = keyIconSvg({ project: { ...project, repo: 'mintegral-skills' }, slot: 1, state: 'done' });
  assert.ok(svg.includes('Health check all l2'));
  assert.ok(!svg.includes('shrimp'));
});
test('brand icon follows the agent requiring attention and lists other detected types', () => {
  const project = { repo: 'mintegral-skills', path: '/worktrees/shrimp', agents: [{ agentType: 'codex', state: 'working' }, { agentType: 'claude', state: 'waiting' }] };
  assert.equal(primaryAgent(project).agentType, 'claude');
  const svg = keyIconSvg({ project, slot: 3, state: 'waiting' });
  assert.ok(svg.includes('#D97757'));
  assert.ok(svg.includes('Codex + Claude'));
  assert.ok(svg.includes('shrimp'));
  assert.ok(svg.includes('3 · 待确认'));
  assert.equal((svg.match(/<svg\b/g) || []).length, 1);
  assert.ok(svg.includes('<g opacity="0.35">'));
  assert.ok(svg.includes('fill-opacity="0.55"'));
  assert.ok(svg.includes('clip-path="url(#key-clip)"'));
});
test('unknown agents and plain shells keep accurate labels; text is escaped', () => {
  const project = { repo: '<script>&"', path: '/worktrees/<test>', agents: [{ agentType: 'custom-agent', state: 'working' }] };
  const svg = keyIconSvg({ project, slot: 2, state: 'working' });
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;'));
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('custom-agent'));
  assert.ok(keyIconSvg({ slot: 10, state: 'empty' }).includes('Terminal'));
  assert.ok(!svg.includes('fill="currentColor"'));
});
