# Phase 15: Text Separator Setting - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users control how the protocol runner joins node output text. A global default is set in the Settings tab; individual nodes can override it in the EditorPanel. No other capabilities are in scope.

</domain>

<decisions>
## Implementation Decisions

### Separator Application Mechanics
- **D-01:** Separator is inserted **before** each new text chunk, **except when the buffer is empty** (first append in a session). Pattern: `if buffer non-empty → prepend separator; then append text`.
- **D-02:** For `free-text-input` nodes the separator precedes the **entire** assembled chunk: `separator + prefix + text + suffix` (separator is not inserted between prefix and text).
- **D-03:** `completeSnippet` (snippet text-block) participates in separator logic like any `text-block` — separator applied before the rendered snippet text.

### Priority: Per-Node Override vs Global
- **D-04:** Per-node separator (stored in canvas JSON as a new `radiprotocol_separator` property) takes priority. If the node has no override, the global setting is used. Runner resolves: node property → global setting.

### Per-Node EditorPanel Field
- **D-05:** Separator override is shown only on node kinds that produce text: `answer`, `free-text-input`, `text-block`. Nodes `start`, `question`, `loop-start`, `loop-end` do NOT get this field.
- **D-06:** Dropdown uses `addDropdown` (Obsidian `Setting` API). Options: **"Use global"** / **"Newline"** / **"Space"**. "Use global" is the default selection — absence of a per-node property in canvas JSON is identical in effect to "Use global".

### Settings Tab
- **D-07:** A dedicated **Runner** section (using `Setting.setHeading()`) is added to the Settings tab, containing `maxLoopIterations` and the new `textSeparator` setting.
- **D-08:** `textSeparator` control uses `addDropdown` with options **"Newline"** (default) and **"Space"**. Stored as `'newline' | 'space'` in `RadiProtocolSettings`.

### Claude's Discretion
- Exact property name for per-node canvas storage: `radiprotocol_separator` (follows existing `radiprotocol_*` namespace — no user input needed).
- How the runner receives the separator value: passed through `ProtocolRunnerOptions` or resolved externally by the caller (e.g., `RunnerView`) before each append — planner decides the cleanest approach.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Core source files to read before planning
- `src/settings.ts` — current `RadiProtocolSettings` interface and `RadiProtocolSettingsTab`; add `textSeparator` field and Runner section here
- `src/views/editor-panel-view.ts` — `buildKindForm()` switch statement; add separator dropdown to `answer`, `free-text-input`, `text-block` cases
- `src/runner/protocol-runner.ts` — all `accumulator.append()` call sites (lines ~87, ~125, ~165, ~433, ~452); separator logic wraps these
- `src/runner/text-accumulator.ts` — pure append buffer; may need an `appendWithSeparator(text, separator)` helper or separator resolved by caller
- `src/graph/graph-model.ts` — node interfaces; `radiprotocol_separator` property needs to be added to `AnswerNode`, `FreeTextInputNode`, `TextBlockNode`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Setting.addDropdown()` — already used in EditorPanel for node type selector; same pattern for separator dropdown
- `Setting.setHeading()` — use to create the new "Runner" section in settings tab (satisfies no-manual-html-headings lint rule)
- `TextAccumulator.append(text)` — 5 call sites in `protocol-runner.ts`; all need separator-aware wrapping

### Established Patterns
- All `radiprotocol_*` canvas properties follow the existing namespace convention — no collisions
- Settings stored via `this.plugin.loadData()` / `saveData()` with defaults merged on load
- No `innerHTML` — DOM only via `createEl`, Obsidian `Setting` API

### Integration Points
- `ProtocolRunner` is pure (no Obsidian imports) — separator value must be injected from outside (via constructor option or per-call parameter) so unit tests remain clean
- `RunnerView` (`src/views/runner-view.ts`) drives `ProtocolRunner` and has access to plugin settings — natural place to resolve global separator and pass it down
- `EditorPanelView.buildKindForm()` writes pending edits to `pendingEdits[key]` and flushes on save — separator dropdown follows same write-back pattern

</code_context>

<specifics>
## Specific Ideas

No specific UI references — open to standard Obsidian plugin patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-text-separator-setting*
*Context gathered: 2026-04-09*
