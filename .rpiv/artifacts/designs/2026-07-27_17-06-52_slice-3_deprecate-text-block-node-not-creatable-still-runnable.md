---
date: 2026-07-27T17:06:52+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Deprecate text-block node (not creatable, still runnable)"
source: .rpiv/artifacts/slices/2026-07-27_16-38-57_runner-cleanup-nodes-snippets-modal-ux.md
slice_n: 3
slice_title: "Deprecate text-block node (not creatable, still runnable)"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 3: Deprecate text-block node (not creatable, still runnable)

## Approach

Apply the "not creatable, still runnable" strategy decided in research (Q/A line 257) and ratified by the slice map: keep every read/run path for `'text-block'` intact so existing `.rp.json` files continue to parse, render, edit, and run — including `snippetId`-bearing text-blocks whose `AWAITING_SNIPPET_FILL` transition is the one behavior `AnswerNode` cannot replace (`src/runner/protocol-runner.ts:711-724`). The deprecation is confined to the **creation** surface only.

The single mechanism is the `EDITABLE_NODE_KINDS` array (`src/views/protocol-editor-view.ts:256`), which feeds exactly two call sites — `openNodeKindPickerAtWorldPoint` (`:769-784`) and `openNodeKindPickerAndConnectAtWorldPoint` (`:819-824`). Both iterate `for (const kind of EDITABLE_NODE_KINDS)` and render one choice button per kind (`protocolEditor.nodeKind.${kind}`). Removing `'text-block'` from the array therefore removes the "Text block" button from both pickers with no further code change — the loop sites are data-driven by the array, so there is no `case 'text-block'` to delete, no branch to forget, no parallel list to keep in sync.

Everything that makes existing text-blocks still runnable is deliberately **left untouched**, per the slice's `Draws on` inventory and `Out of scope`:
- `'text-block'` stays in `RPNodeKind` (`src/graph/graph-model.ts:13`) and `TextBlockNode` stays in the `RPNode` union (`:119`) — removing it would cascade across model/parser/validator/runner/color-map/picker (explicitly out of scope).
- `VALID_KINDS` retains `'text-block'` and the parser `case 'text-block'` arm is unchanged (`src/protocol/protocol-document-parser.ts:31,210-218`) — existing protocols still parse.
- The runner `case 'text-block'` arm is unchanged (`src/runner/protocol-runner.ts:711-724`) — static `content` auto-append and `snippetId`→`AWAITING_SNIPPET_FILL` both still fire.
- `nodeLabel`'s `case 'text-block'` is unchanged (`src/graph/node-label.ts:23`) — validator error wording and runner captions stay in lock-step.
- `NODE_KIND_DEFAULTS['text-block']` is retained (`src/views/protocol-editor-view.ts:251`) — `defaultColorForProtocolEditorNodeKind` / `fieldsForProtocolEditorNodeKind` lookups stay compile-clean and remain available for any legacy display path.
- `GraphValidator` is unchanged — text-block-bearing protocols still validate (the slice explicitly adopts the softer variant, *not* the loop-start/loop-end migration-error precedent, per `Out of scope`).

This is the canonical "not creatable" pattern already established for `loop-start`/`loop-end` (research line 183), applied in its softer form: kind stays in `RPNodeKind` for parse/run, removed only from the editor creation dropdown.

### Open design question settled from inputs: keep text-blocks in the "Start from specific node" picker

The slice map flags as open whether `node-picker-modal.ts` should also stop surfacing text-blocks. The inputs converge on **keeping them**, so no `ask_user_question` is warranted:

1. The slice scope says remove `'text-block'` **only** from `EDITABLE_NODE_KINDS` — the word "only" bounds the change to the creation surface.
2. The mandate is "still runnable"; a runnable node is by definition a valid start point. `snippetId`-bearing text-blocks are specifically called out as needing to keep working — starting from such a node is a legitimate use of that contract.
3. The slice deliberately picks the *softer* deprecation variant (out of scope: validator rejection, full removal from `RPNodeKind`); dropping text-blocks from the start-picker would be a harder deprecation than the slice chose.
4. The start-picker is a **run** entry, not a creation entry; it already includes `start`, `answer`, and `text-block` despite legacy comments saying some are excluded — the implementation is authoritative and intentionally inclusive of runnable kinds (research line 74).

The decision is recorded in `## Notes / Deferred` for the grade panel and for a hypothetical follow-up that wants the harder deprecation.

## File Map

- `src/views/protocol-editor-view.ts` — change — remove the `'text-block'` entry from the `EDITABLE_NODE_KINDS` array literal at line 256 (5 kinds remain: `['start', 'question', 'answer', 'loop', 'snippet']`). No other edit in this file: the two picker loops at `:769` and `:819` are array-driven and need no change; `NODE_KIND_DEFAULTS['text-block']` at `:251` is intentionally retained.

## Key Interfaces

No new types or exports. The touched surface is a single module-private constant:

