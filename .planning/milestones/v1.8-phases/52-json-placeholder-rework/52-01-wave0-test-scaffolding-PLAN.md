---
phase: 52
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/__tests__/snippet-service-validation.test.ts
  - src/__tests__/views/snippet-chip-editor.test.ts
  - src/__tests__/views/snippet-fill-in-modal.test.ts
  - src/__tests__/views/snippet-editor-modal-banner.test.ts
  - src/__tests__/snippet-model.test.ts
  - src/__tests__/views/runner-snippet-picker.test.ts
autonomous: true
requirements:
  - PHLD-01
tags:
  - test-scaffolding
  - wave-0
  - red
  - phase-52
must_haves:
  truths:
    - "Four new test files exist in src/__tests__ covering D-03, D-05/D-06/D-09, D-04 banner, and D-08 options-list regression"
    - "snippet-model.test.ts imports no longer reference 'number', 'multi-choice', or 'unit'/'joinSeparator' literals"
    - "runner-snippet-picker.test.ts fakeSnippet fixtures declare validationError: null so the upcoming type change does not red-trip them"
    - "All new tests fail (RED) at this point because Wave 2+ production code does not yet exist"
    - "Pre-existing suite outside the four touched files remains green (486 pre-existing tests unchanged)"
  artifacts:
    - path: src/__tests__/snippet-service-validation.test.ts
      provides: "D-03 SnippetService.load/listFolder validationError contract coverage"
      contains: "describe('SnippetService.load — Phase 52 D-03"
    - path: src/__tests__/views/snippet-chip-editor.test.ts
      provides: "SC 2 options-list add/edit/remove regression + Phase 52 two-type selector"
      contains: "describe('snippet-chip-editor Phase 52"
    - path: src/__tests__/views/snippet-fill-in-modal.test.ts
      provides: "D-05/D-06/D-09 unified choice rendering coverage"
      contains: "describe('SnippetFillInModal Phase 52"
    - path: src/__tests__/views/snippet-editor-modal-banner.test.ts
      provides: "D-04 banner + save-disabled + read-only content coverage"
      contains: "describe('SnippetEditorModal Phase 52 D-04"
  key_links:
    - from: src/__tests__/views/runner-snippet-picker.test.ts
      to: JsonSnippet type (src/snippets/snippet-model.ts)
      via: "fakeSnippet fixtures at :316 and :479"
      pattern: "validationError: null"
    - from: src/__tests__/snippet-model.test.ts
      to: SnippetPlaceholder type
      via: "fixtures rewritten to two-type union"
      pattern: "separator:"
---

<objective>
**Split permission (per checker Warning 5):** If task-5 execution fatigue emerges, executor may split chip-editor and banner scaffolding into separate commits — tests remain RED until Plans 02/03/04 flip them GREEN, so splitting is safe.

Create Wave 0 test scaffolding so every subsequent GREEN task (Plans 02-04) has a failing target that exercises the exact contract specified in CONTEXT D-01..D-09 and RESEARCH §Phase Requirements → Test Map.

Purpose: Apply TDD RED→GREEN per GSD workflow on a narrowing/rename phase where production changes ripple across 6 files. Wave 0 pins the contract in tests before the model union narrows; this catches shape drift at tsc time, not at runtime in dev-UAT.

Output: 4 new test files + 2 existing files updated with Phase 52-compatible fixtures. All tests in the new files are RED (fail because model/service changes have not landed). Pre-existing tests that rely on the old `'number' | 'multi-choice'` literals are updated so tsc keeps passing under the current (still-4-value) union and will continue to pass under the Plan-02 narrowed union (see RESEARCH §Pitfall 5).

Locked contract this plan tests (source: CONTEXT D-01..D-09):
- D-01: `SnippetPlaceholder['type'] = 'free-text' | 'choice'`
- D-02: field renamed `joinSeparator` → `separator`; default `', '`
- D-03: `SnippetService.load`/`listFolder` return `JsonSnippet & { validationError: string | null }`
- D-04: validation copy surfaces in SnippetEditorModal banner + RunnerView error-panel
- D-05: fill-in modal renders `choice` as checkbox-list with `isMulti: true` always
- D-06: Phase 31 Custom free-text override preserved
- D-07: `unit` field removed; `renderSnippet` loses the `number + unit` branch
- D-08: options-list add/edit/remove roundtrip regression (bug "not reproducible" per RESEARCH — lock functional coverage)
- D-09: empty choice (0 checked + empty Custom) → `''`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-json-placeholder-rework/52-CONTEXT.md
@.planning/phases/52-json-placeholder-rework/52-RESEARCH.md
@.planning/phases/52-json-placeholder-rework/52-VALIDATION.md
@.planning/notes/json-snippet-placeholder-rework.md
@CLAUDE.md

<interfaces>
<!-- Types the test files import — extracted so executor doesn't have to open src/ during RED. -->

From src/snippets/snippet-model.ts (CURRENT, still 4-type union as of Wave 0 start):
```typescript
export interface SnippetPlaceholder {
  id: string;
  label: string;
  type: 'free-text' | 'choice' | 'multi-choice' | 'number';
  options?: string[];
  unit?: string;
  joinSeparator?: string;
}
export interface JsonSnippet {
  readonly kind: 'json';
  path: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
  id?: string;
  // Phase 52 Plan 02 will add: validationError: string | null
}
export type Snippet = JsonSnippet | MdSnippet;
```

From src/snippets/snippet-service.ts (public surface):
```typescript
class SnippetService {
  async load(path: string): Promise<Snippet | null>;
  async listFolder(folderPath: string): Promise<{ folders: string[]; snippets: Snippet[] }>;
  async save(snippet: Snippet): Promise<void>;
  async exists(path: string): Promise<boolean>;
}
```

Mock App surface the snippet-service tests use (see src/__tests__/snippet-service-move.test.ts for prior-art pattern):
```typescript
const mockApp = {
  vault: {
    adapter: {
      exists: vi.fn(),
      read: vi.fn(),
      list: vi.fn(),
      write: vi.fn(),
    },
    create: vi.fn(),
    getAbstractFileByPath: vi.fn(),
    trash: vi.fn(),
    rename: vi.fn(),
  },
};
```
</interfaces>

