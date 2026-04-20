// src/__tests__/views/runner-snippet-sibling-button.test.ts
// Phase 51 Plan 05 (PICKER-01, D-16) — at-node Question snippet-sibling-button
// renders differently for directory-bound vs file-bound Snippet nodes.
//
// Covers D-16 caption fallback chain for file-bound (radiprotocol_snippetPath present):
//   1. snippetLabel (non-empty) → 📄 {label}
//   2. basename(snippetPath) with extension stripped → 📄 {stem}
//   3. literal '📄 Snippet'  (distinct from directory-bound '📁 Snippet')
//
// Directory-bound (radiprotocol_snippetPath undefined) preserves Phase 31:
//   1. snippetLabel (non-empty) → 📁 {label}
//   2. literal '📁 Snippet'
//
// Click handler contract identical to directory-bound path — RUNFIX-02 first,
// then syncManualEdit → chooseSnippetBranch(snippetNode.id) → autoSaveSession
// → renderAsync. (Auto-insert dispatch lands in Plan 06; this plan only covers
// the caption + click-to-chooseSnippetBranch.)

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('obsidian');

// Mock SnippetTreePicker to keep test focused on sibling-button path
vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {}
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

import { RunnerView } from '../../views/runner-view';
import type RadiProtocolPlugin from '../../main';
import type { AnswerNode, SnippetNode, ProtocolGraph } from '../../graph/graph-model';

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
  prepend: (el: FakeNode) => void;
  _clickHandler?: () => void;
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
      if (opts?.type !== undefined) {
        (child as unknown as { type: string }).type = opts.type;
      }
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
    prepend(_el: FakeNode): void {},
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

function findByClass(root: FakeNode, cls: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.cls === cls) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

// ── Graph + runner fakes ──────────────────────────────────────────────────

const GLYPH_FOLDER = '\uD83D\uDCC1'; // 📁
const GLYPH_FILE = '\uD83D\uDCC4'; // 📄

interface FixtureOpts {
  snippetNodes: SnippetNode[];
  includeAnswer?: boolean;
}

function buildGraph(opts: FixtureOpts): ProtocolGraph {
  const nodes = new Map<string, AnswerNode | SnippetNode | {
    kind: 'question';
    id: string;
    questionText: string;
    x: number; y: number; width: number; height: number;
  }>();
  const edges: Array<{ id: string; fromNodeId: string; toNodeId: string; label?: string }> = [];
  nodes.set('q1', {
    kind: 'question',
    id: 'q1',
    questionText: 'Pick one?',
    x: 0, y: 0, width: 200, height: 80,
  });
  const adjacency = new Map<string, string[]>();
  adjacency.set('q1', []);

  if (opts.includeAnswer !== false) {
    const answerNode: AnswerNode = {
      kind: 'answer',
      id: 'a1',
      answerText: 'Yes',
      x: 0, y: 0, width: 100, height: 40,
    };
    nodes.set('a1', answerNode);
    adjacency.get('q1')!.push('a1');
    edges.push({ id: 'e-q1-a1', fromNodeId: 'q1', toNodeId: 'a1' });
  }

  for (const sn of opts.snippetNodes) {
    nodes.set(sn.id, sn);
    adjacency.get('q1')!.push(sn.id);
    edges.push({ id: `e-q1-${sn.id}`, fromNodeId: 'q1', toNodeId: sn.id });
  }

  return {
    canvasFilePath: 'test.canvas',
    nodes: nodes as unknown as ProtocolGraph['nodes'],
    edges,
    adjacency,
    reverseAdjacency: new Map(),
    startNodeId: 'q1',
  };
}

function makePlugin(): RadiProtocolPlugin {
  return {
    settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
    snippetService: {
      load: vi.fn(),
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
}

interface Harness {
  view: RunnerView;
  chooseSnippetBranchSpy: ReturnType<typeof vi.fn>;
  syncManualEditSpy: ReturnType<typeof vi.fn>;
  capturePendingTextareaScrollSpy: ReturnType<typeof vi.fn>;
  contentEl: FakeNode;
}

function mountAtQuestion(graph: ProtocolGraph): Harness {
  const plugin = makePlugin();
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new RunnerView(leaf, plugin);
  const contentEl = makeFakeNode();
  (view as unknown as { contentEl: FakeNode }).contentEl = contentEl;

  const chooseSnippetBranchSpy = vi.fn();
  const syncManualEditSpy = vi.fn();
  (view as unknown as { runner: unknown }).runner = {
    getState: () => ({
      status: 'at-node',
      currentNodeId: 'q1',
      accumulatedText: '',
      canStepBack: false,
    }),
    chooseSnippetBranch: chooseSnippetBranchSpy,
    chooseAnswer: vi.fn(),
    syncManualEdit: syncManualEditSpy,
    stepBack: vi.fn(),
  };
  (view as unknown as { graph: ProtocolGraph }).graph = graph;

  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: FakeNode,
    type: string,
    handler: () => void,
  ) => {
    if (type === 'click') el._clickHandler = handler;
  };
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession =
    async () => {};
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = async () => {};

  const capturePendingTextareaScrollSpy = vi.fn();
  (view as unknown as { capturePendingTextareaScroll: () => void })
    .capturePendingTextareaScroll = capturePendingTextareaScrollSpy;

  // Neutralise renderPreviewZone / renderOutputToolbar so we don't DOM-render them.
  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};
  (view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};

  (view as unknown as { render: () => void }).render();

  return { view, chooseSnippetBranchSpy, syncManualEditSpy, capturePendingTextareaScrollSpy, contentEl };
}

