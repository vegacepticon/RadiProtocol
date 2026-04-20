---
phase: 52
plan: 02
type: tdd
wave: 2
depends_on:
  - 52-01
files_modified:
  - src/snippets/snippet-model.ts
  - src/snippets/snippet-service.ts
  - src/views/snippet-editor-modal.ts
autonomous: true
requirements:
  - PHLD-01
tags:
  - model-narrowing
  - hard-validation
  - green
  - phase-52
must_haves:
  truths:
    - "SnippetPlaceholder.type TypeScript union is exactly 'free-text' | 'choice' — no other literal"
    - "SnippetPlaceholder has a `separator?: string` field; `joinSeparator` and `unit` are gone"
    - "JsonSnippet has a non-optional `validationError: string | null` field"
    - "SnippetService.load returns JsonSnippet with validationError populated from validatePlaceholders helper"
    - "SnippetService.listFolder returns snippets[] where each JsonSnippet has a validationError value (null or a Russian error string)"
    - "Syntax-broken JSON still silently skips (preserved D-03 contract)"
    - "renderSnippet has no special case for number+unit; it is pure string-replace"
    - "All Plan 01 snippet-service-validation.test.ts RED tests flip GREEN"
    - "All Plan 01 snippet-model.test.ts tests still GREEN under the narrowed union"
  artifacts:
    - path: src/snippets/snippet-model.ts
      provides: "narrowed union + separator field + validationError on JsonSnippet + validatePlaceholders helper"
      contains: "export function validatePlaceholders"
    - path: src/snippets/snippet-service.ts
      provides: "load + listFolder return validationError-populated JsonSnippet"
      contains: "validatePlaceholders("
  key_links:
    - from: src/snippets/snippet-service.ts load()
      to: src/snippets/snippet-model.ts validatePlaceholders()
      via: "import + call after JSON.parse"
      pattern: "validatePlaceholders\\(parsed\\.placeholders"
    - from: src/snippets/snippet-service.ts listFolder()
      to: src/snippets/snippet-model.ts validatePlaceholders()
      via: "same import + call inside the JSON branch of the for-loop"
      pattern: "validatePlaceholders\\(parsed\\.placeholders"
    - from: sanitizeJson()
      to: separator (renamed field)
      via: "line replacement of joinSeparator → separator"
      pattern: "separator:"
---

<objective>
Narrow the placeholder model, rename `joinSeparator` → `separator`, drop `unit`, add the `validationError` field on JsonSnippet, and wire `validatePlaceholders` into SnippetService.load + listFolder. Flip all Plan 01 RED tests in `snippet-service-validation.test.ts` to GREEN.

Implements: D-01 (union narrowing), D-02 (separator rename), D-03 (hard-validation in service), D-07 (unit removal + renderSnippet simplification).

Purpose: Model and service tiers must change atomically — the union narrow, the sanitizeJson rename, the validatePlaceholders helper, and the load/listFolder wiring all share the same discriminated-union shape. Splitting would leave tsc red between commits.

Output: A single commit (or atomic pair: "feat + test-flip") that ships the Wave-1/Wave-2 contract from RESEARCH — the TypeScript shape of the snippet subsystem flips to the Phase 52 contract. Views (chip-editor, fill-in modal, editor modal, runner) follow in Plans 03-04.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-json-placeholder-rework/52-CONTEXT.md
@.planning/phases/52-json-placeholder-rework/52-RESEARCH.md
@.planning/phases/52-json-placeholder-rework/52-01-wave0-test-scaffolding-PLAN.md
@.planning/phases/52-json-placeholder-rework/52-01-SUMMARY.md
@CLAUDE.md

<interfaces>
<!-- Target shape of the narrowed model after this plan. Planner locks it here. -->

