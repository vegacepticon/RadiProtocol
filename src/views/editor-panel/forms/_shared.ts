// Phase 76 Plan 01 (SPLIT-01) — Shared types for per-kind editor-panel form modules.
// FormContext is the only allowed coupling between extracted form builders and
// EditorPanelView. Form modules MUST NOT import EditorPanelView directly.
import type { App } from 'obsidian';
import type RadiProtocolPlugin from '../../../main';
import type { SnippetTreePicker } from '../../snippet-tree-picker';

export interface GrowableTextareaOptions {
  blockClass: string;
  textareaClass?: string;
  label: string;
  desc: string;
  value: string;
  onInput: (value: string) => void;
}

export interface FormContext {
  pendingEdits: Record<string, unknown>;
  registerFieldRef: (key: string, el: HTMLInputElement | HTMLTextAreaElement) => void;
  scheduleAutoSave: () => void;
  renderGrowableTextarea: (
    container: HTMLElement,
    opts: GrowableTextareaOptions,
  ) => HTMLTextAreaElement;
  plugin: RadiProtocolPlugin;
  app: App;
  setSnippetTreePicker: (picker: SnippetTreePicker | null) => void;
}
