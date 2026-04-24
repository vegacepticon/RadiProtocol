---
phase: 59
slug: inline-runner-feature-parity
uat_date: 2026-04-24
uat_by: user
status: passed
---

# Phase 59 — Manual UAT Log

Evidence log for behaviors that cannot be fully asserted via unit tests.

## UAT-01 — INLINE-FIX-01: Nested path resolution

| Variant | Setting Value | Expected | Result |
|---------|---------------|----------|--------|
| Canonical | `templates/ALGO` | Picker lists nested canvases | ✅ |
| Trailing slash | `templates/ALGO/` | Same list | ✅ |
| Windows backslash | `templates\ALGO` | Same list | ✅ |

**Notes:** All variants resolved correctly after Phase 59 path normalization.

## UAT-02 — INLINE-FIX-04: Snippet separator parity

| Variant | Setting | Expected | Result |
|---------|---------|----------|--------|
| MD snippet + newline | textSeparator=newline | Single `\n` between prior text + snippet | ✅ |
| JSON zero-placeholder + newline | textSeparator=newline | Single `\n` separator | ✅ |
| MD snippet + space | textSeparator=space | Single ` ` separator | ✅ |

**Notes:** First-chunk invariant also verified (no leading separator when accumulator empty).

## UAT-03 — INLINE-FIX-05: JSON fill-in modal parity

| Behavior | Expected | Result |
|----------|----------|--------|
| Modal appears centered (not in-panel) | Centered Obsidian Modal | ✅ |
| Live preview updates as user types | Visible live rendering | ✅ |
| Custom override on choice placeholders | Field present | ✅ |
| Tab order matches placeholder declaration order | Natural progression | ✅ |
| Submit → content appended with separator | Delta applied | ✅ |
| Cancel / Escape → no content appended | Runner advances with '' | ✅ |

**Notes:** JSON snippets in subdirectories also work after the 6088a1e fallback-scan fix.

## UAT-04 — Phase 54 D1 preserved (freeze/resume under fill-in modal)

| Behavior | Expected | Result |
|----------|----------|--------|
| Switch tab while fill-in modal open | Inline container stays visible | ✅ |
| Switch back to source note | No flicker, modal + inline still visible | ✅ |

## UAT-05 — Phase 54 D3 preserved (close disposes fillModal)

| Behavior | Expected | Result |
|----------|----------|--------|
| Close inline while fill-in modal open | Both close cleanly, no orphan DOM | ✅ |

## UAT-06 — Phase 54 D9 preserved (no-active-md Notice)

| Behavior | Expected | Result |
|----------|----------|--------|
| Run command with canvas view active | Notice "Open a markdown note first..." | ✅ |

## UAT-07 — Phase 54 D8 preserved (empty folder Notice)

| Behavior | Expected | Result |
|----------|----------|--------|
| Run command with empty Protocols folder | Notice "No protocol canvases found..." | ✅ |

## Summary

- Total UAT sections: 7
- Passed: 7 / 7
- Failed: 0 / 7
- Issues filed: None

## Phase 54 Invariant Preservation Confirmed

- ✅ D1: Freeze/resume works (gated by isFillModalOpen during fill-in)
- ✅ D2: Target-note-deleted closes modal cleanly
- ✅ D3: Close button disposes inline AND fill-in modal
- ✅ D4: No textarea — note IS the buffer
- ✅ D5: No on-note running indicator
- ⛔ D6: **REVERSED** — fill-in now uses stacked SnippetFillInModal (documented in 59-03-PLAN.md)
- ✅ D7: Append formatting 1:1 with sidebar (accumulator-diff pattern)
- ✅ D8: No canvases → Notice + abort
- ✅ D9: No active markdown note → Notice + abort
