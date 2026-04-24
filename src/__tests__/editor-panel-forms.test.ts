// src/__tests__/editor-panel-forms.test.ts
// Phase 48 Plan 01 Task 1 — Assertions for NODEUI-01 (no Snippet ID row),
// NODEUI-03 (Display label before Answer text), and NODEUI-04 (custom-DOM
// auto-growing textarea for Question).
//
// All assertions in this file are expected RED before Task 2/3 implementation.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Setting } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';
import type RadiProtocolPlugin from '../main';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('obsidian');
vi.mock('../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    mount = vi.fn().mockResolvedValue(undefined);
    unmount = vi.fn();
  },
}));

// ── Shared capture state ──────────────────────────────────────────────────

const settingCalls: { setName: string[]; setDesc: string[]; setHeading: number }
  = { setName: [], setDesc: [], setHeading: 0 };
const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const textInputOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const dropdownOptions: Array<[string, string]> = [];

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = 0;
  textareaOnChange.cb = null;
  textInputOnChange.cb = null;
  dropdownOptions.length = 0;

  const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
  SettingProto.setName = vi.fn(function (this: unknown, name: string) {
    settingCalls.setName.push(name);
    return this;
  });
  SettingProto.setDesc = vi.fn(function (this: unknown, desc: string) {
    settingCalls.setDesc.push(desc);
    return this;
  });
  SettingProto.setHeading = vi.fn(function (this: unknown) {
    settingCalls.setHeading += 1;
    return this;
  });

  const mockTextArea = {
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown, cb: (v: string) => void) {
      textareaOnChange.cb = cb;
      return this;
    }),
  };
  SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (ta: unknown) => void) {
    cb(mockTextArea);
    return this;
  });

  const mockText = {
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown, cb: (v: string) => void) {
      textInputOnChange.cb = cb;
      return this;
    }),
  };
  SettingProto.addText = vi.fn(function (this: unknown, cb: (t: unknown) => void) {
    cb(mockText);
    return this;
  });

  const mockDropdown = {
    addOption: vi.fn(function (this: unknown, value: string, display: string) {
      dropdownOptions.push([value, display]);
      return this;
    }),
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown) { return this; }),
    selectEl: { createEl: () => ({ disabled: false }) },
  };
  SettingProto.addDropdown = vi.fn(function (this: unknown, cb: (d: unknown) => void) {
    cb(mockDropdown);
    return this;
  });
}

// ── fakeNode recursive stub ───────────────────────────────────────────────

const createdElements: Array<{ tag: string; cls?: string; text?: string; parentCls?: string }> = [];
const textareaInputCb: { cb: (() => void) | null } = { cb: null };
const textareaInputCallbacks = new Map<Record<string, unknown>, () => void>();
const allTextareas: Array<Record<string, unknown>> = [];
let lastTextarea: Record<string, unknown> | null = null;

function makeTrackedStyle(): { style: { height: string; width: string }; history: string[] } {
  const history: string[] = [];
  let height = '';
  const style = { width: '' } as { height: string; width: string };
  Object.defineProperty(style, 'height', {
    get: () => height,
    set: (value: string) => {
      height = value;
      history.push(value);
    },
    configurable: true,
  });
  return { style, history };
}

const fakeNode = (parentCls?: string): Record<string, unknown> => {
  const self: Record<string, unknown> = {
    empty: () => {},
    createDiv: (opts?: { cls?: string; text?: string }) => {
      createdElements.push({ tag: 'div', cls: opts?.cls, text: opts?.text, parentCls });
      return fakeNode(opts?.cls);
    },
    createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
      createdElements.push({ tag, cls: opts?.cls, text: opts?.text, parentCls });
      const child = fakeNode(opts?.cls);
      if (tag === 'textarea') {
        const tracked = makeTrackedStyle();
        (child as Record<string, unknown>).style = tracked.style;
        (child as Record<string, unknown>).__heightHistory = tracked.history;
        (child as Record<string, unknown>).scrollHeight = 123;
        (child as Record<string, unknown>).value = '';
        lastTextarea = child;
        allTextareas.push(child);
      }
      return child;
    },
    createSpan: () => fakeNode(parentCls),
    setAttribute: () => {},
    appendText: () => {},
    addClass: () => {},
    removeClass: () => {},
    setText: () => {},
    disabled: false,
  };
  return self;
};

// ── makeView helper ───────────────────────────────────────────────────────

