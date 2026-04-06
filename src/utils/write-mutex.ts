// utils/write-mutex.ts
// Pure module — zero Obsidian API imports (NFR-01)
import { Mutex } from 'async-mutex';

/**
 * Per-file async write lock (SNIP-07).
 * Wraps every vault.modify() call on snippet files to prevent race-condition corruption.
 * Key = full vault path string.
 */
export class WriteMutex {
  private locks = new Map<string, Mutex>();

  private getLock(path: string): Mutex {
    let lock = this.locks.get(path);
    if (lock === undefined) {
      lock = new Mutex();
      this.locks.set(path, lock);
    }
    return lock;
  }

  async runExclusive<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(path);
    return lock.runExclusive(fn);
  }
}
