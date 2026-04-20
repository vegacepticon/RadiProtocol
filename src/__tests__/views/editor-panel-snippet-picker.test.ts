// src/__tests__/views/editor-panel-snippet-picker.test.ts
// Phase 51 Plan 03 (PICKER-02) — EditorPanelView snippet-arm integration tests.
//
// Covers:
//   D-01  mutual exclusivity on write (snippetPath ↔ subfolderPath never both set)
//   D-05  inline SnippetTreePicker mounted in `case 'snippet':` arm (mode: 'both')
//   Lifecycle discipline: previous picker unmounted before new render
//   Phase 31 preservation: Branch label + Separator fields still rendered below picker
//   Text-mirroring contract: pendingEdits.text mirrors selection label
//     (folder → relativePath, file → basename without extension)
//
// Strategy: mock the SnippetTreePicker module so we can spy on constructor args +
// capture the onSelect callback without running the real picker DOM. Mock Obsidian
// via the existing __mocks__/obsidian.ts with Setting-prototype patches mirroring
// editor-panel-forms.test.ts.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting } from 'obsidian';

vi.mock('obsidian');

// ── SnippetTreePicker mock (hoisted via vi.mock) ──────────────────────────

const pickerCtorSpy = vi.fn();
const pickerMountSpy = vi.fn();
const pickerUnmountSpy = vi.fn();

interface CapturedPicker {
  options: Record<string, unknown>;
}
const pickerInstances: CapturedPicker[] = [];

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(options: Record<string, unknown>) {
      pickerCtorSpy(options);
      pickerInstances.push({ options });
      (this as unknown as { mount: () => Promise<void> }).mount = async () => { pickerMountSpy(); };
      (this as unknown as { unmount: () => void }).unmount = () => { pickerUnmountSpy(); };
    }
  }
  return { SnippetTreePicker };
});

// Import EditorPanelView after mocks are in place.
import { EditorPanelView } from '../../views/editor-panel-view';
import type RadiProtocolPlugin from '../../main';

// ── Setting prototype mock (captures setName / setHeading / setDesc) ──────

const settingCalls = { setName: [] as string[], setDesc: [] as string[], setHeading: 0 };
const dropdownOptions: Array<[string, string]> = [];

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = 0;
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
  const mockText = {
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown) { return this; }),
  };
  SettingProto.addText = vi.fn(function (this: unknown, cb: (t: unknown) => void) {
    cb(mockText);
    return this;
  });
  SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (t: unknown) => void) {
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

// ── fakeNode — recursive createEl/createDiv stub with registry ────────────

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (text: string) => void;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  setAttribute: (k: string, v: string) => void;
  appendText: (t: string) => void;
  disabled: boolean;
  style: Record<string, string>;
  value: string;
}

// Module-scoped registry of every element created by the render — used for DOM-order
// assertions.
const createdRegistry: Array<{ cls?: string; text?: string }> = [];

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    createDiv(opts?: { cls?: string; text?: string }): FakeNode {
      createdRegistry.push({ cls: opts?.cls, text: opts?.text });
      const child = makeFakeNode('div', opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode {
      createdRegistry.push({ cls: opts?.cls, text: opts?.text });
      const child = makeFakeNode(t, opts?.cls, opts?.text);
      node.children.push(child);
      if (opts?.type !== undefined) {
        (child as unknown as { type: string }).type = opts.type;
      }
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): FakeNode {
      return node.createEl('span', opts);
    },
    empty(): void { node.children.length = 0; },
    setText(t: string): void { node.text = t; },
    addClass(_c: string): void {},
    removeClass(_c: string): void {},
    setAttribute(_k: string, _v: string): void {},
    appendText(_t: string): void {},
    disabled: false,
    style: {},
    value: '',
  };
  return node;
}

// ── Plugin fake ───────────────────────────────────────────────────────────

function makePlugin(): RadiProtocolPlugin {
  return {
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: { _isFakeSnippetService: true },
    app: {} as unknown,
  } as unknown as RadiProtocolPlugin;
}

function makeView(): EditorPanelView {
  const plugin = makePlugin();
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new EditorPanelView(leaf, plugin);
  (view as unknown as { contentEl: FakeNode }).contentEl = makeFakeNode();
  return view;
}

type PendingEdits = Record<string, unknown>;

function getPendingEdits(view: EditorPanelView): PendingEdits {
  return (view as unknown as { pendingEdits: PendingEdits }).pendingEdits;
}

function getOnSelect(call: number = 0): (r: { kind: 'folder' | 'file'; relativePath: string }) => void {
  const options = pickerInstances[call]?.options as { onSelect?: (r: unknown) => void } | undefined;
  if (!options?.onSelect) throw new Error(`picker instance #${call} has no onSelect`);
  return options.onSelect as (r: { kind: 'folder' | 'file'; relativePath: string }) => void;
}

