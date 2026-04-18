---
title: "Rework JSON snippet placeholders to free-text + unified choice"
date: 2026-04-18
priority: high
---

See `.planning/notes/json-snippet-placeholder-rework.md` for full design.

Scope:

- Collapse placeholder types to exactly two: `free text` and `choice`.
- Remove `number` (covered by `free text`) and `multichoice` (merged into `choice`).
- Unified `choice`:
  - Always renders as multi-select in Runner modal.
  - Single selection → insert that value.
  - Multiple selections → join with separator, default `", "`, overridable via optional per-placeholder `separator` field.
  - Must support an editable option list in the snippet editor (fixes the current bug where adding options doesn't work).
- Validation: loading a `.json` snippet that declares a removed type is a hard error surfaced in snippet editor; Runner refuses to execute it.
- No automatic migration of legacy snippets — user confirmed there are none.

Touches: snippet schema, snippet editor UI, placeholder fill-in modal (Runner), validation on load.
