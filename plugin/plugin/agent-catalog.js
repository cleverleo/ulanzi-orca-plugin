// Orca ALL_TUI_AGENTS / TUI_AGENT_DISPLAY_NAMES, installed app inspected 2026-10-24.
// Keep display names separate from artwork so version variants retain their labels.
export const agentCatalog = Object.freeze({
  "claude": {
    "name": "Claude",
    "artwork": "claude"
  },
  "claude-agent-teams": {
    "name": "Claude Agent Teams",
    "artwork": "claude"
  },
  "codebuddy": {
    "name": "CodeBuddy",
    "artwork": "codebuddy"
  },
  "openclaude": {
    "name": "OpenClaude",
    "artwork": "openclaude"
  },
  "codex": {
    "name": "Codex",
    "artwork": "codex"
  },
  "devin": {
    "name": "Devin",
    "artwork": "devin"
  },
  "ante": {
    "name": "Ante",
    "artwork": "ante"
  },
  "trae": {
    "name": "Trae",
    "artwork": "trae"
  },
  "muse": {
    "name": "Muse",
    "artwork": "muse"
  },
  "dsh": {
    "name": "DeepSeek Harness",
    "artwork": "dsh"
  },
  "zcode": {
    "name": "ZCode",
    "artwork": "zcode"
  },
  "autohand": {
    "name": "Autohand Code",
    "artwork": "autohand"
  },
  "opencode": {
    "name": "OpenCode",
    "artwork": "opencode"
  },
  "opencode2": {
    "name": "OpenCode 2",
    "artwork": "opencode"
  },
  "mimo-code": {
    "name": "MiMo Code",
    "artwork": "mimo-code"
  },
  "pi": {
    "name": "Pi",
    "artwork": "pi"
  },
  "omp": {
    "name": "OMP",
    "artwork": "omp"
  },
  "prime-agent": {
    "name": "Prime Agent",
    "artwork": "prime-agent"
  },
  "qoder": {
    "name": "Qoder CLI",
    "artwork": "qoder"
  },
  "qoder-cn": {
    "name": "Qoder CLI China",
    "artwork": "qoder"
  },
  "gemini": {
    "name": "Gemini",
    "artwork": "gemini"
  },
  "antigravity": {
    "name": "Antigravity",
    "artwork": "antigravity"
  },
  "aider": {
    "name": "Aider",
    "artwork": "aider"
  },
  "goose": {
    "name": "Goose",
    "artwork": "goose"
  },
  "amp": {
    "name": "Amp",
    "artwork": "amp"
  },
  "kilo": {
    "name": "Kilocode",
    "artwork": "kilo"
  },
  "kiro": {
    "name": "Kiro",
    "artwork": "kiro"
  },
  "crush": {
    "name": "Charm",
    "artwork": "crush"
  },
  "aug": {
    "name": "Auggie",
    "artwork": "aug"
  },
  "cline": {
    "name": "Cline",
    "artwork": "cline"
  },
  "codebuff": {
    "name": "Codebuff",
    "artwork": "codebuff"
  },
  "freebuff": {
    "name": "Freebuff",
    "artwork": "freebuff"
  },
  "command-code": {
    "name": "Command Code",
    "artwork": "command-code"
  },
  "continue": {
    "name": "Continue",
    "artwork": "continue"
  },
  "cursor": {
    "name": "Cursor",
    "artwork": "cursor"
  },
  "droid": {
    "name": "Droid",
    "artwork": "droid"
  },
  "kimi": {
    "name": "Kimi",
    "artwork": "kimi"
  },
  "mistral-vibe": {
    "name": "Mistral Vibe",
    "artwork": "mistral-vibe"
  },
  "qwen-code": {
    "name": "Qwen Code",
    "artwork": "qwen-code"
  },
  "rovo": {
    "name": "Rovo Dev",
    "artwork": "rovo"
  },
  "hermes": {
    "name": "Hermes",
    "artwork": "hermes"
  },
  "openclaw": {
    "name": "OpenClaw",
    "artwork": "openclaw"
  },
  "copilot": {
    "name": "GitHub Copilot",
    "artwork": "copilot"
  },
  "grok": {
    "name": "Grok",
    "artwork": "grok"
  },
  "jcode": {
    "name": "Jcode",
    "artwork": "jcode"
  }
});

const legacyAliases = {
  'claude-code': 'claude', 'codex-cli': 'codex', 'gemini-cli': 'gemini',
  'cursor-agent': 'cursor', 'grok-bot': 'grok',
};
export const canonicalAgentType = value => {
  const type = typeof value === 'string' ? value.toLowerCase() : '';
  return legacyAliases[type] || type;
};
