// src/__tests__/graph/node-label.test.ts
// Unit tests for the shared node-label module after the loop→question merge.

import { describe, it, expect } from 'vitest';
import { nodeLabel } from '../../graph/node-label';
import type { RPNode } from '../../graph/graph-model';

// ─────────────────────────────────────────────────────────────────────────────
// nodeLabel — all RPNodeKind arms (7 after the loop→question merge)
// ─────────────────────────────────────────────────────────────────────────────
describe('nodeLabel', () => {
  const baseRect = { x: 0, y: 0, width: 200, height: 60 };

  it('start → `start (${id})`', () => {
    const node: RPNode = { id: 'n-s', kind: 'start', ...baseRect };
    expect(nodeLabel(node)).toBe('start (n-s)');
  });

  it('question → questionText when non-empty, else id fallback (loop toggle does not affect label)', () => {
    expect(nodeLabel({ id: 'q1', kind: 'question', questionText: 'Size?', ...baseRect })).toBe('Size?');
    expect(nodeLabel({ id: 'q2', kind: 'question', questionText: '', ...baseRect })).toBe('q2');
    // looped question uses the same questionText label arm
    expect(nodeLabel({ id: 'q3', kind: 'question', questionText: 'Repeat?', loop: true, ...baseRect })).toBe('Repeat?');
    expect(nodeLabel({ id: 'q4', kind: 'question', questionText: '', loop: true, ...baseRect })).toBe('q4');
  });

  it('answer → displayLabel when defined, else answerText, else id fallback', () => {
    expect(nodeLabel({ id: 'a1', kind: 'answer', answerText: '1 cm', displayLabel: 'Small', ...baseRect })).toBe('Small');
    expect(nodeLabel({ id: 'a2', kind: 'answer', answerText: '1 cm', ...baseRect })).toBe('1 cm');
    expect(nodeLabel({ id: 'a3', kind: 'answer', answerText: '', ...baseRect })).toBe('a3');
  });

  it('text-block → first 30 chars of content, else id fallback', () => {
    expect(nodeLabel({ id: 't1', kind: 'text-block', content: 'short', ...baseRect })).toBe('short');
    expect(nodeLabel({ id: 't2', kind: 'text-block', content: 'x'.repeat(40), ...baseRect })).toBe('x'.repeat(30));
    expect(nodeLabel({ id: 't3', kind: 'text-block', content: '', ...baseRect })).toBe('t3');
  });

  it('loop-start (deprecated) → loopLabel || id', () => {
    expect(nodeLabel({ id: 'ls1', kind: 'loop-start', loopLabel: 'L', exitLabel: 'выход', ...baseRect })).toBe('L');
    expect(nodeLabel({ id: 'ls2', kind: 'loop-start', loopLabel: '', exitLabel: 'выход', ...baseRect })).toBe('ls2');
  });

  it('loop-end (deprecated) → `loop-end (${id})`', () => {
    expect(nodeLabel({ id: 'le1', kind: 'loop-end', loopStartId: 'ls1', ...baseRect })).toBe('loop-end (le1)');
  });

  it('snippet → subfolderPath variant, else `snippet (root)`', () => {
    expect(nodeLabel({ id: 's1', kind: 'snippet', subfolderPath: 'Findings/Chest', ...baseRect } as RPNode)).toBe('snippet (Findings/Chest)');
    expect(nodeLabel({ id: 's2', kind: 'snippet', ...baseRect } as RPNode)).toBe('snippet (root)');
  });

  it('snippet file-bound → 📄 caption variants (Phase 67 D-15)', () => {
    const baseSnippet = { id: 'sn', kind: 'snippet' as const, ...baseRect };

    // snippetLabel set → 📄 ${label}
    expect(nodeLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'abdomen/ct.md',
      snippetLabel: 'Abd CT',
    } as RPNode)).toBe('📄 Abd CT');

    // snippetLabel empty + path with extension → 📄 ${stem of basename}
    expect(nodeLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'abdomen/ct.md',
    } as RPNode)).toBe('📄 ct');

    // snippetLabel empty + path with no slash + no dot → 📄 ${path}
    expect(nodeLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'plain',
    } as RPNode)).toBe('📄 plain');

    // snippetLabel empty + nested path with extension → 📄 ${stem}
    expect(nodeLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: 'a/b/c/report.json',
    } as RPNode)).toBe('📄 report');

    // Empty radiprotocol_snippetPath ('' — gate is !== '') falls through to directory-bound arm → 'snippet (root)'
    expect(nodeLabel({
      ...baseSnippet,
      radiprotocol_snippetPath: '',
    } as RPNode)).toBe('snippet (root)');

    // snippetLabel set on directory-bound snippet (no path, snippetLabel present) → 📁 ${label}
    expect(nodeLabel({
      ...baseSnippet,
      snippetLabel: 'My Folder',
    } as RPNode)).toBe('📁 My Folder');
  });
});