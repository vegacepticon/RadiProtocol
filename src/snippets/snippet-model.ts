// snippets/snippet-model.ts
// Pure module — zero Obsidian API imports (NFR-01)

import { defaultT, type Translator } from '../i18n';

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
 * Phase 93 (EXTERNAL-LIB-01): Markdown template snippet — `.md` file with
 * YAML-like frontmatter containing metadata and placeholder definitions.
 * Supports placeholder substitution via {{id}} token replacement.
 */
export interface MdTemplateSnippet {
  readonly kind: 'md-template';
  /** Full vault-relative path including `.md` extension */
  path: string;
  name: string;
  /** Template body (without frontmatter) */
  template: string;
  placeholders: SnippetPlaceholder[];
  validationError: string | null;
  /** Optional metadata from frontmatter */
  id?: string;
  lang?: 'ru' | 'en';
  category?: string;
  description?: string;
  version?: number;
}

/**
 * Phase 32 (D-01): Discriminated union over snippet kinds. Callsites MUST
 * branch on `kind` to access variant-specific fields — mirrors the `RPNode`
 * pattern already established in `graph-model.ts`.
 *
 * Phase 2 (JSON-removal): narrowed to the two Markdown variants. Legacy
 * `.json` snippet files remain on disk but are no longer parsed, listed, or
 * loaded — `SnippetService.resolveSnippet` reports them as `legacy-json` so
 * runners can surface an explicit unsupported-format message.
 */
export type Snippet = MdSnippet | MdTemplateSnippet;

/**
 * Phase 93 (EXTERNAL-LIB-01): render interface for md-template snippets.
 * Same {{id}} -> value substitution engine as the legacy JSON renderer used.
 */
export function renderMdTemplateSnippet(
  snippet: MdTemplateSnippet,
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
 * Phase 52 D-03: scan an untyped placeholder array for legacy types or
 * invalid choice configurations. Returns the first violation as a localized
 * error string, or null when all placeholders pass.
 *
 * Phase 84 (I18N-01): message text comes from the i18n locale configured by
 * the caller. The optional `t` translator defaults to English (defaultT).
 * Production callers (snippet-service) forward `plugin.i18n.t.bind(...)` to
 * keep messages aligned with the active UI locale.
 *
 * Input treated as `unknown` — no trust on shape (T-52-04).
 */
export function validatePlaceholders(
  placeholders: unknown,
  t: Translator = defaultT,
): string | null {
  if (!Array.isArray(placeholders)) return null;
  const legacyTypes = new Set(['number', 'multichoice', 'multi-choice']);
  for (const p of placeholders) {
    if (typeof p !== 'object' || p === null) continue;
    const ph = p as { type?: unknown; id?: unknown; options?: unknown };
    const id = typeof ph.id === 'string' ? ph.id : '<unknown>';
    const type = ph.type;
    if (typeof type === 'string' && legacyTypes.has(type)) {
      return t('snippetModel.legacyTypeError', { id, type });
    }
    if (type === 'choice' && (!Array.isArray(ph.options) || (ph.options as unknown[]).length === 0)) {
      return t('snippetModel.invalidChoiceError', { id });
    }
  }
  return null;
}

/**
 * Convert a human-readable label to a valid placeholder id slug (D-04).
 * "Patient age"    → "patient-age"
 * "Size (mm)"      → "size-mm"
 * Cyrillic input is preserved (e.g. "Patient age" Cyrillic → kebab-case Cyrillic).
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
