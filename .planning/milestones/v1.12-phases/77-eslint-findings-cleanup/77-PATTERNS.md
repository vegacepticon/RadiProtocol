# Phase 77: Eslint Findings Cleanup — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 11 source files + 5 CSS files + 1 config file = 17 surfaces
**Analogs found:** 16 / 17 (one net-new API: `setCssProps` — zero existing usage)

---

## File Classification

| Surface | Role | Data Flow | Closest Analog | Match Quality |
|---------|------|-----------|----------------|---------------|
| `eslint.config.mjs` (D-01/D-02) | config | static (build-time) | self (existing `ignores` block + `files: ['src/**/*.ts']` block) | exact (insertion-point analog) |
| `src/views/snippet-fill-in-modal.ts:148-150` (composite class) | view (modal) | static state — initial render | `runner-view.ts:1053` `createEl(.., { cls: 'rp-preview-textarea' })` | exact |
| `src/views/snippet-chip-editor.ts:127,151,152,168,199,206,382` (display toggles) | view (sub-component) | static state toggle | `snippet-chip-editor.ts:288` `chip.toggleClass('is-expanded', ...)` (in-file precedent) | exact |
| `src/views/snippet-manager-view.ts:276,286,287,361,911,937` (display + spacer width) | view (list) | static state toggle | `runner-view.ts:229` `closeBtn.toggleClass('is-hidden', this.canvasFilePath === null)` | exact |
| `src/views/snippet-editor-modal.ts:146,199,200,217,218,374,375,518,525,637` (banner + locked state + max-width) | view (modal) | static state toggle | `snippet-editor-modal.ts:350` `this.folderUnsavedDotEl.toggleClass('is-visible', diff)` (in-file precedent) | exact |
| `src/views/runner-view.ts:1056,1059,1065` (textarea width + auto-grow) | view (sub-component) | runtime geometry (scrollHeight) | **NET-NEW: setCssProps** — Obsidian API `obsidian.d.ts:106`; zero existing call sites | first introduction |
| `src/views/editor-panel-view.ts:531,660` (auto-grow shared helper × 2) | view (helper fn) | runtime geometry (scrollHeight) | **NET-NEW: setCssProps** — same as above; identical Phase 64 pattern as runner-view | first introduction |
| `src/views/inline-runner-modal.ts:658,659,662,663,676` (clearing assignments in applyPosition/applyLayout) | view (modal) | static state toggle (clear-when-positioned) | `inline-runner.css:227-234` `.rp-inline-runner-container` (existing Phase 60/67 base class) | role-match |
| `src/styles/snippet-manager.css` (append) | CSS feature file | declarative rules | `snippet-manager.css:490` `/* Phase 52: validation banner for SnippetEditorModal (D-04) */` | exact |
| `src/styles/snippet-fill-modal.css` (append) | CSS feature file | declarative rules | `snippet-fill-modal.css:1` Phase 5 base; no later phases | exact (file pattern) |
| `src/styles/runner-view.css` (append, new `.rp-preview-textarea` rule) | CSS feature file | declarative rules with `var(--rp-x)` | `runner-view.css:322` `/* Phase 65: Runner footer Back/Skip row */` | exact (precedent for late-phase append) |
| `src/styles/editor-panel.css` (append, share `--rp-textarea-height` var) | CSS feature file | declarative rules with `var(--rp-x)` | `editor-panel.css:246` `/* Phase 64: growable Node Editor textareas */` | exact (Phase 64 own home) |
| `src/styles/inline-runner.css` (append `rp-inline-runner-applied-position` reset class) | CSS feature file | declarative rules | `inline-runner.css:226` `/* Phase 67: resizable inline runner */` | exact |
| `src/__tests__/views/inline-runner-modal*.test.ts` (`no-this-alias` × 3) | test (mock class) | sync constructor capture | (none — Pitfall 3 documents semantically-correct fix) | net-new fix pattern |
| `src/__tests__/views/snippet-editor-modal-banner.test.ts:304` (`no-floating-promises`) | test (lifecycle call) | fire-and-forget Promise | `main.ts:118` `() => { void this.activateRunnerView(); }` | exact |
| `src/__tests__/views/snippet-tree-picker.test.ts:979,996` (`sentence-case`) | test (UI fixture string) | text fixture | (none — direct string capitalization) | net-new (trivial) |
| `src/views/editor-panel-view.ts:284,381` + `inline-runner-modal.ts:599` (`no-tfile-tfolder-cast`) | view (vault read guard) | type narrowing | `main.ts:419` `if (!(file instanceof TFile)) { ... }` + `editor-panel-view.ts:400` (in-file precedent) | exact |
| `src/main.ts:246,255,264,277,296,316` (`no-floating-promises` × 6) | plugin lifecycle | fire-and-forget Promise | `main.ts:118-204` `void this.activateRunnerView()` (in-file precedent) | exact |
| `src/main.ts:517` (`no-this-alias` × 1) | plugin (closure capture) | sync method scope | (none — case-by-case rewrite to arrow or `this: T` param) | net-new fix pattern |
| `src/views/main.ts` / `settings.ts` / `editor-panel-view.ts` / `snippet-chip-editor.ts` (sentence-case × 26) | UI text | static strings | (none — direct string capitalization per `obsidianmd/ui/sentence-case` semantics) | net-new (trivial) |
| `src/views/node-picker-modal.ts:71` (`no-constant-binary-expression`) | view (picker) | code-quality fix | (none — drop unreachable `\|\| id`) | net-new (trivial) |
| `src/snippets/snippet-service.ts:488` (`no-control-regex`) | service (sanitization) | regex fix | (none — Pitfall 6: per-line `eslint-disable` with intentional-strip rationale) | net-new (per-line disable) |
| `src/snippets/snippet-service.ts:240,283` (`prefer-file-manager-trash-file` warn × 2) | service (vault op) | API choice | **NO ANALOG** — zero existing `app.fileManager.trashFile` call sites in src; Pitfall 5 says document as out-of-scope | no analog |
| `src/__tests__/.../inline-runner-modal.test.ts:290` (`ban-ts-comment`) | test (TS suppression) | comment swap | (none — `@ts-ignore` → `@ts-expect-error`) | net-new (trivial) |
| `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts:311` (`prefer-const`) | test | code-quality fix | (none — `let` → `const`) | net-new (trivial) |
| `src/__tests__/snippet-tree-dnd.test.ts:121` (`lastMenuItems` unused — bypasses D-02 underscore filter) | test | code-quality fix | CONVENTIONS.md §Naming Patterns `_underscore` convention | exact |
| `src/views/snippet-editor-modal.ts:143` (unused `eslint-disable` warn) | view | directive removal | (none — remove the directive line) | net-new (trivial) |

