#!/usr/bin/env bash
# claude-budget: Post-compact hook
# Reminds Claude about model routing after context compaction

set -e

MESSAGE=$'
REMINDER (from claude-budget): Context was compacted. Model routing rules:

  haiku  -> researcher, test-runner, git-ops, Explore (search/test/git tasks)
  sonnet -> code-writer, pr-fixer, scaffolder, doc-writer, security-auditor, web-researcher
  opus   -> main conversation, architecture, complex reasoning ONLY

Every Agent() call MUST have a model: parameter. Never default to Opus for subagents.
Delegate search/test/git work to subagents — don'\''t do it on the main thread.
'

INPUT=$(cat)
SOURCE=""

if command -v jq &> /dev/null; then
    SOURCE=$(echo "$INPUT" | jq -r '.source // empty' 2>/dev/null || true)
else
    REGEX='(^|[{,])[[:space:]]*"source"[[:space:]]*:[[:space:]]*"compact"'
    if [[ "$INPUT" =~ $REGEX ]]; then
        SOURCE="compact"
    fi
fi

if [[ "$SOURCE" == "compact" ]]; then
    printf '%s\n' "$MESSAGE"
fi

exit 0
