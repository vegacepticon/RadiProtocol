---
phase: 35
plan: 01
subsystem: runner / tests
tags: [phase-35, wave-0, tdd-red, md-snippets]
requires: []
provides:
  - "MD fixture files for Phase 35 verification"
  - "7 RED test stubs for MD-01..MD-04, D-03, D-06, SC-05"
affects:
  - src/__tests__/runner-extensions.test.ts
  - src/__tests__/fixtures/snippets/phase-35/
tech-stack:
  added: []
  patterns:
    - "Source-level contract assertion (fs.readFileSync on runner-view.ts)"
    - "Runner-level pickSnippet → completeSnippet mirror of Phase 30 D-09"
key-files:
  created:
    - src/__tests__/fixtures/snippets/phase-35/plain.md
    - src/__tests__/fixtures/snippets/phase-35/empty.md
    - src/__tests__/fixtures/snippets/phase-35/subfolder/nested.md
  modified:
    - src/__tests__/runner-extensions.test.ts
decisions:
  - "Pair runner-behavior assertions with grep-style source contract checks on runner-view.ts — view is not mounted in this suite"
  - "Append-only describe block; 3 pre-existing RED tests left untouched per Pitfall 5"
metrics:
  duration: "~15 min"
  completed: 2026-04-15
  tasks: 2
  commits: 2
requirements: [MD-01, MD-02, MD-03, MD-04]
---

# Phase 35 Plan 01: Wave 0 MD fixtures & failing test stubs — Summary

**One-liner:** Nyquist Wave 0 — 3 MD fixtures + 7 RED test stubs in runner-extensions.test.ts covering MD-01..MD-04, D-03 empty MD, D-06 step-back, SC-05 session round-trip, all failing on the current `kind !== 'json'` filter and ready to go GREEN after Plan 02.

## What was built

### Task 1 — MD fixture files (commit `fa3ac04`)

Three markdown fixture files under `src/__tests__/fixtures/snippets/phase-35/`:

| File | Purpose | Contents |
|---|---|---|
| `plain.md` | Verbatim insert source (MD-02) | `# Protocol note\n\nFirst paragraph line.\nSecond paragraph line.\n` |
| `empty.md` | D-03 empty-pick fixture | 0 bytes |
| `subfolder/nested.md` | MD-03 drill-down marker | `Nested MD marker: rp-phase-35-nested\n` |

Verified via inline `node -e` script: all three exist, `empty.md` size=0, markers present.

### Task 2 — 7 failing Phase 35 test stubs (commit `749e3e1`)

New `describe('Phase 35 — MD snippets in Runner picker', ...)` block appended to `src/__tests__/runner-extensions.test.ts` (184 insertions, 0 deletions — pre-existing tests and imports preserved per Pitfall 5).

Test names (match 35-VALIDATION.md `-t` grep patterns):

| # | Test name | Covers | Source marker asserted |
|---|---|---|---|
| 1 | `md picker row` | MD-01 | No `kind !== 'json'` filter; both `📝` and `📄` prefixes present |
| 2 | `md click completes` | MD-02 | `snippet.kind === 'md'` branch + `completeSnippet(snippet.content)` + runtime verbatim insert |
| 3 | `md drill-down` | MD-03 | Filter removed + runtime pickSnippet with subfolder path |
| 4 | `mixed branch md` | MD-04 | MD branch in handler + runtime advance past snippet node |
| 5 | `step-back md` | D-06 | MD branch + runtime stepBack reverts accumulatedText |
| 6 | `empty md` | D-03 | `completeSnippet(snippet.content)` marker + runtime `completeSnippet('')` advances |
| 7 | `session md resume` | SC-05 | MD branch + runtime accumulatedText round-trip via JSON.stringify |

**Helpers introduced (local to describe block):**
- `makeMdSnippet(name, content, folder?)` — builds `MdSnippet` objects without vault I/O
- `loadSnippetGraph(name)` — local mirror of top-level `loadGraph` for canvas fixtures
- `startAtSnippet(fixture)` — drives runner through `chooseAnswer('n-a1')` to reach `awaiting-snippet-pick` (mirrors `runner/protocol-runner.test.ts:605-610`)

### Design note: source-level assertions

Each test pairs a **runner behavior** assertion with a **source-level grep** against `runner-view.ts`. Rationale: `RunnerView` is not mounted in this suite (no jsdom helper exists), and `ProtocolRunner.pickSnippet` + `completeSnippet` already accept any string (MD content works at runtime today). Without the source assertion, tests 2–7 would be GREEN immediately — violating Wave 0's RED requirement.

The source markers reflect Plan 02's concrete contract:
- `/snippet\.kind\s*!==\s*['"]json['"]/` must disappear (MD-01, MD-03)
- `/snippet\.kind\s*===\s*['"]md['"]/` must appear (MD-02, MD-04, D-06, SC-05)
- `/completeSnippet\s*\(\s*snippet\.content\s*\)/` must appear (MD-02, D-03)
- `📝` and `📄` emoji prefixes must appear (MD-01)

When Plan 02 lifts the filter and adds the MD branch, all markers flip and the behavior assertions already pass on the runner core — tests turn GREEN with zero further test edits.

## Verification

```
npx vitest run src/__tests__/runner-extensions.test.ts -t "Phase 35"
→ 7 failed | 3 skipped (10)
```

All 7 Phase 35 tests run, compile cleanly (no TS errors), and fail on the expected source markers. 3 pre-existing tests skipped/red from phase-26 branch are untouched (Pitfall 5).

Acceptance criteria greps:

```
describe(.*Phase 35 — MD snippets): 1
it(.*md picker row): 1
it(.*md click completes): 1
it(.*md drill-down): 1
it(.*mixed branch md): 1
it(.*step-back md): 1
it(.*empty md): 1
it(.*session md resume): 1
```

Git diff for `runner-extensions.test.ts` shows **append-only** change: +184 / -0.

## Deviations from Plan

**None for auto-fixes or blockers.**

One design clarification not spelled out in the plan: tests 2–7 needed source-level grep assertions in addition to runtime behavior because the runner core already accepts MD-shaped input. The plan anticipated this ambiguity (Task 2 action step 9 explicitly states "тесты должны падать на текущем коде"); adding source markers is the cleanest way to satisfy that requirement without mounting a view. Documented here for traceability but treated as an in-scope implementation detail.

## Known Stubs

None — this plan IS the stub; it adds RED test infrastructure that Plan 02 will turn GREEN.

## Commits

- `fa3ac04` — test(35-01): add MD fixture files for Phase 35 Wave 0
- `749e3e1` — test(35-01): add 7 failing Phase 35 MD picker test stubs (Wave 0 RED)

## Self-Check: PASSED

- `src/__tests__/fixtures/snippets/phase-35/plain.md`: FOUND
- `src/__tests__/fixtures/snippets/phase-35/empty.md`: FOUND (0 bytes)
- `src/__tests__/fixtures/snippets/phase-35/subfolder/nested.md`: FOUND
- `src/__tests__/runner-extensions.test.ts`: FOUND (+184 lines)
- Commit `fa3ac04`: FOUND in git log
- Commit `749e3e1`: FOUND in git log
- 7 Phase 35 test cases present, compiling, RED
- 3 pre-existing tests untouched