function makeView(): EditorPanelView {
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const plugin = {
    app: { vault: { adapter: { list: vi.fn(), exists: vi.fn() } } },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: {},
  } as unknown as RadiProtocolPlugin;
  const view = new EditorPanelView(leaf, plugin);
  (view as unknown as { contentEl: unknown }).contentEl = fakeNode();
  (view as unknown as { registerDomEvent: (el: unknown, ev: string, cb: () => void) => void })
    .registerDomEvent = (el, ev, cb) => {
      if (ev === 'input') {
        if (el === lastTextarea) textareaInputCb.cb = cb;
        textareaInputCallbacks.set(el as Record<string, unknown>, cb);
      }
    };
  return view;
}

function resetDomCaptures(): void {
  createdElements.length = 0;
  textareaInputCb.cb = null;
  textareaInputCallbacks.clear();
  allTextareas.length = 0;
  lastTextarea = null;
}

function findTextareaAfterLabel(label: string): Record<string, unknown> | undefined {
  const labelIdx = createdElements.findIndex(e => e.text === label);
  if (labelIdx < 0) return undefined;
  let textareaOrdinal = 0;
  for (let i = 0; i < createdElements.length; i += 1) {
    const element = createdElements[i]!;
    if (element.tag !== 'textarea') continue;
    if (i > labelIdx) return allTextareas[textareaOrdinal];
    textareaOrdinal += 1;
  }
  return undefined;
}

// ── NODEUI-01: text-block form has no Snippet ID row ─────────────────────

describe('NODEUI-01: text-block form has no Snippet ID row', () => {
  beforeEach(() => { installSettingPrototypeMock(); resetDomCaptures(); });

  it('does not render a Setting row named "Snippet ID (optional)"', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'text-block');
    expect(settingCalls.setName).not.toContain('Snippet ID (optional)');
  });

  it('does not write radiprotocol_snippetId to pendingEdits when the text-block form is rendered', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'text-block');
    // simulate a user edit through whatever text-input onChange ran last;
    // for text-block after Phase 48 this is the Separator dropdown only, not Snippet ID.
    expect(Object.keys(view['pendingEdits'])).not.toContain('radiprotocol_snippetId');
  });
});

// ── NODEUI-03: answer form renders Display label before Answer text ────────

describe('NODEUI-03: answer form renders Display label before Answer text', () => {
  beforeEach(() => { installSettingPrototypeMock(); resetDomCaptures(); });

  it('setName order has "Display label (optional)" before "Answer text"', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'answer');
    const labelIdx = settingCalls.setName.indexOf('Display label (optional)');
    const textIdx = settingCalls.setName.indexOf('Answer text');
    expect(labelIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(labelIdx).toBeLessThan(textIdx);
  });

  it('Text separator dropdown stays last (after Answer text)', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'answer');
    const sepIdx = settingCalls.setName.indexOf('Text separator');
    const textIdx = settingCalls.setName.indexOf('Answer text');
    expect(sepIdx).toBeGreaterThan(textIdx);
  });
});

// ── NODEUI-04: question form custom DOM + auto-grow textarea ──────────────

describe('NODEUI-04: question form custom DOM + auto-grow textarea', () => {
  // vitest node environment does not define requestAnimationFrame — install a
  // synchronous polyfill (same pattern as RunnerView.test.ts:114-134) so the
  // deferred height block runs inside the same tick, then tear it down.
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  beforeEach(() => {
    installSettingPrototypeMock();
    resetDomCaptures();
    originalRaf = (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    if (originalRaf === undefined) {
      delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    } else {
      (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = originalRaf;
    }
  });

  it('renders a <textarea class="rp-question-textarea"> NOT wrapped in a .setting-item row', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'question');
    const ta = createdElements.find(e => e.tag === 'textarea' && e.cls?.includes('rp-question-textarea'));
    expect(ta).toBeDefined();
    // addTextArea (which would wrap inside Setting) should NOT have been the one that created the question textarea:
    const taAddedViaSetting = settingCalls.setName.some(n => n === 'Question text');
    expect(taAddedViaSetting).toBe(false);
  });

  it('label + helper description render before the textarea', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'question');
    const labelIdx = createdElements.findIndex(e => e.cls === 'rp-field-label');
    const descIdx = createdElements.findIndex(e => e.cls === 'rp-field-desc');
    const taIdx = createdElements.findIndex(e => e.tag === 'textarea' && e.cls?.includes('rp-question-textarea'));
    expect(labelIdx).toBeGreaterThanOrEqual(0);
    expect(descIdx).toBeGreaterThanOrEqual(0);
    expect(taIdx).toBeGreaterThanOrEqual(0);
    expect(labelIdx).toBeLessThan(taIdx);
    expect(descIdx).toBeLessThan(taIdx);
  });

  it('input event on the textarea writes style.height = "auto" then = scrollHeight + "px"', () => {
    const view = makeView();
    const container = fakeNode();
    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, {}, 'question');
    expect(textareaInputCb.cb).not.toBeNull();
    expect(lastTextarea).not.toBeNull();
    (lastTextarea as { style: { height: string } }).style.height = 'prev';
    textareaInputCb.cb?.();
    expect((lastTextarea as { style: { height: string } }).style.height).toBe('123px');
  });
});

