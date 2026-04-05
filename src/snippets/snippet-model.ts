// snippets/snippet-model.ts — TODO: Phase 5
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
}
