// src/__tests__/views/snippet-fill-in-modal.test.ts
// Phase 52 Plan 01 (D-05 / D-06 / D-09 RED) — unified choice rendering contract.
//
// These tests are RED at Plan 01 commit time. Plan 03 narrows `renderField`
// dispatch to two arms (free-text, choice=alwaysMulti) and flips them GREEN.
//
// Infrastructure note:
//   vitest environment is 'node' — no jsdom. The obsidian stub under
//   src/__mocks__/obsidian.ts exposes a `Modal` whose contentEl is a thin
//   MockEl without querySelector/querySelectorAll. This file swaps the stub
//   via a local vi.mock('obsidian', ...) factory that installs a DOM-ish
//   contentEl/titleEl (same pattern used in snippet-editor-modal.test.ts).
// Tests remain RED because production dispatch still renders radios for
// 'choice' (Plan 03 will flip to checkboxes), not because of infra.

import { describe, it, expect, vi } from 'vitest';

// ───── MockEl with querySelector/querySelectorAll + event dispatch ─────
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  scrollHeight: number;
  dataset: Record<string, string>;
  style: Record<string, string>;
  // accessor-backed: textContent, value, disabled, type, checked, style
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  removeAttribute: (k: string) => void;
  getAttribute: (k: string) => string | null;
  focus: () => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const children: MockEl[] = [];
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const classSet = new Set<string>();
  const dataset: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _value: '',
    _disabled: false,
    _type: '',
    _checked: false,
    _listeners: listeners,
    name: '',
    inputMode: '',
    readOnly: false,
    scrollHeight: 0,
    dataset,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) (child as unknown as { _text: string })._text = opts.text;
      if (opts?.cls) child.classList.add(opts.cls);
      if (opts?.type) (child as unknown as { _type: string })._type = opts.type;
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      (el as unknown as { _text: string })._text = text;
    },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      const want = on ?? !classSet.has(cls);
      if (want) classSet.add(cls);
      else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    removeAttribute(k: string): void { delete attrs[k]; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    focus(): void {},
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type);
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type);
      if (!arr) return;
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(sel: string): MockEl | null {
      const all = walk(el as unknown as MockEl, sel);
      return all[0] ?? null;
    },
    querySelectorAll(sel: string): MockEl[] {
      return walk(el as unknown as MockEl, sel);
    },
    style,
  } as unknown as MockEl;

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as { _text: string })._text; },
    set(v: string): void { (el as unknown as { _text: string })._text = String(v); },
  });
  Object.defineProperty(el, 'value', {
    get(): string { return (el as unknown as { _value: string })._value; },
    set(v: string): void { (el as unknown as { _value: string })._value = String(v); },
  });
  Object.defineProperty(el, 'disabled', {
    get(): boolean { return (el as unknown as { _disabled: boolean })._disabled; },
    set(v: boolean): void { (el as unknown as { _disabled: boolean })._disabled = Boolean(v); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as unknown as { _type: string })._type; },
    set(v: string): void { (el as unknown as { _type: string })._type = String(v); },
  });
  Object.defineProperty(el, 'checked', {
    get(): boolean { return (el as unknown as { _checked: boolean })._checked; },
    set(v: boolean): void { (el as unknown as { _checked: boolean })._checked = Boolean(v); },
  });

  return el;
}

/** Simple selector walker — supports 'input[type="checkbox"]', 'button', 'input[type="radio"]', '.class'. */
function walk(root: MockEl, sel: string): MockEl[] {
  const out: MockEl[] = [];
  const match = buildMatcher(sel);
  const stack: MockEl[] = [...root.children];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (match(cur)) out.push(cur);
    for (const c of cur.children) stack.push(c);
  }
  return out;
}

function buildMatcher(sel: string): (el: MockEl) => boolean {
  // class selector
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  // tag[attr="value"]
  const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]+)"\]$/.exec(sel);
  if (tagAttrMatch) {
    const [, tag, attr, val] = tagAttrMatch;
    return (el) => {
      if (el.tagName !== tag!.toUpperCase()) return false;
      if (attr === 'type') return (el as unknown as { _type: string })._type === val;
      return el.getAttribute(attr!) === val;
    };
  }
  // plain tag
  return (el) => el.tagName === sel.toUpperCase();
}

