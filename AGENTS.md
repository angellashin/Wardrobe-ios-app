# Agent Rules

## Working Mode
- Always start with a plan before editing.
- Keep diffs small and scoped to the active milestone.
- Prefer incremental, reviewable changes over broad rewrites.

## Command Policy
- Do not run build, test, lint, migration, or deploy commands without explicit user approval in the same thread.
- When approval is not granted, list commands as "not executed".
- Do not run destructive git commands unless explicitly requested.

## Delivery Policy
- For each milestone, include changed files, key diffs, and pending decisions.
- Stop at defined phase gates and ask for approval before the next phase.
