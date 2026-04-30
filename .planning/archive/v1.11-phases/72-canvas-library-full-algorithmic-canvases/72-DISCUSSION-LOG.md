# Phase 72: Canvas Library — Full Algorithmic Canvases - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-29
**Phase:** 72-canvas-library-full-algorithmic-canvases
**Mode:** discuss (standard)
**Areas discussed:** Canvas structure approach, Loop modeling conventions, Snippet strategy, Canvas independence vs shared logic, Verification standard

## Discussion Summary

### Canvas structure approach
User confirmed: **Mixed approach** — linear for simple sections, loops for repeating elements, as in ОГК 1.10.0.

**Decisions:**
- D-01: Mixed structure as in ОГК 1.10.0
- D-02: Each canvas standalone with own conclusions
- D-03: Optional "НА СКАНИРОВАННЫХ УРОВНЯХ" block at end (like ОГК)
- D-04: Canvases do NOT reference each other
- D-05: ПКОП standalone

### Loop modeling conventions
User specified per-canvas loop strategy:

- **ГМ:** Loop for multiple focal lesions ✓
- **ОБП full:** Loop for liver + pancreas; other organs linear
- **ОЗП:** Loops for kidneys + adrenal glands (lesions/masses)
- **ОМТ:** Loops ✓
- **ПКОП:** Loop ✓

**Decisions:**
- D-06: ГМ loop for multiple focal lesions
- D-07: ОБП loop for liver + pancreas
- D-08: ОЗП loops for kidneys + adrenal glands
- D-09: ОМТ loops
- D-10: ПКОП loop
- D-11: Exit from loop with "+" prefix per Phase 50.1
- D-12: Hybrid modeling as in ОГК 1.10.0

### Snippet strategy
User clarified: Do NOT create snippet folders in advance. Snippet nodes inserted where appropriate, paths configured manually later.

**Decisions:**
- D-13: Snippet nodes inserted where appropriate
- D-14: Author will manually specify snippet paths
- D-15: No pre-created folder structure needed
- D-16: Format (.json or .md) — author decides at creation time

### Canvas independence vs shared logic
User confirmed: Each canvas standalone, own conclusion. No cross-references. Optional "НА СКАНИРОВАННЫХ УРОВНЯХ" block in each.

**Decisions:**
- D-17: Each canvas complete standalone report
- D-18: No references between canvases
- D-19: Each ends with own Заключение + Рекомендации

### Verification standard
User clarified verification criteria:
- All sections from `.md` template present
- Fixed blocks (Заключение, Рекомендации) output automatically
- "==напишу что не так==" branches valid
- Snippets with placeholders considered filled after fill-in
- Author verification = visual comparison of output structure vs template

**Decisions:**
- D-20: Canvas runs end-to-end without errors
- D-21: All sections from template present
- D-22: Fixed blocks output automatically
- D-23: "напишу вручную" branches valid
- D-24: Fill-in snippets considered complete
- D-25: Author verification = visual comparison

## Deferred Ideas

- Phase 73: Short algorithmic canvases (ОГК short, ОБП short, ОМТ short)
- Snippet folder structure creation — author's local workflow
- Canvas publication / community sharing — out of scope

---

*Phase: 72-canvas-library-full-algorithmic-canvases*
*Discussion completed: 2026-04-29*