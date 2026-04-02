<!-- claude-budget:start -->
# Model Routing (installed by claude-budget)

Every Agent tool call MUST specify a `model:` parameter. Never let subagents inherit the parent model.

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

**Rules:**
1. DELEGATE to subagents — don't do research/search/tests on the main Opus thread
2. Launch parallel agents when tasks are independent
3. 3 Haiku agents in parallel cost less than 1 Opus doing them sequentially
<!-- claude-budget:end -->