// ───── Mock obsidian with enhanced Modal ─────
vi.mock('obsidian', () => {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice { constructor(_m: string) {} }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(): void {}
    onChooseSuggestion(): void {}
    setPlaceholder(): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_e: unknown) {}
    setName(): this { return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addText(): this { return this; }
    addTextArea(): this { return this; }
    addDropdown(): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile { path: string; constructor(p = '') { this.path = p; } }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile };
});

// Import after the mock is installed.
import { SnippetFillInModal } from '../../views/snippet-fill-in-modal';
import type { JsonSnippet } from '../../snippets/snippet-model';

const app = {} as never;

function makeSnippet(
  placeholders: JsonSnippet['placeholders'],
  template = 'R: {{f}}',
): JsonSnippet {
  return {
    kind: 'json',
    path: 'Protocols/Snippets/t.json',
    name: 't',
    template,
    placeholders,
    validationError: null,
  };
}

function findConfirmButton(root: MockEl): MockEl {
  const buttons = root.querySelectorAll('button');
  const found = buttons.find(
    (b) => (b as unknown as { _text: string })._text === 'Confirm',
  );
  if (!found) throw new Error('Confirm button missing');
  return found;
}

describe('SnippetFillInModal Phase 52 D-05 — unified choice renders as checkboxes', () => {
  it('renders checkbox inputs (not radios) for choice with options', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const checkboxes = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="checkbox"]');
    const radios = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="radio"]');
    expect(checkboxes.length).toBe(3);
    expect(radios.length).toBe(0);
    modal.onClose();
  });

  it('resolves with empty string in value map when no checkbox + empty custom (D-09)', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const confirmBtn = findConfirmButton(
      (modal as unknown as { contentEl: MockEl }).contentEl,
    );
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: ');
    modal.onClose();
  });

  it('inserts a single checked option verbatim', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['alpha', 'beta'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const boxes = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="checkbox"]');
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    const confirmBtn = findConfirmButton(
      (modal as unknown as { contentEl: MockEl }).contentEl,
    );
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: alpha');
    modal.onClose();
  });

  it('joins multiple checked options with default separator ", "', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const boxes = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="checkbox"]');
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    (boxes[2] as unknown as { _checked: boolean })._checked = true;
    boxes[2]!.dispatchEvent({ type: 'change' });
    const confirmBtn = findConfirmButton(
      (modal as unknown as { contentEl: MockEl }).contentEl,
    );
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: a, c');
    modal.onClose();
  });

  it('joins multiple checked options with override separator " / " (D-02)', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'], separator: ' / ' },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const boxes = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="checkbox"]');
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    (boxes[1] as unknown as { _checked: boolean })._checked = true;
    boxes[1]!.dispatchEvent({ type: 'change' });
    const confirmBtn = findConfirmButton(
      (modal as unknown as { contentEl: MockEl }).contentEl,
    );
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: a / b');
    modal.onClose();
  });

  it('preserves array order in joined output (not click order)', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b', 'c'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const boxes = (modal as unknown as { contentEl: MockEl }).contentEl
      .querySelectorAll('input[type="checkbox"]');
    // Click order: c, a, b
    (boxes[2] as unknown as { _checked: boolean })._checked = true;
    boxes[2]!.dispatchEvent({ type: 'change' });
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    (boxes[1] as unknown as { _checked: boolean })._checked = true;
    boxes[1]!.dispatchEvent({ type: 'change' });
    const confirmBtn = findConfirmButton(
      (modal as unknown as { contentEl: MockEl }).contentEl,
    );
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: a, b, c');
    modal.onClose();
  });
});

