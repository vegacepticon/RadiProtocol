// views/snippet-tree-picker.ts
// Phase 51 PICKER-02 — Stub for TDD RED phase. Implementation lands in the GREEN commit.
// Design contract: `.planning/notes/snippet-node-binding-and-picker.md` (Shared Pattern H).
import type { App } from 'obsidian';
import type { SnippetService } from '../snippets/snippet-service';

export type SnippetTreePickerMode = 'folder-only' | 'file-only' | 'both';

export interface SnippetTreePickerResult {
  kind: 'folder' | 'file';
  relativePath: string;
}

export interface SnippetTreePickerOptions {
  app: App;
  snippetService: SnippetService;
  container: HTMLElement;
  mode: SnippetTreePickerMode;
  rootPath: string;
  initialSelection?: string;
  onSelect: (result: SnippetTreePickerResult) => void;
}

export class SnippetTreePicker {
  constructor(_options: SnippetTreePickerOptions) {
    // stub
  }

  async mount(): Promise<void> {
    // stub — tests will fail
  }

  unmount(): void {
    // stub
  }
}
