import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { labels, primaryAgent, worktreeName } from './project-state.js';

export const colors = { waiting: '#fbbf24', working: '#38bdf8', done: '#4ade80', idle: '#94a3b8', error: '#f87171', unknown: '#a78bfa', offline: '#64748b', empty: '#475569' };
const aliases = { 'claude-code': 'claude', claude: 'claude', codex: 'codex', 'codex-cli': 'codex', gemini: 'gemini', 'gemini-cli': 'gemini', cursor: 'cursor', 'cursor-agent': 'cursor', opencode: 'opencode', grok: 'grok', 'grok-bot': 'grok', antigravity: 'antigravity' };
const names = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor', opencode: 'OpenCode', grok: 'Grok', antigravity: 'Antigravity' };
const logos = Object.fromEntries(Object.keys(names).map(type => {
  const svg = readFileSync(new URL(`../resources/agents/${type}.svg`, import.meta.url), 'utf8');
  // Preserve the brand paths and explicit colors, with a white default on dark keys.
  const rootAttributes = /<svg\b([^>]*)>/.exec(svg)[1];
  const viewBox = /viewBox="([^"]+)"/.exec(rootAttributes)[1].split(/\s+/).map(Number);
  const scale = 170 / Math.max(viewBox[2], viewBox[3]);
  const attributes = rootAttributes.replace(/\s(?:width|height|style|xmlns|viewBox)="[^"]*"/g, '').replaceAll('currentColor', '#f8fafc');
  const content = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/g, '').replaceAll('currentColor', '#f8fafc');
  // Qt SVG does not consistently honor nested SVG viewports. Flatten the logo
  // to a transformed group so the deliberate oversize crop stays predictable.
  return [type, `<g transform="translate(${-13 - viewBox[0] * scale} ${-13 - viewBox[1] * scale}) scale(${scale})" fill="#f8fafc" ${attributes.replace(/\sfill="[^"]*"/, '')}>${content}</g>`];
}));
const terminal = '<g transform="translate(-13 -13) scale(7.083333)" stroke="#cbd5e1" stroke-width="1.4" fill="none"><rect x="1" y="3" width="22" height="18" rx="3"/><path d="m5 8 4 4-4 4m8 0h6"/></g>';
export const agentArtwork = type => logos[aliases[type]] || terminal;
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
const units = char => /[^\u0000-\u00ff]/.test(char) ? 2 : 1;
function truncate(value, max) {
  let length = 0;
  let text = '';
  const chars = [...String(value ?? '')];
  for (let i = 0; i < chars.length; i++) {
    if (length + units(chars[i]) > max - (i < chars.length - 1 ? 1 : 0)) return text + '…';
    text += chars[i];
    length += units(chars[i]);
  }
  return text;
}
function projectLines(value, max = 16) {
  const chars = [...String(value ?? '')];
  let length = 0;
  let first = '';
  while (chars.length && length + units(chars[0]) <= max) { const char = chars.shift(); first += char; length += units(char); }
  if (chars.length) {
    const split = Math.max(first.lastIndexOf('-'), first.lastIndexOf('_'), first.lastIndexOf(' '));
    if (split >= 8 && split < first.length - 1) {
      chars.unshift(...first.slice(split + 1));
      first = first.slice(0, split + 1);
    }
  }
  return chars.length ? [first.trim(), truncate(chars.join('').trim(), max)] : [first.trim()];
}

export function keyIconSvg({ project, slot, state }) {
  const agent = primaryAgent(project || {});
  const type = aliases[agent?.agentType?.toLowerCase()];
  const types = [...new Set((project?.agents ?? []).map(a => aliases[a.agentType?.toLowerCase()] || a.agentType).filter(Boolean))];
  const agentLabel = types.length ? types.map(t => names[t] || t).join(' + ') : 'Terminal';
  const color = colors[state] || colors.unknown;
  const lines = projectLines(project?.repo || project?.displayName || `Orca ${slot}`, 12);
  const worktree = project ? project.displayName || worktreeName(project) : '等待 worktree';
  const worktreeLines = projectLines(worktree, 13);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<title>${escape(project?.repo || `Orca ${slot}`)} · ${escape(worktree)} · ${escape(agentLabel)} · ${escape(labels[state] || labels.unknown)}</title>
<defs><clipPath id="key-clip"><rect x="4" y="4" width="136" height="136" rx="12"/></clipPath></defs>
<rect width="144" height="144" rx="16" fill="#111827"/>
<g clip-path="url(#key-clip)">
<g opacity="0.35">${logos[type] || terminal}</g>
<rect x="7" y="29" width="130" height="107" rx="9" fill="#24282e" fill-opacity="0.55"/>
<g font-family="Arial, PingFang SC, sans-serif" text-anchor="middle">
${lines.map((line, i) => `<text x="72" y="${lines.length === 1 ? 60 : 45 + i * 21}" font-size="18" font-weight="bold" fill="#ffffff">${escape(line)}</text>`).join('')}
${worktreeLines.map((line, i) => `<text x="72" y="${worktreeLines.length === 1 ? 100 : 87 + i * 21}" font-size="17" font-weight="bold" fill="#ffffff">${escape(line)}</text>`).join('')}
<rect x="12" y="115" width="120" height="19" rx="7" fill="${color}"/>
<text x="72" y="130" font-size="12" font-weight="bold" fill="#111827">${slot} · ${escape(labels[state] || labels.unknown)}</text>
</g></g>
<rect x="3" y="3" width="138" height="138" rx="13" fill="none" stroke="${color}" stroke-width="3"/>
</svg>`;
}

const output = new URL('../resources/live/', import.meta.url);
const currentIcons = new Map();
let newIcons = 0;
export function writeKeyIcon(svg, context) {
  const hash = createHash('sha256').update(svg).digest('hex').slice(0, 24);
  const target = new URL(`${hash}.svg`, output);
  mkdirSync(output, { recursive: true });
  if (context) currentIcons.set(context, `${hash}.svg`);
  if (!existsSync(target)) {
    writeFileSync(target, svg);
    if (++newIcons % 128 === 0) {
      // Quota countdowns change regularly; bound generated files without evicting displayed icons.
      try {
        const protectedNames = new Set(currentIcons.values());
        const files = readdirSync(output).filter(name => /^[a-f0-9]{24}\.svg$/.test(name))
          .map(name => ({ name, time: statSync(new URL(name, output)).mtimeMs })).sort((a, b) => b.time - a.time);
        for (const file of files.slice(512)) if (!protectedNames.has(file.name) && file.name !== `${hash}.svg`) unlinkSync(new URL(file.name, output));
      } catch { /* Cache maintenance cannot stop the display. */ }
    }
  }
  // Content-addressed paths ensure Studio reloads changed icons instead of a cached image.
  return `resources/live/${hash}.svg`;
}
