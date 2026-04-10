# Phase 7: Mid-Session Save and Resume — Validation

**Phase:** 07 — Mid-Session Save and Resume
**Generated:** 2026-04-07
**Framework:** Vitest ^4.1.2

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose src/__tests__/session-service.test.ts` |
| Full suite command | `npm test` |

---

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Plan |
|--------|----------|-----------|-------------------|------|
| SESSION-01 | `SessionService.save()` writes valid JSON to correct path | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |
| SESSION-01 | `SessionService.save()` overwrites existing session (idempotent) | unit | same | 07-00 |
| SESSION-01 | `ProtocolRunner.getSerializableState()` returns null in idle/complete/error | unit | `npm test -- src/__tests__/runner/protocol-runner-session.test.ts` | 07-00 |
| SESSION-01 | `ProtocolRunner.restoreFrom()` then `getState()` returns same node+text | unit | same | 07-00 |
| SESSION-01 | Round-trip: `getSerializableState()` → `JSON.stringify` → `JSON.parse` → `restoreFrom()` → `getState()` matches original | unit | same | 07-00 |
| SESSION-01 | Loop context stack survives round-trip serialization | unit | same | 07-00 |
| SESSION-02 | `SessionService.hasSession()` returns true after save, false before | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |
| SESSION-02 | Resume prompt appears on protocol launch when session file exists | manual UAT | n/a — Obsidian UI required | 07-02 |
| SESSION-03 | `validateSessionNodeIds()` returns empty array when all IDs present | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |
| SESSION-03 | `validateSessionNodeIds()` returns missing IDs when node removed from canvas | unit | same | 07-00 |
| SESSION-03 | Resume blocked with "Start over" when node IDs are missing | manual UAT | n/a — Obsidian UI required | 07-02 |
| SESSION-04 | mtime comparison logic returns true when canvas mtime > `canvasMtimeAtSave` | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |
| SESSION-04 | mtime warning shown in resume modal when canvas modified since save | manual UAT | n/a — Obsidian UI required | 07-02 |
| SESSION-05 | `accumulatedText` in session captures text at save time, not at resume | unit | `npm test -- src/__tests__/runner/protocol-runner-session.test.ts` | 07-00 |
| SESSION-06 | `SessionService.load()` returns null for corrupt JSON | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |
| SESSION-06 | "Start over" choice clears session and starts fresh | manual UAT | n/a — Obsidian UI required | 07-02 |
| SESSION-07 | JSON output of `PersistedSession` contains no `Set` objects (audit — all arrays) | unit | `npm test -- src/__tests__/session-service.test.ts` | 07-00 |

---

## Sampling Rate

- **Per task commit:** `npm test -- src/__tests__/session-service.test.ts src/__tests__/runner/protocol-runner-session.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

---

## Wave 0 Gaps (to be created by 07-00-PLAN.md)

- [ ] `src/__tests__/session-service.test.ts` — covers SESSION-01 through SESSION-07 (pure unit tests using vault mock pattern from `snippet-service.test.ts`)
- [ ] `src/__tests__/runner/protocol-runner-session.test.ts` — covers `getSerializableState()`, `restoreFrom()`, round-trip, loop context stack serialization

*(Existing test infrastructure — `vitest.config.ts`, `src/__mocks__/obsidian.ts`, vault mock factory — covers all new tests with no additional setup)*

---

## Manual UAT Checklist (Plan 07-02)

- [ ] After answering 3+ questions and closing Obsidian, reopening and running the same protocol offers a "Resume session" prompt
- [ ] Resuming restores the runner to the exact node, accumulated text, and undo history from before closing
- [ ] Canvas modified since save → "Resume session?" modal shows a warning; "Try to resume" and "Start over" both work correctly
- [ ] Node ID no longer exists in canvas → error message shown, "Start over" clears session and starts fresh
- [ ] Completing a protocol clears the session file — no resume prompt on next run
- [ ] Closing the resume modal with Escape = "Start over" (starts fresh, session cleared)
