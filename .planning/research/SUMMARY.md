# Research Summary: RadiProtocol v1.1 UX & Community Release

**Synthesized:** 2026-04-07
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

v1.1 is a UX polish and community delivery milestone — the protocol engine is untouched. All six features are additive: they modify the view layer and add two new services. **No new npm dependencies required.**

The only high-risk feature is **live canvas node editing** (undocumented internal API). Every other feature uses stable, public Obsidian API with HIGH confidence.

---

## Stack Additions

| API | Feature | Confidence |
|-----|---------|------------|
| `workspace.getLeaf('tab')` | Full-tab runner | HIGH |
| `Editor.replaceSelection()` / `vault.append()` | Insert into note | HIGH |
| `FuzzySuggestModal<TFile>` | Canvas selector | HIGH |
| `(view as any).canvas` → `node.setData()` → `canvas.requestSave()` | Live canvas editing | MEDIUM (undocumented) |

**New files:** `src/canvas/canvas-live-editor.ts`, `src/types/canvas-internal.d.ts`, `src/templates/template-service.ts`, `versions.json`

---

## Feature Priorities

**Table stakes (must ship):**
- Full-tab runner view — LOW complexity, standard Obsidian UX pattern
- Canvas selector dropdown — LOW-MEDIUM, blocks multi-canvas users
- Insert into current note — LOW, core clinical workflow
- Community submission — MEDIUM (time), this is the delivery gate

**Differentiators (should ship):**
- Node templates (single-node, Strategy A) — MEDIUM, novel in ecosystem
- Live canvas editing — HIGH complexity, QoL over Strategy A; ship last

**Recommended build order:**
1. Community submission prep (parallel — surfaces violations early)
2. Full-tab runner view
3. Canvas selector + Insert into note (can be parallel)
4. Node templates
5. Live canvas editing (last — must not block if unstable)

---

## Architecture Integration

**Modified:** `settings.ts`, `main.ts`, `runner-view.ts`, `editor-panel-view.ts`, `manifest.json`
**Unchanged:** `ProtocolRunner`, `CanvasParser`, `GraphValidator`, `SnippetService`, `SessionService`

**Critical constraint:** Canvas selector header must render in `onOpen()` into a dedicated `headerEl` — never inside `contentEl` which is wiped by `render()` on every state transition.

---

## Top Pitfalls

| # | Pitfall | Risk | Mitigation |
|---|---------|------|-----------|
| 1 | Canvas internal API breakage | HIGH | Isolate in `canvas-live-editor.ts`; runtime guard + Strategy A fallback |
| 2 | `requestSave()` race with canvas dirty cycle | HIGH | Debounce 500ms; integration test roundtrip |
| 3 | Canvas selector destroyed on re-render | MEDIUM | Render in `onOpen()` header, not `contentEl` |
| 4 | Community submission rejection | MEDIUM | `npm run lint` + manifest audit + `versions.json` + correct release tag format |

---

## Open Questions for Implementation

- Does `getMostRecentLeaf()` return correct note when RunnerView is active tab? Verify in UAT (insert-to-note phase).
- Exact signature of `canvas.requestSave()` — Promise or callback? Check at runtime in Phase 5.
- Does `CanvasNode.setData(data, addHistory?)` push to canvas-internal undo only or Obsidian global undo?
- Current state of `manifest.json` — audit `isDesktopOnly`, `minAppVersion`, `versions.json` in submission phase.
