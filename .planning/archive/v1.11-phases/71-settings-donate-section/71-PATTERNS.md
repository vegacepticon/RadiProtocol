# Phase 71: Settings — Donate Section - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 5 (3 NEW, 2 MODIFY)
**Analogs found:** 5 / 5 (all have strong existing analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `src/donate/wallets.ts` | constants module | static-data | `src/canvas/node-color-map.ts` | exact (role + data flow) |
| MODIFY `src/settings.ts` (insert section before line 62) | settings tab UI | request-response (UI) | `src/settings.ts:50-173` (self — existing groups) | exact (in-file pattern) |
| NEW `src/styles/donate-section.css` | per-feature stylesheet | static (declarative CSS) | `src/styles/canvas-selector.css` (small focused file) | exact (role) |
| MODIFY `esbuild.config.mjs` (extend `CSS_FILES` array) | build config | static-list registration | `esbuild.config.mjs` lines 31-40 (self — existing array) | exact (in-file pattern) |
| NEW `src/__tests__/donate/wallets.test.ts` | unit test (constants) | assertion | `src/__tests__/graph/node-label.test.ts` | role-match (constants/data validation) |

**Reference (read-only, used as code-pattern source):**
- `src/views/runner-view.ts:1105-1109` — canonical `clipboard.writeText + Notice` (no `.catch`).

---

## Pattern Assignments

### `src/donate/wallets.ts` (constants module, static-data)

**Analog:** `src/canvas/node-color-map.ts` (entire file, 21 lines)

**Header comment + import + readonly export pattern** (`src/canvas/node-color-map.ts:1-21`):
```typescript
// src/canvas/node-color-map.ts
// Maps every RadiProtocol node type to its Obsidian canvas palette string ("1"–"6").
//
// Palette semantics (Obsidian built-in canvas colors):
//   "1" = Red    "2" = Orange   "3" = Yellow
//   "4" = Green  "5" = Cyan     "6" = Purple
//
// Source: CONTEXT.md D-01, D-02; UI-SPEC Semantic Color Contract

import type { RPNodeKind } from '../graph/graph-model';

export const NODE_COLOR_MAP: Record<RPNodeKind, string> = {
  'start':           '4',  // green  — entry point ("go" semantics)
  'question':        '5',  // cyan   — information gathering
  // ...
};
```

**Patterns to copy:**
- Path-comment header on line 1 (e.g. `// src/donate/wallets.ts`).
- Multi-line block comment explaining domain semantics + reference to `REQUIREMENTS.md DONATE-01` / `CONTEXT.md NTC-D-03`.
- Single `export const` literal — no class, no factory, no runtime function.
- Inline `//`-comments next to each entry (in node-color-map: color names; in wallets: network names).

**Key differences (Phase 71-specific):**
- Replace `Record<RPNodeKind, string>` with `ReadonlyArray<DonateWallet>` per CONTEXT.md NTC-D-03.
- Add the `DonateWallet` interface above the constant: `export interface DonateWallet { readonly name: string; readonly networks?: readonly string[]; readonly address: string; }`.
- Optionally export `DONATE_INVITATION_TEXT` and `DONATE_NOTICE_TEXT` string constants (NTC-D-01, NTC-D-02).
- No external Obsidian / type imports needed (DonateWallet is local) — file is fully self-contained, which keeps the test pure.

**Convention check (from existing codebase):**
- `as const` is used in tests but rarely on top-level constants (`Grep` shows no `^export const \w+:?\s*Readonly` matches). Prefer the explicit `ReadonlyArray<DonateWallet>` type annotation over `as const` to make the contract visible at the export site.

---

### `src/settings.ts` MODIFY (settings tab UI, request-response)

**Analog:** `src/settings.ts:50-173` (existing in-file groups — Runner / Protocol / Output / Storage)

**Section heading pattern** (`src/settings.ts:62-63`, also 92-93, 113-114, 144-145):
```typescript
// Group 1 — Runner
new Setting(containerEl).setName('Runner').setHeading();
```

**Insertion point:** Between `containerEl.empty();` (line 60) and `// Group 1 — Runner` (line 62). The new donate section must render top-most per ROADMAP SC#1.

**Setting row pattern (existing — addText/addDropdown variant)** (`src/settings.ts:65-76`):
```typescript
new Setting(containerEl)
  .setName('Runner view mode')
  .setDesc('Choose where the protocol runner opens. ...')
  .addDropdown(drop => drop
    .addOption('sidebar', 'Sidebar panel')
    // ...
  );
```

**New pattern needed (NOT yet in this codebase — `addExtraButton`):**
The codebase does **not** currently call `addExtraButton` or use `setting.descEl` anywhere (`Grep` confirmed zero hits in `src/**/*.ts`). Phase 71 introduces both. The Obsidian Plugin API signature expected (per CONTEXT.md `<canonical_refs>` / Obsidian docs):
```typescript
new Setting(containerEl)
  .setName('EVM')                          // EVM-D-01: short label
  .setDesc('Ethereum · Linea · Base · …')  // EVM-D-04: middle-dot
  .then(setting => {
    setting.descEl.createEl('code', { text: address, cls: 'rp-donate-address' });
  })
  .addExtraButton(btn => btn
    .setIcon('copy')
    .setTooltip('Скопировать адрес')
    .onClick(() => {
      void navigator.clipboard.writeText(address).then(() => {
        new Notice('Адрес скопирован');
      });
    })
  );
```

**Imports already present at top of file (`src/settings.ts:2-3`):**
```typescript
import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
```
Phase 71 must extend this to add `Notice`:
```typescript
import { PluginSettingTab, Setting, Notice } from 'obsidian';
```
And import the donate constants:
```typescript
import { DONATE_WALLETS, DONATE_INVITATION_TEXT, DONATE_NOTICE_TEXT } from './donate/wallets';
```

**Invitation paragraph pattern (Obsidian-idiomatic; no existing exact analog in `settings.ts` — use the `containerEl.createEl(...)` style already used by `makeMockEl` and elsewhere in views):**
```typescript
containerEl.createEl('p', { text: DONATE_INVITATION_TEXT, cls: 'rp-donate-intro' });
```

**Critical CLAUDE.md rule for editing this file:**
> When editing any file in `src/styles/`, `src/main.ts`, ... or other accumulated files: **ONLY add or modify code relevant to the current phase. NEVER delete rules, functions, or event listeners that you did not add in this phase.**

Although `src/settings.ts` is not explicitly listed, it is an accumulated shared file. The 4 existing groups (Runner/Protocol/Output/Storage, lines 62-171) MUST be preserved verbatim — only the new donate block is inserted between line 60 and line 62.

---

### `src/styles/donate-section.css` (per-feature stylesheet, static)

**Analog:** `src/styles/canvas-selector.css` (small focused file, ~30 lines opening) and `src/styles/inline-runner.css` (Phase 54 starter, ~40 lines opening).

**Header comment pattern** (`src/styles/canvas-selector.css:1`):
```css
/* Phase 13: CanvasSelectorWidget ─────────────────────────────────────────── */
```
Or alternative (`src/styles/inline-runner.css:1`):
```css
/* Phase 54: Inline protocol display mode — bottom bar, note-width */
```

**Recommended for Phase 71:**
```css
/* Phase 71: Donate section (DONATE-01) */
```

**Class-naming convention (`rp-`-prefix per existing files):**
- `src/styles/canvas-selector.css` uses `.rp-selector-*`.
- `src/styles/inline-runner.css` uses `.rp-inline-runner-*`.
- `src/styles/snippet-tree-picker.css:3` (header comment): «Class prefix: rp-stp-* (distinct from rp-snippet-* runner picker classes)».
- **Phase 71 should use `.rp-donate-*`** (e.g. `.rp-donate-address`, `.rp-donate-intro`, optional `.rp-donate-section`).

**Theme-token usage (`src/styles/inline-runner.css:5-9`):**
```css
background: var(--background-primary);
border-top: 1px solid var(--background-modifier-border);
padding: var(--size-4-2) var(--size-4-3);
```
Phase 71 minimal CSS uses Obsidian default `<code>` styling (theme-aware) and only adds:
- `word-break: break-all;` (or `overflow-wrap: anywhere;`) on `.rp-donate-address` — long addresses must wrap.
- `display: block;` and a small `margin-top` (`var(--size-2-1)` or fixed `4px-8px`) so the `<code>` lays under the network list on its own line (VIS-D-03).

**CLAUDE.md rule for new CSS files:**
> When adding CSS for a new feature: create a new file in `src/styles/` and add it to the `CSS_FILES` list in `esbuild.config.mjs`. Do NOT add CSS to an unrelated feature file.

> CSS files: append-only per phase. Add new rules at the bottom of that file with a phase comment: `/* Phase N: description */`. Never rewrite existing sections.

Since `donate-section.css` is created fresh in Phase 71, the entire initial content is the «Phase 71» chunk — the phase-comment marker still applies (CONTEXT.md `<code_context>` confirms: «весь первоначальный контент идёт без `/* Phase N */`-разделителей; будущие фазы будут append-only с маркерами»). Recommend adding the marker anyway for forward-consistency.

---

### `esbuild.config.mjs` MODIFY (extend `CSS_FILES`)

**Analog:** the existing `CSS_FILES` array itself (`esbuild.config.mjs:31-40`):
```javascript
const CSS_FILES = [
  'runner-view',
  'canvas-selector',
  'editor-panel',
  'snippet-manager',
  'snippet-fill-modal',
  'loop-support',
  'snippet-tree-picker',
  'inline-runner',
];
```

**Pattern to copy:**
- Bare base-name (no `.css` extension, no path).
- Append `'donate-section'` to the end of the array (preserves load-order; donate styles come after all existing feature styles, lowering risk of unintended override).

**Resulting (illustrative — exact form is the planner's call):**
```javascript
const CSS_FILES = [
  'runner-view',
  // ... existing entries unchanged ...
  'inline-runner',
  'donate-section',
];
```

**Critical:** All 8 existing entries MUST remain in their current order (CLAUDE.md «never delete code you didn't add»). Only one line is added.

---

### `src/__tests__/donate/wallets.test.ts` (unit test, assertion)

**Analog:** `src/__tests__/graph/node-label.test.ts` (subdir-organized constants/pure-data test, no Obsidian mock needed at the assertion layer).

**Header / import pattern** (`src/__tests__/graph/node-label.test.ts:1-6`):
```typescript
// src/__tests__/graph/node-label.test.ts
// Phase 49 D-13 — unit tests for the shared node-label module.

import { describe, it, expect } from 'vitest';
import { nodeLabel, isLabeledEdge, isExitEdge, stripExitPrefix } from '../../graph/node-label';
import type { RPNode, RPEdge } from '../../graph/graph-model';
```

**Patterns to copy:**
- Path-comment header on line 1 (`// src/__tests__/donate/wallets.test.ts`).
- Phase reference comment on line 2 (`// Phase 71 NTC-D-04 — DONATE_WALLETS constant validation.`).
- `import { describe, it, expect } from 'vitest';` — no other test runners.
- Relative-from-tests imports use `../../` to reach into `src/donate/`.
- Group assertions by domain in `describe(...)` blocks (CONTEXT.md NTC-D-04 specifies 5 distinct invariants — natural to split into 5 `it(...)` cases).
- Use `expect(...).toBe(...)` and `expect(...).toEqual(...)` (exact-literal matchers, like lines 14-22, 41-43).
- For arrays of strings (network names): `toEqual(['Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon'])` — CONTEXT.md NTC-D-04 #4.
- For optional-undefined check (NTC-D-04 #5): `expect(DONATE_WALLETS[1].networks).toBeUndefined()` (not `.toBe(undefined)` — `toBeUndefined` is the idiomatic vitest matcher used elsewhere if available; otherwise `.toBe(undefined)` is acceptable).

**Mock-free:** This test does NOT need `vi.mock('obsidian')` — `wallets.ts` does not import `obsidian`. Compare with `src/__tests__/inline-runner-layout.test.ts:9` which DOES need `vi.mock('obsidian');` because `InlineRunnerModal` imports Obsidian classes. Keeping `wallets.ts` Obsidian-free (per CONTEXT.md NTC-D-03) is what makes the test trivially fast and isolated.

**Suggested structure:**
```typescript
// src/__tests__/donate/wallets.test.ts
// Phase 71 NTC-D-04 — DONATE_WALLETS constant validation (anti-typo tripwire).

import { describe, it, expect } from 'vitest';
import { DONATE_WALLETS } from '../../donate/wallets';

describe('DONATE_WALLETS (Phase 71 NTC-D-04)', () => {
  it('contains exactly 4 entries', () => {
    expect(DONATE_WALLETS.length).toBe(4);
  });

  it('preserves the EVM → Bitcoin → Solana → Tron order', () => {
    expect(DONATE_WALLETS.map(w => w.name)).toEqual(['EVM', 'Bitcoin', 'Solana', 'Tron']);
  });

  it('has the exact addresses from REQUIREMENTS.md DONATE-01', () => {
    expect(DONATE_WALLETS[0]!.address).toBe('0x0B528dAF919516899617C536ec26D2d5ab7fB02A');
    expect(DONATE_WALLETS[1]!.address).toBe('bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7');
    expect(DONATE_WALLETS[2]!.address).toBe('HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA');
    expect(DONATE_WALLETS[3]!.address).toBe('TPBbBauXk56obAiQMSKzMQgsnUiea12hAB');
  });

  it('EVM entry lists the 6 networks in the canonical order', () => {
    expect(DONATE_WALLETS[0]!.networks).toEqual([
      'Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon',
    ]);
  });

  it('non-EVM entries omit the networks field (undefined, not empty array)', () => {
    expect(DONATE_WALLETS[1]!.networks).toBeUndefined();
    expect(DONATE_WALLETS[2]!.networks).toBeUndefined();
    expect(DONATE_WALLETS[3]!.networks).toBeUndefined();
  });
});
```

---

## Shared Patterns

### Clipboard copy + Notice (no `.catch`)

**Source:** `src/views/runner-view.ts:1105-1109`
**Apply to:** Each donate-row `addExtraButton` `onClick` handler (4 rows).

```typescript
this.registerDomEvent(copyBtn, 'click', () => {
  const finalText = this.previewTextarea?.value ?? capturedText;  // D-03: live textarea read
  void navigator.clipboard.writeText(finalText).then(() => {
    new Notice('Copied to clipboard.');
  });
});
```

**Phase 71 adaptation:**
- Replace `this.registerDomEvent(copyBtn, 'click', ...)` with `addExtraButton(btn => btn....onClick(...))`. CONTEXT.md `<code_context>` line 124 explains why: «Settings tab не имеет `register*` методов как у `ItemView`. `addExtraButton().onClick()` использует Obsidian-managed lifecycle».
- Replace `'Copied to clipboard.'` with `'Адрес скопирован'` (NTC-D-02).
- Capture `address` from the closure over the current `DONATE_WALLETS` row, not from a textarea.
- The `void` prefix and absent `.catch` are mandatory (Phase 31 D-08 + CONTEXT.md Row-D-04 + STACK.md `@typescript-eslint/no-floating-promises: error`).

### `void` prefix for floating Promises

**Source:** `src/views/runner-view.ts:1107` and `src/settings.ts:88` (`void this.plugin.saveSettings();`)
**Apply to:** Every `clipboard.writeText(...).then(...)` call inside `onClick` handlers.

The codebase consistently uses `void` to satisfy `@typescript-eslint/no-floating-promises: error` (STACK.md). Same pattern in `runner-view.ts:1114` (`void this.plugin.saveOutputToNote(...)`).

### Notice import + construction

**Source:** `src/views/runner-view.ts:2` and `:1108`
**Apply to:** `src/settings.ts` import line (extend existing `import { PluginSettingTab, Setting } from 'obsidian';` to include `Notice`).

```typescript
// Import (runner-view.ts:2)
import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, MarkdownView, setIcon } from 'obsidian';

// Construction (runner-view.ts:1108)
new Notice('Copied to clipboard.');
```

The mock at `src/__mocks__/obsidian.ts:218-220` (`export class Notice { constructor(_message: string, _timeout?: number) {} }`) confirms the constructor signature.

### CSS class naming (`rp-`-prefix)

**Source:** All files in `src/styles/` (`rp-selector-*`, `rp-inline-runner-*`, `rp-stp-*`, `rp-snippet-*`)
**Apply to:** `src/styles/donate-section.css` — use `rp-donate-*` prefix (`rp-donate-address`, `rp-donate-intro`, optional `rp-donate-section`).

CONTEXT.md `<decisions>` Claude's Discretion line 78 explicitly defers exact class names to the planner — but the prefix pattern is non-negotiable per repo convention.

### Phase-comment marker in CSS

**Source:** `src/styles/canvas-selector.css:1` (`/* Phase 13: CanvasSelectorWidget ─────────── */`), `src/styles/inline-runner.css:1` (`/* Phase 54: Inline protocol display mode — bottom bar, note-width */`), `src/styles/snippet-tree-picker.css:1-4` (multi-line block).
**Apply to:** Top of `donate-section.css`. Recommended: `/* Phase 71: Donate section (DONATE-01) */`.

---

## No Analog Found

**None.** All 5 files (and the cross-cutting clipboard/Notice/void patterns) have direct, recent in-tree analogs. The only «new» surface is the `addExtraButton` Obsidian API — but its signature is well-documented in `CONTEXT.md` itself (`<code_context>` line 117) and the planner can mirror the `addDropdown` / `addText` style already used in `src/settings.ts:67-76`.

### Note for planner: Obsidian mock gap

`src/__mocks__/obsidian.ts:222-247` — the existing `Setting` mock implements `setName`, `setDesc`, `setHeading`, `addText`, `addTextArea`, `addDropdown`, `addSlider`, `addButton`. It does **not** implement `addExtraButton` or expose `descEl`. Phase 71 implementation does NOT require a settings-tab DOM-render test (CONTEXT.md `<domain>` Out of scope explicitly rejects «DOM-render unit-тест на settings tab»). The constants test (`wallets.test.ts`) does not touch the Setting mock at all, so no mock extension is required for the planned test scope. If a future phase adds DOM-render coverage of donate rows, `Setting` mock will need `addExtraButton` and `descEl` stubs added.

---

## Metadata

**Analog search scope:**
- `src/canvas/` — for `Readonly`-typed constant analogs.
- `src/settings.ts` (entire file) — for in-file `new Setting()` builder patterns.
- `src/views/runner-view.ts` (around line 1105) — for canonical clipboard+Notice pattern.
- `src/styles/` (all 8 files) — for CSS-file conventions and class-naming.
- `src/__tests__/` (entire tree, 60+ files) — for vitest test scaffolding analogs.
- `src/__mocks__/obsidian.ts` — to verify mock coverage for tests.
- `esbuild.config.mjs` — for `CSS_FILES` registration pattern.

**Files scanned:** 70+ via Glob/Grep; 12 read in full or in targeted ranges.

**Pattern extraction date:** 2026-04-29
