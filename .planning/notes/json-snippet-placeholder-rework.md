---
title: "JSON snippet placeholder types — rework"
date: 2026-04-18
context: design
---

## Supported placeholder types

Only two types remain:

- **`free text`** — arbitrary text input by the user. Also covers what `number` used to do (no separate numeric type).
- **`choice`** — one unified type for both single- and multi-selection. The author provides a list of options. UI always shows a multi-select; behavior on insertion:
  - User selects a **single** option → that option's value is inserted.
  - User selects **multiple** options → values are joined by a separator.
  - Separator defaults to `", "` (comma + space).
  - Separator can be overridden per placeholder via an optional `separator` field in the placeholder config.

## Removed types

- `number` — removed; use `free text`.
- Old `choice` (single-only) — removed; replaced by unified `choice`.
- `multichoice` — removed; replaced by unified `choice`.

## Legacy snippets

If a `.json` snippet defines a removed placeholder type (`number`, `multichoice`, or old-style `choice` that can't be read as the new unified schema), treat it as an **error**: surface a clear validation message in the snippet editor and block its use in Runner until the author updates it.

The user confirmed they have no legacy snippets that would require migration, so automatic conversion is not implemented.

## Current bug to fix

Placeholder option entry for `choice` / `multichoice` in the snippet editor is broken — the user cannot add or edit option values. This must be fixed as part of the rework, since unified `choice` must support a working option list.

## How to apply

- Define new placeholder schema (types: `"free text"` | `"choice"`; `choice` has `options: string[]`, optional `separator: string`).
- Update snippet editor UI: replace the old type selector with the two new options; fix option-list editor so users can add/remove/edit choices.
- Update Runner placeholder modal: render unified `choice` as multi-select checkboxes (or equivalent), join selected values with separator on insert.
- Add validation: reject snippets declaring removed types on load.
