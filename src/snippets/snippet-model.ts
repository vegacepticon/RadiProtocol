// snippets/snippet-model.ts
// Pure module — zero Obsidian API imports (NFR-01)

export interface SnippetPlaceholder {
  id: string;
  label: string;
  type: 'free-text' | 'choice' | 'multi-choice' | 'number';
  /** Predefined options for 'choice' and 'multi-choice' types (D-06) */
  options?: string[];
  /** Unit suffix for 'number' type, e.g. 'mm'. Rendered as '{value} {unit}' (D-08) */
  unit?: string;
  /** Join separator for 'multi-choice' type. Default: ', ' (D-07) */
  joinSeparator?: string;
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
 */
export interface JsonSnippet {
  readonly kind: 'json';
  /** Full vault-relative path including `.json` extension — identity (D-02) */
  path: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
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
 * Render a snippet template by substituting {{id}} tokens with values.
 * Number placeholders with a unit are rendered as '{value} {unit}'.
 * For multi-choice placeholders the caller pre-joins values using joinSeparator
 * before passing them in the values map.
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
    let rendered: string;
    if (placeholder.type === 'number' && placeholder.unit) {
      rendered = raw.trim() === '' ? '' : `${raw} ${placeholder.unit}`;
    } else {
      rendered = raw;
    }
    // split/join replaces all occurrences without requiring replaceAll (ES2021+)
    output = output.split(`{{${placeholder.id}}}`).join(rendered);
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
