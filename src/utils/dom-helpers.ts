// src/utils/dom-helpers.ts
// Phase 81 TYPE-SAFETY-01 — typed wrappers over Obsidian DOM helpers.
// Reduces `as HTMLButtonElement` casts at hot-path call sites.

interface ButtonOpts {
  cls?: string;
  text?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createButton(parent: HTMLElement, opts: ButtonOpts = {}): HTMLButtonElement {
  const btn = parent.createEl('button', {
    cls: opts.cls,
    text: opts.text,
    attr: opts.attr,
  });
  return btn as HTMLButtonElement;
}

interface InputOpts {
  cls?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createInput(parent: HTMLElement, opts: InputOpts = {}): HTMLInputElement {
  const input = parent.createEl('input', {
    cls: opts.cls,
    type: opts.type ?? 'text',
    placeholder: opts.placeholder,
    value: opts.value,
    attr: opts.attr,
  });
  return input as HTMLInputElement;
}

interface TextareaOpts {
  cls?: string;
  placeholder?: string;
  value?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createTextarea(parent: HTMLElement, opts: TextareaOpts = {}): HTMLTextAreaElement {
  const ta = parent.createEl('textarea', {
    cls: opts.cls,
    placeholder: opts.placeholder,
    value: opts.value,
    attr: { spellcheck: 'false', ...opts.attr },
  });
  return ta as HTMLTextAreaElement;
}

/**
 * Grow a compact auto-expanding textarea so its single visual line is
 * vertically centered inside the field.
 *
 * The previous approach (height: auto → scrollHeight) measured while the
 * element's height was fractional (browser line-height rounding), so
 * scrollHeight rounded UP and baked a sub-pixel remainder into every
 * following height — pinning the text toward the top of the field.
 * Resetting height to 0px first collapses the field to its vertical padding,
 * so scrollHeight then reports the integer content box (line + padding) with
 * no accumulated remainder.
 *
 * Pair with CSS `padding-block: 0; padding-inline: var(--input-padding);` on
 * the textarea (keeps horizontal inset, removes vertical padding so the line
 * box itself IS the content height) for exact centering.
 */
export function growAutoTextarea(textarea: HTMLTextAreaElement): void {
  textarea.setCssProps({ height: '0px' });
  textarea.setCssProps({ height: `${textarea.scrollHeight}px` });
}
