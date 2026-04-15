# Phase 32 — Deferred Items

## Pre-existing failing tests (out of scope)

**File:** `src/__tests__/runner-extensions.test.ts`
**Tests:** 3 failing — `ProtocolRunner extensions (RUN-11, D-04, D-05, D-07)`
**Status:** Pre-existing, unrelated to Phase 32.
**Evidence:** Test names include "RED until Plan 02" — these are TDD RED-state tests left over from a different phase (RUN-11 — a future `ProtocolRunner` extension phase). Confirmed failing on main-trunk state with `git stash` during Plan 32-04 execution.
**Action:** Not fixed in Phase 32. Tracked here for whichever phase picks up RUN-11.