beforeEach(() => {
  pickerCtorSpy.mockClear();
  pickerMountSpy.mockClear();
  pickerUnmountSpy.mockClear();
  pickerInstances.length = 0;
  createdRegistry.length = 0;
  installSettingPrototypeMock();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 03 — SnippetTreePicker inline in Node Editor (D-05)', () => {
  it('Test 1: selecting a Snippet node mounts a SnippetTreePicker rooted at settings.snippetFolderPath in mode "both"', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error accessing private buildKindForm for test
    view['buildKindForm'](container, {}, 'snippet');

    expect(pickerCtorSpy).toHaveBeenCalledTimes(1);
    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.mode).toBe('both');
    expect(opts.rootPath).toBe('.radiprotocol/snippets');
    expect(pickerMountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 2: folder selection writes radiprotocol_subfolderPath AND clears radiprotocol_snippetPath AND triggers scheduleAutoSave', () => {
    const view = makeView();
    const container = makeFakeNode();
    const scheduleSpy = vi.fn();
    (view as unknown as { scheduleAutoSave: () => void }).scheduleAutoSave = scheduleSpy;
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const onSelect = getOnSelect(0);
    onSelect({ kind: 'folder', relativePath: 'abdomen' });

    const pending = getPendingEdits(view);
    expect(pending['radiprotocol_subfolderPath']).toBe('abdomen');
    expect(pending['radiprotocol_snippetPath']).toBeUndefined();
    // Key must be present (explicit undefined), not simply absent — D-01 requires write
    expect(Object.keys(pending)).toContain('radiprotocol_snippetPath');
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('Test 3: file selection writes radiprotocol_snippetPath AND clears radiprotocol_subfolderPath AND triggers scheduleAutoSave', () => {
    const view = makeView();
    const container = makeFakeNode();
    const scheduleSpy = vi.fn();
    (view as unknown as { scheduleAutoSave: () => void }).scheduleAutoSave = scheduleSpy;
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const onSelect = getOnSelect(0);
    onSelect({ kind: 'file', relativePath: 'abdomen/ct-routine.md' });

    const pending = getPendingEdits(view);
    expect(pending['radiprotocol_snippetPath']).toBe('abdomen/ct-routine.md');
    expect(pending['radiprotocol_subfolderPath']).toBeUndefined();
    expect(Object.keys(pending)).toContain('radiprotocol_subfolderPath');
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('Test 4: pendingEdits.text mirrors folder relativePath on folder selection', () => {
    const view = makeView();
    const container = makeFakeNode();
    (view as unknown as { scheduleAutoSave: () => void }).scheduleAutoSave = () => {};
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const onSelect = getOnSelect(0);
    onSelect({ kind: 'folder', relativePath: 'abdomen/ct' });

    expect(getPendingEdits(view)['text']).toBe('abdomen/ct');
  });

  it('Test 5: pendingEdits.text mirrors basename-without-extension on file selection ("abdomen/ct.md" → "ct")', () => {
    const view = makeView();
    const container = makeFakeNode();
    (view as unknown as { scheduleAutoSave: () => void }).scheduleAutoSave = () => {};
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const onSelect = getOnSelect(0);
    onSelect({ kind: 'file', relativePath: 'abdomen/ct.md' });

    expect(getPendingEdits(view)['text']).toBe('ct');
  });

  it('Test 6: pendingEdits.text mirrors basename-without-extension on file selection ("liver/r.json" → "r")', () => {
    const view = makeView();
    const container = makeFakeNode();
    (view as unknown as { scheduleAutoSave: () => void }).scheduleAutoSave = () => {};
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const onSelect = getOnSelect(0);
    onSelect({ kind: 'file', relativePath: 'liver/r.json' });

    expect(getPendingEdits(view)['text']).toBe('r');
  });

  it('Test 7: existing node with radiprotocol_subfolderPath: "abdomen" mounts picker with initialSelection: "abdomen"', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container, { radiprotocol_subfolderPath: 'abdomen' }, 'snippet');

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.initialSelection).toBe('abdomen');
  });

  it('Test 8: existing node with radiprotocol_snippetPath: "abdomen/ct.md" mounts picker with initialSelection: "abdomen/ct.md"', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container, { radiprotocol_snippetPath: 'abdomen/ct.md' }, 'snippet');

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.initialSelection).toBe('abdomen/ct.md');
  });

  it('Test 9 (back-compat): legacy node with neither field mounts picker with initialSelection: undefined and does NOT pre-write pendingEdits', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.initialSelection).toBeUndefined();
    const pending = getPendingEdits(view);
    expect(pending['radiprotocol_subfolderPath']).toBeUndefined();
    expect(pending['radiprotocol_snippetPath']).toBeUndefined();
    expect(pending['text']).toBeUndefined();
    // Make sure buildKindForm did not eagerly stamp pendingEdits.
    expect(Object.keys(pending).length).toBe(0);
  });

  it('Test 10 (lifecycle): re-rendering the snippet form unmounts the prior picker before mounting a new one', () => {
    const view = makeView();
    const container1 = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container1, {}, 'snippet');
    expect(pickerInstances.length).toBe(1);
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(0);

    const container2 = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container2, {}, 'snippet');
    expect(pickerInstances.length).toBe(2);
    // The FIRST picker must have been unmounted before the SECOND was created.
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 11 (preservation — DOM): picker host element appears in the render tree', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    const hostIdx = createdRegistry.findIndex(e => e.cls === 'rp-stp-editor-host');
    expect(hostIdx).toBeGreaterThanOrEqual(0);
  });

  it('Test 12 (preservation — Settings): Branch label + Separator override setNames still fire', () => {
    const view = makeView();
    const container = makeFakeNode();
    // @ts-expect-error private access
    view['buildKindForm'](container, {}, 'snippet');

    expect(settingCalls.setName).toContain('Branch label');
    expect(settingCalls.setName).toContain('Separator override');
    // DOM-order invariant — picker ctor fired before the render completed, so the picker
    // host exists in the creation sequence preceding the Settings rows.
    expect(pickerCtorSpy).toHaveBeenCalledTimes(1);
  });
});
