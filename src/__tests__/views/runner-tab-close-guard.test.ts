import { describe, expect, it, vi } from 'vitest';
import { guardRunnerTabClose } from '../../views/runner-tab-close-guard';

function setup() {
  const handlers = new Map<string, (event: any) => void>();
  const root = {
    addEventListener: vi.fn((type: string, handler: (event: any) => void, _capture: boolean) => handlers.set(type, handler)),
    removeEventListener: vi.fn((type: string) => handlers.delete(type)),
  };
  const close = { closest: (selector: string) => selector === '.workspace-tab-header-inner-close-button' ? close : null };
  const title = { closest: () => null };
  const header = { contains: (target: unknown) => target === close || target === title };
  const requestClose = vi.fn();
  let dirty = true;
  const stop = guardRunnerTabClose({ tabHeaderEl: header } as any, () => dirty, requestClose, root as any);
  const fire = (target: unknown, type = 'click', button = 0) => {
    const event = { target, type, button, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    handlers.get(type)?.(event);
    return event;
  };
  return { root, close, title, requestClose, stop, fire, clean: () => { dirty = false; } };
}

describe('guardRunnerTabClose', () => {
  it('captures this tab close and middle click before native detach', () => {
    const h = setup();
    expect(h.root.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
    const click = h.fire(h.close);
    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(click.stopImmediatePropagation).toHaveBeenCalledOnce();
    h.fire(h.title, 'auxclick', 1);
    expect(h.requestClose).toHaveBeenCalledTimes(2);
  });

  it('allows ordinary selection, other tabs, clean close and events after cleanup', () => {
    const h = setup();
    h.fire(h.title);
    h.fire({ closest: () => h.close });
    h.fire(h.close, 'auxclick', 2);
    h.clean();
    expect(h.fire(h.close).preventDefault).not.toHaveBeenCalled();
    expect(h.requestClose).not.toHaveBeenCalled();
    h.stop();
    expect(h.root.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
    h.fire(h.close);
    expect(h.requestClose).not.toHaveBeenCalled();
  });
});
