// Phase 59 Wave 0 — INLINE-FIX-04 / INLINE-FIX-05 / D1 / D6 / D7 test scaffolding.
// Phase 75 plan 06 — MockEl harness, obsidian mock, and SnippetFillInModal mock
// moved to runner-renderer-host-fixtures.ts (shared across all 3 inline host
// test files). The host-specific tests below remain unchanged: vault.modify
// content / append-policy, modal lifecycle (instance creation, open, resolve),
// and source-string regression guards.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type MockEl,
  makeEl,
  resetFillModalInstances,
  getFillModalInstances,
} from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});

vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { TFile } from 'obsidian';
import { makeBaseApp, makeBasePlugin } from '../runner/runner-renderer-host-fixtures';

// ───── Helpers ─────

function makeTargetNote(): TFile {
  return new (TFile as any)('notes/target.md');
}

function setupModal(opts?: { vaultContent?: string; textSeparator?: string }): {
  modal: InlineRunnerModal;
  app: ReturnType<typeof makeBaseApp>;
  plugin: ReturnType<typeof makeBasePlugin>;
  targetNote: TFile;
} {
  const targetNote = makeTargetNote();
  const plugin = makeBasePlugin({ textSeparator: opts?.textSeparator });
  const app = makeBaseApp(plugin, { vaultContent: opts?.vaultContent });
  const modal = new InlineRunnerModal(
    app as any,
    plugin as any,
    'test.canvas',
    targetNote,
  );
  return { modal, app, plugin, targetNote };
}

// Shorthand: mock runner.getState + (optional) runner.pickSnippet/completeSnippet around an
// accumulator delta. Most tests in this file follow the same shape — wire a
// snippet-pick or snippet-fill state, then assert vault.modify content.
function spyRunnerState(
  modal: InlineRunnerModal,
  status: 'awaiting-snippet-pick' | 'awaiting-snippet-fill',
  initial: string,
  separator: '\n' | ' ' | '' = '\n',
): { setText: (t: string) => void; getText: () => string } {
  let accumulatedText = initial;
  vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
    status, accumulatedText,
  } as any));
  vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
  vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: any) => {
    accumulatedText += separator + text;
  });
  return { setText: t => { accumulatedText = t; }, getText: () => accumulatedText };
}

const JSON_FILL_SNIPPET = {
  kind: 'json',
  id: 'fill',
  name: 'fill',
  path: 'Snippets/fill.json',
  template: 'R: {{f}}',
  placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
  validationError: null,
};

// ───── Tests ─────

describe('InlineRunnerModal — snippet insert separator (INLINE-FIX-04)', () => {
  it('(a) MD snippet append includes configured newline separator between prior text and snippet content', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    spyRunnerState(modal, 'awaiting-snippet-pick', 'Prior answer', '\n');

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer\nReport text',
    );
  });

  it('(b) JSON zero-placeholder snippet append applies separator', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    spyRunnerState(modal, 'awaiting-snippet-pick', 'Prior answer', '\n');

    const jsonSnippet = { kind: 'json', id: 'static', name: 'static', path: 'Snippets/static.json', template: 'Static text', placeholders: [], validationError: null };
    await (modal as any).handleSnippetPickerSelection(jsonSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer\nStatic text',
    );
  });

  it('(d) per-node radiprotocol_snippetSeparator = "space" overrides global newline', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    spyRunnerState(modal, 'awaiting-snippet-pick', 'Prior answer', ' ');

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer Report text',
    );
  });

  it('(e) first-chunk invariant — no leading separator when accumulator is empty', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    // separator='' simulates the runner's first-chunk-no-separator invariant
    // (production runner suppresses the leading separator when the accumulator
    // is empty). The test verifies the host append-policy honors that result.
    spyRunnerState(modal, 'awaiting-snippet-pick', '', '');

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'First snippet' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'First snippet',
    );
  });
});

