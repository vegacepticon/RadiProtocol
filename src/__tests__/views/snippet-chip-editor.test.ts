// src/__tests__/views/snippet-chip-editor.test.ts
// Phase 52 Plan 01 RED — narrowing probes for the two-type union + SC 2
// options-list regression guard.
//
// Mix of RED and GREEN tests:
//   - A1 (Phase 52 RED): mini-form type-select has only 2 options ('free-text', 'choice')
//   - A2 (SC 2 GREEN):   options-list add/edit/remove roundtrip works on current code
//                        (RESEARCH.md: D-08 bug "not reproducible"; this is the
//                        functional regression guard).
//   - A3 (Phase 52 RED): expanded-chip type-select has only 2 options
//   - A4 (Phase 52 RED): expanded-chip uses `ph.separator` not `ph.joinSeparator`,
//                        label reads "Разделитель" (or Phase-52-locked copy).
//   - A5 (Phase 52 RED): PH_COLOR probe via rendered border-left-color on a chip

import { describe, it, expect, vi } from 'vitest';

// ───── MockEl infra (trimmed variant of snippet-fill-in-modal.test.ts) ────
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
  id: string;
  htmlFor: string;
  dataset: Record<string, string>;
  selectionStart: number;
  selectionEnd: number;
  style: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  appendChild: (c: MockEl) => MockEl;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  closest: (sel: string) => MockEl | null;
  focus: () => void;
  contains: (other: MockEl | null) => boolean;
  remove: () => void;
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
    id: '',
    htmlFor: '',
    dataset,
    selectionStart: 0,
    selectionEnd: 0,
    style,
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
    appendChild(child: MockEl): MockEl {
      child.parent = el as unknown as MockEl;
      children.push(child);
      return child;
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
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    removeAttribute(k: string): void { delete attrs[k]; },
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
    closest(sel: string): MockEl | null {
      let cur: MockEl | null = el as unknown as MockEl;
      const match = buildMatcher(sel);
      while (cur) {
        if (match(cur)) return cur;
        cur = cur.parent;
      }
      return null;
    },
    focus(): void {},
    contains(_other: MockEl | null): boolean { return false; },
    remove(): void {
      if (el.parent) {
        const arr = el.parent.children;
        const i = arr.indexOf(el as unknown as MockEl);
        if (i >= 0) arr.splice(i, 1);
      }
    },
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
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  return (el) => el.tagName === sel.toUpperCase();
}

// ───── Mock obsidian ─────
vi.mock('obsidian', () => {
  return {
    Modal: class {
      app: unknown;
      contentEl: MockEl;
      constructor(app: unknown) { this.app = app; this.contentEl = makeEl('div'); }
      open(): void {}
      close(): void {}
      onOpen(): void {}
      onClose(): void {}
    },
    Notice: class { constructor(_m: string) {} },
    Plugin: class {},
    ItemView: class {},
    WorkspaceLeaf: class {},
    PluginSettingTab: class {},
    SuggestModal: class<T> {
      app: unknown;
      constructor(app: unknown) { this.app = app; }
      getSuggestions(_q: string): T[] { return []; }
      renderSuggestion(): void {}
      onChooseSuggestion(): void {}
      setPlaceholder(): void {}
      open(): void {}
      close(): void {}
    },
    Setting: class {
      constructor(_e: unknown) {}
      setName(): this { return this; }
      setDesc(): this { return this; }
      setHeading(): this { return this; }
      addText(): this { return this; }
      addTextArea(): this { return this; }
      addDropdown(): this { return this; }
      addSlider(): this { return this; }
      addButton(): this { return this; }
    },
    TFile: class { path: string; constructor(p = '') { this.path = p; } },
  };
});

// Polyfill `Event` class used by insertAtCursor helper if needed
if (typeof (globalThis as { Event?: unknown }).Event === 'undefined') {
  (globalThis as unknown as { Event: unknown }).Event = class {
    type: string;
    constructor(type: string) { this.type = type; }
  };
}

import { mountChipEditor } from '../../views/snippet-chip-editor';
import type { JsonSnippet } from '../../snippets/snippet-model';

function makeDraft(placeholders: JsonSnippet['placeholders'] = []): JsonSnippet {
  return {
    kind: 'json',
    path: 'Protocols/Snippets/t.json',
    name: 't',
    template: '',
    placeholders,
    validationError: null,
  };
}

