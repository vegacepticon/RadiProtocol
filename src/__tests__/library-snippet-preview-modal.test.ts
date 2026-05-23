import { describe, it, expect, vi } from 'vitest';
import { LibrarySnippetPreviewModal } from '../views/library-snippet-preview-modal';
import type { JsonSnippet } from '../snippets/snippet-model';

interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  classList: Set<string>;
  _text: string;
  _value: string;
  value: string;
  _type: string;
  type: string;
  _attrs: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  readOnly: boolean;
  scrollHeight: number;
  style: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (text: string) => void;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  toggleClass: (cls: string, on?: boolean) => void;
  hasClass: (cls: string) => boolean;
  setAttribute: (key: string, value: string) => void;
  removeAttribute: (key: string) => void;
  getAttribute: (key: string) => string | null;
  focus: () => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
}

function makeEl(tag = 'div'): MockEl {
  const children: MockEl[] = [];
  const classList = new Set<string>();
  const attrs: Record<string, string> = {};
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const style: Record<string, string> = {};
  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    classList,
    _text: '',
    _value: '',
    _type: '',
    _attrs: attrs,
    _listeners: listeners,
    readOnly: false,
    scrollHeight: 0,
    style,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) child._text = opts.text;
      if (opts?.cls) child.classList.add(opts.cls);
      if (opts?.type) child._type = opts.type;
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    empty(): void { children.length = 0; },
    setText(text: string): void { (el as unknown as MockEl)._text = text; },
    addClass(cls: string): void { classList.add(cls); },
    removeClass(cls: string): void { classList.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      const want = on ?? !classList.has(cls);
      if (want) classList.add(cls);
      else classList.delete(cls);
    },
    hasClass(cls: string): boolean { return classList.has(cls); },
    setAttribute(key: string, value: string): void { attrs[key] = value; },
    removeAttribute(key: string): void { delete attrs[key]; },
    getAttribute(key: string): string | null { return attrs[key] ?? null; },
    focus(): void {},
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type) ?? [];
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(sel: string): MockEl | null { return walk(el as unknown as MockEl, sel)[0] ?? null; },
    querySelectorAll(sel: string): MockEl[] { return walk(el as unknown as MockEl, sel); },
  } as MockEl;

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as MockEl)._text; },
    set(v: string): void { (el as MockEl)._text = String(v); },
  });
  Object.defineProperty(el, 'value', {
    get(): string { return (el as MockEl)._value; },
    set(v: string): void { (el as MockEl)._value = String(v); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as MockEl)._type; },
    set(v: string): void { (el as MockEl)._type = String(v); },
  });
  return el;
}

function walk(root: MockEl, sel: string): MockEl[] {
  const out: MockEl[] = [];
  const match = buildMatcher(sel);
  const stack = [...root.children];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (match(cur)) out.push(cur);
    stack.push(...cur.children);
  }
  return out;
}

function buildMatcher(sel: string): (el: MockEl) => boolean {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]+)"\]$/.exec(sel);
  if (tagAttrMatch) {
    const [, tag, attr, val] = tagAttrMatch;
    return (el) => el.tagName === tag!.toUpperCase() && (attr === 'type' ? el._type === val : el.getAttribute(attr!) === val);
  }
  return (el) => el.tagName === sel.toUpperCase();
}

vi.mock('obsidian', () => {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: MockEl;
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = makeEl('div');
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  return { Modal };
});

const snippet: JsonSnippet = {
  kind: 'json',
  path: 'remote/test.json',
  name: 'Preview Snippet',
  template: 'Finding: {{finding}}. Side: {{side}}.',
  placeholders: [
    { id: 'finding', label: 'Finding', type: 'free-text' },
    { id: 'side', label: 'Side', type: 'choice', options: ['left', 'right'] },
  ],
  validationError: null,
};

const t = (key: string, vars?: Record<string, string>): string => {
  const map: Record<string, string> = {
    'library.previewTitle': `Preview: ${vars?.name ?? ''}`,
    'library.previewOutput': 'Preview',
    'library.previewClose': 'Close',
    'library.previewCustom': 'Custom:',
    'library.previewCustomAria': `Custom ${vars?.label ?? ''}`,
    'library.previewCustomValueAria': `Custom value for ${vars?.label ?? ''}`,
  };
  return map[key] ?? key;
};

describe('LibrarySnippetPreviewModal', () => {
  it('renders fields and updates preview without resolving insertion result', () => {
    const modal = new LibrarySnippetPreviewModal({} as never, snippet, t);

    modal.open();

    const content = (modal as unknown as { contentEl: MockEl }).contentEl;
    const input = content.querySelector('input[type="text"]');
    const preview = content.querySelector('.rp-library-preview-output');
    const sideButton = content.querySelectorAll('.rp-library-preview-option-row')[0];

    expect(preview?.value).toBe('Finding: {{finding}}. Side: {{side}}.');

    input!.value = 'mass';
    input!.dispatchEvent({ type: 'input' });
    sideButton!.dispatchEvent({ type: 'click' });

    expect(preview?.value).toBe('Finding: mass. Side: left.');
    expect(sideButton?.getAttribute('aria-pressed')).toBe('true');
  });
});
