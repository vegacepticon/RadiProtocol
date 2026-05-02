import { describe, expect, it, vi } from 'vitest';
import { RunnerRenderer } from '../../runner/runner-renderer';
import type { RunnerHost } from '../../runner/runner-host';
import type { RunnerState } from '../../runner/runner-state';
import { accumulatedTextOf } from '../../runner/runner-text';
import { snippetBranchLabel } from '../../runner/snippet-label';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { SnippetNode } from '../../graph/graph-model';

function makeHost(): RunnerHost {
  return {
    kind: 'runner-view',
    app: {} as RunnerHost['app'],
    plugin: {} as RunnerHost['plugin'],
    bindClick: vi.fn(),
    snippetPickerHostClass: 'rp-stp-runner-host',
    snippetCopyLocale: 'ru',
    requestRender: vi.fn(),
    openSnippetFillModal: vi.fn(async () => null),
    resolveSnippetPath: vi.fn((snippetId: string) => snippetId),
    onSnippetValidationError: vi.fn(),
    renderError: vi.fn(),
  };
}

const baseSnippet = {
  id: 's1',
  kind: 'snippet',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
} satisfies Omit<SnippetNode, 'radiprotocol_snippetPath' | 'snippetLabel' | 'subfolderPath'>;

describe('RunnerRenderer scaffold (Phase 75)', () => {
  it('is instantiable and leaves non-error states as scaffold no-ops', () => {
    const host = makeHost();
    const renderer = new RunnerRenderer(host, new ProtocolRunner(), () => null);

    renderer.render({} as HTMLElement);

    expect(host.renderError).not.toHaveBeenCalled();
    expect(renderer.graph()).toBeNull();
  });

  it('delegates error states to host error chrome', () => {
    const host = makeHost();
    const renderer = new RunnerRenderer(host, new ProtocolRunner(), () => null);

    renderer.renderState({} as HTMLElement, { status: 'error', message: 'boom' });

    expect(host.renderError).toHaveBeenCalledWith(['boom']);
  });

  it('formats file-bound snippet labels with explicit label, file stem, and fallback', () => {
    expect(snippetBranchLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'Chest/report.json',
      snippetLabel: 'ОГК',
    })).toBe('📄 ОГК');

    expect(snippetBranchLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'Chest/report.json',
    })).toBe('📄 report');

    expect(snippetBranchLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: '',
    })).toBe('📁 Snippet');
  });

  it('formats directory-bound snippet labels with label and fallback', () => {
    expect(snippetBranchLabel({
      ...baseSnippet,
      subfolderPath: 'Chest',
      snippetLabel: 'Грудная клетка',
    })).toBe('📁 Грудная клетка');

    expect(snippetBranchLabel({
      ...baseSnippet,
      subfolderPath: 'Chest',
    })).toBe('📁 Snippet');
  });

  it('extracts accumulated/final text from runner states', () => {
    const states: RunnerState[] = [
      { status: 'idle' },
      { status: 'at-node', currentNodeId: 'q1', accumulatedText: 'A', canStepBack: false },
      { status: 'awaiting-snippet-pick', nodeId: 's1', subfolderPath: undefined, accumulatedText: 'B', canStepBack: true },
      { status: 'awaiting-snippet-fill', snippetId: 'x', nodeId: 't1', accumulatedText: 'C', canStepBack: true },
      { status: 'awaiting-loop-pick', nodeId: 'l1', accumulatedText: 'D', canStepBack: true },
      { status: 'complete', finalText: 'E' },
      { status: 'error', message: 'bad' },
    ];

    expect(states.map(accumulatedTextOf)).toEqual(['', 'A', 'B', 'C', 'D', 'E', '']);
  });
});
