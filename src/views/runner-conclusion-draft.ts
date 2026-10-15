import type { Translator } from '../i18n';
import { createButton, createTextarea, growAutoTextarea } from '../utils/dom-helpers';

interface DraftLine { text: string }
const DRAG_TYPE = 'application/x-radiprotocol-conclusion-line';
let nextDraftId = 0;

function growDraftTextarea(textarea: HTMLTextAreaElement): void {
  growAutoTextarea(textarea);
  // scrollHeight excludes borders, while these fields use border-box sizing.
  const borders = textarea.offsetHeight - textarea.clientHeight;
  textarea.setCssProps({ height: `${textarea.scrollHeight + borders}px` });
}

/** Session-local editor. Successful writes acknowledge a snapshot, never clear the draft. */
export class RunnerConclusionDraft {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly input: HTMLTextAreaElement;
  private readonly insert: HTMLButtonElement;
  private readonly dragId = String(++nextDraftId);
  private lines: DraftLine[] = [];
  private dragged: DraftLine | null = null;
  private insertedText = '';
  private busy = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    private readonly t: Translator,
    onInsert: () => void,
    private readonly onChange: () => void = () => {},
  ) {
    this.root = container.createDiv({ cls: 'rp-runner-draft' });
    // Never let native textarea drops import foreign/plain text. Only our row
    // handler may mutate order, after validating this component's drag token.
    this.root.addEventListener('drop', event => { event.preventDefault(); });
    this.root.createEl('h3', { text: t('runnerDraft.title') });
    this.root.createEl('p', { cls: 'rp-runner-draft-help', text: t('runnerDraft.help') });
    this.list = this.root.createDiv({ cls: 'rp-runner-draft-list' });
    this.input = createTextarea(this.root, {
      cls: 'rp-runner-draft-input', placeholder: t('runnerDraft.inputPlaceholder'),
      attr: { rows: '1', 'aria-label': t('runnerDraft.inputLabel') },
    });
    this.input.addEventListener('input', () => {
      growDraftTextarea(this.input);
      this.changed();
    });
    this.input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      event.preventDefault();
      if (this.destroyed) return;
      const added = this.input.value.split(/\r?\n/).filter(text => text.trim());
      if (!added.length) return;
      this.lines.push(...added.map(text => ({ text })));
      this.input.value = '';
      growDraftTextarea(this.input);
      this.renderLines();
      this.changed();
    });
    this.insert = createButton(this.root, { cls: 'rp-runner-draft-insert', text: t('runnerDraft.insert'), attr: { type: 'button' } });
    this.insert.addEventListener('click', () => {
      if (!this.destroyed && !this.busy && this.getText().trim()) onInsert();
    });
    growDraftTextarea(this.input);
    this.refresh();
    if (typeof ResizeObserver !== 'undefined') {
      let previousWidth = -1;
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (this.destroyed || width === undefined || width === previousWidth) return;
        previousWidth = width;
        growDraftTextarea(this.input);
        this.list.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(editor => growDraftTextarea(editor));
      });
      this.resizeObserver.observe(this.root);
    }
  }

  getText(): string {
    return [...this.lines.map(line => line.text), this.input.value]
      .filter(text => text.trim()).join('\n');
  }

  hasUninsertedText(): boolean {
    const text = this.getText();
    return Boolean(text.trim()) && text !== this.insertedText;
  }

  markInserted(text: string): void {
    this.insertedText = text;
    this.changed();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.refresh();
  }

  destroy(): void {
    this.destroyed = true;
    this.dragged = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.root.remove();
  }

  private refresh(): void {
    this.insert.disabled = this.destroyed || this.busy || !this.getText().trim();
  }

  private changed(): void {
    if (this.destroyed) return;
    this.refresh();
    this.onChange();
  }

  private move(line: DraftLine, target: number, focusClass?: string): void {
    const from = this.lines.indexOf(line);
    if (from < 0 || target < 0 || target >= this.lines.length || from === target) return;
    this.lines.splice(from, 1);
    this.lines.splice(target, 0, line);
    this.renderLines();
    if (focusClass) {
      const row = this.list.children[target];
      const control = row?.querySelector<HTMLButtonElement>(focusClass);
      if (control && !control.disabled) control.focus();
      else row?.querySelector<HTMLTextAreaElement>('.rp-runner-draft-line')?.focus();
    }
    this.changed();
  }

  private renderLines(): void {
    this.list.empty();
    this.lines.forEach((line, index) => {
      const row = this.list.createDiv({ cls: 'rp-runner-draft-row' });
      const handle = createButton(row, { cls: 'rp-runner-draft-drag', text: '⠿', attr: { type: 'button', draggable: 'true', 'aria-label': this.t('runnerDraft.dragLine') } });
      handle.addEventListener('dragstart', event => {
        if (!event.dataTransfer || this.destroyed) return;
        this.dragged = line;
        event.dataTransfer.setData(DRAG_TYPE, this.dragId);
        event.dataTransfer.effectAllowed = 'move';
      });
      handle.addEventListener('dragend', () => { this.dragged = null; });
      row.addEventListener('dragover', event => {
        if (this.dragged && event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault();
      });
      row.addEventListener('drop', event => {
        if (!this.dragged || event.dataTransfer?.getData(DRAG_TYPE) !== this.dragId) return;
        event.preventDefault();
        const dragged = this.dragged;
        this.dragged = null;
        this.move(dragged, this.lines.indexOf(line));
      });
      const editor = createTextarea(row, { cls: 'rp-runner-draft-line', attr: { rows: '1', 'aria-label': this.t('runnerDraft.editLine') } });
      editor.value = line.text;
      editor.addEventListener('input', () => {
        line.text = editor.value;
        growDraftTextarea(editor);
        this.changed();
      });
      growDraftTextarea(editor);
      const controls = row.createDiv({ cls: 'rp-runner-draft-controls' });
      const up = createButton(controls, { cls: 'rp-runner-draft-up', text: '↑', attr: { type: 'button', 'aria-label': this.t('runnerDraft.moveUp') } });
      up.disabled = index === 0;
      up.addEventListener('click', () => this.move(line, this.lines.indexOf(line) - 1, '.rp-runner-draft-up'));
      const down = createButton(controls, { cls: 'rp-runner-draft-down', text: '↓', attr: { type: 'button', 'aria-label': this.t('runnerDraft.moveDown') } });
      down.disabled = index === this.lines.length - 1;
      down.addEventListener('click', () => this.move(line, this.lines.indexOf(line) + 1, '.rp-runner-draft-down'));
      const remove = createButton(controls, { cls: 'rp-runner-draft-delete', text: '×', attr: { type: 'button', 'aria-label': this.t('runnerDraft.deleteLine') } });
      remove.addEventListener('click', () => {
        this.lines = this.lines.filter(candidate => candidate !== line);
        this.renderLines();
        this.input.focus();
        this.changed();
      });
    });
  }
}
