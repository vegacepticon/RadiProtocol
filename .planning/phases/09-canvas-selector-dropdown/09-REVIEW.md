---
phase: 09-canvas-selector-dropdown
reviewed: 2026-04-07T18:35:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/settings.ts
  - src/views/canvas-selector-widget.ts
  - src/views/canvas-switch-modal.ts
  - src/views/runner-view.ts
  - src/styles.css
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-07T18:35:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed covering the canvas selector dropdown feature (SELECTOR-01 through SELECTOR-03). The new `CanvasSelectorWidget`, `CanvasSwitchModal`, settings additions, and runner-view integration are well-structured. The modal double-resolve guard is solid, the drill-down navigation logic is correct, and the mid-session confirmation flow is properly handled.

One critical build-chain defect was found: the Phase 9 CSS lives entirely in `src/styles.css` but the build system only ships the root-level `styles.css` to Obsidian. All selector styles are unreachable at runtime. Three warnings cover a type-safety gap in canvas file reads, a missing stale-path update on canvas rename, and a duplicate CSS rule block. Three info items note dead code, a `console.debug` left in the build script, and a stub file that can be consolidated.

---

## Critical Issues

### CR-01: Phase 9 CSS is never deployed — all selector styles are dead at runtime

**File:** `src/styles.css:493-605`

**Issue:** The entire Phase 9 canvas selector block (`.rp-selector-wrapper`, `.rp-selector-trigger`, `.rp-selector-popover`, `.rp-selector-row`, and all related rules) lives in `src/styles.css`. The esbuild pipeline only copies the root-level `styles.css` to the Obsidian plugin directory (see `esbuild.config.mjs:49-51`). There is no build step that merges or copies `src/styles.css` into the root. At runtime the trigger button, popover, rows, and chevron all render without any CSS — the selector will appear as an unstyled HTML dump.

**Fix:** Append the Phase 9 block from `src/styles.css` into the root `styles.css`, then remove the duplicate content from `src/styles.css`. The established pattern for this project is to maintain all shipped CSS in the root `styles.css`. Phases 3–8 all live there; only Phase 9 was mistakenly placed under `src/`.

```bash
# Quick consolidation (run from project root)
# 1. Append Phase 9 block to root styles.css
cat src/styles.css >> styles.css   # then manually trim the Phase 3–8 duplication from src/styles.css
# 2. Or simply move all content: root styles.css becomes the canonical file
```

The cleaner fix is to make `src/styles.css` empty (or delete it) and maintain only the root `styles.css`, consistent with Phases 3–8.

---

## Warnings

### WR-01: Unsafe `as TFile` cast — folder path stored as canvasFilePath causes silent read error

**File:** `src/views/runner-view.ts:65`

**Issue:** `this.app.vault.read(file as TFile)` casts `file` after only a `!== null` guard (line 58). `getAbstractFileByPath` returns `TAbstractFile`, which can be a `TFolder`. If a folder path is ever persisted as `canvasFilePath` (e.g. from a malformed state restore), the cast bypasses TypeScript's type system and `vault.read()` will throw. The catch block at line 67 handles the throw, so it is not a crash — but the error message says "Could not read canvas file" when the real cause is a wrong type, making diagnosis harder.

**Fix:** Add an `instanceof TFile` guard before the read, consistent with the check already used at line 104:

```typescript
// runner-view.ts line 63
const file = this.app.vault.getAbstractFileByPath(filePath);
if (!(file instanceof TFile)) {
  this.renderError([`Canvas file not found: "${filePath}".`]);
  return;
}

let content: string;
try {
  content = await this.app.vault.read(file); // no cast needed
} catch {
  ...
}
```

---

### WR-02: Vault `rename` event does not update `canvasFilePath` — active session goes stale

**File:** `src/views/runner-view.ts:168-174`

**Issue:** When the active `.canvas` file is renamed while a session is in-progress, the `rename` listener (line 169) only calls `this.selector?.rebuildIfOpen()` to refresh the popover list. It does not update `this.canvasFilePath` to the new path. Subsequent calls to `autoSaveSession` (line 450-471) use the old path, causing `getAbstractFileByPath` (line 455) to return `null` and silently record `mtime = 0`. On next open, the session file is associated with the old (non-existent) path and will never be found.