```typescript
// src/snippets/snippet-model.ts — Phase 52 target
export interface SnippetPlaceholder {
  id: string;
  label: string;
  type: 'free-text' | 'choice';                        // D-01
  /** Predefined options for 'choice' type */
  options?: string[];
  /** Separator between values when multiple choice options selected.
   *  Default: ', '. Used whenever >1 value after merge. (D-02, D-05) */
  separator?: string;
}

export interface JsonSnippet {
  readonly kind: 'json';
  path: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
  /** Phase 52 D-03: non-null when the .json file declares a removed
   *  placeholder type or a 'choice' without valid options. Consumers
   *  MUST check before rendering in Editor/Runner. */
  validationError: string | null;
  /** @deprecated retained for backward-compat of on-disk legacy id field. */
  id?: string;
}

export interface MdSnippet {
  readonly kind: 'md';
  path: string;
  name: string;
  content: string;
  // NO validationError — markdown has no placeholders (RESEARCH A3).
}

export type Snippet = JsonSnippet | MdSnippet;
export type SnippetFile = JsonSnippet;

export function validatePlaceholders(placeholders: unknown): string | null;

export function renderSnippet(snippet: JsonSnippet, values: Record<string, string>): string;

export function slugifyLabel(label: string): string;
```

SnippetService surface (unchanged — only internal implementation changes):
```typescript
class SnippetService {
  async load(path: string): Promise<Snippet | null>;
  async listFolder(folderPath: string): Promise<{ folders: string[]; snippets: Snippet[] }>;
  async save(snippet: Snippet): Promise<void>;   // sanitizeJson uses `separator` not `joinSeparator`
}
```
</interfaces>

<locked_russian_copy>
<!-- Authoritative text for validatePlaceholders — MUST match what Plan 01 tests assert. -->

For legacy type (`'number'` | `'multichoice'` | `'multi-choice'`):
```
Плейсхолдер "{id}" использует удалённый тип "{type}". Пересоздайте плейсхолдер вручную — автоматическая миграция не выполняется.
```

For choice without valid options:
```
Плейсхолдер "{id}" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.
```

These strings MUST match verbatim (character-for-character) the Plan 01 test `.toMatch(/...../)` patterns. Any deviation = RED→RED, not RED→GREEN.
</locked_russian_copy>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Vault `.json` parsed → `validatePlaceholders(unknown)` | Input is user vault data; must not trust shape |
| validation error string → Plan 04 DOM surfaces | Returned string is consumed by editor modal banner + runner error panel |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-52-04 | Tampering | validatePlaceholders(unknown) | mitigate | Helper treats input as `unknown`; uses `Array.isArray` + `typeof === 'object'` + typed property probes before indexing. No trust on shape. Unit-tested at Plan 01 Task 03. |
| T-52-05 | Information Disclosure | validationError string leaks internal file contents | accept | N/A — error string cites only `ph.id` and `ph.type` values the user authored. No path / secret exposure beyond what the existing silent-skip log already emits. |
| T-52-06 | Tampering | renamed field `separator` not written through sanitizeJson | mitigate | Task 02 explicitly replaces the `joinSeparator:` line in sanitizeJson with `separator:` — acceptance criterion: grep `joinSeparator` returns 0 hits in src/. |
</threat_model>

<tasks>

