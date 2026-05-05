// Phase 75 Plan 05 — focused tests for the shared error-list renderer.
// The host wrapping stays host-owned; this test pins only the title + list
// body shape and the optional title-class divergence.

import { describe, expect, it } from 'vitest';
import { renderErrorList } from '../../runner/render/render-error';

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  createEl(tag: string, opts?: { cls?: string; text?: string }): FakeNode;
}

function makeFakeNode(tag = 'div'): FakeNode {
  const node: FakeNode = {
    tag,
    children: [],
    createEl(t: string, opts?: { cls?: string; text?: string }): FakeNode {
      const child = makeFakeNode(t);
      child.cls = opts?.cls;
      child.text = opts?.text;
      node.children.push(child);
      return child;
    },
  };
  return node;
}

function asHtml(n: FakeNode): HTMLElement { return n as unknown as HTMLElement; }

describe('renderErrorList', () => {
  it('renders title without class when titleClass is omitted (default shape)', () => {
    const zone = makeFakeNode();
    renderErrorList(asHtml(zone), ['boom', 'kaboom']);

    expect(zone.children).toHaveLength(2);
    expect(zone.children[0]!.tag).toBe('p');
    expect(zone.children[0]!.text).toBe('Protocol error');
    expect(zone.children[0]!.cls).toBeUndefined();

    const ul = zone.children[1]!;
    expect(ul.tag).toBe('ul');
    expect(ul.cls).toBe('rp-error-list');
    expect(ul.children.map(c => c.text)).toEqual(['boom', 'kaboom']);
    expect(ul.children.every(c => c.tag === 'li')).toBe(true);
  });

  it('honours titleClass for inline modal divergence', () => {
    const zone = makeFakeNode();
    renderErrorList(asHtml(zone), ['nope'], { titleClass: 'rp-error-title' });
    expect(zone.children[0]!.cls).toBe('rp-error-title');
  });

  it('produces an empty list body for zero messages', () => {
    const zone = makeFakeNode();
    renderErrorList(asHtml(zone), []);
    expect(zone.children).toHaveLength(2);
    expect(zone.children[1]!.children).toHaveLength(0);
  });
});
