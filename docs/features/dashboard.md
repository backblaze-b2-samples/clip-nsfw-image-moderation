<!-- last_verified: 2026-07-20 -->
# Feature: Dashboard

## Purpose
Provide an at-a-glance overview of moderation activity across all batches.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /batches/stats`, `GET /batches`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 moderation stat cards
- `apps/web/src/components/dashboard/recent-batches-table.tsx` — recent batches
- `apps/web/src/lib/queries.ts` — `useModerationStats()`, `useBatches()`
- `services/api/app/runtime/batches.py` — `GET /batches/stats` handler
- `services/api/app/service/batches.py` — `get_moderation_stats()` business logic

## Canonical Files
- Stat cards: `apps/web/src/components/dashboard/stats-cards.tsx`
- Stats service logic: `services/api/app/service/batches.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /batches/stats` → `ModerationStats` (total_batches, pending_batches, images_scored, approved, quarantined)
- `GET /batches` → `BatchSummary[]` for the recent-batches table (sorted newest-first)

## Flow
- Page loads → two API calls (moderation stats, batch list)
- Stat cards display total batches, images scored, approved, quarantined
- Recent batches table shows the most recent batches with name, status, image count, created date

## Edge Cases
- API unavailable → inline error state with retry (no false zeros)
- No batches yet → empty stat values (0) and an empty-table message
- Many batches → stats aggregate across all manifests (repo paginates listings)

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No batches yet"
- Loaded: populated cards and table

## Verification
- Test files: `services/api/tests/test_batches.py`
- Required cases: stats across batches, empty state, API error fallback
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
