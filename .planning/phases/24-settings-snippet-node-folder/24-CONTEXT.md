# Phase 24: Settings — Snippet Node Folder — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a single text field `snippetNodeFolderPath` to the plugin Settings tab. This is the global vault-relative folder path the snippet node file picker (Phase 25) will scope to when no per-node override is set.

This phase does NOT implement the file picker, the snippet node button, or the "no folder configured" notice — those belong to Phase 25.

</domain>

<decisions>
## Implementation Decisions

### Settings Field
- **D-01:** Add `snippetNodeFolderPath: string` to `RadiProtocolSettings` interface and `DEFAULT_SETTINGS` (default: `''` — empty string means not configured).
- **D-02:** Place the field in the **Storage** group (Group 5) in `RadiProtocolSettingsTab.display()`, alongside `snippetFolderPath` and `sessionFolderPath`.
- **D-03:** Label: **"Default snippet files folder"**. Description should convey that this is the global fallback folder the file picker scopes to, and that per-node overrides take precedence.
- **D-04:** Placeholder text: `e.g. Templates` (consistent with `protocolFolderPath` pattern: `e.g. Protocols`).
- **D-05:** onChange: `value.trim()` — store trimmed value, allow empty string (empty = not configured, no default fallback path unlike `snippetFolderPath`).

### Notice Behavior
- **D-06:** Phase 24 adds **only the setting field**. The "configuration notice is shown when a snippet node button is pressed without a folder configured" behavior is **Phase 25's responsibility** — it owns the button and its press handler. Phase 24 success criterion 2 is satisfied by Phase 25 reading `settings.snippetNodeFolderPath` and showing a notice if empty.

### Claude's Discretion
- Exact description text for the Setting field (tone and wording, consistent with existing descriptions in `settings.ts`).
- Whether to add a test in `settings-tab.test.ts` for the new field (if the test file already covers other fields with a similar pattern, add one; otherwise skip).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 24 goal and success criteria

### Source files to modify
- `src/settings.ts` — `RadiProtocolSettings` interface (add `snippetNodeFolderPath: string`); `DEFAULT_SETTINGS` (add `snippetNodeFolderPath: ''`); `RadiProtocolSettingsTab.display()` (add Setting in Storage group)

### Prior phase context
- `.planning/phases/22-snippet-node-graph-and-runner-layer/22-CONTEXT.md` — D-01: per-node `folderPath` overrides global `snippetNodeFolderPath`; Phase 25 applies resolution logic

### Tests
- `src/__tests__/settings-tab.test.ts` — check if existing pattern covers new field; add test if applicable
</canonical_refs>
