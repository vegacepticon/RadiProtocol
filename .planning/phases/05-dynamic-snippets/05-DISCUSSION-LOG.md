# Phase 5: Dynamic Snippets — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 05-dynamic-snippets
**Mode:** discuss
**Areas discussed:** Snippet Manager layout, Placeholder authoring flow, Choice options input, SNIP-09 scope

---

## Areas Discussed

### Snippet Manager Layout

| Question | Options presented | User chose |
|----------|------------------|------------|
| SnippetManagerView layout? | List + form right (master-detail) / Accordion | **List + form right** |

Notes: Standard master-detail pattern. Left column: list with [+ New snippet]. Right column:
Name, Template textarea, Placeholders section, Save/Delete buttons.

### Placeholder Authoring Flow

| Question | Options presented | User chose |
|----------|------------------|------------|
| How to insert {{id}} and define placeholders? | [+ Add placeholder] button / Manual {{id}} typing + auto-detect | **[+ Add placeholder] button** |

Notes: Button inserts `{{id}}` at cursor AND adds a row to the placeholder list.
Mini-form (label, type) opens inline under the button. ID is auto-generated from label slug.
Raw IDs never visible to users — only human-readable labels shown.

### Choice Options Input

| Question | Options presented | User chose |
|----------|------------------|------------|
| How to enter choice/multi-choice options? | Individual +/- fields / Textarea one-per-line | **Individual +/- fields** |

Notes: One text input per option with [×] remove button. [+ Add option] adds a new field.
Avoids comma ambiguity in medical terms (e.g., "left, right" could be one or two options).
`multi-choice` adds a Join separator field. `number` adds a Unit field.

### SNIP-09 Scope

| Question | Options presented | User chose |
|----------|------------------|------------|
| Include free-text override for choice fields? | Include now / Defer to later | **Include now** |

Notes: During fill-in, a "Custom: [text input]" field appears below all choice/multi-choice
options. Typing auto-deselects any radio/checkbox selection. Useful for non-standard findings
(atypical anatomy, rare measurements). Included as "Should have" in SNIP-09.

---

## Corrections Made

None — all recommendations accepted.

---

## Prior Decisions Applied (No Re-asking)

- `completeSnippet(renderedText)` hook: locked by Phase 2 D-06/D-07. Runner receives only
  the final rendered string — no knowledge of snippet template format.
- Fill-in is a `Modal` (not inline panel): SNIP-04 names it `SnippetFillInModal` explicitly.
  ROADMAP risk flag acknowledged — Modal accepted as simpler/safer implementation.
- Plain DOM + `createEl()`/`createDiv()`: no React (Phase 3 D-04 + NFR-02).
- `async-mutex` for WriteMutex: STACK.md dependency already listed.
- Snippet folder `.radiprotocol/snippets/`: locked by SNIP-01/SNIP-08.
- Template syntax `{{placeholder_id}}`: locked by Assumption A2 (confirmed in STATE.md).
