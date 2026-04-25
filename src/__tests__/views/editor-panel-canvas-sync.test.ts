// src/__tests__/views/editor-panel-canvas-sync.test.ts
// Phase 63 Plan 03 Task 1 — RED test surface for the canvas → Node Editor inbound
// patch path. Covers VALIDATION rows 63-03-01 .. 63-03-07. All tests are expected
// to fail until Task 2 wires `applyCanvasPatch` / `formFieldRefs` /
// `pendingCanvasUpdate` / per-field blur handlers / lifecycle clears into
// `EditorPanelView`.
//
// Setup pattern lifted from:
//   - src/__tests__/editor-panel-forms.test.ts:31-166 (Setting prototype mock + FakeNode)
//   - src/__tests__/views/runner-snippet-sibling-button.test.ts:37-228 (richer FakeNode +
//     registerDomEvent capture + activeElement-style focus harness)
// + RESEARCH §"DOM-mocking" lines 391-396 (globalThis.document.activeElement patch)
// + RESEARCH §"Defensive note" line 824 (FakeNode.ownerDocument back-reference).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting } from 'obsidian';
import { EditorPanelView } from '../../views/editor-panel-view';
import type RadiProtocolPlugin from '../../main';
import type { CanvasChangedForNodeDetail } from '../../canvas/edge-label-sync-service';

vi.mock('obsidian');
vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    mount = vi.fn().mockResolvedValue(undefined);
    unmount = vi.fn();
  },
}));

// ── Globals patched at top: document.activeElement harness (RESEARCH 391-396) ──

interface PatchedDocument {
  activeElement: unknown;
}
const globalAny = globalThis as unknown as { document: PatchedDocument };

// ── Setting prototype mock (lifted verbatim from editor-panel-forms.test.ts) ──

const settingCalls: { setName: string[]; setDesc: string[]; setHeading: number }
  = { setName: [], setDesc: [], setHeading: 0 };
const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const textInputOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const dropdownOptions: Array<[string, string]> = [];