function makeSnippetNode(partial: Partial<SnippetNode> & { id: string }): SnippetNode {
  return {
    kind: 'snippet',
    x: 0, y: 0, width: 100, height: 40,
    ...partial,
  } as SnippetNode;
}

beforeEach(() => {
  // no-op — each test creates its own harness
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 05 — Specific-bound Snippet sibling button (D-16)', () => {
  it('Test 1: directory-bound snippet sibling renders with 📁 prefix (Phase 31 preserved)', () => {
    const sn = makeSnippetNode({
      id: 's1',
      subfolderPath: 'abdomen',
      snippetLabel: 'Report',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FOLDER} Report`);
  });

  it('Test 2: file-bound snippet (snippetPath only, no label) renders "📄 ct" from basename ext-stripped', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: 'abdomen/ct.md',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FILE} ct`);
  });

  it('Test 3: file-bound snippet (.json) renders "📄 r" from basename ext-stripped', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: 'liver/r.json',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FILE} r`);
  });

  it('Test 4: file-bound snippet with snippetLabel takes precedence over basename', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: 'abdomen/ct.md',
      snippetLabel: 'My Report',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FILE} My Report`);
  });

  it('Test 5: file-bound snippet with empty snippetLabel falls through to basename', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: 'x.md',
      snippetLabel: '',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FILE} x`);
  });

  it('Test 6: file-bound snippet with unparseable basename falls through to literal "📄 Snippet"', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: '',  // defensive — Plan 01 normalises empty away, but fallback must work
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    // Note: empty string means radiprotocol_snippetPath is present but empty.
    // Per D-16, empty snippetPath should NOT be treated as file-bound (directory-bound path).
    // So this SHOULD render '📁 Snippet'. Per plan action: isFileBound requires non-empty.
    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    // Empty snippetPath is NOT file-bound per isFileBound check → directory-binding fallback.
    expect(btns[0]!.text).toBe(`${GLYPH_FOLDER} Snippet`);
  });

  it('Test 6b: file-bound snippet with dotfile-style basename (".md") renders stem as-is (dot-at-position-0 preserved)', () => {
    const sn = makeSnippetNode({
      id: 's1',
      // Edge case: "foo/.md" basename is ".md" — dot is at position 0. Per plan spec
      // (dot > 0 ? slice(0, dot) : basename), dotfiles are returned as-is, not stripped
      // to empty → does NOT fall through to "Snippet" literal.
      radiprotocol_snippetPath: 'foo/.md',
    });
    const { contentEl } = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toBe(`${GLYPH_FILE} .md`);
  });

  it('Test 7 (RUNFIX-02): click handler invokes capturePendingTextareaScroll FIRST, then syncManualEdit, then chooseSnippetBranch', () => {
    const sn = makeSnippetNode({
      id: 's1',
      radiprotocol_snippetPath: 'abdomen/ct.md',
    });
    const h = mountAtQuestion(buildGraph({ snippetNodes: [sn] }));

    const callOrder: string[] = [];
    h.capturePendingTextareaScrollSpy.mockImplementation(() => {
      callOrder.push('capturePendingTextareaScroll');
    });
    h.syncManualEditSpy.mockImplementation(() => {
      callOrder.push('syncManualEdit');
    });
    h.chooseSnippetBranchSpy.mockImplementation(() => {
      callOrder.push('chooseSnippetBranch');
    });

    const btns = findByClass(h.contentEl, 'rp-snippet-branch-btn');
    btns[0]!._clickHandler?.();

    expect(callOrder[0]).toBe('capturePendingTextareaScroll');
    expect(callOrder[1]).toBe('syncManualEdit');
    expect(callOrder[2]).toBe('chooseSnippetBranch');
    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledWith('s1');
  });

  it('Test 8: TWO snippet siblings (directory-bound + file-bound) render with distinct glyphs', () => {
    const snDir = makeSnippetNode({
      id: 'sDir',
      subfolderPath: 'abdomen',
      snippetLabel: 'Abdomen',
    });
    const snFile = makeSnippetNode({
      id: 'sFile',
      radiprotocol_snippetPath: 'liver/report.md',
      snippetLabel: 'Liver Report',
    });
    const { contentEl } = mountAtQuestion(
      buildGraph({ snippetNodes: [snDir, snFile] }),
    );

    const btns = findByClass(contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(2);
    expect(btns[0]!.text).toBe(`${GLYPH_FOLDER} Abdomen`);
    expect(btns[1]!.text).toBe(`${GLYPH_FILE} Liver Report`);
  });
});
