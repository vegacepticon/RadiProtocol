import { describe, expect, it, vi } from 'vitest';
import { ProtocolEditorDocumentOwner } from '../../views/protocol-editor-document-owner';
import { createEmptyProtocolDocument, type ProtocolDocumentV1 } from '../../protocol/protocol-document';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness() {
  const doc = createEmptyProtocolDocument('a', 'A', new Date('2026-01-01'));
  const state = { path: 'a.rp.json' as string | null, generation: 0, readOnly: false };
  const store = {
    read: vi.fn(async (_path: string): Promise<ProtocolDocumentV1 | null> => doc),
    update: vi.fn(async (_path: string, mutate: (value: ProtocolDocumentV1 | null) => ProtocolDocumentV1) => mutate(doc)),
  };
  const owner = new ProtocolEditorDocumentOwner(store, () => state, () => { ++state.generation; });
  const apply = vi.fn((next: ProtocolDocumentV1) => { state.path = `${next.id}.rp.json`; });
  return { owner, store, state, doc, apply };
}

describe('ProtocolEditorDocumentOwner', () => {
  it.each([false, true])('latest load wins even when reads finish backwards (same path: %s)', async (samePath) => {
    const h = harness();
    const first = deferred<ProtocolDocumentV1 | null>();
    const second = deferred<ProtocolDocumentV1 | null>();
    h.store.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldLoad = h.owner.load('a.rp.json', h.apply);
    const newLoad = h.owner.load(samePath ? 'a.rp.json' : 'b.rp.json', h.apply);
    expect(h.owner.capture()).toBeNull();
    const latest = { ...h.doc, title: 'Latest read' };
    second.resolve(latest);
    expect(await newLoad).toBe('loaded');
    first.resolve(h.doc);
    expect(await oldLoad).toBe('stale');
    expect(h.apply).toHaveBeenCalledExactlyOnceWith(latest);
  });

  it('close rejects a pending load even after reopening', async () => {
    const h = harness();
    const read = deferred<ProtocolDocumentV1 | null>();
    h.store.read.mockReturnValueOnce(read.promise);
    const pending = h.owner.load('a.rp.json', h.apply);
    h.owner.close();
    h.owner.open();
    read.resolve(h.doc);
    expect(await pending).toBe('stale');
    expect(h.apply).not.toHaveBeenCalled();
    expect(await h.owner.load('a.rp.json', h.apply)).toBe('loaded');
    expect(h.owner.capture()).not.toBeNull();
  });

  it('discards errors from superseded loads, but reports current failures', async () => {
    const h = harness();
    const first = deferred<ProtocolDocumentV1 | null>();
    h.store.read.mockReturnValueOnce(first.promise);
    const oldLoad = h.owner.load('a.rp.json', h.apply);
    await h.owner.load('b.rp.json', h.apply);
    first.reject(new Error('old read error'));
    expect(await oldLoad).toBe('stale');
    h.store.read.mockRejectedValueOnce(new Error('current read error'));
    await expect(h.owner.load('a.rp.json', h.apply)).rejects.toThrow('current read error');
    expect(h.owner.capture()).not.toBeNull();
    h.store.read.mockResolvedValueOnce(null);
    expect(await h.owner.load('a.rp.json', h.apply)).toBe('failed');
  });

  it.each(['load', 'close', 'read-only'] as const)('abandons queued mutations before writing after %s', async (transition) => {
    const h = harness();
    const entered = deferred<void>();
    const acquired = deferred<void>();
    const writes = vi.fn();
    h.store.update.mockImplementationOnce(async (_path, mutate) => {
      entered.resolve();
      await acquired.promise;
      const result = mutate(h.doc);
      writes(result);
      return result;
    });
    const mutate = vi.fn((doc: ProtocolDocumentV1 | null) => ({ ...doc!, title: 'Old draft' }));
    const pending = h.owner.update(h.owner.capture(), mutate);
    await entered.promise;
    if (transition === 'load') await h.owner.load('b.rp.json', h.apply);
    if (transition === 'close') h.owner.close();
    if (transition === 'read-only') h.state.readOnly = true;
    acquired.resolve();
    expect(await pending).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([false, true])('discards late save completion after document switch (failure: %s)', async (failure) => {
    const h = harness();
    const result = deferred<ProtocolDocumentV1>();
    h.store.update.mockReturnValueOnce(result.promise);
    const pending = h.owner.update(h.owner.capture(), doc => doc!);
    await h.owner.load('b.rp.json', h.apply);
    if (failure) result.reject(new Error('old write failed'));
    else result.resolve(h.doc);
    expect(await pending).toBeNull();
  });

  it('keeps the draft path and rejects it after a switch', async () => {
    const h = harness();
    const draft = h.owner.capture()!;
    await h.owner.load('b.rp.json', h.apply);
    expect(await h.owner.update(draft, doc => doc!)).toBeNull();
    expect(h.store.update).not.toHaveBeenCalled();
  });

  it('blocks updates while loading and after close, and preserves read-only', async () => {
    const h = harness();
    const read = deferred<ProtocolDocumentV1 | null>();
    h.store.read.mockReturnValueOnce(read.promise);
    const lease = h.owner.capture()!;
    const pending = h.owner.load('b.rp.json', h.apply);
    expect(await h.owner.update(lease, doc => doc!)).toBeNull();
    read.resolve(h.doc);
    await pending;
    h.state.readOnly = true;
    expect(await h.owner.update(h.owner.capture(), doc => doc!)).toBeNull();
    h.owner.close();
    expect(h.owner.capture()).toBeNull();
    expect(await h.owner.load('a.rp.json', h.apply)).toBe('stale');
    expect(h.store.update).not.toHaveBeenCalled();
  });

  it('disposes overlays and timers once on switch or close', async () => {
    const h = harness();
    const draft = h.owner.capture()!;
    const overlay = vi.fn();
    const cancelTimer = vi.fn();
    const closeOverlay = h.owner.own(draft, overlay);
    h.owner.own(draft, cancelTimer);
    closeOverlay();
    await h.owner.load('b.rp.json', h.apply);
    h.owner.close();
    closeOverlay();
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(cancelTimer).toHaveBeenCalledTimes(1);
    const detached = vi.fn();
    h.owner.own(draft, detached);
    expect(detached).toHaveBeenCalledTimes(1);
  });

  it('refresh after saving keeps other accepted edits in the same session', async () => {
    const h = harness();
    const lease = h.owner.capture()!;
    const read = deferred<ProtocolDocumentV1 | null>();
    h.store.read.mockReturnValueOnce(read.promise);
    const refresh = h.owner.load(lease.path, h.apply, lease);
    const result = await h.owner.update(lease, doc => ({ ...doc!, title: 'Next edit' }));
    expect(result!.title).toBe('Next edit');
    read.resolve(h.doc);
    expect(await refresh).toBe('stale');
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.owner.isCurrent(lease)).toBe(true);
  });

  it('returns accepted edits and propagates failures for the current document', async () => {
    const h = harness();
    const result = await h.owner.update(h.owner.capture(), doc => ({ ...doc!, title: 'Edited' }));
    expect(result!.title).toBe('Edited');
    h.store.update.mockRejectedValueOnce(new Error('disk error'));
    await expect(h.owner.update(h.owner.capture(), doc => doc!)).rejects.toThrow('disk error');
  });
});
