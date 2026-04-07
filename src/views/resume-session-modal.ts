// views/resume-session-modal.ts
// Resume session modal — promise-based two-button modal (SESSION-02, SESSION-04, SESSION-06)
import { Modal, App } from 'obsidian';

/** The user's choice in the resume prompt. */
export type ResumeChoice = 'resume' | 'start-over';

/**
 * ResumeSessionModal — presented by RunnerView.openCanvas() when an incomplete session
 * file exists for the canvas being opened.
 *
 * Usage:
 *   const modal = new ResumeSessionModal(this.app, warnings);
 *   modal.open();
 *   const choice = await modal.result;  // 'resume' | 'start-over'
 *
 * The modal resolves 'start-over' if the user presses Escape or closes the modal
 * without clicking a button (SESSION-06: safe default — no data loss).
 *
 * warningLines: pass [] for a plain resume offer; pass warning strings when canvas
 * mtime has changed (SESSION-04) so the user sees the warning before choosing.
 */
export class ResumeSessionModal extends Modal {
  private resolve!: (choice: ResumeChoice) => void;
  /** Double-resolve guard (mirrors SnippetFillInModal.resolved — Pitfall 5) */
  private resolved = false;
  /** Awaitable promise resolved when user makes a choice or closes modal */
  readonly result: Promise<ResumeChoice>;

  constructor(
    app: App,
    private readonly warningLines: string[],
  ) {
    super(app);
    this.result = new Promise<ResumeChoice>(res => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    this.titleEl.setText('Resume session?');
    this.contentEl.addClass('rp-resume-modal');

    // Render warning lines before the button row (SESSION-04, SESSION-06)
    for (const line of this.warningLines) {
      this.contentEl.createEl('p', { text: line, cls: 'rp-session-warning' });
    }

    // Button row: [Resume session] [Start over]
    const btnRow = this.contentEl.createDiv({ cls: 'rp-session-btn-row' });

    const resumeBtn = btnRow.createEl('button', {
      text: 'Resume session',
      cls: 'mod-cta',
    });
    const startOverBtn = btnRow.createEl('button', { text: 'Start over' });

    resumeBtn.addEventListener('click', () => { this.settle('resume'); });
    startOverBtn.addEventListener('click', () => { this.settle('start-over'); });
  }

  onClose(): void {
    // Escape or external close — default to 'start-over' (SESSION-06: safe default)
    this.settle('start-over');
    this.contentEl.empty();
  }

  /** Resolve the promise at most once (Pitfall 5 — guards against Escape + click race). */
  private settle(choice: ResumeChoice): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(choice);   // resolve FIRST
    this.close();           // close AFTER — onClose will call contentEl.empty()
  }
}
