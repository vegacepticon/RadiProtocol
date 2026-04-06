import { describe, it, expect } from 'vitest';
import { WriteMutex } from '../utils/write-mutex';

describe('WriteMutex (SNIP-07)', () => {
  it('has runExclusive(path, fn) method', () => {
    const m = new WriteMutex();
    expect(typeof m.runExclusive).toBe('function');
  });

  it('serializes concurrent writes on the same path', async () => {
    const m = new WriteMutex();
    const order: number[] = [];

    const p1 = m.runExclusive('/test/file.json', async () => {
      await new Promise(r => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = m.runExclusive('/test/file.json', async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
