# RadiProtocol Architecture Notes

This document promotes implementation-relevant design notes out of the local `.planning/` directory.

`.planning/` is a gitignored local GSD workspace. Source files must not point to it as a required design reference, because contributors and CI clones do not receive it. If a note is needed to understand source code, summarize it here or in an ADR under `docs/adr/`.

## Snippet node binding and picker

Snippet nodes can be bound either to a concrete snippet file or to a snippet directory:

- File-bound snippet nodes carry `radiprotocol_snippetPath` and bypass the picker. The runner goes directly to snippet fill/insert handling.
- Directory-bound snippet nodes carry `radiprotocol_snippetFolderPath` or no concrete file path. The runner opens the snippet tree picker rooted at the configured directory.
- UI components should preserve this distinction consistently in editor forms, snippet manager actions, graph parsing, validation, and tests.
- Shared Pattern H: user-visible snippet binding controls should present folder/file choices through Obsidian-native picker UI, not manual raw-path editing where avoidable.

## Answer label and edge sync

Answer node text and incoming edge labels must stay synchronized without corrupting user edits:

- Canvas edge labels can mirror answer node labels to keep the visual graph readable.
- Reconciliation logic should be pure where possible, then applied through a service/live-editor boundary.
- Open editor forms must not overwrite the field currently being edited by the user. If an inbound canvas update targets a focused field, stash/defer it rather than clobbering the input.
- Use re-entrancy guards (`queueMicrotask` where needed) around live canvas/editor synchronization to avoid cascading renders inside the same event stack.

## Loop node exit edge convention

RadiProtocol uses the unified `loop` node model. Legacy `loop-start`/`loop-end` nodes are retained only for migration diagnostics and graceful rejection.

Loop exit semantics:

- Exit edges are identified by a `+`-prefixed label.
- Non-exit edges are loop-body branches.
- The runner presents body branches and exit branches together at the loop picker.
- Returning from a body branch increments the active loop frame iteration exactly once before showing the picker again.

## Donate wallet constants

Donate wallet addresses are intentionally hard-coded constants used by Settings → Donate UI and covered by literal tests. If a wallet address changes, update both `src/donate/wallets.ts` and the corresponding tests in `src/__tests__/donate/wallets.test.ts`.