---

## Pattern Assignments

### 1. `eslint.config.mjs` — D-01 + D-02 config edits

**Role:** flat-config rule definition
**Data flow:** static (build-time)
**Analog:** the file itself — both insertion sites are inside the existing `tseslint.config(...)` array.

**Existing `ignores` block** (`eslint.config.mjs:82-92` — APPEND `.planning/**` here):
```javascript
// Ignore patterns
{
  ignores: [
    'node_modules/**',
    'main.js',
    'eslint.config.mjs',
    'esbuild.config.mjs',
    'version-bump.mjs',
    'vitest.config.ts',
  ],
}
```

**Existing per-file rule block** (`eslint.config.mjs:25-80` — INSERT new test override AFTER this block, BEFORE the `ignores` block, so flat-config last-match semantics let it win for the narrower glob):
```javascript
// Main source files config
{
  files: ['src/**/*.ts'],
  plugins: {
    obsidianmd,
  },
  rules: {
    // ... 23 obsidianmd rules + TS rules + general rules
  },
},
```

**Adaptation:** the new override block follows the same shape but with `files: ['src/__tests__/**/*.ts', 'src/__mocks__/**/*.ts']` and only the two relaxations (`no-explicit-any: 'off'`, `no-unused-vars` with `_`-pattern). Both D-01 and D-02 commit messages must include the rationale verbatim per ROADMAP SC#3.

---

### 2. `src/views/snippet-fill-in-modal.ts:148-150` — composite class (3 inline styles → 1 CSS class)

**Role:** view (modal sub-render)
**Data flow:** static state — initial DOM render
**Analog:** `src/views/runner-view.ts:1053`

**Pattern excerpt** (`runner-view.ts:1053`):
```typescript
const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
```

**Adaptation:** apply the same `createEl(..., { cls: 'rp-snippet-fill-option-row' })` shape to the row creation site at `snippet-fill-in-modal.ts:147`. The 3 `style.x = ...` lines collapse into a single CSS rule appended to `src/styles/snippet-fill-modal.css`.

---

### 3. `src/views/snippet-chip-editor.ts` — display/visibility toggles (7 sites at lines 127, 151, 152, 168, 199, 206, 382)

**Role:** view (chip sub-component)
**Data flow:** static state toggle (show/hide mini-form, expand/collapse)
**Analog:** **in-file precedent at `snippet-chip-editor.ts:288`**

**Pattern excerpt** (`snippet-chip-editor.ts:286-288`):
```typescript
chip.addEventListener('click', () => {
  if (chip.querySelector('input')) return;
  chip.toggleClass('is-expanded', !chip.hasClass('is-expanded'));
});
```

**Adaptation:** replace each `el.style.display = 'none'` / `el.style.display = 'flex'` with `el.toggleClass('rp-chip-{state}-hidden', boolean)`. Class names per D-05 (e.g. `rp-chip-form-hidden`, `rp-chip-row-flex`). Note the in-file precedent uses Obsidian's `is-expanded` core convention — but D-05 explicitly forbids `is-*` for new code (collision risk); use `rp-chip-*-hidden` instead.

