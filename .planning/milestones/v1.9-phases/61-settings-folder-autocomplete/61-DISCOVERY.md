# Phase 61 Discovery — Settings Folder Autocomplete

## Discovery Level

Level 1 — quick verification. This phase uses the existing `obsidian` dependency and known settings-tab patterns; no new external dependency is required.

## Verified Obsidian API

- `AbstractInputSuggest<T>` attaches type-ahead support to an `HTMLInputElement` or contenteditable div.
- Constructor: `new AbstractInputSuggest(app, textInputEl)`.
- Subclasses implement protected `getSuggestions(query): T[] | Promise<T[]>` and `renderSuggestion(value, el)`.
- Selection is handled via `selectSuggestion(value, evt)` override or `onSelect(callback)`.
- `Vault.getAllFolders(includeRoot?: boolean): TFolder[]` is available in Obsidian 1.12.3, so folder enumeration does not need adapter crawling.
- `TFolder.path` is the vault-relative folder path and is the correct persisted value for settings fields.

## Existing Project Patterns

- Settings fields live in `src/settings.ts` inside `RadiProtocolSettingsTab.display()`.
- All three in-scope fields are existing `Setting.addText(...)` controls:
  - `protocolFolderPath`
  - `outputFolderPath`
  - `snippetFolderPath`
- `sessionFolderPath` is also a path-like setting but is explicitly not in v1.9 scope; do not attach autocomplete there.
- Existing tests for settings are light (`src/__tests__/settings-tab.test.ts`), so Phase 61 should strengthen the Obsidian mock enough to test `AbstractInputSuggest` construction and text-component wiring.

## Implementation Guidance

- Create a reusable `FolderSuggest` in `src/views/folder-suggest.ts`.
- Use `AbstractInputSuggest<string>`, not `SuggestModal` and not custom popup DOM.
- Use `app.vault.getAllFolders(false)` where available, map to `.path`, exclude empty/root path, sort alphabetically, and filter case-insensitive by substring. Prefix matches naturally pass because they are substrings.
- `renderSuggestion()` must use `el.createEl(...)`/Obsidian helpers; no `innerHTML`.
- On selection, call `this.setValue(folder)` and dispatch a real `input` event so the existing `TextComponent.onChange(...)` save-on-change path persists the selected folder without duplicating save logic.

## Source Audit

SOURCE    | ID          | Feature/Requirement | Plan | Status | Notes
--------- | ----------- | ------------------- | ---- | ------ | -----
GOAL      | —           | Every settings path field (Protocols, Snippets, Output) renders Templater-style folder autocomplete via `AbstractInputSuggest` | 01-03 | COVERED | Goal from ROADMAP Phase 61
REQ       | SETTINGS-01 | All settings path fields render existing vault folder suggestions as user types | 00-03 | COVERED | Requirement from REQUIREMENTS.md
RESEARCH  | —           | Use `AbstractInputSuggest`, not custom DOM or `SuggestModal` | 01 | COVERED | Verified against Obsidian API
RESEARCH  | —           | Use a single reusable component | 01-02 | COVERED | `FolderSuggest` consumed by `settings.ts`
RESEARCH  | —           | Preserve existing save-on-change behavior | 02 | COVERED | Selection dispatches input/change path; typing remains existing onChange
CONTEXT   | state-v1.9  | Apply autocomplete to ALL path fields in settings (Protocols, Snippets, Output) | 02 | COVERED | Locked v1.9 decision in STATE.md
