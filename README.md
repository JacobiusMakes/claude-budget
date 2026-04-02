# claude-budget

Stop burning Opus tokens on subagents. One command to install model routing for Claude Code.

## The Problem

Claude Code runs **everything** on Opus by default — including subagent tasks like searching files, running tests, and git operations that work perfectly on Sonnet or Haiku. On the Max plan, this means you hit session limits with 0% Sonnet usage while Opus is maxed out.

Haiku is ~95% cheaper than Opus. Sonnet is ~80% cheaper. Most subagent tasks don't need Opus.

## The Fix

```bash
npx claude-budget
```

That's it. This installs:

1. **9 model-routed agents** in `~/.claude/agents/` — each has an explicit `model:` field so Claude Code uses the right tier
2. **Routing rules** appended to `~/CLAUDE.md` — instructions that every Claude session reads
3. **Post-compact hook** — reminds Claude about routing after context compaction (when it tends to forget)

## What gets routed where

| Agent | Model | Savings vs Opus |
|-------|-------|-----------------|
| researcher | Haiku | ~95% cheaper |
| test-runner | Haiku | ~95% cheaper |
| git-ops | Haiku | ~95% cheaper |
| code-writer | Sonnet | ~80% cheaper |
| pr-fixer | Sonnet | ~80% cheaper |
| scaffolder | Sonnet | ~80% cheaper |
| doc-writer | Sonnet | ~80% cheaper |
| security-auditor | Sonnet | ~80% cheaper |
| web-researcher | Sonnet | ~80% cheaper |

Opus stays reserved for the main conversation thread, architecture decisions, and complex reasoning — the stuff that actually needs it.

## Commands

```bash
npx claude-budget              # Install everything
npx claude-budget status       # Check what's installed + estimated savings
npx claude-budget doctor       # Diagnose routing issues
npx claude-budget uninstall    # Remove everything cleanly
npx claude-budget install --force  # Overwrite existing agents
```

## How it works

Claude Code supports [custom subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) with a `model:` field in their frontmatter. When Claude spawns a subagent using the `Agent` tool, it uses the model specified in the agent definition instead of inheriting the parent's model.

The problem is that without these definitions, every `Agent()` call defaults to inheriting the parent model (Opus). And there's no built-in enforcement or reminder system.

claude-budget solves this by:
- **Installing agents** with explicit `model: haiku` or `model: sonnet` in their frontmatter
- **Adding routing rules** to `~/CLAUDE.md` (loaded into every session) that instruct Claude to always specify a model and to delegate work to subagents
- **Installing a hook** that fires after context compaction to re-inject the routing reminder (Claude forgets instructions when context is compressed)

## Typical savings

Most users running Claude Code on the Max plan see:
- **60-80% reduction** in Opus token usage
- **Significantly more headroom** before hitting session limits
- **No quality loss** — Haiku and Sonnet handle search/test/git/code tasks perfectly

## License

MIT