<banner_and_error_copy>
<!-- Russian validation copy the tests assert — LOCKED here once so Plan 02/04 use the exact same strings. -->

Text A — emitted by `validatePlaceholders` helper (Plan 02) for legacy type:
```
Плейсхолдер "{id}" использует удалённый тип "{type}". Пересоздайте плейсхолдер вручную — автоматическая миграция не выполняется.
```

Text B — emitted by `validatePlaceholders` for `choice` with invalid options:
```
Плейсхолдер "{id}" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.
```

Text C — shown in SnippetEditorModal banner (Plan 04), wraps Text A/B with the snippet context:
```
Сниппет "{name}" не может быть использован: {textAorB}
```

Text D — shown in RunnerView error-panel (Plan 04), wraps Text A/B with node + path context:
```
Snippet-узел "{nodeId}": сниппет "{path}" не может быть использован. {textAorB}
```

Style precedent: Phase 50.1 D-04..D-08 (`.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md`) — subject in quotes, imperative fix, "автоматическая миграция не выполняется" hint.
</banner_and_error_copy>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Vault `.json` file → SnippetService | User-authored JSON parsed and rendered into Runner + Editor DOM |
| validation error string → SnippetEditorModal banner DOM | Error copy is interpolated from `ph.id` / `ph.type` string literals read from disk |
| validation error string → RunnerView error panel DOM | Same source; rendered via renderError `createEl('li', { text })` pattern |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-52-01 | Tampering | banner / error-panel DOM | mitigate | Assert tests use `textContent` (Obsidian `createEl({ text })` or `el.textContent = …`) — NEVER `innerHTML`. Acceptance criterion: grep `innerHTML` absent in new files. |
| T-52-02 | Information Disclosure | validationError leak from `vault.adapter.read` error | accept | N/A — file is user's own vault; validation copy exposes only path + type name the user authored. |
| T-52-03 | Tampering | crafted Unicode in `ph.id` / `ph.type` rendered into banner | mitigate | `sanitizeJson` strips U+0000–U+001F/U+007F on save (snippet-service.ts:479); Wave 0 tests assert banner uses `textContent` so crafted chars render literally, not as HTML. |

**Acceptance criterion (enforced across Plans 01-04):** `grep -rn "innerHTML" src/__tests__/snippet-service-validation.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts` returns **zero matches**.
</threat_model>

<tasks>

