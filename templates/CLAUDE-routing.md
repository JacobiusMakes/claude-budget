<!-- claude-budget:start -->
# Opus = Orchestrator, Not Worker (installed by claude-budget)

The main thread (Opus) should THINK and DELEGATE. Subagents do the tool work on cheaper models.

**Before using Read/Grep/Bash directly, ask: could a subagent do this?**

Delegate to subagents when: searching multiple files, reading 3+ files, running tests, git ops, writing new code, creating PRs, web research.

Use tools directly only for: quick single reads for immediate decisions, Edits/Writes, trivial lookups.

Every Agent tool call MUST specify a `model:` parameter.

| Task | model | subagent_type |
|------|-------|---------------|
| Search/grep/find files | `haiku` | researcher, Explore |
| Run tests | `haiku` | test-runner |
| Git commit/push/status | `haiku` | git-ops |
| Write/fix code | `sonnet` | code-writer |
| Fix issues + create PRs | `sonnet` | pr-fixer |
| Scaffold projects | `sonnet` | scaffolder |
| Write docs/READMEs | `sonnet` | doc-writer |
| Security audit | `sonnet` | security-auditor |
| Web research | `sonnet` | web-researcher |
| Architecture/planning | (default) | Plan |

Launch parallel agents when tasks are independent. 3 Haiku agents < 1 Opus sequential.
<!-- claude-budget:end -->
