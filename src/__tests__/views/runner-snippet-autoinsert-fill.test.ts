// src/__tests__/views/runner-snippet-autoinsert-fill.test.ts
// Phase 51 Plan 06 (PICKER-01, D-14) — RunnerView.handleSnippetFill path-shape detection.
//
// handleSnippetFill now recognises two snippetId shapes:
//   - Legacy id-string (Phase 32/35 callers) — no '/', no '.md'/'.json' extension
//     → resolved via `${snippetFolderPath}/${snippetId}.json` (legacy composition).
//   - Phase 51 full vault-relative path (auto-insert callers, Plan 06) — contains '/'
//     OR ends with '.md' / '.json' → resolved directly, no extension append.
//
// When the loaded snippet is an MdSnippet AND the path was Phase-51 full-path shape,
// handleSnippetFill calls runner.completeSnippet(snippet.content) directly (no modal
// for .md per Phase 35 D-04 contract).
// When the loaded snippet is a JsonSnippet with zero placeholders, short-circuit
// via runner.completeSnippet(snippet.template) — Phase 30 D-09 harmonisation with
// handleSnippetPickerSelection so auto-insert behaves identically to a user-clicked pick.
// When the loaded snippet is a JsonSnippet with placeholders, SnippetFillInModal opens.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('obsidian');

// ── Mock SnippetTreePicker (not under test here) ──────────────────────────
vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {}
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

// ── Mock SnippetFillInModal so we can assert on its construction and result ─
const modalCtorSpy = vi.fn();
const modalOpenSpy = vi.fn();
let modalResultOverride: string | null = '<<rendered>>';

vi.mock('../../views/snippet-fill-in-modal', () => {
  class SnippetFillInModal {
    public result: Promise<string | null>;
    constructor(_app: unknown, snippet: unknown) {
      modalCtorSpy(snippet);
      this.result = Promise.resolve(modalResultOverride);
    }
    open(): void {
      modalOpenSpy();
    }
  }
  return { SnippetFillInModal };
});

import { RunnerView } from '../../views/runner-view';
import type RadiProtocolPlugin from '../../main';
import type { Snippet, JsonSnippet, MdSnippet } from '../../snippets/snippet-model';

