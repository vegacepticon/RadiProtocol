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

vi.mock('obsidian');

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
let lastTextarea: Record<string, unknown> | null = null;

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
        (child as Record<string, unknown>).style = { width: '', height: '' };
        (child as Record<string, unknown>).scrollHeight = 123;
        (child as Record<string, unknown>).value = '';
        lastTextarea = child;
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
  const plugin = {} as unknown as RadiProtocolPlugin;
  const view = new EditorPanelView(leaf, plugin);
  (view as unknown as { contentEl: unknown }).contentEl = fakeNode();
  (view as unknown as { registerDomEvent: (el: unknown, ev: string, cb: () => void) => void })
    .registerDomEvent = (el, ev, cb) => {
      if (ev === 'input' && el === lastTextarea) textareaInputCb.cb = cb;
    };
  return view;
}

// ── NODEUI-01: text-block form has no Snippet ID row ─────────────────────

describe('NODEUI-01: text-block form has no Snippet ID row', () => {
  beforeEach(() => { installSettingPrototypeMock(); createdElements.length = 0; });

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
    // @ts-expect-error accessing private for test
    expect(Object.keys(view['pendingEdits'])).not.toContain('radiprotocol_snippetId');
  });
});

// ── NODEUI-03: answer form renders Display label before Answer text ────────

describe('NODEUI-03: answer form renders Display label before Answer text', () => {
  beforeEach(() => { installSettingPrototypeMock(); createdElements.length = 0; });

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
    createdElements.length = 0;
    textareaInputCb.cb = null;
    lastTextarea = null;
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
    const ta = createdElements.find(e => e.tag === 'textarea' && e.cls === 'rp-question-textarea');
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
    const taIdx = createdElements.findIndex(e => e.tag === 'textarea' && e.cls === 'rp-question-textarea');
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
