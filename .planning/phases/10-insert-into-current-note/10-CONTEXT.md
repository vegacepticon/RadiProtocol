# Phase 10: Insert Into Current Note — Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an "Insert into current note" button to the runner's complete screen — a third output action alongside the existing "Copy to clipboard" and "Save to note" buttons.

When pressed, the generated protocol text is appended to the end of the currently active markdown note in the editor, separated by a `---` horizontal rule.

Scope includes:
- A new "Insert into note" button in the `RunnerView` complete-state UI
- Button is dynamically enabled/disabled based on whether a markdown note is currently active
- Append protocol text (with `---` separator) to end of active file via `vault.modify()`
- `workspace` event listener to keep button state in sync as the user switches between files

Out of scope: changes to `outputDestination` setting (untouched), live canvas editing (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Trigger: Manual Button
- **D-01:** "Insert into note" is a **manual button** in the runner complete-state UI — rendered alongside the existing "Copy to clipboard" and "Save to note" buttons. No changes to `outputDestination` setting or its enum values.
- **D-02:** `outputDestination` union type (`'clipboard' | 'new-note' | 'both'`) remains unchanged. The new button is always visible regardless of the setting.

### Insert Position
- **D-03:** Text is **appended to the end** of the active file. Format: `\n\n---\n\n{protocolText}` (two newlines before the separator, two after, then the text). Uses `vault.read()` + `vault.modify()` — same pattern as session and snippet writes, with `WriteMutex` per file path.
- **D-04:** No cursor-position insertion. The runner is a sidebar and the cursor in the editor may be in a different state. Append-to-end is simple and predictable.

### Button State: Enabled/Disabled
- **D-05:** The button is **dynamically disabled** when no active markdown note is open. A disabled button requires no Notice — the visual state communicates the reason.
- **D-06:** "Active markdown note" means: `app.workspace.getActiveViewOfType(MarkdownView)` returns a non-null value with a `file` property.
- **D-07:** Use `this.registerEvent(app.workspace.on('active-leaf-change', ...))` to update the button's disabled state whenever the active leaf changes.
- **D-08:** Button state is evaluated once when the complete-state renders, then kept in sync via the `active-leaf-change` listener.

### Claude's Discretion
- Exact button label text (e.g., "Insert into note" vs "Append to note").
- Whether to show a brief Notice ("Inserted into [filename].") on success.
- Exact CSS class names for the new button.
- Whether the `---` separator is omitted if the file is empty (append without separator).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Change Files
- `src/views/runner-view.ts` — complete-state render block (lines ~485–530): add the new button here. The existing "Copy to clipboard" button (~line 493) and "Save to note" button (~line 513) are the reference patterns.
- `src/main.ts` — `saveOutputToNote()` method (~line 203): reference for vault write pattern. A new parallel method `insertIntoCurrentNote(text)` will be added here.

### Supporting Files
- `src/settings.ts` — **not changed** in this phase. `outputDestination` enum stays as-is.

### Patterns to Follow
- `WriteMutex` (async-mutex) on `vault.modify()` — see `src/sessions/session-service.ts` and `src/snippets/snippet-service.ts` for the per-file mutex pattern.
- `this.registerEvent()` for workspace events — see Phase 9 implementation in `src/views/runner-view.ts` for the `vault.on('create'/'delete'/'rename')` pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Complete-state button pattern in `runner-view.ts` (~line 493): `createEl('button', { text: 'Copy to clipboard' })` + `this.registerDomEvent(btn, 'click', ...)`. New button follows the same DOM API pattern.
- `app.workspace.getActiveViewOfType(MarkdownView)` — the standard Obsidian API to get the currently active markdown editor.
- `vault.read(file)` + `vault.modify(file, newContent)` — correct pattern for read-modify-write on existing files.
- `WriteMutex` already used in snippet and session services — import and apply same pattern.

### Integration Points
- `RunnerView` complete-state render block in `runner-view.ts` → add third button
- `RadiProtocolPlugin` in `main.ts` → add `insertIntoCurrentNote(text: string): Promise<void>` method
- `app.workspace.on('active-leaf-change', ...)` via `this.registerEvent()` in `RunnerView`

### No new npm dependencies required

</code_context>