```ts
// src/views/protocol-editor-view.ts — module-private, not exported (unchanged type, one fewer element)
const EDITABLE_NODE_KINDS: RPNodeKind[] = ['start', 'question', 'answer', 'loop', 'snippet'];
```

`RPNodeKind`, `TextBlockNode`, the parser `case 'text-block'`, the runner `case 'text-block'` arm, `nodeLabel`'s `case 'text-block'`, and `NODE_KIND_DEFAULTS['text-block']` are all **unchanged** — they remain the contract that existing protocols rely on.

## Integration Points

- `src/views/protocol-editor-view.ts:256` — `EDITABLE_NODE_KINDS` loses its `'text-block'` element; this is the sole edit of the slice.
- `src/views/protocol-editor-view.ts:769` — `openNodeKindPickerAtWorldPoint`'s `for (const kind of EDITABLE_NODE_KINDS)` loop now renders 5 choice buttons (no "Text block" button); no code change at the loop site itself (data-driven).
- `src/views/protocol-editor-view.ts:819` — `openNodeKindPickerAndConnectAtWorldPoint`'s loop likewise renders 5 buttons; no code change at the site.
- `src/views/node-picker-modal.ts:9,56-63,92-106` — **unchanged**; `StartableNodeKind`/`KIND_LABELS`/`KIND_ORDER`/`buildNodeOptions` keep listing text-blocks (deliberate, see Approach). Sibling slices: none — `depends_on: []`.

## Success Criteria

- [ ] `EDITABLE_NODE_KINDS` no longer contains `'text-block'` — `openNodeKindPickerAtWorldPoint` renders exactly 5 choice buttons (Start, Question, Answer, Loop, Snippet) and no "Text block" button.
- [ ] `openNodeKindPickerAndConnectAtWorldPoint` (the connect-from-node variant) likewise renders exactly 5 choice buttons and no "Text block" button.
- [ ] Existing `.rp.json` protocols containing text-block nodes still parse — `VALID_KINDS` retains `'text-block'` and the parser `case 'text-block'` arm is unchanged (verified by `__tests__/protocol-document-parser.test.ts` "parses text-block node with content" still passing).
- [ ] Existing text-block nodes still run: the runner `case 'text-block'` arm is unchanged — static `content` auto-appends and follows the first neighbor; a `snippetId`-bearing text-block still transitions to `AWAITING_SNIPPET_FILL` with `snippetId`/`snippetNodeId` set.
- [ ] `nodeLabel` still returns a label for text-block nodes (validator error UX and runner captions unaffected).
- [ ] `NODE_KIND_DEFAULTS['text-block']` retained — `defaultColorForProtocolEditorNodeKind('text-block')` / `fieldsForProtocolEditorNodeKind('text-block')` still resolve without compile error.
- [ ] The "Start from specific node" picker still lists existing text-block nodes — `buildNodeOptions` text-block arm and `StartableNodeKind` union unchanged (deliberate per Approach).
- [ ] `npm run build` (type-check + esbuild) passes — exhaustive `switch` on `RPNodeKind` in `nodeLabel`, the parser, and the runner all still see `'text-block'`, so narrowing stays exhaustive.
- [ ] `npm test` passes — existing parser/runner/node-picker/protocol-editor-helpers tests are unchanged and continue to exercise the retained text-block paths.

## Notes / Deferred

- **Settled assumption (no blocker):** text-blocks remain in the "Start from specific node" picker. The slice map marked this as an open question, but the slice scope ("remove `'text-block'` **only** from `EDITABLE_NODE_KINDS`"), the "still runnable" mandate, the deliberate softer-variant choice (out of scope: validator rejection), and the picker's authoritative inclusivity of runnable kinds all converge on keeping them. If a future slice wants the harder deprecation, it must edit `StartableNodeKind`, `KIND_LABEL_KEYS`, `KIND_LABELS`, `KIND_ORDER`, and the `buildNodeOptions` text-block arm in `src/views/node-picker-modal.ts`, and update `__tests__/node-picker-modal.test.ts` accordingly.
- **Orphaned i18n keys (deferred):** `protocolEditor.nodeKind.text-block` (`src/i18n/locales/en.json:97`, `ru.json:97`) and `protocolEditor.defaultNodeText.text-block` (`en.json:104`, `ru.json:104`) become runtime-dead after this slice — the only readers are the two picker loops (`protocol-editor-view.ts:772,822`) and the generic `defaultNodeText` lookup (`:681`), none of which will receive `'text-block'` anymore. They are **kept** to avoid touching i18n outside this slice's scope; a future cleanup slice may remove them. No compile impact (template-literal lookups).
- **No validator change (deferred):** text-block-bearing protocols still validate cleanly. The loop-start/loop-end migration-error precedent is explicitly out of scope; this slice uses the softer "not creatable, still runnable" variant.
- **No README change:** documenting the text-block deprecation in README is not in this slice's scope (README rewrite is Slice 2's remit, scoped to JSON-snippet/Canvas cleanup). A future docs slice may note text-block as deprecated-for-creation.