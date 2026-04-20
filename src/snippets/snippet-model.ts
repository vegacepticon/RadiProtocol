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
 * Replaces the legacy `SnippetFile` interface; `SnippetFile` is retained below
 * as a type alias to minimize callsite churn during the phase 32 refactor.
 *
 * Identity (D-02): the full vault-relative `path` (including `.json`
 * extension) is the source of truth. The deprecated `id` field may still
 * appear in v1.4-era JSON files on disk and is tolerated on the type for
 * compatibility, but it is ignored at runtime — basename is authoritative.
 *
 * Phase 52 (D-03): non-optional `validationError` field. Non-null means the
 * file on disk declared a removed placeholder type ('number', 'multichoice',
 * 'multi-choice') or a 'choice' placeholder with invalid options. Consumers
 * MUST check before rendering in Editor or Runner — see SnippetEditorModal
 * banner surface and RunnerView handleSnippetFill guard.
 */
export interface JsonSnippet {
  readonly kind: 'json';
  /** Full vault-relative path including `.json` extension — identity (D-02) */
  path: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
  /** Phase 52 D-03: null on valid snippet; Russian error string on legacy. */
  validationError: string | null;
  /** @deprecated D-02: basename is source of truth; tolerated on disk only.
   *  Not `readonly` to preserve legacy snippet-manager-view write behavior
   *  until Phase 33 replaces that view. */
  id?: string;
}

/**
 * Phase 32 (D-01): Markdown snippet variant of the Snippet discriminated union.
 * A `.md` file under the snippet root is a first-class snippet whose raw file
 * contents are inserted as-is by the runner (Phase 35). No placeholder
 * substitution is performed for `MdSnippet`.
 */
export interface MdSnippet {
  readonly kind: 'md';
  /** Full vault-relative path including `.md` extension — identity */
  path: string;
  /** Basename without extension */
  name: string;
  /** Raw file contents */
  content: string;
}

/**
 * Phase 32 (D-01): Discriminated union over snippet kinds. Callsites MUST
 * branch on `kind` to access variant-specific fields — mirrors the `RPNode`
 * pattern already established in `graph-model.ts`.
 */
export type Snippet = JsonSnippet | MdSnippet;

/**
 * Phase 32 (D-01, Claude's Discretion): backwards-compat alias for the
 * pre-phase-32 `SnippetFile` interface. Existing callsites that only deal
 * with JSON snippets can keep using `SnippetFile` without churn; new code
 * should prefer `JsonSnippet` or the `Snippet` union.
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
 * Uses split/join for compatibility with ES6 targets (RESEARCH.md Pitfall / key_research_finding 4).
 *
 * Phase 32: signature accepts `JsonSnippet` (was `SnippetFile`). Since
 * `SnippetFile = JsonSnippet`, existing JSON-only callers remain compatible.
 * `MdSnippet` is not renderable — callers must branch on `kind` first.
 */
export function renderSnippet(
  snippet: JsonSnippet,
  values: Record<string, string>,
): string {
  let output = snippet.template;
  for (const placeholder of snippet.placeholders) {
    const raw = values[placeholder.id] ?? '';
    // split/join replaces all occurrences without requiring replaceAll (ES2021+)
    output = output.split(`{{${placeholder.id}}}`).join(raw);
  }
  return output;
}

/**
 * Convert a human-readable label to a valid placeholder id slug (D-04).
 * "Patient age"    → "patient-age"
 * "Size (mm)"      → "size-mm"
 * "Возраст пациента" → "возраст-пациента"
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
