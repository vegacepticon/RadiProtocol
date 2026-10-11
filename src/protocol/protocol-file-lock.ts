import type { Vault } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';

// Stores and snippet reference rewrites must serialize against the same files.
// Vault identity isolates independent vaults and lets their locks be collected.
const vaultLocks = new WeakMap<Vault, WriteMutex>();

export function withProtocolFileLock<T>(
  vault: Vault,
  path: string,
  operation: () => Promise<T>,
): Promise<T> {
  let mutex = vaultLocks.get(vault);
  if (mutex === undefined) {
    mutex = new WriteMutex();
    vaultLocks.set(vault, mutex);
  }
  return mutex.runExclusive(path, operation);
}