**Fix:** Update `canvasFilePath` (and the selector label) when the renamed file matches the current path. The Obsidian `rename` event passes `(file: TAbstractFile, oldPath: string)`:

```typescript
// runner-view.ts — update the rename handler
this.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => {
    if (file instanceof TFile && file.extension === 'canvas') {
      this.selector?.rebuildIfOpen();
      // Update active canvas path if the renamed file was the active one
      if (oldPath === this.canvasFilePath) {
        this.canvasFilePath = file.path;
        this.selector?.setSelectedPath(file.path);
      }
    }
  })
);
```

---

### WR-03: Duplicate CSS rule blocks for `.rp-snippet-preview-label` and `.rp-snippet-preview`

**File:** `src/styles.css:394-411` and `src/styles.css:426-445`

**Issue:** `.rp-snippet-preview-label` is defined at lines 394-398 and again at lines 426-431. `.rp-snippet-preview` is defined at lines 400-412 and again at lines 433-445. The second declarations have differing property values (`padding: var(--size-4-2)` vs `padding: var(--size-4-1)`, plus `margin-bottom` added in the second block). The second block wins by cascade order, making the first declarations dead code that creates confusion about which values are actually applied.

**Fix:** Remove the first (lines 394-412) declarations and keep only the second (lines 426-445), which are more complete. Alternatively, if the first block is intentionally distinct, give them separate selectors or consolidate into one rule per selector:

```css
/* Keep only this block — remove lines 394-412 */
.rp-snippet-preview-label {
  font-size: var(--font-smaller);
  font-weight: var(--font-semibold);
  line-height: 1.4;
  margin-bottom: var(--size-2-1);
}

.rp-snippet-preview {
  width: 100%;
  resize: none;
  font-family: var(--font-monospace);
  font-size: var(--font-text-size);
  font-weight: var(--font-normal);
  line-height: 1.5;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  padding: var(--size-4-2);
  box-sizing: border-box;
  min-height: 80px;
}
```

---

## Info

### IN-01: `??` fallback in `updateTriggerLabel` is unreachable dead code

**File:** `src/views/canvas-selector-widget.ts:74`

**Issue:** `const filename = parts[parts.length - 1] ?? this.selectedFilePath;` — `String.prototype.split` always returns an array with at least one element, so `parts[parts.length - 1]` is never `undefined`. The `?? this.selectedFilePath` branch is dead code. It also introduces a type widening issue: `filename` is inferred as `string | null` because `selectedFilePath` is `string | null`, but then `filename` is passed to `.replace()` on the next line. TypeScript allows this only because the null path is unreachable.

**Fix:** Remove the fallback:

```typescript
const filename = parts[parts.length - 1];  // always defined
labelEl.setText(filename.replace(/\.canvas$/, ''));
```

---

### IN-02: `console.debug` left in production build path in `esbuild.config.mjs`

**File:** `esbuild.config.mjs:52`

**Issue:** `console.debug(`[radiprotocol] Copied to dev vault: ${pluginDir}`)` runs every time a dev build succeeds. This is not a production bug (dev-only path), but `console.debug` is typically suppressed in browser devtools by default, making it invisible unless verbose logging is enabled. Using `console.log` would be more consistent if the message is intended to be visible; or it can remain `console.debug` if intentionally low-visibility. Not a blocking issue, but the inconsistency with `console.error` on the failure path (line 54) is worth noting.

**Fix:** Either promote to `console.log` for visibility, or leave as-is and document the intent. No code change required if the current behavior is acceptable.

---

### IN-03: Root `styles.css` is a stale Phase 3 stub — misleading for contributors

**File:** `styles.css:1`

**Issue:** The root `styles.css` contains only `/* RadiProtocol styles — Phase 3 will populate this file */`. All actual styles are in `src/styles.css` (Phases 3–9). The root file is the one the build deploys, but it is empty. This is directly related to CR-01 — once CR-01 is resolved by moving all CSS to the root file, this stub comment should be replaced with real content or removed.

**Fix:** After resolving CR-01, the root `styles.css` becomes the canonical file and this comment is naturally replaced. No separate action needed beyond the CR-01 fix.

---

_Reviewed: 2026-04-07T18:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