---

### 4. `src/views/snippet-manager-view.ts:276,286,287,361,911,937` — display toggles + spacer width

**Role:** view (tree list)
**Data flow:** static state toggle (inline-rename label show/hide, spacer width)
**Analog:** `src/views/runner-view.ts:229,427`

**Pattern excerpt** (`runner-view.ts:229`):
```typescript
closeBtn.toggleClass('is-hidden', this.canvasFilePath === null);
```

**Pattern excerpt** (`runner-view.ts:427`):
```typescript
this.closeBtn?.toggleClass('is-hidden', this.canvasFilePath === null);
```

**Adaptation:** lines 911/937 use `style['display']` (computed property — eslint flags). Replace with `el.toggleClass('rp-snippet-tree-label-hidden', boolean)`. Line 287 (`'12px'` literal) → class `rp-snippet-tree-spacer` with `width: 12px;` rule. Line 275 (template literal `${depth * 16}px`) is NOT flagged — leave it alone per Pitfall 7.

---

### 5. `src/views/snippet-editor-modal.ts` — banner show/hide + locked state + max-width (10 sites)

**Role:** view (modal)
**Data flow:** static state toggle (validation banner, form locked-disabled, modal max-width)
**Analog:** **in-file precedent at `snippet-editor-modal.ts:350`**

**Pattern excerpt** (`snippet-editor-modal.ts:350`):
```typescript
this.folderUnsavedDotEl.toggleClass('is-visible', diff);
```

**Adaptation:** apply same `toggleClass(cls, bool)` shape:
- Banner show/hide (lines 199, 217 region) → `el.toggleClass('rp-snippet-banner-hidden', !visible)`. Pair with rule appended to `snippet-manager.css` (note: Phase 52 already has banner rules at line 490 — APPEND new hidden-state rule, do NOT edit existing rule, per CLAUDE.md).
- Locked-state `pointerEvents: 'none' + opacity: 0.5` (lines 518/525) → `el.toggleClass('rp-snippet-form-locked', isLocked)`.
- Max-width 800px (line 146) → permanent `addClass('rp-snippet-editor-modal')` at construction.
- Color `var(--text-error)` (line 200) → permanent class `rp-snippet-editor-save-error`.

**D-13 directive:** also DELETE the unused `eslint-disable` directive at line 143 in this same commit.

---

### 6. `src/views/runner-view.ts:1056,1059,1065` — auto-grow textarea (NET-NEW setCssProps API)

**Role:** view (preview zone sub-render)
**Data flow:** runtime geometry — `scrollHeight` measured each input event
**Analog:** **NO existing call site in `src/`.** API defined at `node_modules/obsidian/obsidian.d.ts:106`:
```typescript
// HTMLElement augmentation
setCssProps(props: Record<string, string>): void;
```

**Existing code to migrate** (`runner-view.ts:1052-1069`):
```typescript
private renderPreviewZone(zone: HTMLElement, text: string): void {
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  textarea.style.width = '100%';                                    // FLAGGED
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';                                 // FLAGGED (literal)
    textarea.style.height = textarea.scrollHeight + 'px';           // OK (concat)
    textarea.scrollTop = textarea.scrollHeight;
  });
  this.registerDomEvent(textarea, 'input', () => {
    textarea.style.height = 'auto';                                 // FLAGGED
    textarea.style.height = textarea.scrollHeight + 'px';           // OK
  });
  this.previewTextarea = textarea;
}
```

**Adaptation:** width=100% → CSS rule on `.rp-preview-textarea` (already has the class). Both `height = 'auto'` and `height = scrollHeight + 'px'` lines migrate together to setCssProps for consistency:
```typescript
textarea.setCssProps({ '--rp-textarea-height': 'auto' });
textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
```
CSS rule appended to `src/styles/runner-view.css`:
```css
/* Phase 77: preview textarea — width via class; height driven by --rp-textarea-height (Phase 64 auto-grow) */
.rp-preview-textarea {
  width: 100%;
  height: var(--rp-textarea-height, auto);
}
```

**CRITICAL Pitfall 2:** the `auto` fallback in `var(--rp-textarea-height, auto)` is mandatory — `requestAnimationFrame` defers the first setCssProps call past initial paint; without fallback, height would collapse.

---

### 7. `src/views/editor-panel-view.ts:531,660` — auto-grow shared helper (× 2)

**Role:** view (shared helper function — Phase 64 textarea pattern)
**Data flow:** runtime geometry — identical pattern to runner-view
**Analog:** **same NET-NEW setCssProps; cross-file Phase 64 precedent at `runner-view.ts:1058-1067`**

**Existing code to migrate** (`editor-panel-view.ts:529-533`):
```typescript
const resize = () => {
  if (!textarea.style) return;
  textarea.style.height = 'auto';                                   // FLAGGED
  textarea.style.height = textarea.scrollHeight + 'px';             // OK (concat, but migrate together)
};
```