describe('SnippetFillInModal Phase 52 D-06 — Custom override preserved', () => {
  it('keeps custom text rows collapsed by default behind a compact toggle', () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const root = (modal as unknown as { contentEl: MockEl }).contentEl;
    const customRow = root.querySelectorAll('.rp-snippet-modal-custom-row')[0];
    const customToggle = root.querySelectorAll('.rp-snippet-modal-custom-toggle')[0];
    if (!customRow || !customToggle) throw new Error('Custom controls missing');
    expect(customRow.getAttribute('hidden')).toBe('true');
    expect(customToggle.getAttribute('aria-expanded')).toBe('false');
    customToggle.dispatchEvent({ type: 'click' });
    expect(customRow.getAttribute('hidden')).toBeNull();
    expect(customToggle.getAttribute('aria-expanded')).toBe('true');
    modal.onClose();
  });

  it('Custom non-empty text overrides checkboxes', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const root = (modal as unknown as { contentEl: MockEl }).contentEl;
    const boxes = root.querySelectorAll('input[type="checkbox"]');
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    (boxes[1] as unknown as { _checked: boolean })._checked = true;
    boxes[1]!.dispatchEvent({ type: 'change' });
    const customInput = root
      .querySelectorAll('.rp-snippet-modal-custom-row')[0]
      ?.querySelectorAll('input[type="text"]')[0];
    if (!customInput) throw new Error('Custom input missing');
    (customInput as unknown as { _value: string })._value = 'customX';
    customInput.dispatchEvent({ type: 'input' });
    const confirmBtn = findConfirmButton(root);
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: customX');
    modal.onClose();
  });

  it('Custom emptied falls back to checkbox values', async () => {
    const snippet = makeSnippet([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'] },
    ]);
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const root = (modal as unknown as { contentEl: MockEl }).contentEl;
    const boxes = root.querySelectorAll('input[type="checkbox"]');
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    const customInput = root
      .querySelectorAll('.rp-snippet-modal-custom-row')[0]
      ?.querySelectorAll('input[type="text"]')[0];
    if (!customInput) throw new Error('Custom input missing');
    (customInput as unknown as { _value: string })._value = 'override';
    customInput.dispatchEvent({ type: 'input' });
    // Clear Custom
    (customInput as unknown as { _value: string })._value = '';
    customInput.dispatchEvent({ type: 'input' });
    // Re-check the box (Custom listener clears all boxes on non-empty)
    (boxes[0] as unknown as { _checked: boolean })._checked = true;
    boxes[0]!.dispatchEvent({ type: 'change' });
    const confirmBtn = findConfirmButton(root);
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: a');
    modal.onClose();
  });
});

describe('SnippetFillInModal Phase 52 — free-text unchanged', () => {
  it('auto-expands the preview textarea as rendered text grows', () => {
    const snippet = makeSnippet(
      [{ id: 'f', label: 'F', type: 'free-text' }],
      'R: {{f}}',
    );
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const root = (modal as unknown as { contentEl: MockEl }).contentEl;
    const preview = root.querySelectorAll('.rp-snippet-preview')[0];
    const textInput = root.querySelectorAll('input[type="text"]')[0];
    if (!preview || !textInput) throw new Error('Preview or text input missing');
    preview.scrollHeight = 240;
    (textInput as unknown as { _value: string })._value = 'long rendered text';
    textInput.dispatchEvent({ type: 'input' });
    expect(preview.style.height).toBe('240px');
    modal.onClose();
  });

  it('renders a text input for free-text and inserts its value', async () => {
    const snippet = makeSnippet(
      [{ id: 'f', label: 'F', type: 'free-text' }],
      'R: {{f}}',
    );
    const modal = new SnippetFillInModal(app, snippet);
    modal.onOpen();
    const root = (modal as unknown as { contentEl: MockEl }).contentEl;
    const textInputs = root.querySelectorAll('input[type="text"]');
    const textInput = textInputs[0];
    if (!textInput) throw new Error('Text input missing');
    (textInput as unknown as { _value: string })._value = 'hello';
    textInput.dispatchEvent({ type: 'input' });
    const confirmBtn = findConfirmButton(root);
    confirmBtn.dispatchEvent({ type: 'click' });
    const result = await modal.result;
    expect(result).toBe('R: hello');
    modal.onClose();
  });
});
