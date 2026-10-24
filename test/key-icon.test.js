import test from 'node:test';
import assert from 'node:assert/strict';
import { agentArtwork, keyIconSvg } from '../plugin/plugin/key-icon.js';
import { agentCatalog } from '../plugin/plugin/agent-catalog.js';
import { worktreeName, primaryAgent } from '../plugin/plugin/project-state.js';

test('every Orca catalog entry renders its brand artwork and display name', () => {
  assert.equal(Object.keys(agentCatalog).length, 45);
  const fallback = agentArtwork('custom-agent');
  for (const [type, { name }] of Object.entries(agentCatalog)) {
    const artwork = agentArtwork(type);
    assert.notEqual(artwork, fallback, type);
    assert.equal(agentArtwork(type.toUpperCase()), artwork, type);
    const svg = keyIconSvg({ project: { repo: 'demo', agents: [{ agentType: type, state: 'working' }] }, slot: 1, state: 'working' });
    assert.ok(svg.includes(artwork), type);
    assert.ok(svg.includes(` · ${name} · `), type);
    assert.equal((svg.match(/<svg\b/g) || []).length, 1, type);
    assert.ok(!svg.includes('currentColor'), type);
  }
});

test('version variants share artwork while retaining distinct labels; CLI aliases still resolve', () => {
  for (const [variant, base] of [['claude-agent-teams', 'claude'], ['opencode2', 'opencode'], ['qoder-cn', 'qoder']]) {
    assert.equal(agentArtwork(variant), agentArtwork(base));
    const svg = keyIconSvg({ project: { repo: 'demo', agents: [{ agentType: base }, { agentType: variant }] }, slot: 1, state: 'idle' });
    assert.ok(svg.includes(`${agentCatalog[base].name} + ${agentCatalog[variant].name}`));
  }
  for (const [alias, base] of [['claude-code', 'claude'], ['codex-cli', 'codex'], ['gemini-cli', 'gemini'], ['cursor-agent', 'cursor'], ['grok-bot', 'grok']]) {
    assert.equal(agentArtwork(alias), agentArtwork(base));
  }
});

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