**Existing code to migrate** (`editor-panel-view.ts:659-661`):
```typescript
if (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement && el.style) {
  el.style.height = 'auto';                                         // FLAGGED
  el.style.height = el.scrollHeight + 'px';                         // OK
}
```

**Adaptation:** identical to runner-view — `setCssProps({'--rp-textarea-height': 'auto'})` then `setCssProps({'--rp-textarea-height': el.scrollHeight + 'px'})`. **Custom-property name MUST be `--rp-textarea-height` — single source of truth shared with runner-view per CONTEXT.md `<code_context>`.** Two CSS rules appended to `src/styles/editor-panel.css` (one for `.rp-growable-textarea`, possibly a second class for the patched-value site if not already covered) referencing `var(--rp-textarea-height, auto)`.

---

### 8. `src/views/inline-runner-modal.ts:658,659,662,663,676` — applyPosition/applyLayout clearing assignments

**Role:** view (modal — drag/resize state)
**Data flow:** static state toggle (clear-right/bottom/maxWidth/transform when explicit left/top is applied)
**Analog:** existing Phase 67 base class `inline-runner.css:227-234`

**Pattern excerpt** (`inline-runner.css:226-234`):
```css
/* Phase 67: resizable inline runner */
.rp-inline-runner-container {
  resize: both;
  overflow: auto;
  min-width: 240px;
  min-height: 120px;
  max-width: calc(100vw - var(--size-4-8));
  max-height: calc(100vh - var(--size-4-8));
}
```

**Existing code to migrate** (`inline-runner-modal.ts:654-664`):
```typescript
private applyPosition(position: InlineRunnerLayout): void {
  if (this.containerEl === null) return;
  this.containerEl.style.left = `${Math.round(position.left)}px`;   // OK (template literal — Pitfall 7)
  this.containerEl.style.top = `${Math.round(position.top)}px`;     // OK
  this.containerEl.style.right = '';                                // FLAGGED (literal '')
  this.containerEl.style.bottom = '';                               // FLAGGED
  this.containerEl.style.maxWidth = '';                             // FLAGGED
  this.containerEl.style.transform = '';                            // FLAGGED
}
```

**Adaptation:** keep the `style.left`/`style.top` template-literal assignments untouched (Pitfall 7). Replace the four clearing assignments with a single class toggle:
```typescript
this.containerEl.toggleClass('rp-inline-runner-applied-position', true);
```
Append CSS rule to `inline-runner.css` (after Phase 67 block):
```css
/* Phase 77: applyPosition resets right/bottom/maxWidth/transform when explicit left/top is applied */
.rp-inline-runner-container.rp-inline-runner-applied-position {
  right: auto;
  bottom: auto;
  max-width: none;
  transform: none;
}
```
Line 676 (in `applyLayout`) — same single class toggle covers it; no separate rule needed.

---

### 9. CSS feature files — append-only with `/* Phase 77: ... */` comment

**Role:** declarative styling
**Data flow:** static (build-time concatenation)
**Analog:** every existing `src/styles/*.css` file. Best precedents:

**`runner-view.css:322`:**
```css
/* Phase 65: Runner footer Back/Skip row */
.rp-runner-footer-row {
  ...
}
```

**`editor-panel.css:246`:**
```css
/* Phase 64: growable Node Editor textareas */
.rp-growable-textarea {
  ...
}
```

**`inline-runner.css:226`:**
```css
/* Phase 67: resizable inline runner */
.rp-inline-runner-container {
  ...
}
```

**`snippet-manager.css:490`:**
```css
/* Phase 52: validation banner for SnippetEditorModal (D-04) */
.rp-snippet-banner {
  ...
}
```

**`donate-section.css:1`:**
```css
/* Phase 71: Donate section (DONATE-01) ────────────────────────────────────── */
```

**Adaptation per D-07:** append at the END of each target file, prefixed with `/* Phase 77: <description> */`. NEVER edit existing rules above. CLAUDE.md «append-only per phase» is non-negotiable — Pitfall 1 in RESEARCH.md flags silent rule deletion as a recurring regression class.

| Target CSS file | Sources of new rules | Rule prefixes (per D-05/D-06) |
|-----------------|---------------------|-------------------------------|
| `snippet-manager.css` | snippet-editor-modal.ts, snippet-chip-editor.ts, snippet-manager-view.ts | `rp-snippet-editor-*`, `rp-chip-*`, `rp-snippet-tree-*` |
| `snippet-fill-modal.css` | snippet-fill-in-modal.ts | `rp-snippet-fill-option-row` |
| `runner-view.css` | runner-view.ts | `rp-preview-textarea { height: var(--rp-textarea-height, auto); }` |
| `editor-panel.css` | editor-panel-view.ts | `.rp-growable-textarea { height: var(--rp-textarea-height, auto); }` (shares custom-property name) |
| `inline-runner.css` | inline-runner-modal.ts | `.rp-inline-runner-container.rp-inline-runner-applied-position { ... }` |

