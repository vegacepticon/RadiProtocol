// src/__tests__/views/option-order-chip-editor.test.ts
// Unit tests for the reorderable option-order chip list.

import { describe, it, expect, vi } from 'vitest';
import { mountOptionOrderChips, type OptionOrderChipItem } from '../../views/option-order-chip-editor';

class MockEl {
  children: MockEl[] = [];
  cls = '';
  textContent = '';
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  private listeners = new Map<string, EventListener[]>();

  constructor(readonly tag: string) {}

  empty(): void { this.children = []; }

  createDiv(opts?: { cls?: string; text?: string }): MockEl {
    const child = new MockEl('div');
    child.cls = opts?.cls ?? '';
    child.textContent = opts?.text ?? '';
    this.children.push(child);
    return child;
  }
  createEl(tag: string, opts?: { cls?: string; text?: string }): MockEl {
    const child = new MockEl(tag);
    child.cls = opts?.cls ?? '';
    child.textContent = opts?.text ?? '';
    this.children.push(child);
    return child;
  }
  createSpan(opts?: { cls?: string }): MockEl {
    const child = new MockEl('span');
    child.cls = opts?.cls ?? '';
    this.children.push(child);
    return child;
  }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value); }
  addClass(c: string): void { if (!this.cls.split(/\s+/).includes(c)) this.cls = (this.cls + ' ' + c).trim(); }
  removeClass(c: string): void { this.cls = this.cls.split(/\s+/).filter((x) => x !== c).join(' ').trim(); }
  contains(_node: Node | null): boolean { return false; }
  querySelectorAll(selector: string): MockEl[] {
    const want = selector.replace(/^\./, '');
    const out: MockEl[] = [];
    const visit = (el: MockEl): void => {
      if (el.cls.split(/\s+/).includes(want)) out.push(el);
      for (const child of el.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return out;
  }
  querySelector(selector: string): MockEl | undefined { return this.querySelectorAll(selector)[0]; }
  addEventListener(type: string, handler: EventListener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(handler);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, handler: EventListener): void {
    const arr = this.listeners.get(type);
    if (arr) this.listeners.set(type, arr.filter((h) => h !== handler));
  }
  dispatch(type: string, event: unknown): void {
    for (const h of this.listeners.get(type) ?? []) (h as EventListener)(event as Event);
  }
}

function asHtml(el: MockEl): HTMLElement { return el as unknown as HTMLElement; }

function makeDataTransfer(): { setData: (k: string, v: string) => void; getData: (k: string) => string } {
  const store: Record<string, string> = {};
  return { setData: (k, v) => { store[k] = v; }, getData: (k) => store[k] ?? '' };
}
function makeEvent(dt: { setData: (k: string, v: string) => void; getData: (k: string) => string }): unknown {
  return { dataTransfer: dt, preventDefault: () => {}, relatedTarget: null };
}

const t = (key: string, params?: Record<string, string>): string =>
  key === 'protocolEditor.optionOrderDragAria' ? `Drag ${params?.['label'] ?? ''}` : key;

describe('mountOptionOrderChips', () => {
  it('renders one chip per draft item with its label and draggable attr', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'Answer A' },
      { id: 'e2', label: 'Snippet B' },
    ];
    mountOptionOrderChips(asHtml(container), draft, () => {}, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    expect(chips.length).toBe(2);
    expect(chips.map((c) => c.querySelector('rp-option-order-chip-label')?.textContent)).toEqual(['Answer A', 'Snippet B']);
    expect(chips.map((c) => c.attrs.get('draggable'))).toEqual(['true', 'true']);
  });

  it('DnD drop reorders the draft in place and calls onChange', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
      { id: 'e3', label: 'C' },
    ];
    const onChange = vi.fn();
    mountOptionOrderChips(asHtml(container), draft, onChange, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    const dt = makeDataTransfer();
    chips[0]!.dispatch('dragstart', makeEvent(dt));  // from = 0
    chips[2]!.dispatch('drop', makeEvent(dt));        // to = 2
    expect(draft.map((d) => d.id)).toEqual(['e2', 'e3', 'e1']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores a drop with no transferred data (no reorder, no onChange)', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
    ];
    const onChange = vi.fn();
    mountOptionOrderChips(asHtml(container), draft, onChange, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    chips[1]!.dispatch('drop', makeEvent(makeDataTransfer()));  // empty dataTransfer → from = NaN
    expect(draft.map((d) => d.id)).toEqual(['e1', 'e2']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('destroy empties the container', () => {
    const container = new MockEl('div');
    const handle = mountOptionOrderChips(asHtml(container), [{ id: 'e1', label: 'A' }], () => {}, { t });
    expect(container.children.length).toBeGreaterThan(0);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });

  it('clicking a chip or its drag handle does not corrupt the draft (reorder-only — no click handler)', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
    ];
    mountOptionOrderChips(asHtml(container), draft, () => {}, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    const handles = container.querySelectorAll('rp-option-order-chip-handle');
    // Chips are reorder-only (no expand/toggle); no 'click' listener is registered,
    // so a stray click cannot corrupt the draft (DnD click-guard precedent 9900a56).
    chips[0]!.dispatch('click', {});
    handles[0]!.dispatch('click', {});
    expect(draft.map((d) => d.id)).toEqual(['e1', 'e2']);
  });
});