<task id="52-02-01" type="auto" tdd="true">
  <title>Task 01: Narrow SnippetPlaceholder union + add separator + drop unit + add validationError on JsonSnippet + add validatePlaceholders helper + simplify renderSnippet</title>
  <read_first>
    - src/snippets/snippet-model.ts (entire — 113 lines; especially interface at :4-14, JsonSnippet at :26-37, renderSnippet at :81-98)
    - src/__tests__/snippet-model.test.ts (after Plan 01 Task 01 edits)
    - src/__tests__/snippet-service-validation.test.ts (to see the exact error-text patterns the helper must emit)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Model & Render — TypeScript Changes" + §"Code Examples" (proposed validatePlaceholders body)
  </read_first>
  <behavior>
    - `type SnippetPlaceholder['type'] = 'free-text' | 'choice'` — tsc forbids any other literal.
    - `SnippetPlaceholder` has `separator?: string`; has NO `joinSeparator`, has NO `unit`.
    - `JsonSnippet` has non-optional `validationError: string | null` — every construction site (tests + service + editor-modal draft factory) must populate it; tsc enforces.
    - New export `validatePlaceholders(placeholders: unknown): string | null` — returns the first legacy-type hit or invalid-options hit as a Russian error string matching `<locked_russian_copy>`; returns `null` when all placeholders valid or when input is not an array (degenerate).
    - `renderSnippet` loses the `type === 'number' && unit` branch → becomes pure `output.split('{{id}}').join(raw)` per placeholder.
  </behavior>
  <action>
    Edit `src/snippets/snippet-model.ts` — full file rewrite preferred for clarity; executor may also surgically edit.

    **Target content (replaces existing :1-113 byte-for-byte equivalent behaviour except for the changes spelled out):**

    ```typescript
    // snippets/snippet-model.ts
    // Pure module — zero Obsidian API imports (NFR-01)

    export interface SnippetPlaceholder {
      id: string;
      label: string;
      /** Phase 52 D-01: union narrowed from 4 to 2. 'number' and 'multi-choice' removed. */
      type: 'free-text' | 'choice';
      /** Predefined options for 'choice' type (D-06) */
      options?: string[];
      /**
       * Phase 52 D-02: separator between values when >1 choice option selected.
       * Default: ', '. Renamed from legacy `joinSeparator`. Applies to unified
       * choice (single or multi-select).
       */
      separator?: string;
    }

    /**
     * Phase 32 (D-01): JSON snippet variant of the Snippet discriminated union.
     *
     * Phase 52 (D-03): non-optional `validationError` field. Non-null means the
     * file on disk declared a removed placeholder type ('number', 'multichoice',
     * 'multi-choice') or a 'choice' placeholder with invalid options. Consumers
     * MUST check before rendering in Editor or Runner — see SnippetEditorModal
     * banner surface and RunnerView handleSnippetFill guard.
     */
    export interface JsonSnippet {
      readonly kind: 'json';
      path: string;
      name: string;
      template: string;
      placeholders: SnippetPlaceholder[];
      /** Phase 52 D-03: null on valid snippet; Russian error string on legacy. */
      validationError: string | null;
      /** @deprecated D-02: basename is source of truth; tolerated on disk only. */
      id?: string;
    }

    /**
     * Phase 32 (D-01): Markdown snippet variant. No placeholders → no validationError.
     */
    export interface MdSnippet {
      readonly kind: 'md';
      path: string;
      name: string;
      content: string;
    }

    export type Snippet = JsonSnippet | MdSnippet;

    /**
     * Phase 32 (D-01): backwards-compat alias. Existing JSON-only callers keep
     * using `SnippetFile` without churn; new code prefers `JsonSnippet`.
     */
    export type SnippetFile = JsonSnippet;

    /**
     * Phase 52 D-03: scan an untyped placeholder array for legacy types or
     * invalid choice configurations. Returns the first violation as a Russian
     * error string, or null when all placeholders pass.
     *
     * Locked copy (matches Plan 01 test assertions verbatim):
     *   Legacy type → `Плейсхолдер "{id}" использует удалённый тип "{type}". Пересоздайте плейсхолдер вручную — автоматическая миграция не выполняется.`
     *   Invalid choice → `Плейсхолдер "{id}" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.`
     *
     * Input treated as `unknown` — no trust on shape (T-52-04).
     */
    export function validatePlaceholders(placeholders: unknown): string | null {
      if (!Array.isArray(placeholders)) return null;
      const legacyTypes = new Set(['number', 'multichoice', 'multi-choice']);
      for (const p of placeholders) {
        if (typeof p !== 'object' || p === null) continue;
        const ph = p as { type?: unknown; id?: unknown; options?: unknown };
        const id = typeof ph.id === 'string' ? ph.id : '<unknown>';
        const type = ph.type;
        if (typeof type === 'string' && legacyTypes.has(type)) {
          return `Плейсхолдер "${id}" использует удалённый тип "${type}". Пересоздайте плейсхолдер вручную — автоматическая миграция не выполняется.`;
        }
        if (type === 'choice' && (!Array.isArray(ph.options) || (ph.options as unknown[]).length === 0)) {
          return `Плейсхолдер "${id}" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.`;
        }
      }
      return null;
    }

    /**
     * Render a snippet template by substituting {{id}} tokens with values.
     * Phase 52 D-05/D-07: pure string-replace. Callers (SnippetFillInModal)
     * pre-join choice values using `placeholder.separator`. No unit suffix.
     *
     * MdSnippet is not renderable — callers must branch on `kind` first.
     */
    export function renderSnippet(
      snippet: JsonSnippet,
      values: Record<string, string>,
    ): string {
      let output = snippet.template;
      for (const placeholder of snippet.placeholders) {
        const raw = values[placeholder.id] ?? '';
        output = output.split(`{{${placeholder.id}}}`).join(raw);
      }
      return output;
    }

    /**
     * Convert a human-readable label to a valid placeholder id slug (D-04).
     */
    export function slugifyLabel(label: string): string {
      return label
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
    }
    ```

    **Important deltas vs pre-plan:**
    1. `type: 'free-text' | 'choice' | 'multi-choice' | 'number'` → `'free-text' | 'choice'`.
    2. `unit?: string;` field: REMOVED.
    3. `joinSeparator?: string;` field: REMOVED.
    4. New `separator?: string;` field: ADDED.
    5. `JsonSnippet.validationError: string | null` field: ADDED (non-optional).
    6. New exported function: `validatePlaceholders(placeholders: unknown): string | null`.
    7. `renderSnippet`: the `if (placeholder.type === 'number' && placeholder.unit) { ... }` block: REMOVED. Body becomes the `split/join` line unconditionally.

    **Ripple — tsc will red-trip these call-sites if untouched:**
    - `src/snippets/snippet-service.ts` — load, listFolder, sanitizeJson (handled in Task 02 of this plan).
    - `src/views/snippet-chip-editor.ts` — PH_COLOR (4→2 keys), miniTypeSelect phTypes, phTypesLocal, renderNumberExpanded, joinSeparator refs, unit refs, the `{phType === 'number' ? { unit: '' } : {}}` spread, the `ph.type === 'choice' || ph.type === 'multi-choice'` branches, `{ joinSeparator: ', ' }` spread — handled in Plan 03.
    - `src/views/snippet-fill-in-modal.ts` — renderField dispatch, renderNumberField, joinSeparator ref at :160 — handled in Plan 03.
    - `src/views/snippet-editor-modal.ts` — emptyJsonDraft factory needs `validationError: null` added — handled in Plan 04, OR tsc-critical enough to patch here.

    **Pre-emptive fix for cross-plan tsc:** Because `JsonSnippet.validationError` becomes non-optional, `emptyJsonDraft` in `snippet-editor-modal.ts:50-58` must include `validationError: null` OR this task fails tsc. Executor applies the minimum additional patch:
    ```typescript
    // src/views/snippet-editor-modal.ts :50-58 (add one line)
    function emptyJsonDraft(folder: string): JsonSnippet {
      return {
        kind: 'json',
        path: folder + '/.json',
        name: '',
        template: '',
        placeholders: [],
        validationError: null,    // Phase 52 D-03
      };
    }
    ```
    AND similarly patch `cloneSnippet` at `:600-609` to carry through `validationError`:
    ```typescript
    function cloneSnippet(s: Snippet): JsonSnippet | MdSnippet {
      if (s.kind === 'json') {
        return {
          kind: 'json',
          path: s.path,
          name: s.name,
          template: s.template,
          placeholders: s.placeholders.map((p) => ({ ...p })),
          validationError: s.validationError,   // Phase 52 D-03
        };
      }
      return { kind: 'md', path: s.path, name: s.name, content: s.content };
    }
    ```
    These are minimum-viable patches to keep tsc green until Plan 04 adds the banner logic.

    **Do NOT touch** the PH_COLOR dictionary, phTypes, renderField, renderNumberField, renderNumberExpanded, or joinSeparator usages in views — Plan 03 owns those. If tsc red-trips on those views because of the union narrowing, the executor must pause and escalate (see Acceptance Criteria below) — it's evidence that Plan 02 and Plan 03 cannot be separate commits on this codebase. Recommended mitigation: write this task as a single commit that includes minimum tsc-fix patches in chip-editor / fill-in-modal (adding a default branch / silencing the union cast with `as unknown as SnippetPlaceholder['type']`) so Plan 03 can land the real narrowing cleanly.
  </action>
  <acceptance_criteria>
    - `grep -c "'multi-choice'" src/snippets/snippet-model.ts` equals `0`
    - `grep -c "'number'" src/snippets/snippet-model.ts` equals `0`
    - `grep -c "unit" src/snippets/snippet-model.ts` — equals `0` if executor fully prunes comments too, else ≤ 1 in a deprecation note (Claude's Discretion — preference: 0)
    - `grep -c "joinSeparator" src/snippets/snippet-model.ts` equals `0`
    - `grep -c "validationError" src/snippets/snippet-model.ts` ≥ 2 (interface field + JSDoc)
    - `grep -c "export function validatePlaceholders" src/snippets/snippet-model.ts` equals `1`
    - Russian copy matches byte-for-byte: `grep -c 'использует удалённый тип' src/snippets/snippet-model.ts` equals `1`; `grep -c 'не содержит ни одного варианта' src/snippets/snippet-model.ts` equals `1`
    - `grep -c "Number placeholders with a unit" src/snippets/snippet-model.ts` equals `0` (old JSDoc gone)
    - `npx vitest run src/__tests__/snippet-model.test.ts` exits `0`
    - `npx tsc --noEmit --skipLibCheck` exits `0` (after the emptyJsonDraft + cloneSnippet patches)
    - **Escalation gate:** if after the minimum patches tsc still reports errors in `src/views/snippet-chip-editor.ts` or `src/views/snippet-fill-in-modal.ts`, executor applies just-enough-to-compile casts (using `as SnippetPlaceholder['type']` or `as unknown as SnippetPlaceholder`) and documents every cast in the task's commit message. Plan 03 removes all such casts.
    - Zero functional changes to renderSnippet behaviour on non-`number` inputs — all pre-existing renderSnippet tests that test free-text or choice stay GREEN.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/snippet-model.test.ts && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    snippet-model.ts narrowed to 2-type union; validatePlaceholders helper exported with locked Russian copy; renderSnippet simplified; JsonSnippet carries validationError: string | null; emptyJsonDraft + cloneSnippet in editor-modal patched to keep tsc green. All Plan 01 snippet-model tests pass; tsc is green.
  </done>
</task>

<task id="52-02-02" type="auto" tdd="true">
  <title>Task 02: Wire validatePlaceholders into SnippetService.load + listFolder + rename joinSeparator → separator in sanitizeJson + drop unit</title>
  <read_first>
    - src/snippets/snippet-service.ts (lines 86-180 — listFolder + load JSON branches; 469-491 — sanitizeJson)
    - src/__tests__/snippet-service-validation.test.ts (the RED contract this task must flip GREEN)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"SnippetService.load / listFolder — Current Flow & Call Sites" + §"Phase 52 Target Flow"
  </read_first>
  <behavior>
    - `listFolder` — inside the `.json` branch (:116-129), after `JSON.parse`, call `validatePlaceholders(parsed.placeholders)` and push a JsonSnippet with `validationError` populated. Syntax-broken path (catch block :127-129) unchanged.
    - `load` — inside the `.json` branch (:163-172), after `JSON.parse`, call `validatePlaceholders(parsed.placeholders)` and return a JsonSnippet with `validationError`. Catch-block `null` return preserved (:177-179).
    - `sanitizeJson` (:474-490) — rename `joinSeparator` → `separator`; drop `unit` line entirely.
    - `.md` paths unchanged.
  </behavior>
  <action>
    **Step 1 — Update imports** at top of `src/snippets/snippet-service.ts`:

    ```typescript
    import type { Snippet, JsonSnippet } from './snippet-model';
    import { validatePlaceholders } from './snippet-model';
    ```

    Append `validatePlaceholders` to the named import line at :5 (or add a separate `import` if separating type-only from runtime imports per project convention).

    **Step 2 — Patch `listFolder` JSON branch (:116-129):**

    ```typescript
    if (filePath.endsWith('.json')) {
      try {
        const raw = await this.app.vault.adapter.read(filePath);
        const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
        const validationError = validatePlaceholders(parsed.placeholders);
        snippets.push({
          kind: 'json',
          path: filePath,
          name: basename,
          template: parsed.template ?? '',
          placeholders: (parsed.placeholders ?? []) as JsonSnippet['placeholders'],
          validationError,
        });
      } catch {
        // Corrupt file — skip silently (D-03 explicit: syntax-broken JSON stays silent-skip).
      }
    }
    ```

    **Step 3 — Patch `load` JSON branch (:163-172):**

    ```typescript
    if (normalized.endsWith('.json')) {
      const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
      const validationError = validatePlaceholders(parsed.placeholders);
      return {
        kind: 'json',
        path: normalized,
        name: basename,
        template: parsed.template ?? '',
        placeholders: (parsed.placeholders ?? []) as JsonSnippet['placeholders'],
        validationError,
      };
    }
    ```

    **Step 4 — Patch `sanitizeJson` (:474-491):**

    ```typescript
    private sanitizeJson(snippet: JsonSnippet): {
      name: string;
      template: string;
      placeholders: JsonSnippet['placeholders'];
    } {
      const clean = (s: string): string => s.replace(/[\u0000-\u001F\u007F]/g, '');
      return {
        name: clean(snippet.name),
        template: clean(snippet.template),
        placeholders: snippet.placeholders.map((p) => ({
          ...p,
          label: clean(p.label),
          options: p.options?.map(clean),
          // Phase 52 D-02: rename joinSeparator → separator; D-07: unit deleted.
          separator: p.separator !== undefined ? clean(p.separator) : undefined,
        })),
      };
    }
    ```

    Remove lines for `unit:` and `joinSeparator:`. Note the `...p` spread no longer carries `unit` or `joinSeparator` because the narrowed interface has neither — tsc enforces.

    **Step 5 — Cast-tolerance for legacy on-disk data (defensive):** when parsing, disk file may still contain `type: 'number'` or `joinSeparator`. After `JSON.parse`, the type assertion `as Partial<JsonSnippet>` forbids that at compile time — but runtime still receives the field. `validatePlaceholders(parsed.placeholders)` correctly identifies and returns error; the legacy fields end up copied into `placeholders` in the service return but are unreachable through the typed union (effectively ignored). This is acceptable because:
    - `validationError !== null` → downstream surfaces (banner / error-panel) BLOCK rendering, so the `options`, `separator`, `unit` fields on that placeholder never reach `renderSnippet`.
    - For legacy `joinSeparator`: the file is either (a) legacy `multi-choice` → validationError set → blocked; or (b) rare `choice` + `joinSeparator` from a user who typed it manually → silently ignored by fill-in modal which now reads `separator`. This matches CONTEXT D-02 "любой .json с joinSeparator при чтении проигнорирует поле".
  </action>
  <acceptance_criteria>
    - `grep -c "joinSeparator" src/snippets/snippet-service.ts` equals `0`
    - `grep -c "unit:" src/snippets/snippet-service.ts` equals `0` (note: "unit" substring may survive in unrelated comments like `separator: …`; planner grep is on `unit:` with colon)
    - `grep -c "validatePlaceholders" src/snippets/snippet-service.ts` ≥ 3 (import + 2 call sites)
    - `grep -c "validationError" src/snippets/snippet-service.ts` ≥ 3 (2 call sites + 1 variable in each)
    - `grep -c "separator:" src/snippets/snippet-service.ts` ≥ 1 (sanitizeJson replacement)
    - `npx vitest run src/__tests__/snippet-service-validation.test.ts` exits `0` with ALL 9 tests GREEN (flipping Plan 01's RED tests)
    - `npx vitest run` full-suite reports: total_pass = (baseline from Plan 01 final) + (9 tests that flipped), total_fail = Plan 01's remaining RED count minus 9. I.e., snippet-service-validation is fully GREEN but snippet-fill-in-modal.test.ts and others are still RED (Plan 03 flips those).
    - `npx tsc --noEmit --skipLibCheck` exits `0`
    - Zero deletions of unrelated code: `git diff --stat src/snippets/snippet-service.ts` shows ~10-20 lines changed, entirely inside the load / listFolder / sanitizeJson blocks (no untouched methods modified).
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/snippet-service-validation.test.ts src/__tests__/snippet-model.test.ts && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    SnippetService.load and listFolder populate `validationError` on every JsonSnippet return; sanitizeJson persists `separator` (not `joinSeparator`) and drops `unit`; Plan 01's D-03 RED tests flip fully GREEN; tsc is green; unrelated SnippetService methods (save, delete, moveSnippet, renameFolder, etc.) are byte-identical.
  </done>
</task>

</tasks>

<verification>
After both tasks, executor runs:

```bash
npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/snippet-service-validation.test.ts src/__tests__/views/runner-snippet-picker.test.ts src/__tests__/snippet-service-move.test.ts && npx tsc --noEmit --skipLibCheck
```

Expected: snippet-model + snippet-service-validation ALL GREEN; runner-snippet-picker still GREEN (fixtures ready for Plan 04); snippet-service-move (existing test) still GREEN (it doesn't touch validationError); tsc exits 0.

Full suite `npm test` should show: previous GREEN count + 9 (snippet-service-validation flipped) + 0 regressions. Plan 03 targets (snippet-fill-in-modal.test.ts, snippet-chip-editor.test.ts) still RED.
</verification>

<success_criteria>
- D-01: `'free-text' | 'choice'` is the only union allowed anywhere in src/ (after Plan 03 removes the residual casts in views).
- D-02: `separator` field exists on SnippetPlaceholder and on disk via sanitizeJson; `joinSeparator` is gone from src/snippets/.
- D-03: SnippetService returns validationError on every .json load and listFolder entry.
- D-07: unit field gone from model; renderSnippet unconditional.
- Plan 01 RED test count drops by ≥ 9 (snippet-service-validation.test.ts flipped to fully GREEN).
- No regression to existing SnippetService tests (`snippet-service-move.test.ts`, `snippet-vault-watcher.test.ts`, etc.).
- tsc green; build not required yet (views still old-shape per Plan 03 scope).
</success_criteria>

<output>
After completion, create `.planning/phases/52-json-placeholder-rework/52-02-SUMMARY.md` with:
- Commit SHAs (expect 1-2 commits: TDD commit naming `feat(52-02): ...`)
- Before/after test counts (targeting: +9 GREEN from Plan 01's RED set)
- List any tsc-tolerance casts added in `src/views/*` and mark them for Plan 03 to remove
- Confirmation that Plans 03 and 04 remain unblocked
- Any deviations per GSD Rule 1/2/3 format
</output>