describe('snippet-chip-editor Phase 52 — narrowing probes (RED pre-Plan-03)', () => {
  it('A1: mini-form type-select contains exactly two options (free-text, choice)', () => {
    const draft = makeDraft();
    const container = makeEl('div');
    const onChange = vi.fn();
    mountChipEditor(container as unknown as HTMLElement, draft, onChange);
    // Expand mini-form via the [+ add placeholder] button click
    const addBtn = container.querySelectorAll('button').find(
      (b) => (b as unknown as { _text: string })._text === '+ add placeholder',
    );
    if (!addBtn) throw new Error('+ add placeholder button missing');
    addBtn.dispatchEvent({ type: 'click' });
    const selectEls = container.querySelectorAll('select');
    // mini-form select is the first select
    const select = selectEls[0];
    if (!select) throw new Error('mini-form select missing');
    const options = select.children.filter((c) => c.tagName === 'OPTION');
    const values = options.map((o) => (o as unknown as { _value: string })._value);
    expect(values).toEqual(['free-text', 'choice']);
  });

  it('A3: expanded-chip type-select contains exactly two options (free-text, choice)', () => {
    const draft = makeDraft([
      { id: 'f', label: 'F', type: 'choice', options: ['a'] },
    ]);
    const container = makeEl('div');
    const onChange = vi.fn();
    mountChipEditor(container as unknown as HTMLElement, draft, onChange);
    // Click the chip to expand
    const chip = container.querySelectorAll('.rp-placeholder-chip')[0];
    if (!chip) throw new Error('chip missing');
    chip.dispatchEvent({ type: 'click' });
    // The expanded form inserts a new select (type dropdown); after click there
    // should be at least 2 selects — the mini-form (hidden) + the expanded one.
    const selects = container.querySelectorAll('select');
    // Expanded form's type-select is the LAST select rendered
    const expandedSelect = selects[selects.length - 1];
    if (!expandedSelect) throw new Error('expanded type-select missing');
    const options = expandedSelect.children.filter((c) => c.tagName === 'OPTION');
    const values = options.map((o) => (o as unknown as { _value: string })._value);
    expect(values).toEqual(['free-text', 'choice']);
  });

  it('A4: expanded choice placeholder binds separator to ph.separator (not joinSeparator)', () => {
    const draft = makeDraft([
      { id: 'f', label: 'F', type: 'choice', options: ['a', 'b'], separator: ' / ' },
    ]);
    const container = makeEl('div');
    const onChange = vi.fn();
    mountChipEditor(container as unknown as HTMLElement, draft, onChange);
    const chip = container.querySelectorAll('.rp-placeholder-chip')[0];
    if (!chip) throw new Error('chip missing');
    chip.dispatchEvent({ type: 'click' });
    // Look for the separator label — Phase 52 locks the copy to 'Разделитель'
    const labels = container.querySelectorAll('label');
    const sepLabel = labels.find(
      (l) => (l as unknown as { _text: string })._text === 'Разделитель',
    );
    expect(sepLabel).toBeTruthy();
    // And the separator input should carry the draft.separator value
    const inputs = container.querySelectorAll('input');
    const sepInput = inputs.find(
      (i) => (i as unknown as { _value: string })._value === ' / ',
    );
    expect(sepInput).toBeTruthy();
  });

  it('A5: PH_COLOR exposes exactly two keys after narrowing (free-text, choice)', () => {
    // Probe by asserting the chip border-left-color style is populated for both
    // remaining types. If PH_COLOR still has 'multi-choice' / 'number' keys
    // (pre-Plan-03), the TS union narrowing will force a compile error —
    // Plan 03 simultaneously narrows the union and PH_COLOR. This test asserts
    // at runtime that a 'choice' chip gets a non-empty border-left-color.
    const draft = makeDraft([
      { id: 'f', label: 'F', type: 'choice', options: ['a'] },
    ]);
    const container = makeEl('div');
    const onChange = vi.fn();
    mountChipEditor(container as unknown as HTMLElement, draft, onChange);
    const chip = container.querySelectorAll('.rp-placeholder-chip')[0];
    if (!chip) throw new Error('chip missing');
    const borderColor = (chip as unknown as { style: Record<string, string> }).style[
      'borderLeftColor'
    ] ?? (chip as unknown as { style: Record<string, string> }).style['border-left-color'];
    expect(borderColor).toBeTruthy();
    // Phase 52 locked: choice = orange (per chip-editor PH_COLOR after narrowing)
    expect(String(borderColor)).toMatch(/orange/);
  });
});

describe('snippet-chip-editor Phase 52 — options-list roundtrip (SC 2 regression guard)', () => {
  it('A2: + add option → type → × remove mutates draft.placeholders.options', () => {
    const draft = makeDraft([
      { id: 'f', label: 'F', type: 'choice', options: [] },
    ]);
    const container = makeEl('div');
    const onChange = vi.fn();
    mountChipEditor(container as unknown as HTMLElement, draft, onChange);
    // Expand the chip
    const chip = container.querySelectorAll('.rp-placeholder-chip')[0];
    if (!chip) throw new Error('chip missing');
    chip.dispatchEvent({ type: 'click' });
    // Find the [+ add option] button
    const allButtons = container.querySelectorAll('button');
    const addBtn = allButtons.find(
      (b) => (b as unknown as { _text: string })._text === '+ add option',
    );
    if (!addBtn) throw new Error('+ add option button missing');
    addBtn.dispatchEvent({ type: 'click' });
    expect(draft.placeholders[0]!.options).toHaveLength(1);
    expect(onChange).toHaveBeenCalled();
    // Type into the new option input
    const optRow = container.querySelectorAll('.rp-option-row')[0];
    if (!optRow) throw new Error('.rp-option-row missing');
    const optInput = optRow.querySelectorAll('input')[0];
    if (!optInput) throw new Error('option input missing');
    (optInput as unknown as { _value: string })._value = 'left';
    optInput.dispatchEvent({ type: 'input' });
    expect(draft.placeholders[0]!.options?.[0]).toBe('left');
    // Remove the row via the row's remove button (× character)
    const removeBtn = optRow.querySelectorAll('button').find(
      (b) => (b as unknown as { _text: string })._text === '×',
    ) ?? optRow.querySelectorAll('button')[0];
    if (!removeBtn) throw new Error('remove button missing');
    removeBtn.dispatchEvent({ type: 'click' });
    expect(draft.placeholders[0]!.options).toHaveLength(0);
  });
});
