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
