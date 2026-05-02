# Phase 83 Plan — RunnerView SessionRecoveryCoordinator Extraction

## Objective
Extract session-recovery behavioural surface from `src/views/runner-view.ts` into a dedicated coordinator module, reducing the view to host-only responsibilities.

## Scope
1. **Autosave/append-policy** — `autoSaveSession()` and all its call sites (SESSION-01).
2. **Resume prompt** — SESSION-02/03/04/06 logic inside `openCanvas()` that checks for an existing incomplete session, validates node IDs, compares canvas mtime, and presents `ResumeSessionModal`.
3. **Canvas-modification-warning** — SESSION-04 mtime check (part of the resume flow).

## Out of scope
- Canvas-switching logic (`handleSelectorSelect`, `handleClose`, `restartCanvas`).
- Snippet picker/fill logic (`mountSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`).
- Shared renderer delegation (`render`, `renderPreviewZone`, `renderOutputToolbar`, `renderError`).

## Deliverables
1. `src/runner/session-recovery-coordinator.ts` — `SessionRecoveryCoordinator` class.
2. Refactored `src/views/runner-view.ts` — delegates session recovery to the coordinator.

## Design

### `SessionRecoveryCoordinator`
```typescript
class SessionRecoveryCoordinator {
  constructor(private plugin: RadiProtocolPlugin) {}

  /**
   * Checks for a persisted session, validates it, and either:
   * - restores the runner ('resume')
   * - clears the stale session and signals 'start-over'
   * - returns 'error' with messages if the session is corrupt.
   */
  async resolveSession(
    filePath: string,
    graph: ProtocolGraph,
    file: TFile,
    runner: ProtocolRunner,
  ): Promise<{ action: 'resume' | 'start-over' | 'error'; messages?: string[] }>;

  /**
   * Fire-and-forget session autosave.
   */
  async autoSave(
    canvasFilePath: string | null,
    runner: ProtocolRunner,
  ): Promise<void>;
}
```

### `RunnerView` changes
- Add private field `sessionCoordinator: SessionRecoveryCoordinator`, initialised in the constructor.
- Replace the ~45-line session block in `openCanvas()` with a single call to `this.sessionCoordinator.resolveSession(...)`.
- Replace `autoSaveSession()` body with a single delegation call.
- Remove imports of `ResumeSessionModal`, `PersistedSession`, and `validateSessionNodeIds` from `runner-view.ts` (moved to the coordinator).

## Expected line-count impact
- Remove ~70 LOC from `runner-view.ts` (session block + autoSave + imports).
- Current: 925 LOC. After extraction: ~855 LOC.
- ROADMAP target <700 LOC is a *soft* budget; the coordinator extraction alone will not reach it. Further decomposition (snippet-picker surface, canvas-switching surface) is deferred to future milestones. Phase 83 satisfies the stated behavioural extraction requirement.

## Verification
- `npm run build` exits 0.
- `npm test` exits 0 (847 tests).
- `npm run lint` exits 0 (0 errors).
- No behavioural changes to autosave timing, resume conditions, or canvas-modification warnings.
