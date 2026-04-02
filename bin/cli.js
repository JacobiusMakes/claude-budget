#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, chmodSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const AGENTS_DIR = join(CLAUDE_DIR, 'agents');
const HOOKS_DIR = join(HOME, '.local', 'bin');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function log(msg) { console.log(msg); }
function success(msg) { log(`${GREEN}OK${RESET} ${msg}`); }
function warn(msg) { log(`${YELLOW}!!${RESET} ${msg}`); }
function info(msg) { log(`${DIM}${msg}${RESET}`); }

const args = process.argv.slice(2);
const command = args[0] || 'install';

switch (command) {
  case 'install':
    install(args.includes('--force'));
    break;
  case 'status':
    status();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'doctor':
    doctor();
    break;
  case '--help':
  case '-h':
  case 'help':
    help();
    break;
  default:
    log(`Unknown command: ${command}`);
    help();
    process.exit(1);
}

function help() {
  log(`
${BOLD}claude-budget${RESET} — Stop burning Opus on subagents

${BOLD}Usage:${RESET}
  npx claude-budget            Install agents, hooks, and routing rules
  npx claude-budget install    Same as above (--force to overwrite)
  npx claude-budget status     Show what's installed and estimated savings
  npx claude-budget doctor     Diagnose routing issues
  npx claude-budget uninstall  Remove everything claude-budget installed

${BOLD}What it does:${RESET}
  1. Installs 9 model-routed agents to ~/.claude/agents/
     - 3 on Haiku (researcher, test-runner, git-ops)
     - 6 on Sonnet (code-writer, pr-fixer, scaffolder, doc-writer, security-auditor, web-researcher)
  2. Adds mandatory routing rules to ~/CLAUDE.md
  3. Installs a post-compact hook that reminds Claude about routing after context compaction
  4. All of this makes Claude Code delegate work to cheaper models automatically

${BOLD}Estimated savings:${RESET}
  Haiku agents are ~95% cheaper than Opus
  Sonnet agents are ~80% cheaper than Opus
  Most users see 60-80% reduction in Opus token usage
`);
}

function install(force = false) {
  log(`\n${BOLD}claude-budget install${RESET}\n`);

  // 1. Ensure directories exist
  for (const dir of [AGENTS_DIR, HOOKS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      info(`Created ${dir}`);
    }
  }

  // 2. Install agents
  const agentsSrc = join(ROOT, 'agents');
  const agentFiles = readdirSync(agentsSrc).filter(f => f.endsWith('.md'));
  let installed = 0;
  let skipped = 0;

  for (const file of agentFiles) {
    const dest = join(AGENTS_DIR, file);
    if (existsSync(dest) && !force) {
      const existing = readFileSync(dest, 'utf8');
      if (existing.includes('claude-budget')) {
        skipped++;
        continue;
      }
      // Different agent exists — don't overwrite without --force
      warn(`${file} exists (not from claude-budget). Use --force to overwrite.`);
      skipped++;
      continue;
    }
    copyFileSync(join(agentsSrc, file), dest);
    installed++;
  }
  success(`Agents: ${installed} installed, ${skipped} skipped (${agentFiles.length} total)`);

  // 3. Install/update ~/CLAUDE.md
  const claudeMdPath = join(HOME, 'CLAUDE.md');
  const routingBlock = readFileSync(join(ROOT, 'templates', 'CLAUDE-routing.md'), 'utf8');

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf8');
    if (existing.includes('claude-budget')) {
      if (force) {
        // Replace the claude-budget section
        const updated = existing.replace(
          /<!-- claude-budget:start -->[\s\S]*?<!-- claude-budget:end -->/,
          routingBlock
        );
        writeFileSync(claudeMdPath, updated);
        success('~/CLAUDE.md routing rules updated');
      } else {
        info('~/CLAUDE.md already has routing rules (use --force to update)');
      }
    } else {
      // Append routing block
      writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + routingBlock + '\n');
      success('~/CLAUDE.md — appended routing rules');
    }
  } else {
    writeFileSync(claudeMdPath, routingBlock + '\n');
    success('~/CLAUDE.md — created with routing rules');
  }

  // 4. Install post-compact hook
  const hookPath = join(HOOKS_DIR, 'claude-budget-compact-hook');
  const hookSrc = join(ROOT, 'hooks', 'post-compact.sh');
  copyFileSync(hookSrc, hookPath);
  chmodSync(hookPath, 0o755);
  success('Post-compact hook installed');

  // 5. Check/update settings.json for hook registration
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const hookCommand = `${hookPath}`;

    // Check if hook already registered
    const hooks = settings.hooks?.SessionStart || [];
    const hasHook = hooks.some(h =>
      h.hooks?.some(hh => hh.command?.includes('claude-budget'))
    );

    if (!hasHook) {
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

      settings.hooks.SessionStart.push({
        matcher: 'compact',
        hooks: [{
          type: 'command',
          command: hookCommand
        }]
      });
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      success('Hook registered in settings.json');
    } else {
      info('Hook already registered in settings.json');
    }
  } else {
    warn('No ~/.claude/settings.json found — hook not auto-registered');
    info(`Add manually: hooks.SessionStart with command: ${join(HOOKS_DIR, 'claude-budget-compact-hook')}`);
  }

  log(`\n${GREEN}${BOLD}Done!${RESET} Claude Code will now route subagents to Sonnet/Haiku automatically.`);
  log(`${DIM}New sessions pick this up immediately. Existing sessions need a restart.${RESET}\n`);
}

