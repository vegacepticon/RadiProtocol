// snippets/snippet-model.ts
// Pure module — zero Obsidian API imports (NFR-01)

export interface SnippetFile {
  id: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
}

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
 * Render a snippet template by substituting {{id}} tokens with values.
 * Number placeholders with a unit are rendered as '{value} {unit}'.
 * For multi-choice placeholders the caller pre-joins values using joinSeparator
 * before passing them in the values map.
 * Uses split/join for compatibility with ES6 targets (RESEARCH.md Pitfall / key_research_finding 4).
 */
export function renderSnippet(
  snippet: SnippetFile,
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
