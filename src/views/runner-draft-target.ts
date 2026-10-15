import type { App, Editor, TFile } from 'obsidian';

interface DraftEditor {
  editor: Editor;
  save(): Promise<void>;
}

/** Keeps the last focused editor for the bound note, never an unrelated active note.
 * The editor itself maps its cursor through edits while focus is in the Runner.
 * No note is opened, created, or silently appended to when editing is unavailable.
 */
export class RunnerDraftTarget {
  private remembered: Editor | null = null;

  constructor(private readonly app: App, private readonly targetNote: TFile) {}

  resolve(): DraftEditor | null {
    const views: DraftEditor[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as typeof leaf.view & {
        file?: TFile | null;
        editor?: Editor;
        getMode?: () => string;
        save?: () => Promise<void>;
      };
      if (view.file?.path === this.targetNote.path && view.editor !== undefined
        && typeof view.save === 'function'
        && (view.getMode === undefined || view.getMode() === 'source')) {
        views.push({ editor: view.editor, save: () => view.save!() });
      }
    });
    const active = this.app.workspace.activeEditor;
    if (active?.file?.path === this.targetNote.path && active.editor !== undefined
      && views.some(view => view.editor === active.editor)) {
      this.remembered = active.editor;
    } else if (this.remembered === null || !views.some(view => view.editor === this.remembered)) {
      this.remembered = views[0]?.editor ?? null;
    }
    return views.find(view => view.editor === this.remembered) ?? null;
  }

  clear(): void { this.remembered = null; }
}
