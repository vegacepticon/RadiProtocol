# Phase 51: Snippet Picker Overhaul — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `51-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 51-snippet-picker-overhaul
**Areas discussed:** Storage shape, Scope of picker replacement, Tree-wide search semantics, Auto-insert semantics

---

## Storage shape (D-01..D-04)

### Q1 — Binding discriminant on SnippetNode

| Option | Description | Selected |
|--------|-------------|----------|
| Отдельное поле `radiprotocol_snippetPath` | New property, mutually exclusive with `radiprotocol_subfolderPath`. Legacy canvases unchanged. | ✓ |
| Явный discriminant + одно поле | `radiprotocol_bindingKind: 'folder' \| 'file'` + unified path. Requires migration or runtime fallback. | |
| Overload `subfolderPath` по extension | Single field, read `endsWith('.md')`/`.json` to detect file binding. Risk of name collision. | |

**User's choice:** Отдельное поле `radiprotocol_snippetPath` (recommended — Pitfall #11 natively satisfied).

### Q2 — Path format

| Option | Description | Selected |
|--------|-------------|----------|
| Относительно `snippetFolderPath` | Same convention as existing `subfolderPath`. Survives vault moves / setting changes. | ✓ |
| Абсолютный vault-путь | Self-contained but breaks on `snippetFolderPath` setting change. | |

**User's choice:** Относительно `snippetFolderPath`.

### Q3 — File extension in stored path

| Option | Description | Selected |
|--------|-------------|----------|
| С расширением (.md / .json) | Runner can branch by path check, no extra lookup. | ✓ |
| Без расширения («snippet id») | Requires runtime lookup in `snippetService` to resolve md vs json. | |

**User's choice:** С расширением.

### Q4 — Missing-file behaviour in GraphValidator

| Option | Description | Selected |
|--------|-------------|----------|
| Hard validation error в canvas-open | Russian error, canvas rejected, matches Phase 50.1 style. | ✓ |
| Lazy fail в Runner | Canvas opens; error shown only if node is reached. | |
| Warning, continue | Log + skip. Masks author mistakes. | |

**User's choice:** Hard validation error в canvas-open.

---

## Scope of picker replacement (D-05..D-08)

### Q1 — Node Editor integration style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline в form (один Setting-row) | Picker rendered directly in the editor column. No modal hop. | ✓ |
| Кнопка открывает модалку | Compact but extra click to pick. | |

**User's choice:** Inline в form.

### Q2 — Runner drill-down migration

| Option | Description | Selected |
|--------|-------------|----------|
| Перевести на общий компонент | Runner uses the same navigator in file-only mode; search in runtime too. | ✓ |
| Оставить текущую реализацию, добавить поиск отдельно | Less diff but two code paths — divergence risk. | |

**User's choice:** Перевести на общий компонент.

### Q3 — FolderPickerModal + SnippetEditorModal «Папка»

| Option | Description | Selected |
|--------|-------------|----------|
| Оба на новый navigator (folder-only) | Full SC 2 coverage — every call-site uses one component. | ✓ |
| Только Node Editor + Runner в Phase 51 | Narrower scope; SC 2 reading literally only. | |
| Полумеры: SnippetEditorModal да, FolderPickerModal нет | Partial migration. | |

**User's choice:** Оба на новый navigator (folder-only).

### Q4 — Component module location

| Option | Description | Selected |
|--------|-------------|----------|
| `src/views/snippet-tree-picker.ts` (новый) | Clean separation, mockable in tests, accepts `mode` option. | ✓ |
| Вытащить из `runner-view.ts` существующий `renderSnippetPicker` | Less abstraction but `runner-view.ts` is already large. | |

**User's choice:** `src/views/snippet-tree-picker.ts` (new module).

---

## Tree-wide search semantics (D-09..D-12)

### Q1 — What the search matches

| Option | Description | Selected |
|--------|-------------|----------|
| И snippets, и папки | Both, filtered by picker `mode`. | ✓ |
| Только snippets | Folders reachable only via drill. | |

**User's choice:** И snippets, и папки.

### Q2 — Matching algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive substring | `includes()` — matches existing `FolderPickerModal`. | ✓ |
| Fuzzy (`prepareFuzzySearch`) | Score + highlight; overkill at v1.8 scale. | |

**User's choice:** Case-insensitive substring.

### Q3 — Result row layout

| Option | Description | Selected |
|--------|-------------|----------|
| Name + muted secondary full relative path | Disambiguates duplicate filenames. | ✓ |
| Только имя файла/папки | Shorter but cannot distinguish duplicates. | |

**User's choice:** Name + muted secondary full relative path.

### Q4 — Click behaviour and clear-search

| Option | Description | Selected |
|--------|-------------|----------|
| Click на file = select; click на folder = drill; clear = return to drill-path | Natural split between select vs navigate; search as transient overlay. | ✓ |
| Click = always select; clear = root | Uniform click but folder cannot be drilled from search. | |

**User's choice:** Click на file = select; click на folder = drill; clear = return to drill-path.

---

## Auto-insert semantics (D-13..D-16)

### Q1 — «Sole option at the current step» trigger scope

| Option | Description | Selected |
|--------|-------------|----------|
| Только Question с единственным исходом на specific-snippet node | Narrow, predictable trigger. | ✓ |
| Также linear chain (Answer/Start → Snippet) | Broader auto, less predictable. | |
| Везде, где degree=1 | Maximum auto. Breaks directory-bound UX. | |

**User's choice:** Только Question с единственным исходом на specific-snippet node.

### Q2 — Runner-state for auto-insert

| Option | Description | Selected |
|--------|-------------|----------|
| Перейти сразу в `awaiting-snippet-fill` | Reuses existing state arm; placeholder modal path identical to click. | ✓ |
| Новый runner-status `auto-inserting-snippet` | Transient state with loading label. Unclear win. | |

**User's choice:** Перейти сразу в `awaiting-snippet-fill`.

### Q3 — Step-back after auto-insert

| Option | Description | Selected |
|--------|-------------|----------|
| Step-back откатывает на предыдущий decision-point | Consistent with `pickSnippet` undo. | ✓ |
| Auto-insert не пушит undo (transparent) | Less predictable; skips user placeholder input on step-back. | |

**User's choice:** Step-back откатывает на предыдущий decision-point.

### Q4 — Sibling caption for specific-bound Snippet

| Option | Description | Selected |
|--------|-------------|----------|
| `snippetLabel` → basename без расширения → `📄 Snippet` | Document emoji distinguishes from directory binding. | ✓ |
| `snippetLabel` → `📁 Snippet` (as directory binding) | Same as today, no extra info. | |

**User's choice:** `snippetLabel` → basename без расширения → `📄 Snippet`.

---

## Claude's Discretion

- Exact Russian wording for the D-04 missing-file validation error (planner decides during PLAN.md).
- Internal shape of `SnippetTreePicker` (class vs factory, internal state machine).
- Whether `snippetService` needs a new flat-listing helper for search.
- Inline picker max-height CSS tuning in the editor panel.
- Whether sibling-button rendering for specific-bound snippets reuses `.rp-snippet-branch-btn` or adds a modifier class.

## Deferred Ideas

- Multi-select in pickers.
- Persisted drill-state across picker re-opens.
- Fuzzy search.
- Automatic migration of legacy directory-bound canvases.
- Dedicated Runner UI for mixed specific-bound + directory-bound Snippet siblings (flagged Out-of-Scope in REQUIREMENTS.md).
- New `snippetService.listAllEntries()` flat API (only if planner decides it's needed).
