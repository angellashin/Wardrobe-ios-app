# Module Rules: supabase

This module follows the root `AGENTS.md` policy.

## Scope
- Add SQL migrations, RLS policies, storage documentation, and mocked Edge Function contracts.
- Do not run migrations or function serve/invoke commands without explicit user approval.

## Safety
- Keep SQL additive and reviewable.
- Ensure RLS is enabled on all user-owned tables in the migration set.
