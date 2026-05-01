// src/__tests__/views/runner-view-output-toolbar.test.ts
// Phase 69 INLINE-CLEAN-01 (D-08) — sidebar / tab RunnerView cross-mode regression:
// in complete-state, the three result-export buttons (.rp-copy-btn / .rp-save-btn /
// .rp-insert-btn) are STILL rendered. Validates SC#2 + SC#3 of ROADMAP.md §Phase 69
// — the inline-only deletion in Plan 02 must NOT regress sidebar/tab.
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian');

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {}
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

import { RunnerView } from '../../views/runner-view';

// ── FakeNode — DOM-ish stub ───────────────────────────────────────────────

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  title?: string;
  children: FakeNode[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (t: string) => void;
  setAttribute: (name: string, value: string) => void;
  prepend: (el: FakeNode) => void;
  _clickHandler?: () => void;
  _attrs?: Record<string, string>;
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
    setAttribute(name: string, value: string): void {
      if (node._attrs === undefined) node._attrs = {};
      node._attrs[name] = value;
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

function mountAtComplete(): { view: any } {
  const view = Object.create(RunnerView.prototype);

  // contentEl — FakeNode root that the render path will populate.
  view.contentEl = makeFakeNode('div');
  view.canvasFilePath = 'test.canvas';
  view.lastActiveMarkdownFile = null;
  view.snippetTreePicker = null;
  view.previewState = { previewVisible: true };
  view.app = { workspace: { getActiveFile: () => null }, vault: {} };
  view.plugin = {
    saveOutputToNote: vi.fn().mockResolvedValue(undefined),
    insertIntoCurrentNote: vi.fn().mockResolvedValue(undefined),
    settings: { snippetFolderPath: 'snippets', defaultSeparator: '\n\n' },
  };

  // Spy: report complete-state. finalText drives what renderOutputToolbar writes.
  view.runner = {
    getState: vi.fn().mockReturnValue({
      status: 'complete',
      finalText: 'sample',
      canStepBack: false,
    }),
    restartCanvas: vi.fn(),
  };

  // Neutralise the sibling sub-renders that complete-state branch invokes BUT NOT
  // renderOutputToolbar — that is the assertion target.
  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};

  // Required Obsidian-side stubs for the complete-state render path
  // (runner-view.ts case 'complete' calls this.registerDomEvent on the
  // "Run again" button; without these three mocks view.render() throws
  // TypeError). Copied from analog runner-snippet-sibling-button.test.ts
  // mountAtQuestion() lines 218-227.
  (view as unknown as { registerDomEvent: (...args: unknown[]) => void }).registerDomEvent = () => {};
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession = async () => {};
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = async () => {};

  // Drive render — invoke the private render method directly (matches analog's
  // pattern: see runner-snippet-sibling-button.test.ts:233-235).
  view.render();
  return { view };
}

describe('Phase 69 cross-mode regression — sidebar RunnerView complete-state still renders all 3 result-export buttons', () => {
  it('.rp-copy-btn, .rp-save-btn, .rp-insert-btn each present exactly once in complete-state DOM', () => {
    const { view } = mountAtComplete();
    expect(findByClass(view.contentEl, 'rp-copy-btn')).toHaveLength(1);
    expect(findByClass(view.contentEl, 'rp-save-btn')).toHaveLength(1);
    expect(findByClass(view.contentEl, 'rp-insert-btn')).toHaveLength(1);
  });
});
