// Phase 75 Plan 05 — focused tests for the shared `complete` heading renderer.

import { describe, expect, it } from 'vitest';
import { renderCompleteHeading } from '../../runner/render/render-complete';

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
      const child: FakeNode = {
        tag: t,
        cls: opts?.cls,
        text: opts?.text,
        children: [],
        createEl(): FakeNode { throw new Error('not used'); },
      };
      node.children.push(child);
      return child;
    },
  };
  return node;
}

function asHtml(n: FakeNode): HTMLElement { return n as unknown as HTMLElement; }

describe('renderCompleteHeading', () => {
  it('appends an <h2> with the shared "Protocol complete" copy and class', () => {
    const zone = makeFakeNode();
    const heading = renderCompleteHeading(asHtml(zone));
    expect(zone.children).toHaveLength(1);
    expect(zone.children[0]!.tag).toBe('h2');
    expect(zone.children[0]!.text).toBe('Protocol complete');
    expect(zone.children[0]!.cls).toBe('rp-complete-heading');
    // Returns the heading element for hosts that need to attach Run-again
    // chrome. Identity check via reference equality.
    expect(heading as unknown as FakeNode).toBe(zone.children[0]!);
  });
});