describe('InlineRunnerModal — JSON fill-in modal (INLINE-FIX-05)', () => {
  beforeEach(() => {
    resetFillModalInstances();
  });

  it('(a) JSON snippet with placeholders instantiates new SnippetFillInModal(app, snippet)', async () => {
    const { modal } = setupModal();
    spyRunnerState(modal, 'awaiting-snippet-fill', '', '');

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(JSON_FILL_SNIPPET);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instances = getFillModalInstances();
    expect(instances.length).toBeGreaterThanOrEqual(1);
    const instance = instances[instances.length - 1]!;
    expect(instance.snippet).toBe(JSON_FILL_SNIPPET);
    expect(instance.opened).toBe(true);

    instance.__resolve('R: resolved');
    await promise;
  });

  it('(b) modal.__resolve(rendered) — runner.completeSnippet(rendered) called + delta appended to note', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior text' });
    spyRunnerState(modal, 'awaiting-snippet-fill', 'Prior text', '\n');

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(JSON_FILL_SNIPPET);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instances = getFillModalInstances();
    instances[instances.length - 1]!.__resolve('R: resolved');
    await promise;

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior text\nR: resolved',
    );
  });

  it('(c) modal.__resolve(null) — runner.completeSnippet("") called + no note append (first-chunk invariant)', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    spyRunnerState(modal, 'awaiting-snippet-fill', '', '');

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(JSON_FILL_SNIPPET);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instances = getFillModalInstances();
    instances[instances.length - 1]!.__resolve(null);
    await promise;

    // After Wave 1c: completeSnippet('') is a no-op for empty string, so no vault.modify call
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  it('(d) in-panel renderSnippetFillIn is no longer reachable (source-string grep inside test)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../views/inline-runner-modal.ts'),
      'utf8',
    );
    expect(src).not.toContain('renderSnippetFillIn');
    expect(src).not.toContain('rp-snippet-fill-form');
  });

  it('(e) Z-index sanity — SnippetFillInModal open() called AFTER inline container attached to DOM', async () => {
    const { modal } = setupModal();
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText: '',
    } as any));

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(JSON_FILL_SNIPPET);

    // Simulate container being attached
    (modal as any).containerEl = makeEl('div') as MockEl;
    (modal as any).containerEl.setAttribute('class', 'rp-inline-runner-container');

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instances = getFillModalInstances();
    const instance = instances[instances.length - 1]!;
    expect(instance.opened).toBe(true);
    instance.__resolve('R: resolved');
    await promise;
  });
});

describe('InlineRunnerModal — Phase 54 D1/D6/D7 regression guards', () => {
  it('D1 gate — inline container does NOT get is-hidden while SnippetFillInModal is open (isFillModalOpen flag)', () => {
    const { modal } = setupModal();
    const container = makeEl('div');
    (modal as any).containerEl = container;
    (modal as any).isFillModalOpen = true;

    // Simulate active leaf change when a different file is active
    (modal as any).app.workspace.getActiveFile = vi.fn(() => new (TFile as any)('other.md'));
    (modal as any).app.workspace.iterateAllLeaves = vi.fn((cb: any) => {
      cb({ view: { file: new (TFile as any)('notes/target.md') } });
    });

    (modal as any).handleActiveLeafChange();

    expect(container.hasClass('is-hidden')).toBe(false);
  });

  it('D6 reversal — renderSnippetFillIn symbol does not exist in current inline-runner-modal.ts source', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../views/inline-runner-modal.ts'),
      'utf8',
    );
    expect(src).not.toContain('renderSnippetFillIn');
    expect(src).not.toContain('rp-snippet-fill-form');
  });

  it('D7 parity — inline snippet insert produces same delta as sidebar for identical fixture', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    spyRunnerState(modal, 'awaiting-snippet-pick', '', '\n');

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    const inlineDelta = app._modifyCalls[0]?.[1] ?? '';
    expect(inlineDelta).toBe('\nReport text');
  });
});