<task id="52-01-01" type="auto" tdd="true">
  <title>Task 01: Update existing snippet-model.test.ts fixtures for two-type union + separator field</title>
  <read_first>
    - src/__tests__/snippet-model.test.ts (entire — 85 lines)
    - src/snippets/snippet-model.ts (lines 1-113, especially interface SnippetPlaceholder at :4-14 and renderSnippet at :81-98)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Dead-Code Audit — Legacy Types" → subsection "src/__tests__/snippet-model.test.ts"
  </read_first>
  <behavior>
    - Test 1 (KEEP, unchanged): `has optional options field for choice/multi-choice` → rename describe case to `has optional options field for choice` (drop `/multi-choice` wording; fixture already uses `type: 'choice'` so no code change to assertion).
    - Test 2 (DELETE): `has optional unit field for number placeholders` — whole `it(...)` block removed; literal `type: 'number'` and `unit:` are forbidden under the Plan-02 narrowed union.
    - Test 3 (REWRITE): `has optional joinSeparator field for multi-choice placeholders` → `has optional separator field for choice placeholders`; fixture: `{ id: 'findings', label: 'Findings', type: 'choice', separator: ' and ', options: ['a', 'b'] }` with `expect(p.separator).toBe(' and ')`.
    - Test 4 (KEEP, REWRITE fixture): renderSnippet snippet fixture at :30-41 drops the `size` / `number` / `unit` placeholder entirely. New placeholders array: `[{ id: 'age', label: 'Age', type: 'free-text' }, { id: 'laterality', label: 'Side', type: 'choice', options: ['Left', 'Right'] }]`. Update template string at :35 to `'Patient age: {{age}}. Side: {{laterality}}.'` (drop ` Size: {{size}}.`).
    - Test 5 (DELETE): `renders number placeholder with unit suffix` — `size` placeholder is gone; test block removed.
    - Test 6 (KEEP): `substitutes free-text placeholder tokens` — values map drops `size`.
    - Test 7 (KEEP): `leaves unfilled tokens as empty string` — values map drops `size`.
    - Test 8 (REWRITE): `joins multi-choice values with joinSeparator` → `renders choice placeholder with pre-joined multi values`. The new `renderSnippet` contract (RESEARCH §Proposed renderSnippet) is pure string-replace — caller pre-joins. Fixture uses `type: 'choice'` with `separator: ' and '` + `options: ['cyst', 'mass']`. Input values: `{ f: 'cyst and mass' }`. Expected output unchanged: `'Findings: cyst and mass.'`. This test proves the renderSnippet surface is stable across the D-07 contract change.
    - Test 9 (KEEP): all three `slugifyLabel` tests unchanged.
    - Add JsonSnippet field `validationError: null` to EVERY `SnippetFile` fixture in this file (currently 2 fixtures at :30-41 and :62-66). Required because Plan 02 will add `validationError: string | null` as a non-optional field to JsonSnippet, so tsc will red-trip these fixtures otherwise at Plan-02-start.
  </behavior>
  <action>
    Edit `src/__tests__/snippet-model.test.ts` in place. Do not delete unrelated code (slugifyLabel tests, `SnippetFile` / `SnippetPlaceholder` imports).

    Step 1 — Delete the `has optional unit field for number placeholders` `it(...)` block (current :14-19).

    Step 2 — Rename describe `SnippetPlaceholder interface (SNIP-02, D-16)` stays the same (still valid identifier).

    Step 3 — Replace the `has optional joinSeparator field for multi-choice placeholders` block (current :21-26) with:

    ```typescript
    it('has optional separator field for choice placeholders (D-02)', () => {
      const p: SnippetPlaceholder = {
        id: 'findings', label: 'Findings', type: 'choice',
        options: ['cyst', 'mass'], separator: ' and ',
      };
      expect(p.separator).toBe(' and ');
    });
    ```

    Step 4 — Rewrite `renderSnippet (SNIP-02)` fixture at :30-41 to:

    ```typescript
    const snippet: SnippetFile = {
      kind: 'json',
      path: '.radiprotocol/snippets/liver-report.json',
      id: 'liver-report',
      name: 'Liver report',
      template: 'Patient age: {{age}}. Side: {{laterality}}.',
      placeholders: [
        { id: 'age', label: 'Age', type: 'free-text' },
        { id: 'laterality', label: 'Side', type: 'choice', options: ['Left', 'Right'] },
      ],
      validationError: null,
    };
    ```

    Step 5 — Delete `renders number placeholder with unit suffix` block (current :48-51).

    Step 6 — Fix the remaining two `renderSnippet(snippet, { age: ..., laterality: ..., size: ... })` calls: drop `size` from values maps.

    Step 7 — Replace the `renderSnippet multi-choice (SNIP-02)` describe + its single `it(...)` at :59-70 with:

    ```typescript
    describe('renderSnippet choice (D-02, D-05)', () => {
      it('inserts pre-joined choice values verbatim (caller pre-joins with separator)', () => {
        const s: SnippetFile = {
          kind: 'json',
          path: '.radiprotocol/snippets/findings.json',
          id: 'findings', name: 'Findings',
          template: 'Findings: {{f}}.',
          placeholders: [{
            id: 'f', label: 'Findings', type: 'choice',
            options: ['cyst', 'mass'], separator: ' and ',
          }],
          validationError: null,
        };
        const result = renderSnippet(s, { f: 'cyst and mass' });
        expect(result).toBe('Findings: cyst and mass.');
      });
    });
    ```

    Step 8 — Leave `slugifyLabel` tests (:72-84) byte-identical.
  </action>
  <acceptance_criteria>
    - `grep -c "type: 'number'" src/__tests__/snippet-model.test.ts` equals `0`
    - `grep -c "'multi-choice'" src/__tests__/snippet-model.test.ts` equals `0`
    - `grep -c "joinSeparator" src/__tests__/snippet-model.test.ts` equals `0`
    - `grep -c "unit:" src/__tests__/snippet-model.test.ts` equals `0`
    - `grep -c "validationError: null" src/__tests__/snippet-model.test.ts` is `≥ 2` (both SnippetFile fixtures)
    - `grep -c "separator: ' and '" src/__tests__/snippet-model.test.ts` is `≥ 2` (SnippetPlaceholder test + renderSnippet-choice fixture)
    - `npx vitest run src/__tests__/snippet-model.test.ts` exits with code `0` (tests still pass under the CURRENT 4-type union — we only removed/renamed our own `'number'`/`'multi-choice'` usage; separator/validationError are NEW fields that tsc will green-light as excess properties on the current interface until Plan 02 narrows).
    - **Deviation note:** if tsc red-trips because `validationError` is not in current `JsonSnippet`, use a `satisfies` cast: `{ ... } satisfies SnippetFile` — OR cast `as SnippetFile` to tolerate the pre-narrowing shape. Executor decides based on tsc output.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/snippet-model.test.ts</automated>
  </verify>
  <done>
    snippet-model.test.ts uses only `'free-text' | 'choice'` literals, `separator` instead of `joinSeparator`, no `unit:` fixtures, `validationError: null` on every `JsonSnippet`/`SnippetFile` fixture, all existing assertions still pass against the current (pre-narrow) model.
  </done>
</task>

<task id="52-01-02" type="auto" tdd="true">
  <title>Task 02: Update runner-snippet-picker.test.ts fakeSnippet fixtures with validationError</title>
  <read_first>
    - src/__tests__/views/runner-snippet-picker.test.ts (lines 300-330, 470-500 — surrounding the `fakeSnippet` objects at :316 and :479)
    - src/snippets/snippet-model.ts :26-37 (JsonSnippet interface)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Common Pitfalls" → Pitfall 1 + Pitfall 5 (test fixtures must declare validationError: null)
  </read_first>
  <behavior>
    - Every `{ kind: 'json', path, name, template, placeholders }` literal in `runner-snippet-picker.test.ts` acquires a `validationError: null` field so the Plan 02 type narrowing does not red-trip the file at tsc time.
    - ALSO add a new fixture `fakeBrokenSnippet` that will exercise Plan 04's `validationError !== null` guard — placed near `fakeSnippet` and exported/used later by Plan 04 Task 04. For this plan, the fixture exists but is unused (TypeScript accepts it; unused-variable is warning-level at most).
  </behavior>
  <action>
    Step 1 — Grep the file for `kind: 'json'` and add `validationError: null` to every matching fixture:

    ```bash
    grep -n "kind: 'json'" src/__tests__/views/runner-snippet-picker.test.ts
    ```

    Expected hits (per RESEARCH): lines near :316 and :479, plus any other picker-mock fixture. Executor enumerates exhaustively and edits each.

    Example patch:
    ```typescript
    // BEFORE (:316 shape)
    const fakeSnippet: JsonSnippet = {
      kind: 'json',
      path: 'Protocols/Snippets/foo.json',
      name: 'foo',
      template: 'Hello {{name}}',
      placeholders: [{ id: 'name', label: 'Name', type: 'free-text' }],
    };

    // AFTER
    const fakeSnippet: JsonSnippet = {
      kind: 'json',
      path: 'Protocols/Snippets/foo.json',
      name: 'foo',
      template: 'Hello {{name}}',
      placeholders: [{ id: 'name', label: 'Name', type: 'free-text' }],
      validationError: null,
    };
    ```

    Step 2 — Append a Phase-52 describe block at the END of the file (append-only, per CLAUDE.md Standing Pitfall 7 "never remove existing code you didn't add"):

    ```typescript
    describe('Phase 52 D-04 — validationError fixtures', () => {
      // Fixture used by Plan 04 Task 04 to drive the error-panel path.
      // Declared here so Plan 04 can import it without touching this file again.
      it('declares a broken-snippet fixture with a non-null validationError', () => {
        const broken: JsonSnippet = {
          kind: 'json',
          path: 'Protocols/Snippets/broken.json',
          name: 'broken',
          template: 'Value: {{v}}',
          placeholders: [{ id: 'v', label: 'Value', type: 'choice', options: [] }],
          validationError: 'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
        };
        expect(broken.validationError).not.toBeNull();
      });
    });
    ```

    **Important:** `validationError` is not in the current `JsonSnippet` interface. Use `satisfies JsonSnippet` OR wrap in `as JsonSnippet & { validationError: string | null }` — executor picks whichever keeps tsc green under the CURRENT model. Plan 02 will retrofit the interface and this cast becomes unnecessary but harmless.
  </action>
  <acceptance_criteria>
    - `grep -c "validationError: null" src/__tests__/views/runner-snippet-picker.test.ts` is `≥ N` where N = count of `kind: 'json'` fixtures (verify N by `grep -c "kind: 'json'" src/__tests__/views/runner-snippet-picker.test.ts`)
    - `grep -c "describe('Phase 52 D-04" src/__tests__/views/runner-snippet-picker.test.ts` equals `1`
    - `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts` exits `0`
    - No existing tests in this file regress (counts preserved: read baseline `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts` before edit; final count must equal baseline + 1 new `it` from the Phase 52 describe).
    - No deletions of pre-existing content in this file: `git diff src/__tests__/views/runner-snippet-picker.test.ts | grep "^-" | grep -v "^---" | wc -l` reports only lines that are replaced in the fixture patches (no block deletions).
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-picker.test.ts</automated>
  </verify>
  <done>
    Every existing `kind: 'json'` fixture in runner-snippet-picker.test.ts declares `validationError: null`; one new broken-snippet fixture exists in an appended describe; pre-existing tests still pass; zero unrelated deletions.
  </done>
