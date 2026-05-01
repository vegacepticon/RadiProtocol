// Phase 76 (SPLIT-01 G6) — extracted renderGrowableTextarea body. Called
// directly by FormContext (no dispatcher wrapper) since no test asserts on
// `view['renderGrowableTextarea']` and form modules go through makeFormContext.
import type { ItemView } from 'obsidian';

export function renderGrowableTextarea(
  container: HTMLElement,
  options: {
    blockClass: string;
    textareaClass?: string;
    label: string;
    desc: string;
    value: string;
    onInput: (value: string) => void;
  },
  deps: {
    scheduleAutoSave: () => void;
    registerDomEvent?: ItemView['registerDomEvent'];
  }
): HTMLTextAreaElement {
  const block = container.createDiv({ cls: options.blockClass });
  block.createDiv({ cls: 'rp-field-label', text: options.label });
  block.createEl('p', { cls: 'rp-field-desc', text: options.desc });

  const textareaClasses = options.textareaClass
    ? `rp-growable-textarea ${options.textareaClass}`
    : 'rp-growable-textarea';
  const textarea = block.createEl('textarea', { cls: textareaClasses });
  textarea.value = options.value;

  const resize = () => {
    if (typeof textarea.setCssProps !== 'function') return;
    textarea.setCssProps({ '--rp-textarea-height': 'auto' });
    textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(resize);
  } else {
    resize();
  }
  const onTextareaInput = () => {
    resize();
    options.onInput(textarea.value);
    deps.scheduleAutoSave();
  };

  if (typeof deps.registerDomEvent === 'function') {
    deps.registerDomEvent(textarea, 'input', onTextareaInput);
  } else if (typeof textarea.addEventListener === 'function') {
    textarea.addEventListener('input', onTextareaInput);
  }

  return textarea;
}
