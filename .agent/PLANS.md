# ExecPlan: Wardrobe in my phone (Phase 0-1)

## Milestone 1 - Phase 0 Governance Guardrails
Scope:
- Add root and module-level `AGENTS.md` policies.
- Enforce plan-first workflow, no auto-run commands, and small diffs.

Outputs:
- `AGENTS.md`
- `WardrobeApp/AGENTS.md`
- `supabase/AGENTS.md`

Acceptance checks:
- Root and module files exist.
- Policies explicitly require user approval before build/test/run commands.

## Milestone 2 - Phase 0 Program Plan
Scope:
- Create this execution plan file with phase gates and acceptance checks.

Outputs:
- `.agent/PLANS.md`

Acceptance checks:
- Contains both Phase 0 and Phase 1.
- Includes explicit "stop and request approval" gate after Phase 1.

## Milestone 3 - Phase 1 Data Layer (Schema + RLS + Storage Docs)
Scope:
- Add Supabase SQL migrations for MVP schema and RLS.
- Add storage plan and API contract docs.

Outputs:
- `supabase/migrations/20260228_000001_mvp_core_schema.sql`
- `supabase/migrations/20260228_000002_mvp_rls_and_indexes.sql`
- `supabase/docs/storage-plan.md`
- `supabase/docs/api-contracts.md`

Acceptance checks:
- Tables, constraints, FKs, and indexes are present.
- RLS is enabled and policies are present on all user-owned tables.
- Storage doc defines bucket names, path patterns, and retention.

## Milestone 4 - Phase 1 Edge Function Stubs
Scope:
- Add mocked extraction-related Edge Function endpoints with typed contracts.
- No external ML calls in this phase.

Outputs:
- `supabase/functions/extractions/contracts.ts`
- `supabase/functions/extractions/mock.ts`
- `supabase/functions/extractions/index.ts`

Acceptance checks:
- Contracts include request/response and error shape.
- Stub handlers cover create extraction, retry extraction, and confirm tags.
- Idempotency key exists in create extraction request contract.

## Milestone 5 - Phase 1 iOS Skeleton
Scope:
- Create feature-first SwiftUI structure with placeholder routes/screens.
- Keep UI intentionally minimal for scaffolding.

Outputs:
- App/core/feature/shared placeholder files under `WardrobeApp/`.

Acceptance checks:
- App can be navigated logically via skeleton routing structure.
- Placeholder views exist for AuthGate, Onboarding, Closet, Lookbook, Buy, Profile.

## Milestone 6 - Stop Gate and Handoff
Scope:
- Stop after Phase 1 and return implementation summary.

Outputs:
- Changed file list.
- Key diffs.
- Command list (not executed) for migrations/functions/app.

Acceptance checks:
- No build/test/run/migration/function commands executed.
- Explicit request for approval before Phase 2.

## Stop And Request Approval
- After Milestone 6, pause implementation and request user approval to proceed.