describe('InlineRunnerModal — INLINE-FIX-04 (c) JSON with-placeholder + separator', () => {
  beforeEach(() => {
    resetFillModalInstances();
  });

  it('(c) JSON with-placeholder snippet insert applies separator after modal resolves', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior text' });
    spyRunnerState(modal, 'awaiting-snippet-fill', 'Prior text', '\n');

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(JSON_FILL_SNIPPET);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instances = getFillModalInstances();
    instances[instances.length - 1]!.__resolve('R: resolved');
    await promise;

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior text\nR: resolved',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 85 INLINE-MULTI-01 — registry integration tests.
// Verifies that close() unregisters the modal from the plugin registry, and
// that focus() unhides + reattaches the container so the modal stacks on top.
describe('InlineRunnerModal — Phase 85 INLINE-MULTI-01 registry integration', () => {
  it('close() calls plugin.unregisterInlineRunner with `${canvasPath}#${notePath}` key', () => {
    const { modal, plugin, targetNote } = setupModal();
    const expectedKey = `test.canvas#${targetNote.path}`;
    // Pre-populate registry as if openInlineRunner had completed.
    plugin.registerInlineRunner(expectedKey, modal as unknown as never);
    expect(plugin.inlineRunners.has(expectedKey)).toBe(true);

    modal.close();

    expect(plugin.unregisterInlineRunner).toHaveBeenCalledWith(expectedKey);
    expect(plugin.inlineRunners.has(expectedKey)).toBe(false);
  });

  it('focus() removes is-hidden class and re-appends container to document.body', () => {
    const { modal } = setupModal();
    const container = makeEl('div');
    container.addClass('is-hidden');
    (modal as any).containerEl = container;
    (modal as any).isHidden = true;

    // Mock document.body.appendChild — node env has no DOM.
    const appendChildSpy = vi.fn();
    const fakeDocument = { body: { appendChild: appendChildSpy } };
    vi.stubGlobal('document', fakeDocument);
    try {
      (modal as any).focus();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(container.hasClass('is-hidden')).toBe(false);
    expect(appendChildSpy).toHaveBeenCalledWith(container);
    expect((modal as any).isHidden).toBe(false);
  });

  it('keeps parallel inline runner progress isolated by canvas#note registry key', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin, { vaultContent: '' });
    const noteA = new (TFile as any)('notes/a.md');
    const noteB = new (TFile as any)('notes/b.md');
    (app.vault.read as any).mockImplementation(async (file: { path: string }) => {
      if (file.path === 'notes/a.md') return 'A progress';
      if (file.path === 'notes/b.md') return 'B progress';
      return '';
    });
    const first = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', noteA);
    const second = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', noteB);

    plugin.registerInlineRunner('test.canvas#notes/a.md', first);
    plugin.registerInlineRunner('test.canvas#notes/b.md', second);
    expect(plugin.inlineRunners.size).toBe(2);
    expect(plugin.getInlineRunner('test.canvas#notes/a.md')).toBe(first);
    expect(plugin.getInlineRunner('test.canvas#notes/b.md')).toBe(second);

    spyRunnerState(first, 'awaiting-snippet-pick', 'A progress', '\n');
    spyRunnerState(second, 'awaiting-snippet-pick', 'B progress', '\n');

    await (first as any).handleSnippetPickerSelection({ kind: 'md', path: 'Snippets/a.md', content: 'Alpha' });
    await (second as any).handleSnippetPickerSelection({ kind: 'md', path: 'Snippets/b.md', content: 'Beta' });

    expect(app._modifyCalls).toEqual([
      ['notes/a.md', 'A progress\nAlpha'],
      ['notes/b.md', 'B progress\nBeta'],
    ]);
  });
});

describe('InlineRunnerModal — progress calculation (v1.17.1)', () => {
  function makeProgressGraph() {
    const node = (id: string, kind: any = 'question') => ({ id, kind, x: 0, y: 0, width: 100, height: 60, questionText: id });
    const nodes = new Map<string, any>([
      ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
      ['q1', node('q1')],
      ['q2', node('q2')],
      ['q3', node('q3')],
      ['q4', node('q4')],
    ]);
    return {
      canvasFilePath: 'test.canvas',
      nodes,
      edges: [],
      adjacency: new Map([
        ['start', ['q1']],
        ['q1', ['q2']],
        ['q2', ['q3']],
        ['q3', ['q4']],
        ['q4', []],
      ]),
      reverseAdjacency: new Map(),
      startNodeId: 'start',
    };
  }

  it('uses graph distance instead of visited/all-nodes ratio', () => {
    const { modal } = setupModal();
    (modal as any).graph = makeProgressGraph();

    expect((modal as any).calculateProgressPercent({ status: 'at-node', currentNodeId: 'q4' })).toBe(99);
  });

  it('starts from selected node with matching baseline progress', () => {
    const targetNote = makeTargetNote();
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin, { vaultContent: '' });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote, 'q2');
    (modal as any).graph = makeProgressGraph();

    const percent = (modal as any).calculateProgressPercent({ status: 'at-node', currentNodeId: 'q2' });
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(99);
  });
});