function status() {
  log(`\n${BOLD}claude-budget status${RESET}\n`);

  // Check agents
  const agentFiles = existsSync(AGENTS_DIR) ? readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')) : [];
  const budgetAgents = agentFiles.filter(f => {
    try {
      return readFileSync(join(AGENTS_DIR, f), 'utf8').includes('claude-budget');
    } catch { return false; }
  });

  const modelCounts = { haiku: 0, sonnet: 0, opus: 0, unset: 0 };
  for (const f of agentFiles) {
    try {
      const content = readFileSync(join(AGENTS_DIR, f), 'utf8');
      const modelMatch = content.match(/^model:\s*(\w+)/m);
      if (modelMatch) {
        const m = modelMatch[1].toLowerCase();
        if (m in modelCounts) modelCounts[m]++;
        else modelCounts.unset++;
      } else {
        modelCounts.unset++;
      }
    } catch { modelCounts.unset++; }
  }

  log(`${BOLD}Agents:${RESET} ${agentFiles.length} total (${budgetAgents.length} from claude-budget)`);
  log(`  ${CYAN}haiku${RESET}:  ${modelCounts.haiku} agents (~95% cheaper than Opus)`);
  log(`  ${CYAN}sonnet${RESET}: ${modelCounts.sonnet} agents (~80% cheaper than Opus)`);
  if (modelCounts.unset > 0) {
    log(`  ${RED}unset${RESET}:  ${modelCounts.unset} agents ${RED}(BURNING OPUS!)${RESET}`);
  }

  // Check CLAUDE.md
  const claudeMd = join(HOME, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    const content = readFileSync(claudeMd, 'utf8');
    if (content.includes('claude-budget')) {
      success('~/CLAUDE.md has routing rules');
    } else {
      warn('~/CLAUDE.md exists but missing routing rules');
    }
  } else {
    warn('No ~/CLAUDE.md — routing rules not installed');
  }

  // Check hook
  const hookPath = join(HOOKS_DIR, 'claude-budget-compact-hook');
  if (existsSync(hookPath)) {
    success('Post-compact hook installed');
  } else {
    warn('Post-compact hook not found');
  }

  // Estimate savings
  log(`\n${BOLD}Estimated savings per session:${RESET}`);
  log(`  If 40% of work goes to Haiku agents:  ~38% cost reduction`);
  log(`  If 40% goes to Sonnet, 20% to Haiku:  ~52% cost reduction`);
  log(`  Typical mixed workload:                ~60-70% cost reduction`);
  log('');
}

function doctor() {
  log(`\n${BOLD}claude-budget doctor${RESET}\n`);

  let issues = 0;

  // Check for agents without model routing
  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const content = readFileSync(join(AGENTS_DIR, f), 'utf8');
      if (!content.match(/^model:\s*\w+/m)) {
        warn(`${f} has NO model set — will inherit Opus!`);
        issues++;
      }
    }
    if (files.length === 0) {
      warn('No agents installed at all');
      issues++;
    }
  } else {
    warn('~/.claude/agents/ directory missing');
    issues++;
  }

  // Check CLAUDE.md
  const claudeMd = join(HOME, 'CLAUDE.md');
  if (!existsSync(claudeMd)) {
    warn('No ~/CLAUDE.md — Claude has no routing instructions');
    issues++;
  } else {
    const content = readFileSync(claudeMd, 'utf8');
    if (!content.toLowerCase().includes('model')) {
      warn('~/CLAUDE.md exists but mentions nothing about model routing');
      issues++;
    }
  }

  // Check settings.json for auto mode
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (settings.permissions?.defaultMode !== 'auto') {
      info('Tip: defaultMode is not "auto" — subagents may prompt for permissions');
    }
  }

  if (issues === 0) {
    log(`\n${GREEN}${BOLD}All clear!${RESET} Model routing is properly configured.\n`);
  } else {
    log(`\n${RED}${BOLD}${issues} issue(s) found.${RESET} Run ${CYAN}npx claude-budget install${RESET} to fix.\n`);
  }
}

function uninstall() {
  log(`\n${BOLD}claude-budget uninstall${RESET}\n`);

  // Remove agents that we installed
  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
    let removed = 0;
    for (const f of files) {
      const content = readFileSync(join(AGENTS_DIR, f), 'utf8');
      if (content.includes('claude-budget')) {
        unlinkSync(join(AGENTS_DIR, f));
        removed++;
      }
    }
    success(`Removed ${removed} agents`);
  }

  // Remove routing block from CLAUDE.md
  const claudeMd = join(HOME, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    let content = readFileSync(claudeMd, 'utf8');
    if (content.includes('claude-budget')) {
      content = content.replace(
        /\n*<!-- claude-budget:start -->[\s\S]*?<!-- claude-budget:end -->\n*/,
        '\n'
      ).trim();
      if (content) {
        writeFileSync(claudeMd, content + '\n');
      }
      success('Removed routing rules from ~/CLAUDE.md');
    }
  }

  // Remove hook
  const hookPath = join(HOOKS_DIR, 'claude-budget-compact-hook');
  if (existsSync(hookPath)) {
    unlinkSync(hookPath);
    success('Removed post-compact hook');
  }

  // Remove hook from settings.json
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (settings.hooks?.SessionStart) {
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(h =>
        !h.hooks?.some(hh => hh.command?.includes('claude-budget'))
      );
      if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      success('Removed hook from settings.json');
    }
  }

  log(`\n${GREEN}${BOLD}Uninstalled.${RESET} Claude Code is back to default (Opus for everything).\n`);
}
