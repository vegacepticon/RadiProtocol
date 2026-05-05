// Phase 75 Plan 05 — focused tests for the shared awaiting-snippet-fill helpers.
// Pin the shared awaiting-snippet-fill helper behavior: the loading
// placeholder, the not-found copy with optional trailer, and the path-shape
// detection. Host-specific path resolution / WR-03 / fillModal lifecycle stays
// covered by the existing host test suites.

import { describe, expect, it } from 'vitest';
import {
  isFullSnippetPath,
  renderSnippetFillLoading,
  renderSnippetFillNotFound,
} from '../../runner/render/render-snippet-fill';

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  empty(): void;
  createEl(tag: string, opts?: { cls?: string; text?: string }): FakeNode;
}

function makeFakeNode(tag = 'div'): FakeNode {
  const node: FakeNode = {
    tag,
    children: [],
    empty(): void { node.children.length = 0; },
    createEl(t: string, opts?: { cls?: string; text?: string }): FakeNode {
      const child: FakeNode = {
        tag: t,
        cls: opts?.cls,
        text: opts?.text,
        children: [],
        empty(): void { child.children.length = 0; },
        createEl: (tt: string, opts2?: { cls?: string; text?: string }) =>
          (child.createEl as unknown as typeof node.createEl)(tt, opts2),
      };
      // Hook child createEl so further nesting works.
      child.createEl = function (tt: string, _opts?: { cls?: string; text?: string }): FakeNode {
        return makeFakeNode(tt) as FakeNode;
      };
      node.children.push(child);
      return child;
    },
  };
  return node;
}

function asHtml(n: FakeNode): HTMLElement { return n as unknown as HTMLElement; }

describe('isFullSnippetPath', () => {
  it('treats slash-bearing ids as full paths', () => {
    expect(isFullSnippetPath('abdomen/ct.json')).toBe(true);
    expect(isFullSnippetPath('a/b/c.md')).toBe(true);
  });

  it('treats explicit .md / .json suffixes as full paths', () => {
    expect(isFullSnippetPath('foo.md')).toBe(true);
    expect(isFullSnippetPath('foo.json')).toBe(true);
  });

  it('treats bare legacy ids as non-full paths', () => {
    expect(isFullSnippetPath('legacy_id')).toBe(false);
    expect(isFullSnippetPath('snippet42')).toBe(false);
  });
});

describe('renderSnippetFillLoading', () => {
  it('emits the localised loading paragraph with the empty-state class', () => {
    const zone = makeFakeNode();
    renderSnippetFillLoading(asHtml(zone));
    expect(zone.children).toHaveLength(1);
    expect(zone.children[0]!.tag).toBe('p');
    expect(zone.children[0]!.text).toBe('Loading snippet...');
    expect(zone.children[0]!.cls).toBe('rp-empty-state-body');
  });
});

describe('renderSnippetFillNotFound', () => {
  it('clears the zone and renders the bare not-found copy when no trailer is given', () => {
    const zone = makeFakeNode();
    // pre-populate to confirm empty() is called
    zone.createEl('p', { text: 'Previous' });
    renderSnippetFillNotFound(asHtml(zone), 'foo');
    expect(zone.children).toHaveLength(1);
    expect(zone.children[0]!.text).toBe(`Snippet 'foo' not found.`);
    expect(zone.children[0]!.cls).toBe('rp-empty-state-body');
  });

  it('appends the trailer when provided (legacy host copy)', () => {
    const zone = makeFakeNode();
    renderSnippetFillNotFound(asHtml(zone), 'foo', {
      trailer: ' The snippet may have been deleted. Use step-back to continue.',
    });
    expect(zone.children).toHaveLength(1);
    expect(zone.children[0]!.text).toBe(
      `Snippet 'foo' not found. The snippet may have been deleted. Use step-back to continue.`,
    );
  });
});