---

### 10. `src/__tests__/views/inline-runner-modal*.test.ts:267,261,272` — `no-this-alias` (× 3)

**Role:** test (mock SnippetFillInModal class constructor)
**Data flow:** sync constructor capture into `instances.push({ getter: ... })`
**Analog:** **none — Pitfall 3 documents this fully.**

**Existing pattern** (across all 3 files, identical shape):
```typescript
constructor(_app: unknown, snippet: unknown) {
  const self = this;                                                // FLAGGED (no-this-alias)
  this.snippet = snippet;
  this.result = new Promise<string | null>(res => { this.resolveFn = res; });
  instances.push({
    snippet,
    get opened() { return self.opened; },
    get closed() { return self.closed; },
    open: () => { self.opened = true; },
    close: () => { self.closed = true; },
  });
}
```

**Adaptation (Pitfall 3 cleanest fix):** push `this` directly — the pushed object IS the modal instance, eliminating both the alias AND the getter rebinding pitfall:
```typescript
constructor(_app: unknown, snippet: unknown) {
  this.snippet = snippet;
  this.result = new Promise<string | null>(res => { this.resolveFn = res; });
  instances.push(this as unknown as InstanceShape);
}
```
Test code reading `instance.opened` continues to work because `this` is the modal.

---

### 11. `src/__tests__/views/snippet-editor-modal-banner.test.ts:304` — `no-floating-promises`

**Role:** test (lifecycle Promise call)
**Data flow:** fire-and-forget Promise chained with `await Promise.resolve()` flush
**Analog:** `src/main.ts:118` (in-codebase `void` precedent)

**Pattern excerpt** (`main.ts:118`):
```typescript
this.addRibbonIcon('activity', 'Radiprotocol', () => { void this.activateRunnerView(); });
```

**Pattern excerpt** (`main.ts:204`):
```typescript
void this.openEditorPanelForNode(filePath, nodeId);
```

**Adaptation:** prefix the test call:
```typescript
// Before:
modal.onOpen();
// After:
void modal.onOpen();
```
Per CONVENTIONS.md §«Void-ing fire-and-forget promises». The two `await Promise.resolve()` lines that follow at 305-306 still flush microtasks correctly.

---

### 12. `src/main.ts:246,255,264,277,296,316` — `no-floating-promises` × 6 (workspace lifecycle)

**Role:** plugin (workspace lifecycle hooks)
**Data flow:** fire-and-forget Promise (revealLeaf, setActiveLeaf, etc.)
**Analog:** **same in-file precedent at `main.ts:118-204`** (already 6+ existing `void this.x()` patterns).

**Pattern excerpt** (`main.ts:118-204`):
```typescript
this.addRibbonIcon('activity', 'Radiprotocol', () => { void this.activateRunnerView(); });
// ...
callback: () => { void this.activateRunnerView(); },
// ...
void this.openEditorPanelForNode(filePath, nodeId);
```

**Adaptation:** prefix each flagged call with `void`. Trivial, mechanical fix — single commit groups all 6.

---

### 13. `src/views/editor-panel-view.ts:284,381` + `src/views/inline-runner-modal.ts:599` — `no-tfile-tfolder-cast` × 3

**Role:** view (vault read with file argument)
**Data flow:** type narrowing — runtime guard before vault API call
**Analog:** `src/main.ts:419` and `src/views/editor-panel-view.ts:400` (in-file precedent)

**Pattern excerpt** (`main.ts:419-422`):
```typescript
if (!(file instanceof TFile)) {
  // ... user-facing error or early return
  return;
}
// file is now narrowed to TFile
```

**Pattern excerpt** (`editor-panel-view.ts:400`):
```typescript
if (!(file instanceof TFile)) {
  // ...
}
```

**Adaptation:** replace `as TFile` cast with an `instanceof TFile` guard returning early on the false branch. The vault API call below the guard automatically gets the narrowed `TFile` type. Identical shape at all 3 call sites.

---

### 14. `src/__tests__/views/snippet-tree-picker.test.ts:979,996` — `obsidianmd/ui/sentence-case` × 2 (test fixtures)

**Role:** test (UI string fixtures)
**Data flow:** static text
**Analog:** none — direct string capitalization.

**Adaptation:**
- Line 979: `text: 'pre-existing'` → `text: 'Pre-existing'`. Line 990 assertion `expect(...).toBe('pre-existing')` updates in lock-step.
- Line 996: `text: 'stale'` → `text: 'Stale'`.

---

### 15. `src/views/main.ts`, `src/settings.ts`, `src/views/editor-panel-view.ts`, `src/views/snippet-chip-editor.ts` — sentence-case × 26 (production UI strings)