</task>

<task id="52-01-03" type="auto" tdd="true">
  <title>Task 03: Create snippet-service-validation.test.ts (D-03 RED)</title>
  <read_first>
    - src/snippets/snippet-service.ts (entire — focus on listFolder :86-148 and load :155-180)
    - src/__tests__/snippet-service-move.test.ts (read lines 1-60 for the App mock pattern used in snippet-service tests)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Phase 52 Target Flow" + §"Code Examples" → `validatePlaceholders` helper (Plan 02 will implement this)
    - .planning/phases/52-json-placeholder-rework/52-CONTEXT.md §D-03
  </read_first>
  <behavior>
    RED tests for the D-03 contract. All tests fail until Plan 02 adds `validationError` to JsonSnippet and wires validatePlaceholders into SnippetService.load + listFolder.
    - Test 1: `load(path)` returns `{ kind: 'json', ..., validationError: null }` for a valid `.json` with two valid placeholders (`free-text` + `choice` with options).
    - Test 2: `load(path)` returns `{ ..., validationError: <string matching /удалённый тип "number"/> }` when `.json` declares `type: 'number'`.
    - Test 3: `load(path)` returns `{ ..., validationError: <string matching /удалённый тип "multichoice"/> }` when `.json` declares `type: 'multichoice'`.
    - Test 4: `load(path)` returns `{ ..., validationError: <string matching /удалённый тип "multi-choice"/> }` when `.json` declares `type: 'multi-choice'`.
    - Test 5: `load(path)` returns `{ ..., validationError: <string matching /не содержит ни одного варианта/> }` when `.json` declares `type: 'choice'` with `options: []` (or missing options).
    - Test 6: `listFolder(folder)` includes the broken snippet in the returned `snippets` array with `validationError !== null` (matches Test 2-5 inputs).
    - Test 7: `listFolder(folder)` entries for valid `.json` files carry `validationError: null`.
    - Test 8: `listFolder(folder)` silently skips syntax-broken JSON (JSON.parse throws) — preserves current silent-skip D-03 contract; broken-syntax file NOT in returned snippets.
    - Test 9: `load(path)` returns `null` (not a JsonSnippet-with-validationError) for syntax-broken JSON — preserves current behaviour.
    - Test 10: `.md` snippets are unaffected — no `validationError` field, returned as MdSnippet.
  </behavior>
  <action>
    Create NEW file `src/__tests__/snippet-service-validation.test.ts`. Start with:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { SnippetService } from '../snippets/snippet-service';
    import type { App } from 'obsidian';

    type MockAdapter = {
      exists: ReturnType<typeof vi.fn>;
      read: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
    };

    function makeMockApp(files: Record<string, string>, folderList: { files: string[]; folders: string[] }): { app: App; adapter: MockAdapter } {
      const adapter: MockAdapter = {
        exists: vi.fn(async (p: string) => p in files || p === 'Protocols/Snippets'),
        read: vi.fn(async (p: string) => {
          if (!(p in files)) throw new Error(`ENOENT: ${p}`);
          return files[p];
        }),
        list: vi.fn(async () => folderList),
      };
      const app = { vault: { adapter } } as unknown as App;
      return { app, adapter };
    }

    const settings = { snippetFolderPath: 'Protocols/Snippets' } as const;

    describe('SnippetService.load — Phase 52 D-03 validationError', () => {
      it('returns validationError: null for a valid choice placeholder with options', async () => {
        const path = 'Protocols/Snippets/ok.json';
        const raw = JSON.stringify({
          template: 'Side: {{s}}',
          placeholders: [{ id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] }],
        });
        const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        expect(snippet).not.toBeNull();
        expect(snippet?.kind).toBe('json');
        if (snippet?.kind !== 'json') return;
        expect(snippet.validationError).toBeNull();
      });

      it('returns validationError citing "number" for legacy number type', async () => {
        const path = 'Protocols/Snippets/legacy-num.json';
        const raw = JSON.stringify({
          template: 'Size: {{sz}}',
          placeholders: [{ id: 'sz', label: 'Size', type: 'number', unit: 'mm' }],
        });
        const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        expect(snippet?.kind).toBe('json');
        if (snippet?.kind !== 'json') return;
        expect(snippet.validationError).not.toBeNull();
        expect(snippet.validationError).toMatch(/удалённый тип "number"/);
        expect(snippet.validationError).toMatch(/Плейсхолдер "sz"/);
      });

      it('returns validationError citing "multichoice" for legacy multichoice type', async () => {
        const path = 'Protocols/Snippets/legacy-mc.json';
        const raw = JSON.stringify({
          template: 'F: {{f}}',
          placeholders: [{ id: 'f', label: 'F', type: 'multichoice', options: ['a'] }],
        });
        const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        if (snippet?.kind !== 'json') return;
        expect(snippet.validationError).toMatch(/удалённый тип "multichoice"/);
      });

      it('returns validationError citing "multi-choice" for legacy hyphenated multi-choice type', async () => {
        const path = 'Protocols/Snippets/legacy-mc2.json';
        const raw = JSON.stringify({
          template: 'F: {{f}}',
          placeholders: [{ id: 'f', label: 'F', type: 'multi-choice', options: ['a'] }],
        });
        const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        if (snippet?.kind !== 'json') return;
        expect(snippet.validationError).toMatch(/удалённый тип "multi-choice"/);
      });

      it('returns validationError for choice placeholder with empty options array', async () => {
        const path = 'Protocols/Snippets/empty-choice.json';
        const raw = JSON.stringify({
          template: 'F: {{f}}',
          placeholders: [{ id: 'f', label: 'F', type: 'choice', options: [] }],
        });
        const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        if (snippet?.kind !== 'json') return;
        expect(snippet.validationError).toMatch(/не содержит ни одного варианта/);
        expect(snippet.validationError).toMatch(/Плейсхолдер "f"/);
      });

      it('returns null for syntax-broken JSON (preserves silent-skip)', async () => {
        const path = 'Protocols/Snippets/broken.json';
        const { app } = makeMockApp({ [path]: '{not json' }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        expect(snippet).toBeNull();
      });

      it('returns MdSnippet unaffected (no validationError field on md)', async () => {
        const path = 'Protocols/Snippets/note.md';
        const { app } = makeMockApp({ [path]: '# hi' }, { files: [path], folders: [] });
        const svc = new SnippetService(app, settings as never);
        const snippet = await svc.load(path);
        expect(snippet?.kind).toBe('md');
      });
    });

    describe('SnippetService.listFolder — Phase 52 D-03 validationError', () => {
      it('returns a mix of valid + broken snippets with validationError populated per entry', async () => {
        const root = 'Protocols/Snippets';
        const okPath = `${root}/ok.json`;
        const badPath = `${root}/legacy.json`;
        const okRaw = JSON.stringify({
          template: 'Side: {{s}}',
          placeholders: [{ id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] }],
        });
        const badRaw = JSON.stringify({
          template: 'Sz: {{sz}}',
          placeholders: [{ id: 'sz', label: 'Sz', type: 'number' }],
        });
        const { app } = makeMockApp(
          { [okPath]: okRaw, [badPath]: badRaw },
          { files: [okPath, badPath], folders: [] },
        );
        const svc = new SnippetService(app, settings as never);
        const { snippets } = await svc.listFolder(root);
        const ok = snippets.find(s => s.name === 'ok');
        const bad = snippets.find(s => s.name === 'legacy');
        expect(ok?.kind).toBe('json');
        expect(bad?.kind).toBe('json');
        if (ok?.kind === 'json') expect(ok.validationError).toBeNull();
        if (bad?.kind === 'json') expect(bad.validationError).toMatch(/удалённый тип "number"/);
      });

      it('silently skips syntax-broken .json (not in returned snippets)', async () => {
        const root = 'Protocols/Snippets';
        const brokenPath = `${root}/corrupt.json`;
        const { app } = makeMockApp(
          { [brokenPath]: '{not json' },
          { files: [brokenPath], folders: [] },
        );
        const svc = new SnippetService(app, settings as never);
        const { snippets } = await svc.listFolder(root);
        expect(snippets.find(s => s.name === 'corrupt')).toBeUndefined();
      });
    });
    ```

    **Expected state after write:** every test fails with `TypeError: Cannot read properties of undefined (reading 'validationError')` or similar — the production `snippet.validationError` field does not yet exist. This is the RED state.
  </action>
  <acceptance_criteria>
    - File `src/__tests__/snippet-service-validation.test.ts` exists.
    - File imports only from `vitest`, `../snippets/snippet-service`, and type-only `obsidian` — no `innerHTML` references.
    - File contains exactly 9 `it(...)` blocks inside 2 `describe(...)` blocks (count: `grep -c "  it(" src/__tests__/snippet-service-validation.test.ts` ≥ 9).
    - `grep -c "validationError" src/__tests__/snippet-service-validation.test.ts` ≥ 10.
    - `grep -c "innerHTML" src/__tests__/snippet-service-validation.test.ts` equals `0`.
    - `npx vitest run src/__tests__/snippet-service-validation.test.ts` exits NON-ZERO (expected RED) — at least 5 of the new tests must fail with a message indicating `validationError` is undefined, `.toMatch(/удалённый тип/)` failed, or similar. Zero non-Phase-52 tests regress.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/snippet-service-validation.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    snippet-service-validation.test.ts exists with 9 RED tests covering D-03 load + listFolder + legacy-syntax preservation + .md unaffected-ness; every test references the locked Russian copy format from `<banner_and_error_copy>` in this plan's context.
  </done>
</task>

<task id="52-01-04" type="auto" tdd="true">
  <title>Task 04: Create snippet-fill-in-modal.test.ts (D-05/D-06/D-09 RED)</title>
  <read_first>
    - src/views/snippet-fill-in-modal.ts (lines 85-212 — renderField dispatch + renderChoiceField)
    - src/__tests__/snippet-model.test.ts (pattern reference for Snippet fixtures)
    - .planning/phases/52-json-placeholder-rework/52-CONTEXT.md §D-05, §D-06, §D-09
  </read_first>
  <behavior>
    RED tests for Plan 03's unified-choice rendering contract. Uses jsdom (vitest default).
    - Test 1 (D-05 render): a `choice` placeholder with 3 options renders 3 `input[type=checkbox]` controls (NOT radios) + one `Custom:` text input.
    - Test 2 (D-05 empty = ''): opening modal, confirming without checking anything, with empty Custom → the resolved renderSnippet output substitutes `{{id}}` with `''`.
    - Test 3 (D-05 single = verbatim): check a single box, confirm → rendered output contains the option value verbatim.
    - Test 4 (D-05 multi + default separator): check 2 boxes, no `separator` field, confirm → values joined by `, `.
    - Test 5 (D-05 multi + override separator): check 2 boxes, placeholder has `separator: ' / '`, confirm → values joined by ` / `.
    - Test 6 (D-05 order = array order not click order): options `['a','b','c']`; click order c, a, b; result order = `a, b, c`.
    - Test 7 (D-06 Custom override): check 2 boxes, THEN type into Custom — result = Custom text only, checkboxes are cleared.
    - Test 8 (D-06 Custom empty falls back to checkboxes): check a box, type into Custom then clear Custom → checkbox value wins again.
    - Test 9 (free-text unchanged): free-text placeholder renders a text input; typed value appears in result.
  </behavior>
  <action>
    Create NEW file `src/__tests__/views/snippet-fill-in-modal.test.ts` with the skeleton:

    ```typescript
    import { describe, it, expect, beforeEach, vi } from 'vitest';
    import { SnippetFillInModal } from '../../views/snippet-fill-in-modal';
    import type { JsonSnippet } from '../../snippets/snippet-model';

    // Minimal App mock — SnippetFillInModal only uses App for Modal plumbing which
    // the obsidian stub already provides in src/__tests__/__mocks__/obsidian.ts
    // (if that mock does not exist yet, create an inline stub here — executor's choice).
    const app = {} as never;

    function makeSnippet(placeholders: JsonSnippet['placeholders'], template = 'R: {{f}}'): JsonSnippet {
      return {
        kind: 'json',
        path: 'Protocols/Snippets/t.json',
        name: 't',
        template,
        placeholders,
        validationError: null,
      };
    }

    describe('SnippetFillInModal Phase 52 D-05 — unified choice renders as checkboxes', () => {
      it('renders checkbox inputs (not radios) for choice with options', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const checkboxes = modal.contentEl.querySelectorAll('input[type="checkbox"]');
        const radios = modal.contentEl.querySelectorAll('input[type="radio"]');
        expect(checkboxes.length).toBe(3);
        expect(radios.length).toBe(0);
        modal.onClose();
      });

      it('resolves with empty string in value map when no checkbox + empty custom (D-09)', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        // simulate clicking Confirm button
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: ');
        modal.onClose();
      });

      it('inserts a single checked option verbatim', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['alpha', 'beta'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const [first] = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        first.checked = true;
        first.dispatchEvent(new Event('change'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: alpha');
        modal.onClose();
      });

      it('joins multiple checked options with default separator ", "', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const boxes = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        boxes[0].checked = true;
        boxes[0].dispatchEvent(new Event('change'));
        boxes[2].checked = true;
        boxes[2].dispatchEvent(new Event('change'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: a, c');
        modal.onClose();
      });

      it('joins multiple checked options with override separator " / " (D-02)', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'], separator: ' / ' },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const boxes = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
        boxes[1].checked = true; boxes[1].dispatchEvent(new Event('change'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: a / b');
        modal.onClose();
      });

      it('preserves array order in joined output (not click order)', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const boxes = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        // Click order: c, a, b
        boxes[2].checked = true; boxes[2].dispatchEvent(new Event('change'));
        boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
        boxes[1].checked = true; boxes[1].dispatchEvent(new Event('change'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: a, b, c');
        modal.onClose();
      });
    });

    describe('SnippetFillInModal Phase 52 D-06 — Custom override preserved', () => {
      it('Custom non-empty text overrides checkboxes', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const boxes = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
        boxes[1].checked = true; boxes[1].dispatchEvent(new Event('change'));
        const customInput = modal.contentEl.querySelector<HTMLInputElement>('.rp-snippet-modal-custom-row input[type="text"]');
        if (!customInput) throw new Error('Custom input missing');
        customInput.value = 'customX';
        customInput.dispatchEvent(new Event('input'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: customX');
        modal.onClose();
      });

      it('Custom emptied falls back to checkbox values', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
        ]);
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const boxes = Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
        const customInput = modal.contentEl.querySelector<HTMLInputElement>('.rp-snippet-modal-custom-row input[type="text"]');
        if (!customInput) throw new Error('Custom input missing');
        customInput.value = 'override';
        customInput.dispatchEvent(new Event('input'));
        // Now clear Custom
        customInput.value = '';
        customInput.dispatchEvent(new Event('input'));
        // Re-check the box (because Custom input listener clears all boxes when non-empty)
        boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: a');
        modal.onClose();
      });
    });

    describe('SnippetFillInModal Phase 52 — free-text unchanged', () => {
      it('renders a text input for free-text and inserts its value', async () => {
        const snippet = makeSnippet([
          { id: 'f', label: 'F', type: 'free-text' },
        ], 'R: {{f}}');
        const modal = new SnippetFillInModal(app, snippet);
        modal.onOpen();
        const textInput = modal.contentEl.querySelector<HTMLInputElement>('input[type="text"]');
        if (!textInput) throw new Error('Text input missing');
        textInput.value = 'hello';
        textInput.dispatchEvent(new Event('input'));
        const confirmBtn = Array.from(modal.contentEl.querySelectorAll('button'))
          .find(b => b.textContent === 'Confirm') as HTMLButtonElement;
        confirmBtn.click();
        const result = await modal.result;
        expect(result).toBe('R: hello');
        modal.onClose();
      });
    });
    ```

    **Pre-emptive note for executor:** If Obsidian's `Modal` stub in `src/__tests__/__mocks__/obsidian.ts` lacks `contentEl`, `titleEl`, `open()`, `close()`, extend the stub — do NOT stub SnippetFillInModal. The real path is under test. If the test file already mocks Modal inline per some project convention, follow that convention.

  </action>
  <acceptance_criteria>
    - File `src/__tests__/views/snippet-fill-in-modal.test.ts` exists.
    - `grep -c "  it(" src/__tests__/views/snippet-fill-in-modal.test.ts` ≥ 9.
    - `grep -c "innerHTML" src/__tests__/views/snippet-fill-in-modal.test.ts` equals `0`.
    - `grep -c "input\[type=\"checkbox\"\]" src/__tests__/views/snippet-fill-in-modal.test.ts` ≥ 5.
    - `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` — at least 5 tests fail (expected RED because Plan 03 has not narrowed `renderField` dispatch yet; D-05 checkbox-only assertion will fail since the current dispatch renders radios for `'choice'`).
    - Zero non-Phase-52 regressions anywhere in the suite.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts 2>&1 | tail -30</automated>
  </verify>
  <done>
    snippet-fill-in-modal.test.ts exists with 9 tests covering D-05 checkbox rendering, D-05 separator logic (default + override), D-05 array-order preservation, D-06 Custom override, D-09 empty state, and free-text unchanged behaviour.
  </done>
</task>

<task id="52-01-05" type="auto" tdd="true">
  <title>Task 05: Create snippet-chip-editor.test.ts + snippet-editor-modal-banner.test.ts (D-04/D-08 RED)</title>
  <read_first>
    - src/views/snippet-chip-editor.ts (lines 380-445 — renderOptionRows + `+ Add option` button + join separator section)
    - src/views/snippet-editor-modal.ts (lines 327-370 — renderContentRegion; 431-445 — updateCollisionUI pattern)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"D-08 Bug Repro Report" (bug NOT reproducible; SC 2 satisfied by functional regression suite)
    - .planning/phases/52-json-placeholder-rework/52-CONTEXT.md §D-04, §D-08
  </read_first>
  <behavior>
    Two separate test files, merged into one task because both are small.

    **File A: `src/__tests__/views/snippet-chip-editor.test.ts`** (SC 2 + Phase 52 type-select):
    - Test A1: `mountChipEditor(container, draft, onChange)` with a draft containing one empty placeholder — the mini type-select dropdown shows exactly 2 options with values `'free-text'` and `'choice'` (NOT `'number'` or `'multi-choice'`). This test RED until Plan 03 narrows the selector.
    - Test A2: options-list roundtrip — click `+ Add option`, type value, assert `draft.placeholders[0].options[0]` mutates; click `×` remove, assert option length decrements; type into existing option, assert index mutates. Passes against current implementation (RESEARCH §D-08 verdict: bug non-reproducible). This is the SC 2 regression-guard; it stays GREEN even pre-Plan-03.
    - Test A3: expanded-placeholder type-change dropdown for an existing `choice` placeholder shows exactly 2 options `free-text` and `choice` — RED until Plan 03 narrows `phTypesLocal`.
    - Test A4: a `choice` placeholder's expanded form renders a "Разделитель" (or equivalent label — executor picks; locked by Plan 03 CSS/DOM) input bound to `ph.separator` (not `ph.joinSeparator`). RED until Plan 03 renames.
    - Test A5: `PH_COLOR` has exactly 2 keys after Plan 03 — probe by asserting that a placeholder created with `type: 'choice'` renders with a non-empty `border-left-color`, and one created hypothetically with any removed type would fall back to `'transparent'`. (Static import assertion preferred — import `PH_COLOR` if exported, else skip this test as a probe and document.)

    **File B: `src/__tests__/views/snippet-editor-modal-banner.test.ts`** (D-04):
    - Test B1: opening the modal in edit mode with a snippet whose `validationError !== null` causes a banner element (class `radi-snippet-editor-validation-banner` or `rp-validation-banner`) to appear in `modal.contentEl`. RED until Plan 04 lands.
    - Test B2: same setup → Save button (found by text `'Сохранить'`) has `.disabled === true`. RED.
    - Test B3: banner `textContent` contains the snippet's `validationError` string verbatim. RED.
    - Test B4: banner uses `textContent` not `innerHTML` — assert `element.innerHTML` does NOT contain HTML tags injected from the error string. Use a validation error with a `<script>` substring; assert `banner.textContent.includes('<script>')` is true AND `banner.querySelector('script')` is `null`. RED (no banner yet) — once banner lands, this guards T-52-03.
    - Test B5: valid snippet (`validationError: null`) → NO banner, Save button enabled. Baseline assertion; should pass already (no banner rendering code exists), so this test is GREEN pre-Plan-04. Document as the control-group.
  </behavior>
  <action>
    **Step 1 — Create `src/__tests__/views/snippet-chip-editor.test.ts`:**

    Structure the file with 5 `it(...)` blocks inside 2 `describe(...)` blocks (one for the Phase 52 narrowing probes, one for SC 2 options roundtrip). Import from `../../views/snippet-chip-editor`. Mount editor into a fresh `document.createElement('div')` container per test. Use `onChange = vi.fn()`. Assert `onChange` is called after each mutation.

    Example skeleton for Test A2 (the GREEN one):
    ```typescript
    describe('snippet-chip-editor Phase 52 — options-list roundtrip (SC 2 regression guard)', () => {
      it('+ Add option → type → × remove mutates draft.placeholders', () => {
        const draft: JsonSnippet = {
          kind: 'json', path: 't.json', name: 't', template: '{{f}}',
          placeholders: [{ id: 'f', label: 'F', type: 'choice', options: [] }],
          validationError: null,
        };
        const container = document.createElement('div');
        document.body.appendChild(container);
        const onChange = vi.fn();
        mountChipEditor(container, draft, onChange);
        // Expand the chip
        const chip = container.querySelector('.rp-placeholder-chip') as HTMLElement;
        chip.click();
        // Find the + Add option button
        const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Add option')) as HTMLButtonElement;
        addBtn.click();
        expect(draft.placeholders[0].options).toHaveLength(1);
        expect(onChange).toHaveBeenCalled();
        // Type a value
        const optInput = container.querySelector<HTMLInputElement>('.rp-option-row input[type="text"]');
        if (!optInput) throw new Error('option input missing');
        optInput.value = 'left';
        optInput.dispatchEvent(new Event('input'));
        expect(draft.placeholders[0].options?.[0]).toBe('left');
        // Remove
        const removeBtn = container.querySelector<HTMLButtonElement>('.rp-option-row button');
        if (!removeBtn) throw new Error('remove button missing');
        removeBtn.click();
        expect(draft.placeholders[0].options).toHaveLength(0);
      });
    });
    ```

    For Tests A1/A3/A4 (Phase 52 RED), write assertions against the NARROWED DOM state (2 options in select, "Разделитель" label, `ph.separator` field usage). These fail against the current implementation, proving RED.

    **Step 2 — Create `src/__tests__/views/snippet-editor-modal-banner.test.ts`:**

    Mount `SnippetEditorModal` in edit mode with a broken snippet fixture:
    ```typescript
    const brokenSnippet: JsonSnippet = {
      kind: 'json',
      path: 'Protocols/Snippets/broken.json',
      name: 'broken',
      template: 'V: {{v}}',
      placeholders: [{ id: 'v', label: 'V', type: 'choice', options: [] }],
      validationError: 'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    };
    ```

    Mock the plugin object minimally: `{ settings: { snippetFolderPath: 'Protocols/Snippets' }, snippetService: { exists: vi.fn().mockResolvedValue(false), listFolderDescendants: vi.fn().mockResolvedValue({ folders: [], files: [], total: 0 }), save: vi.fn(), moveSnippet: vi.fn(), renameSnippet: vi.fn() } }`. Mock App stub for Modal plumbing.

    Each test opens a fresh modal, awaits `onOpen()` (it's async), performs assertions against `modal.contentEl`, then `modal.close()`.

    **Note on setup pain:** SnippetEditorModal has heavy async onOpen (folder dropdown). If the test infrastructure gets ugly, executor may reduce B1-B4 to a single integration test that sets the broken draft and asserts banner+disabled-save together. Plan-level contract: D-04 is covered by AT LEAST ONE failing test. Executor must NOT skip D-04 entirely.
  </action>
  <acceptance_criteria>
    - File `src/__tests__/views/snippet-chip-editor.test.ts` exists with `grep -c "  it(" ...` ≥ 5.
    - File `src/__tests__/views/snippet-editor-modal-banner.test.ts` exists with `grep -c "  it(" ...` ≥ 4.
    - Neither file contains the string `innerHTML` (grep check equals 0).
    - Running `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts`: Test A2 passes (GREEN); Tests A1/A3/A4 fail (RED — type selector still has 4 options, `joinSeparator` still used).
    - Running `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts`: Tests B1-B4 fail (RED — banner rendering not yet implemented); Test B5 either passes (GREEN control) or is skipped with inline comment.
    - Zero regressions outside these two new files.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts 2>&1 | tail -40</automated>
  </verify>
  <done>
    Two test files exist. SC 2 options-list roundtrip is GREEN now (regression guard works on current code, confirming D-08 bug not reproducible). All Phase 52 narrowing + D-04 banner + textContent-safety probes are RED, ready for Plan 02-04 to flip GREEN.
  </done>
</task>

</tasks>

<verification>
After all 5 tasks complete, executor runs:

```bash
npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/views/runner-snippet-picker.test.ts src/__tests__/snippet-service-validation.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts 2>&1 | tail -40
```

Expected outcome: mixed pass/fail.
- `snippet-model.test.ts` — ALL GREEN (fixtures updated; tests still pass under current model + `validationError: null` tolerated as excess property or via cast).
- `runner-snippet-picker.test.ts` — ALL GREEN (fixtures updated + new describe at tail).
- `snippet-service-validation.test.ts` — ≥5 RED (validationError field absent).
- `snippet-fill-in-modal.test.ts` — ≥5 RED (renderField still dispatches 4 types; radios still render for `'choice'`).
- `snippet-chip-editor.test.ts` — A2 GREEN, A1/A3/A4 RED, A5 TBD.
- `snippet-editor-modal-banner.test.ts` — B1-B4 RED, B5 GREEN/skip.

Also run `npm test` and confirm **total failed count equals ~15-20 new Phase-52 RED tests and ZERO regressions** on pre-existing tests. If pre-existing count drops, executor must fix before committing (acceptance rule).
</verification>

<success_criteria>
- 4 new test files in `src/__tests__/` and `src/__tests__/views/`, all syntactically valid, all imported by vitest.
- 2 existing test files have their Phase 52 fixtures updated (snippet-model.test.ts, runner-snippet-picker.test.ts).
- Full suite baseline preserved for non-Phase-52 tests.
- Every new test file: zero `innerHTML` references (T-52-01/T-52-03 compliance).
- Every required Russian error string is referenced verbatim by at least one test (banner + runner-panel + validatePlaceholders text).
- Pre-existing test count delta is only additive: `count_after = count_before + Σ(new it blocks across 4 files)`.
- tsc `npx tsc --noEmit --skipLibCheck` exits `0` — the `validationError: null` cast path compiles under the current (pre-narrow) union.
</success_criteria>

<output>
After completion, create `.planning/phases/52-json-placeholder-rework/52-01-SUMMARY.md` documenting:
- Each task's commit SHA and the RED/GREEN count it produced
- Exact number of new tests added and their RED/GREEN distribution
- Any deviations (e.g. tsc casts added, test-framework skips) per GSD Rule 1/2/3 escalation format
- Baseline test count before this plan and after (confirms zero regressions on pre-existing)
- Note confirming Plans 02-04 can now proceed against a committed RED baseline
</output>