// ── FakeNode — DOM-ish stub ───────────────────────────────────────────────

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (t: string) => void;
  disabled: boolean;
  value: string;
  style: Record<string, string>;
  scrollTop: number;
  scrollHeight: number;
}

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    createDiv(opts?: { cls?: string; text?: string }): FakeNode {
      const child = makeFakeNode('div', opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode {
      const child = makeFakeNode(t, opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): FakeNode {
      return node.createEl('span', opts);
    },
    empty(): void {
      node.children.length = 0;
    },
    setText(t: string): void {
      node.text = t;
    },
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

interface Harness {
  view: RunnerView;
  loadSpy: ReturnType<typeof vi.fn>;
  completeSnippetSpy: ReturnType<typeof vi.fn>;
  questionZone: FakeNode;
}

function makeJsonSnippet(partial: Partial<JsonSnippet> = {}): JsonSnippet {
  return {
    kind: 'json',
    path: partial.path ?? 'test.json',
    name: partial.name ?? 'test',
    template: partial.template ?? 'Hello {{name}}',
    placeholders: partial.placeholders ?? [
      { id: 'name', label: 'Name', type: 'free-text' },
    ],
    validationError: partial.validationError ?? null,
  };
}

function makeMdSnippet(partial: Partial<MdSnippet> = {}): MdSnippet {
  return {
    kind: 'md',
    path: partial.path ?? 'test.md',
    name: partial.name ?? 'test',
    content: partial.content ?? 'md content',
  };
}

function mountHarness(loadResult: Snippet | null): Harness {
  const loadSpy = vi.fn(async () => loadResult);
  const plugin = {
    settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
    snippetService: {
      load: loadSpy,
      listFolder: vi.fn(async () => ({ folders: [], snippets: [] })),
      listFolderDescendants: vi.fn(async () => ({ files: [], folders: [] })),
    },
    app: { vault: { getAbstractFileByPath: () => null } },
    sessionService: { save: vi.fn(), load: vi.fn(), clear: vi.fn() },
    canvasLiveEditor: { getCanvasJSON: () => null },
    canvasParser: { parse: vi.fn() },
    saveOutputToNote: vi.fn(),
    insertIntoCurrentNote: vi.fn(),
  } as unknown as RadiProtocolPlugin;

  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new RunnerView(leaf, plugin);

  const completeSnippetSpy = vi.fn();
  (view as unknown as { runner: unknown }).runner = {
    completeSnippet: completeSnippetSpy,
    getState: () => ({ status: 'at-node', currentNodeId: 'x', accumulatedText: '', canStepBack: true }),
  };

  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession =
    async () => {};
  (view as unknown as { render: () => void }).render = () => {};

  const questionZone = makeFakeNode();
  return { view, loadSpy, completeSnippetSpy, questionZone };
}

async function callHandle(h: Harness, snippetId: string): Promise<void> {
  const fn = (h.view as unknown as {
    handleSnippetFill: (id: string, q: unknown) => Promise<void>;
  }).handleSnippetFill.bind(h.view);
  await fn(snippetId, h.questionZone as unknown as HTMLElement);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 06 — RunnerView.handleSnippetFill path-shape detection (D-14)', () => {

  beforeEach(() => {
    modalCtorSpy.mockClear();
    modalOpenSpy.mockClear();
    modalResultOverride = '<<rendered>>';
  });

  it('Test 1: legacy id-string "legacy-id" (no slash, no ext) loads via `${root}/legacy-id.json`', async () => {
    const json = makeJsonSnippet({ path: '.radiprotocol/snippets/legacy-id.json', name: 'legacy-id' });
    const h = mountHarness(json);
    await callHandle(h, 'legacy-id');

    expect(h.loadSpy).toHaveBeenCalledTimes(1);
    expect(h.loadSpy).toHaveBeenCalledWith('.radiprotocol/snippets/legacy-id.json');
  });

  it('Test 2: Phase 51 full-path "abdomen/ct.md" loads via `${root}/abdomen/ct.md` (no ext append)', async () => {
    const md = makeMdSnippet({ path: '.radiprotocol/snippets/abdomen/ct.md', name: 'ct', content: 'CT body' });
    const h = mountHarness(md);
    await callHandle(h, 'abdomen/ct.md');

    expect(h.loadSpy).toHaveBeenCalledTimes(1);
    expect(h.loadSpy).toHaveBeenCalledWith('.radiprotocol/snippets/abdomen/ct.md');
  });

  it('Test 3: Phase 51 full-path "liver/r.json" loads via `${root}/liver/r.json` (no ext append)', async () => {
    const json = makeJsonSnippet({ path: '.radiprotocol/snippets/liver/r.json', name: 'r' });
    const h = mountHarness(json);
    await callHandle(h, 'liver/r.json');

    expect(h.loadSpy).toHaveBeenCalledTimes(1);
    expect(h.loadSpy).toHaveBeenCalledWith('.radiprotocol/snippets/liver/r.json');
  });

  it('Test 4: Phase 51 full-path "x.md" (extension only, no slash) treated as full-path, loads via `${root}/x.md`', async () => {
    const md = makeMdSnippet({ path: '.radiprotocol/snippets/x.md', name: 'x', content: 'root md' });
    const h = mountHarness(md);
    await callHandle(h, 'x.md');

    expect(h.loadSpy).toHaveBeenCalledTimes(1);
    expect(h.loadSpy).toHaveBeenCalledWith('.radiprotocol/snippets/x.md');
  });

  it('Test 5: D-14 .md auto-insert end-to-end — full-path snippetId → MdSnippet → runner.completeSnippet(content)', async () => {
    const md = makeMdSnippet({ path: '.radiprotocol/snippets/abdomen/ct.md', name: 'ct', content: 'Hello MD' });
    const h = mountHarness(md);
    await callHandle(h, 'abdomen/ct.md');

    expect(h.completeSnippetSpy).toHaveBeenCalledTimes(1);
    expect(h.completeSnippetSpy).toHaveBeenCalledWith('Hello MD');
    // Modal must NOT have opened for .md
    expect(modalCtorSpy).not.toHaveBeenCalled();
    expect(modalOpenSpy).not.toHaveBeenCalled();
  });

  it('Test 6: D-14 .json auto-insert WITH placeholders — opens SnippetFillInModal', async () => {
    const json = makeJsonSnippet({
      path: '.radiprotocol/snippets/liver/r.json',
      name: 'r',
      template: 'Age: {{age}}',
      placeholders: [{ id: 'age', label: 'Age', type: 'free-text' }],
    });
    const h = mountHarness(json);
    await callHandle(h, 'liver/r.json');

    expect(modalCtorSpy).toHaveBeenCalledTimes(1);
    expect(modalOpenSpy).toHaveBeenCalledTimes(1);
    expect(h.completeSnippetSpy).toHaveBeenCalledWith('<<rendered>>');
  });

  it('Test 7: D-14 .json auto-insert WITHOUT placeholders — short-circuit to completeSnippet(template); no modal (Phase 30 D-09 harmonisation)', async () => {
    const json = makeJsonSnippet({
      path: '.radiprotocol/snippets/liver/empty.json',
      name: 'empty',
      template: 'static body',
      placeholders: [],
    });
    const h = mountHarness(json);
    await callHandle(h, 'liver/empty.json');

    expect(h.completeSnippetSpy).toHaveBeenCalledTimes(1);
    expect(h.completeSnippetSpy).toHaveBeenCalledWith('static body');
    expect(modalCtorSpy).not.toHaveBeenCalled();
    expect(modalOpenSpy).not.toHaveBeenCalled();
  });

  it('Test 8: legacy id-string + load returns null — renders «not found» inline error, no mutation', async () => {
    const h = mountHarness(null);
    await callHandle(h, 'missing-id');

    expect(h.loadSpy).toHaveBeenCalledWith('.radiprotocol/snippets/missing-id.json');
    expect(h.completeSnippetSpy).not.toHaveBeenCalled();
    // questionZone should have a <p> with "not found" wording
    const p = h.questionZone.children.find(c => c.tag === 'p');
    expect(p).toBeDefined();
    expect(p?.text ?? '').toContain('not found');
  });

});