**Role:** UI text
**Data flow:** static text rendered to DOM via `createEl({ text: ... })` / `Notice(...)` / button labels
**Analog:** none — per `obsidianmd/ui/sentence-case` rule semantics, Title Case strings need lowercasing; first-letter-uppercase only.

**Adaptation:** mechanical. Examples:
- `'Save Settings'` → `'Save settings'`
- `'New Snippet'` → `'New snippet'`
- `'Delete Folder'` → `'Delete folder'`

Where Russian + English are mixed, only the English token follows the rule (Russian text isn't subject to ESLint regex matching). Per CONTEXT.md D-13 these are batched into per-file Stage 3 commits.

---

### 16. `src/views/node-picker-modal.ts:71` — `no-constant-binary-expression`

**Role:** view (picker option construction)
**Data flow:** code-quality fix
**Analog:** none.

**Existing code:**
```typescript
options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
```

**Adaptation:** drop the unreachable `|| id` (the truthy literal `'(корень snippets)'` always wins):
```typescript
options.push({ id, label: s.subfolderPath || '(корень snippets)', kind: 'snippet' });
```

---

### 17. `src/snippets/snippet-service.ts:488` — `no-control-regex` (intentional)

**Role:** service (input sanitization)
**Data flow:** regex match on user-supplied string
**Analog:** Pitfall 6 in RESEARCH.md — intentional control-char strip.

**Adaptation:** add per-line disable with rationale:
```typescript
// eslint-disable-next-line no-control-regex -- Phase 32: intentional control-char strip; prevents invisible-char injection in snippet content
const control = /[ -]/g;
```
Justification mirrored in commit message per ROADMAP SC#3.

---

### 18. `src/snippets/snippet-service.ts:240,283` — `prefer-file-manager-trash-file` (warn × 2)

**Role:** service (vault delete operation)
**Data flow:** API choice
**Analog:** **NO ANALOG** — zero existing `app.fileManager.trashFile` call sites in `src/`. Pitfall 5 documents the UX impact.

**Adaptation per D-13:** **document as out-of-scope.** Replacing `vault.trash(file, false)` with `app.fileManager.trashFile(file)` changes UX semantics (vault-relative `.trash/` → user-configured: system trash / vault trash / permanent). Behaviour change requires a UX decision phase outside LINT-01. Document in `77-VERIFICATION.md` per ROADMAP SC#5; the 2 warnings remain. Final commit retains `npm run lint` exit 0 because warnings don't fail (only errors do, with eslint default flag set).

**Risk if planner overrides D-13:** existing tests asserting `vault.trash` was called break; users relying on `.trash/` placement get OS Trash placement — silent UX regression.

---

### 19. `src/__tests__/views/inline-runner-modal.test.ts:290` — `ban-ts-comment`

**Role:** test (TS suppression)
**Data flow:** comment swap
**Analog:** none — direct directive rename.

**Adaptation:** `// @ts-ignore` → `// @ts-expect-error: <reason>`. The `@ts-expect-error` form fails the build if the suppression is no longer needed (TS 4.0+).

---

### 20. `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts:311` — `prefer-const`

**Role:** test (variable mutation check)
**Data flow:** code-quality fix
**Analog:** none.

**Adaptation:** `let foo = ...;` → `const foo = ...;` if `foo` is never reassigned. NOT covered by D-02 override (override only relaxes `no-unused-vars` and `no-explicit-any`).

---

### 21. `src/__tests__/snippet-tree-dnd.test.ts:121` — `lastMenuItems` unused (no underscore prefix)

**Role:** test (recorded fixture variable)
**Data flow:** code-quality fix
**Analog:** CONVENTIONS.md §Naming Patterns `_underscore` convention.

**Pattern excerpt** (CONVENTIONS.md):
> `_underscore` prefix for intentional unused (callback params, exhaustiveness placeholders).

**Adaptation:** Open Question #3 from RESEARCH.md surfaces this. D-02 override only ignores names starting with `_`. Either:
- Rename to `_lastMenuItems` (signals intentional unused), OR
- Remove the variable if truly dead.
Plan should pick rename (preserves the recorded fixture for potential reactivation).

---

### 22. `src/views/snippet-editor-modal.ts:143` — unused `eslint-disable` directive (warn)

**Role:** view (directive removal)
**Data flow:** code-quality fix
**Analog:** none.

**Adaptation:** delete the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` line at 143. Per RESEARCH.md the directive points at `no-explicit-any` but no `any`-violation exists in the block below. This commit MUST be coordinated with the broader snippet-editor-modal.ts Stage 2 commit per D-13 (single touch on this file).

---

### 23. `src/main.ts:517` — `no-this-alias` (× 1, plugin scope)

**Role:** plugin (closure capture in event handler or similar)
**Data flow:** sync method scope
**Analog:** none — case-by-case rewrite.

**Adaptation:** depends on the local pattern — either rewrite as arrow function (lexical `this`), or annotate with `this: T` parameter type if a `function` keyword is required. Researcher did NOT inline-Read this site (out of scope for research lookup); planner must Read `main.ts:510-525` and pick the right rewrite.

---

### 24. Test ripple — `src/__tests__/editor-panel-forms.test.ts:300` (auto-grow) + `src/__tests__/views/inline-runner-position.test.ts:216-217` (position fixture)

**Role:** test (DOM-state assertion / fixture write)
**Data flow:** test reads `style.height` / writes `style.left`
**Analog:** **none — production-code migration drives the assertion change.**

**Adaptation `editor-panel-forms.test.ts:300-302`:**
- Line 300 currently writes `style.height = 'prev'` (literal — also flagged). Rewrite as `(lastTextarea as ...).setCssProps({'--rp-textarea-height': 'prev'})` to match the new production pathway.
- Line 302 assert: `expect(...style.height).toBe('123px')` → `expect((lastTextarea as ...).style.getPropertyValue('--rp-textarea-height')).toBe('123px')`.
- Bundle into the same commit as `editor-panel-view.ts` Stage 2 migration.

**Adaptation `inline-runner-position.test.ts:216-217`:**
- These ARE flagged (literal-string fixture writes). Production code at `inline-runner-modal.ts:656-657` uses template literals (NOT flagged → not migrated). So the test fixture writes have no production analog to align with. Per RESEARCH §«Test Surfaces Needing Update»: wrap with per-line disable:
  ```typescript
  // eslint-disable-next-line obsidianmd/no-static-styles-assignment -- test fixture forcing pre-condition; production code uses template literal which is not flagged
  containerEl.style.left = '920px';
  // eslint-disable-next-line obsidianmd/no-static-styles-assignment -- ditto
  containerEl.style.top = '740px';
  ```
- READ-side assertions (lines 171/186/198/208/222/223) reading `style.left`/`style.top` are NOT changed.

---

## Shared Patterns

### A. Class toggle for boolean state (D-04 first branch)

**Source:** `src/views/runner-view.ts:229,427` + `src/views/snippet-editor-modal.ts:350` + `src/views/snippet-chip-editor.ts:288`
**Apply to:** all view files in Stage 2 except runtime-geometry sites
**Pattern excerpt** (`runner-view.ts:229`):
```typescript
closeBtn.toggleClass('is-hidden', this.canvasFilePath === null);
```
**Project naming convention (D-05):** new toggles use `rp-{component}-{state}` (NOT `is-*`). Existing `is-expanded`/`is-visible`/`is-hidden` precedents are kept where present (don't rename) but new code uses the rp-prefixed form.

### B. CSS append-only with phase tag (CLAUDE.md mandate)

**Source:** every `src/styles/*.css` file. Strongest recent precedents:
- `inline-runner.css:226` `/* Phase 67: resizable inline runner */`
- `loop-support.css:113` `/* Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01) ─ */`
- `donate-section.css:1` `/* Phase 71: Donate section (DONATE-01) ─ */`

**Apply to:** all 5 CSS files touched (`snippet-manager.css`, `snippet-fill-modal.css`, `runner-view.css`, `editor-panel.css`, `inline-runner.css`).

**Pattern excerpt** (`editor-panel.css:246-283` showing two consecutive Phase 64 blocks):
```css
/* Phase 64: growable Node Editor textareas */
.rp-growable-textarea { ... }

/* Phase 64: text block quick-create button */
.rp-quickcreate-textblock-btn { ... }
```

**Strict rule:** ONLY add at end of file. NEVER edit existing rules. `git diff` should show additions only — `-` lines in CSS = STOP and re-do (Pitfall 1).

### C. setCssProps for runtime CSS custom properties (D-04 second branch — NET-NEW)

**Source:** **NO existing call sites in `src/`.** Type signature at `node_modules/obsidian/obsidian.d.ts:106`:
```typescript
setCssProps(props: Record<string, string>): void;
```
**Apply to:** 3 sites only — `runner-view.ts:1059/1065`, `editor-panel-view.ts:531/660`. NO other site needs setCssProps (Pitfall 7: template-literal assignments are NOT flagged).

**Custom-property naming (D-06):** `--rp-{component}-{prop}`. The shared name `--rp-textarea-height` is the single source of truth across both files.

**CSS fallback (Pitfall 2):** every `var(--rp-x)` consumer MUST include a fallback (`var(--rp-textarea-height, auto)`) — first paint runs before the deferred `requestAnimationFrame` setCssProps call.

### D. Mock helper for `setCssProps` in `src/__mocks__/obsidian.ts`

**Source:** existing toggleClass mock at `src/__mocks__/obsidian.ts` (and per-test mock files at `src/__tests__/views/inline-runner-modal*.test.ts:92,94,98` etc.)
**Apply to:** `src/__mocks__/obsidian.ts` MockElement interface (1-line addition)

**Pattern excerpt** (`inline-runner-modal.test.ts:92` showing existing mock shape):
```typescript
toggleClass(cls: string, on?: boolean): void { ... }
```

**Adaptation:** add a stub method:
```typescript
setCssProps(_props: Record<string, string>): void { /* no-op in mock */ }
```
The `_underscore` prefix on `_props` matches CONVENTIONS.md and survives the D-02 override unused-vars check.

### E. `void` prefix for fire-and-forget Promises (CONVENTIONS.md §Void-ing)

**Source:** 6+ sites in `src/main.ts:118-204` and 6+ sites in `src/views/inline-runner-modal.ts:215-759`
**Apply to:** `main.ts:246,255,264,277,296,316` (6 src) + `snippet-editor-modal-banner.test.ts:304` (1 test)

**Pattern excerpt** (`main.ts:118`):
```typescript
this.addRibbonIcon('activity', 'Radiprotocol', () => { void this.activateRunnerView(); });
```

### F. `instanceof TFile` narrowing (replaces `as TFile` cast)

**Source:** `src/main.ts:351,419` + `src/views/editor-panel-view.ts:249,400` + `src/canvas/edge-label-sync-service.ts:94,138,331`
**Apply to:** `editor-panel-view.ts:284,381` + `inline-runner-modal.ts:599`

**Pattern excerpt** (`main.ts:419`):
```typescript
if (!(file instanceof TFile)) {
  return;
}
// 'file' narrowed to TFile from here
```

### G. Per-line eslint-disable with written justification (ROADMAP SC#3)

**Source:** D-13 mandates this for `snippet-service.ts:488` (no-control-regex) and ripple test fixture writes.
**Apply to:** `snippet-service.ts:488` + `inline-runner-position.test.ts:216-217`.

**Format:**
```typescript
// eslint-disable-next-line <rule-name> -- Phase <N>: <reason that survives blame review>
<flagged line>
```
Justification in commit message per ROADMAP SC#3 («default is to fix the violation; per-file disable acceptable ONLY with written justification»).

---

## No Analog Found

| File / fix | Reason no analog | How planner handles |
|------------|------------------|---------------------|
| **`setCssProps` introduction** (3 sites: runner-view.ts × 1, editor-panel-view.ts × 2) | Phase 77 introduces the API to the codebase — zero prior call sites. Mock at `src/__mocks__/obsidian.ts` does NOT have it. | Researcher's «Standard Stack» section provides the pattern (Pattern 2 in RESEARCH.md). Plan must include mock stub addition (Shared Pattern D above). |
| **`app.fileManager.trashFile`** (snippet-service.ts:240,283) | Zero existing call sites in src; would alter UX (Pitfall 5). | Document as out-of-scope per D-13 in `77-VERIFICATION.md`. 2 warnings remain — acceptable per ROADMAP SC#5. |
| **`no-this-alias` getter rebind fix** (3 test files) | Existing project pattern is to use arrow functions, but the constructor+getter shape in these tests has no precedent in the codebase. | Pitfall 3 in RESEARCH.md provides cleanest fix: push `this as unknown as InstanceShape` directly. |
| **`main.ts:517` `no-this-alias`** | Without reading the local context, no analog identified. Researcher noted this is in the «остальные правила» bucket (D-13). | Planner Reads `main.ts:510-525`, picks arrow rewrite or `this: T` annotation per local shape. |
| **Sentence-case bulk fixes** (26 src strings + 2 test fixtures) | Direct character casing — no pattern precedent needed. | Mechanical Stage 3 fix; per-file commits per D-11. |
| **Trivial single-rule fixes** (no-constant-binary-expression × 1, ban-ts-comment × 1, prefer-const × 1, unused eslint-disable × 1, lastMenuItems × 1) | One-line fixes with no architectural pattern. | Stage 3 individual commits or grouped «misc residual» commit per D-11 discretion. |

---

## Metadata

**Analog search scope:** `src/views/`, `src/main.ts`, `src/snippets/`, `src/canvas/`, `src/styles/`, `src/__tests__/`, `src/__mocks__/`, `eslint.config.mjs`, `esbuild.config.mjs`, `node_modules/obsidian/obsidian.d.ts`.

**Files Read (live, this session):** CONTEXT.md, RESEARCH.md, CLAUDE.md, CONVENTIONS.md, eslint.config.mjs, esbuild.config.mjs, inline-runner-modal.ts:650-685, runner-view.ts:1050-1075, editor-panel-view.ts:525-540 + 650-670, inline-runner.css:220-238.

**Files Grep-verified (this session):** `toggleClass(` usage (4 src + 8 test mock sites confirmed); `setCssProps` (zero src usage confirmed); `instanceof TFile|TFolder` (15+ existing sites confirmed); `void this.|void await` (multiple in-file precedents confirmed); `trashFile|fileManager.trash` (zero existing — confirms «no analog»); `/* Phase \d+:` headers across all 9 CSS files (append-only convention confirmed live).

**Pattern extraction date:** 2026-04-30
