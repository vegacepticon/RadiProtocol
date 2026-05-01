// Phase 76 (SPLIT-01 G5) — extracted renderToolbar body. The dispatcher
// (EditorPanelView) keeps a thin private wrapper so renderIdle / renderForm and
// the existing test surface (which spy on / replace `view['renderToolbar']`) keep
// working unchanged.
import { setIcon, type ItemView } from 'obsidian';

type QuickCreateKind = 'question' | 'answer' | 'snippet' | 'loop' | 'text-block';

export function renderToolbar(
  container: HTMLElement,
  args: {
    registerDomEvent: ItemView['registerDomEvent'];
    hasCurrentNode: boolean;
    onQuickCreate: (kind: QuickCreateKind) => void;
    onDuplicate: () => void;
  }
): void {
  const { registerDomEvent, hasCurrentNode, onQuickCreate, onDuplicate } = args;
  const toolbar = container.createDiv({ cls: 'rp-editor-create-toolbar' });

  const qBtn = toolbar.createEl('button', { cls: 'rp-create-question-btn' });
  const qIcon = qBtn.createSpan();
  setIcon(qIcon, 'help-circle');
  qBtn.appendText('Create question node');
  registerDomEvent(qBtn, 'click', () => { onQuickCreate('question'); });

  const aBtn = toolbar.createEl('button', { cls: 'rp-create-answer-btn' });
  const aIcon = aBtn.createSpan();
  setIcon(aIcon, 'message-square');
  aBtn.appendText('Create answer node');
  registerDomEvent(aBtn, 'click', () => { onQuickCreate('answer'); });

  // Phase 42: Create snippet node button
  const sBtn = toolbar.createEl('button', { cls: 'rp-create-snippet-btn' });
  sBtn.setAttribute('aria-label', 'Create snippet node');
  sBtn.setAttribute('title', 'Create snippet node');
  const sIcon = sBtn.createSpan();
  setIcon(sIcon, 'file-text');
  sBtn.appendText('Create snippet node');
  registerDomEvent(sBtn, 'click', () => { onQuickCreate('snippet'); });

  // Phase 45: Create loop node button (LOOP-05, D-03)
  const lBtn = toolbar.createEl('button', { cls: 'rp-create-loop-btn' });
  lBtn.setAttribute('aria-label', 'Create loop node');
  lBtn.setAttribute('title', 'Create loop node');
  const lIcon = lBtn.createSpan();
  setIcon(lIcon, 'repeat');
  lBtn.appendText('Create loop node');
  registerDomEvent(lBtn, 'click', () => { onQuickCreate('loop'); });

  // Phase 64: Create text block button (EDITOR-06)
  const tbBtn = toolbar.createEl('button', { cls: 'rp-create-text-block-btn' });
  tbBtn.setAttribute('aria-label', 'Create text block');
  tbBtn.setAttribute('title', 'Create text block');
  const tbIcon = tbBtn.createSpan();
  setIcon(tbIcon, 'file-text');
  tbBtn.appendText('Create text block');
  registerDomEvent(tbBtn, 'click', () => { onQuickCreate('text-block'); });

  // Phase 40: Duplicate node button
  const dupBtn = toolbar.createEl('button', { cls: 'rp-duplicate-btn' });
  const dupIcon = dupBtn.createSpan();
  setIcon(dupIcon, 'copy');
  dupBtn.appendText('Duplicate node');
  if (!hasCurrentNode) dupBtn.disabled = true;
  registerDomEvent(dupBtn, 'click', () => { onDuplicate(); });
}