let lastAddTextInputEl: Record<string, unknown> | null = null;

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = 0;
  textareaOnChange.cb = null;
  textInputOnChange.cb = null;
  dropdownOptions.length = 0;
  lastAddTextInputEl = null;

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

  // addText returns a mockText whose `inputEl` is a fresh stub object;
  // capture the most recently produced inputEl so tests can locate it via
  // formFieldRefs.get('radiprotocol_displayLabel').
  SettingProto.addText = vi.fn(function (this: unknown, cb: (t: unknown) => void) {
    const inputEl = makeInputElStub();
    lastAddTextInputEl = inputEl;
    const mockText = {
      inputEl,
      setValue: vi.fn(function (this: unknown) { return this; }),
      onChange: vi.fn(function (this: unknown, cbInner: (v: string) => void) {
        textInputOnChange.cb = cbInner;
        return this;
      }),
    };
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

// ── FakeNode + tracked-style helpers (lifted from editor-panel-forms.test.ts) ──

const createdElements: Array<{ tag: string; cls?: string; text?: string; parentCls?: string }> = [];
const allTextareas: Array<Record<string, unknown>> = [];
const allInputElStubs: Array<Record<string, unknown>> = [];
let lastTextarea: Record<string, unknown> | null = null;

// blur handlers captured per-element via registerDomEvent stub. Map key = the
// HTMLElement-like stub object so tests can recover the handler attached to a
// specific textarea / inputEl.
const blurHandlerCaptures = new Map<unknown, () => void>();
const inputHandlerCaptures = new Map<unknown, () => void>();

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

function makeInputElStub(): Record<string, unknown> {
  const stub: Record<string, unknown> = {
    value: '',
    isConnected: true,
    addEventListener: () => {},
    style: {},
  };
  // ownerDocument back-reference so the implementation's
  // `el.ownerDocument?.activeElement === el` check resolves against the same
  // patched globalAny.document used by the tests (RESEARCH Pitfall 3).
  Object.defineProperty(stub, 'ownerDocument', {
    get: () => globalAny.document,
    configurable: true,
  });
  allInputElStubs.push(stub);
  return stub;
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
        (child as Record<string, unknown>).isConnected = true;
        // ownerDocument back-reference (RESEARCH Pitfall 3) — same global doc
        // the tests patch with `globalAny.document.activeElement = ta`.
        Object.defineProperty(child, 'ownerDocument', {
          get: () => globalAny.document,
          configurable: true,
        });
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

// ── makeView helper ──────────────────────────────────────────────────────────

interface ViewHarness {
  view: EditorPanelView;
  plugin: RadiProtocolPlugin;
  subscribeSpy: ReturnType<typeof vi.fn>;
  registerSpy: ReturnType<typeof vi.fn>;
  // Captures every (el, type, handler) so tests can recover blur handlers per element.
  domEventLog: Array<{ el: unknown; type: string; handler: () => void }>;
  // Most recent handler captured for the corresponding (el, type) pair from outside.
  capturedHandler: (el: unknown, type: string) => (() => void) | undefined;
}

function makeView(): ViewHarness {
  const subscribeSpy = vi.fn().mockReturnValue(() => {});
  const registerSpy = vi.fn();
  const domEventLog: Array<{ el: unknown; type: string; handler: () => void }> = [];
  const plugin = {
    app: {
      vault: {
        adapter: { list: vi.fn(), exists: vi.fn() },
        // Stubbed so loadNode → renderNodeForm doesn't hit "not a function" on
        // the unhandled-promise path (renderNodeForm short-circuits on the
        // file-not-found check we return null for).
        getAbstractFileByPath: vi.fn().mockReturnValue(null),
      },
    },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: {},
    edgeLabelSyncService: { subscribe: subscribeSpy },
  } as unknown as RadiProtocolPlugin;
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new EditorPanelView(leaf, plugin);
  (view as unknown as { contentEl: unknown }).contentEl = fakeNode();
  (view as unknown as { register: unknown }).register = registerSpy;
  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: unknown,
    type: string,
    handler: () => void,
  ) => {
    domEventLog.push({ el, type, handler });
    if (type === 'blur') blurHandlerCaptures.set(el, handler);
    if (type === 'input') inputHandlerCaptures.set(el, handler);
  };
  return {
    view,
    plugin,
    subscribeSpy,
    registerSpy,
    domEventLog,
    capturedHandler: (el, type) => {
      const found = domEventLog.find(d => d.el === el && d.type === type);
      return found?.handler;
    },
  };
}

function resetDomCaptures(): void {
  createdElements.length = 0;
  allTextareas.length = 0;
  allInputElStubs.length = 0;
  lastTextarea = null;
  blurHandlerCaptures.clear();
  inputHandlerCaptures.clear();
}

async function drainMicrotasks(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

beforeEach(() => {
  installSettingPrototypeMock();
  resetDomCaptures();
  globalAny.document = { activeElement: null };
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-01 — formFieldRefs lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — formFieldRefs lifecycle (D-08)", () => {
  it('renderForm populates formFieldRefs for question textarea', () => {
    const { view } = makeView();
    // Drive the question form via the private renderForm + buildKindForm.
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');

    const refs = (view as unknown as {
      formFieldRefs: Map<string, unknown>;
    }).formFieldRefs;
    expect(refs).toBeInstanceOf(Map);
    expect(refs.has('radiprotocol_questionText')).toBe(true);
    // Captured ref is the most-recently-created textarea
    expect(refs.get('radiprotocol_questionText')).toBe(lastTextarea);
  });

  it('formFieldRefs cleared on loadNode (node switch)', () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    const refs = (view as unknown as {
      formFieldRefs: Map<string, unknown>;
    }).formFieldRefs;
    expect(refs.size).toBeGreaterThan(0);

    view.loadNode('test.canvas', 'n2');
    expect(refs.size).toBe(0);
  });

  it('formFieldRefs cleared on onClose', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    const refs = (view as unknown as {
      formFieldRefs: Map<string, unknown>;
    }).formFieldRefs;
    expect(refs.size).toBeGreaterThan(0);

    await view.onClose();
    expect(refs.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-02 — D-08 patch non-focused field
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — D-08 patch non-focused field", () => {
  it('writes value to .value of unfocused textarea', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'patched' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText');
    expect(ta).toBeTruthy();
    expect((ta as Record<string, unknown>).value).toBe('patched');
  });

  it('does NOT push patched value into pendingEdits (RESEARCH Pitfall 6)', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'patched' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    const pending = (view as unknown as {
      pendingEdits: Record<string, unknown>;
    }).pendingEdits;
    expect(pending['radiprotocol_questionText']).toBeUndefined();
  });

  it('does NOT invoke the registered input handler (RESEARCH Pitfall 1)', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText');
    expect(ta).toBeTruthy();

    // Wrap the captured input handler with a spy so we can detect re-entry via
    // a synthetic input event.
    const inputHandler = inputHandlerCaptures.get(ta);
    expect(typeof inputHandler).toBe('function');
    let inputHandlerCalls = 0;
    if (inputHandler) {
      inputHandlerCaptures.set(ta, () => {
        inputHandlerCalls += 1;
        inputHandler();
      });
    }

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'patched' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    expect(inputHandlerCalls).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-03 — D-05 in-flight protection
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — D-05 in-flight protection", () => {
  it('skips patch when target el === ownerDocument.activeElement', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    ta.value = 'Q1';
    globalAny.document.activeElement = ta;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'skip-me' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    expect(ta.value).toBe('Q1');
  });

  it('stashes value in pendingCanvasUpdate slot when skipped', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    globalAny.document.activeElement = ta;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'skip-me' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    const pendingCanvas = (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate;
    expect(pendingCanvas.get('radiprotocol_questionText')).toBe('skip-me');
  });

  it('continues patching OTHER non-focused fields in same payload (D-06 field-level lock)', async () => {
    const { view } = makeView();
    // Drive the Answer kind which renders BOTH a displayLabel addText input AND
    // an answerText growable textarea — gives us two distinct fields to patch
    // independently.
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm'](
      { id: 'n1', radiprotocol_nodeType: 'answer', radiprotocol_answerText: 'A1', radiprotocol_displayLabel: 'L1' },
      'answer',
    );
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ans = refs.get('radiprotocol_answerText') as Record<string, unknown>;
    const lbl = refs.get('radiprotocol_displayLabel') as Record<string, unknown>;
    expect(ans).toBeTruthy();
    expect(lbl).toBeTruthy();
    ans.value = 'A1';
    lbl.value = 'L1';
    // Focus the answerText textarea — displayLabel input must remain patchable.
    globalAny.document.activeElement = ans;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: {
        radiprotocol_answerText: 'skip-ans',
        radiprotocol_displayLabel: 'apply-lbl',
      },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    // Focused field skipped, slot stashed.
    expect(ans.value).toBe('A1');
    const pendingCanvas = (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate;
    expect(pendingCanvas.get('radiprotocol_answerText')).toBe('skip-ans');

    // Non-focused field patched.
    expect(lbl.value).toBe('apply-lbl');
    expect(pendingCanvas.has('radiprotocol_displayLabel')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-04 — D-07 apply post-blur
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — D-07 apply post-blur", () => {
  it('blur handler flushes pendingCanvasUpdate to .value', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    ta.value = 'Q1';
    globalAny.document.activeElement = ta;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'flush-me' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();
    expect(ta.value).toBe('Q1');

    // Simulate blur: defocus the field and invoke the captured blur handler.
    globalAny.document.activeElement = null;
    const blurHandler = blurHandlerCaptures.get(ta);
    expect(typeof blurHandler).toBe('function');
    blurHandler!();
    await drainMicrotasks();
    expect(ta.value).toBe('flush-me');
  });

  it('blur handler clears its slot after flushing', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    globalAny.document.activeElement = ta;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'flush-me' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    const pendingCanvas = (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate;
    expect(pendingCanvas.has('radiprotocol_questionText')).toBe(true);

    globalAny.document.activeElement = null;
    blurHandlerCaptures.get(ta)!();
    await drainMicrotasks();
    expect(pendingCanvas.has('radiprotocol_questionText')).toBe(false);
  });

  it('blur handler with no pending value is a no-op (RESEARCH Pitfall 4 — queueMicrotask defer)', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    ta.value = 'Q1';

    // No applyCanvasPatch beforehand → pendingCanvasUpdate is empty.
    const blurHandler = blurHandlerCaptures.get(ta);
    expect(typeof blurHandler).toBe('function');
    expect(() => blurHandler!()).not.toThrow();
    await drainMicrotasks();
    expect(ta.value).toBe('Q1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-05 — D-09 nodeType change
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — D-09 nodeType change", () => {
  it('changeKind:"nodeType" triggers full renderNodeForm', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const renderNodeFormSpy = vi.fn().mockResolvedValue(undefined);
    (view as unknown as { renderNodeForm: unknown }).renderNodeForm = renderNodeFormSpy;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'nodeType',
      newKind: 'answer',
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    expect(renderNodeFormSpy).toHaveBeenCalledTimes(1);
    expect(renderNodeFormSpy).toHaveBeenCalledWith('test.canvas', 'n1');
  });

  it('clears formFieldRefs and pendingCanvasUpdate before re-render (D-09)', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    // Pre-seed pendingCanvasUpdate to verify it's cleared.
    (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate.set('radiprotocol_questionText', 'stash');
    (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits['radiprotocol_questionText'] = 'pending';

    // Stub renderNodeForm so the test focuses on the clear semantics.
    (view as unknown as { renderNodeForm: unknown }).renderNodeForm = vi.fn().mockResolvedValue(undefined);

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'nodeType',
      newKind: 'answer',
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    const refs = (view as unknown as { formFieldRefs: Map<string, unknown> }).formFieldRefs;
    const pendingCanvas = (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate;
    const pending = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
    expect(refs.size).toBe(0);
    expect(pendingCanvas.size).toBe(0);
    expect(Object.keys(pending).length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-06 — D-10 node deleted
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — D-10 node deleted", () => {
  it('changeKind:"deleted" triggers renderIdle', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const renderIdleSpy = vi.fn();
    (view as unknown as { renderIdle: unknown }).renderIdle = renderIdleSpy;

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'deleted',
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    expect(renderIdleSpy).toHaveBeenCalledTimes(1);
  });

  it('nullifies currentNodeId / currentFilePath and clears pendingEdits + both maps', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';
    (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits['radiprotocol_questionText'] = 'x';
    (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate.set('radiprotocol_questionText', 'y');

    (view as unknown as { renderIdle: unknown }).renderIdle = vi.fn();

    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'deleted',
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    await drainMicrotasks();

    expect((view as unknown as { currentNodeId: string | null }).currentNodeId).toBeNull();
    expect((view as unknown as { currentFilePath: string | null }).currentFilePath).toBeNull();
    const pending = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
    expect(Object.keys(pending).length).toBe(0);
    const refs = (view as unknown as { formFieldRefs: Map<string, unknown> }).formFieldRefs;
    const pendingCanvas = (view as unknown as {
      pendingCanvasUpdate: Map<string, string | undefined>;
    }).pendingCanvasUpdate;
    expect(refs.size).toBe(0);
    expect(pendingCanvas.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 63-03-07 — Phase 42 WR-01 re-entrancy
// ─────────────────────────────────────────────────────────────────────────────

describe("EditorPanelView.applyCanvasPatch — Phase 42 WR-01 re-entrancy", () => {
  it('patch dispatched synchronously inside renderForm flush is deferred via queueMicrotask and lands cleanly', async () => {
    const { view } = makeView();
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['renderForm']({ id: 'n1', radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }, 'question');
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'n1';

    const refs = (view as unknown as {
      formFieldRefs: Map<string, Record<string, unknown>>;
    }).formFieldRefs;
    const ta = refs.get('radiprotocol_questionText') as Record<string, unknown>;
    expect(ta).toBeTruthy();
    ta.value = 'Q1';

    // Synchronously dispatch a patch BEFORE any microtask drain — emulates the
    // race where the dispatch fires while a renderForm pass is unwinding.
    const detail: CanvasChangedForNodeDetail = {
      filePath: 'test.canvas',
      nodeId: 'n1',
      changeKind: 'fields',
      fieldUpdates: { radiprotocol_questionText: 'patched' },
    };
    // bracket-syntax access into private members for test (no TS error suppression needed)
    view['applyCanvasPatch'](detail);
    // Synchronously, no patch has landed yet (it's deferred via queueMicrotask).
    expect(ta.value).toBe('Q1');

    await drainMicrotasks();
    expect(ta.value).toBe('patched');
  });
});