// ── Phase 64 EDITOR-04: all authored multiline fields auto-grow ───────────

describe('Phase 64 EDITOR-04: shared auto-grow textarea coverage', () => {
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  beforeEach(() => {
    installSettingPrototypeMock();
    resetDomCaptures();
    originalRaf = (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    if (originalRaf === undefined) {
      delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    } else {
      (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = originalRaf;
    }
  });

  const cases: Array<{
    kind: 'question' | 'answer' | 'text-block' | 'loop' | 'snippet';
    label: string;
    record: Record<string, unknown>;
    newValue: string;
    expectedEdits: Record<string, unknown>;
  }> = [
    {
      kind: 'question',
      label: 'Question text',
      record: { radiprotocol_questionText: 'Initial question' },
      newValue: 'Updated question',
      expectedEdits: { radiprotocol_questionText: 'Updated question', text: 'Updated question' },
    },
    {
      kind: 'answer',
      label: 'Answer text',
      record: { radiprotocol_answerText: 'Initial answer' },
      newValue: 'Updated answer',
      expectedEdits: { radiprotocol_answerText: 'Updated answer', text: 'Updated answer' },
    },
    {
      kind: 'text-block',
      label: 'Content',
      record: { radiprotocol_content: 'Initial text block' },
      newValue: 'Updated text block',
      expectedEdits: { radiprotocol_content: 'Updated text block', text: 'Updated text block' },
    },
    {
      kind: 'loop',
      label: 'Header text',
      record: { radiprotocol_headerText: 'Initial loop header' },
      newValue: 'Updated loop header',
      expectedEdits: { radiprotocol_headerText: 'Updated loop header', text: 'Updated loop header' },
    },
    {
      kind: 'snippet',
      label: 'Branch label',
      record: { radiprotocol_snippetLabel: 'Initial snippet label' },
      newValue: 'Updated snippet label',
      expectedEdits: { radiprotocol_snippetLabel: 'Updated snippet label' },
    },
  ];

  it.each(cases)('Phase 64: $kind $label field renders as a managed growable textarea and sizes on load', ({ kind, label, record }) => {
    const view = makeView();
    const container = fakeNode();

    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, record, kind);

    const textarea = findTextareaAfterLabel(label);
    expect(textarea, `${label} should render as a real textarea after its visible label`).toBeDefined();
    const element = createdElements.find(e => e.tag === 'textarea');
    expect(element?.cls, `${label} textarea should opt into shared growable styling`).toContain('rp-growable-textarea');
    expect(textarea?.value).toBe(Object.values(record)[0]);
    expect(textarea?.__heightHistory).toEqual(['auto', '123px']);
  });

  it.each(cases)('Phase 64: $kind $label input grows/shrinks and preserves pending edit keys', ({ kind, record, newValue, expectedEdits }) => {
    const view = makeView();
    const container = fakeNode();

    // @ts-expect-error accessing private for test
    view['buildKindForm'](container, record, kind);

    const textarea = allTextareas[0];
    expect(textarea, `${kind} should register a managed textarea`).toBeDefined();
    const inputCb = textareaInputCallbacks.get(textarea!);
    expect(inputCb, `${kind} textarea should register an input callback`).toBeDefined();

    (textarea as { value: string }).value = newValue;
    (textarea as { scrollHeight: number }).scrollHeight = 240;
    (textarea as { __heightHistory: string[] }).__heightHistory.length = 0;
    inputCb?.();

    expect((textarea as { __heightHistory: string[] }).__heightHistory).toEqual(['auto', '240px']);
    for (const [key, value] of Object.entries(expectedEdits)) {
      expect(view['pendingEdits'][key]).toBe(value);
    }

    (textarea as { value: string }).value = '';
    (textarea as { scrollHeight: number }).scrollHeight = 18;
    (textarea as { __heightHistory: string[] }).__heightHistory.length = 0;
    inputCb?.();

    expect((textarea as { __heightHistory: string[] }).__heightHistory).toEqual(['auto', '18px']);
    if (kind === 'snippet') {
      expect(view['pendingEdits']['radiprotocol_snippetLabel']).toBeUndefined();
    }
  });
});

// ── NODEUI-05: toolbar renders at the bottom of contentEl ────────────────

describe('NODEUI-05: toolbar renders at the bottom of contentEl', () => {
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  beforeEach(() => {
    installSettingPrototypeMock();
    resetDomCaptures();
    originalRaf = (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    if (originalRaf === undefined) {
      delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    } else {
      (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = originalRaf;
    }
  });

  it('renderIdle: toolbar is invoked AFTER the idle container <p> elements', () => {
    const view = makeView();
    (view as unknown as { renderToolbar: (c: unknown) => void })['renderToolbar'] =
      () => { createdElements.push({ tag: '__TOOLBAR__' }); };
    view['renderIdle']();
    const idleIdx = createdElements.findIndex(e => e.cls === 'rp-editor-idle');
    const toolbarIdx = createdElements.findIndex(e => e.tag === '__TOOLBAR__');
    expect(idleIdx).toBeGreaterThanOrEqual(0);
    expect(toolbarIdx).toBeGreaterThanOrEqual(0);
    expect(toolbarIdx).toBeGreaterThan(idleIdx);
  });

  it('renderForm: toolbar is invoked AFTER the .rp-editor-panel container', () => {
    const view = makeView();
    (view as unknown as { renderToolbar: (c: unknown) => void })['renderToolbar'] =
      () => { createdElements.push({ tag: '__TOOLBAR__' }); };
    view['renderForm']({}, null);
    const panelIdx = createdElements.findIndex(e => e.cls === 'rp-editor-panel');
    const toolbarIdx = createdElements.findIndex(e => e.tag === '__TOOLBAR__');
    expect(panelIdx).toBeGreaterThanOrEqual(0);
    expect(toolbarIdx).toBeGreaterThanOrEqual(0);
    expect(toolbarIdx).toBeGreaterThan(panelIdx);
  });
});

// ── NODEUI-05: editor-panel.css has Phase 48 column-stack rules ──────────

describe('NODEUI-05: editor-panel.css has Phase 48 column-stack rules', () => {
  it('contains a /* Phase 48 */ marker with flex-direction: column + margin-top: auto + flex-wrap: nowrap', () => {
    const cssPath = path.resolve(__dirname, '../styles/editor-panel.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const phase48Idx = css.indexOf('/* Phase 48');
    expect(phase48Idx).toBeGreaterThanOrEqual(0);
    const phase48Region = css.slice(phase48Idx);
    expect(phase48Region).toContain('flex-direction: column');
    expect(phase48Region).toContain('margin-top: auto');
    expect(phase48Region).toContain('flex-wrap: nowrap');
  });

  it('Phase 48.1: toolbar margin-top is overridden to a small fixed gap (var(--size-4-3)) after the Phase 48 block', () => {
    const cssPath = path.resolve(__dirname, '../styles/editor-panel.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const phase481Idx = css.indexOf('/* Phase 48.1');
    expect(phase481Idx).toBeGreaterThanOrEqual(0);
    const phase48Idx = css.indexOf('/* Phase 48 NODEUI-05');
    expect(phase481Idx).toBeGreaterThan(phase48Idx);
    const phase481Region = css.slice(phase481Idx);
    expect(phase481Region).toContain('.rp-editor-create-toolbar');
    expect(phase481Region).toContain('margin-top: var(--size-4-3)');
  });

  it('Phase 48.1b: .rp-editor-panel height override is present so form panel does not push the toolbar off-screen', () => {
    const cssPath = path.resolve(__dirname, '../styles/editor-panel.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const phase481bIdx = css.indexOf('/* Phase 48.1b');
    expect(phase481bIdx).toBeGreaterThanOrEqual(0);
    const phase4PanelIdx = css.indexOf('.rp-editor-panel');
    expect(phase481bIdx).toBeGreaterThan(phase4PanelIdx);
    const phase481bRegion = css.slice(phase481bIdx);
    expect(phase481bRegion).toMatch(/\.rp-editor-panel\s*\{[^}]*height:\s*auto/);
  });
});
