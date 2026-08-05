// src/library/library-json-io.ts
// Shared low-level JSON vault I/O helpers for the library stores (D3).
// NOT a generic repository — just the WriteMutex + ensureFolderPath + pretty-
// JSON dialect factored out so the cache/record/journal stores don't triplicate
// it. Vault is a type-only import (NFR-01).

import type { Vault } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import { LibraryStoreError } from './library-model';

/** Extract a message from an unknown rejection WITHOUT ever throwing. Single
 *  read of e.message; returns a string on every path. */
export function safeErrorMessage(e: unknown): string {
  try {
    if (e instanceof Error) {
      const m = e.message;
      if (typeof m === 'string') return m;
    }
    return String(e);
  } catch {
    return 'unknown error';
  }
}

/**
 * Read + parse a JSON file with a shape guard. Missing file → null (empty
 * initial state). Malformed JSON or failed schema → throws LibraryStoreError
 * (explicit recoverable error, never a silent reset — D3). Does NOT take a
 * mutex — callers composing read-modify-write must hold their own lock
 * (D7 — the installer/service owns the transaction boundary).
 */
export async function readJsonFile<T>(
  vault: Vault,
  path: string,
  guard: (value: unknown) => value is T,
  label: string,
): Promise<T | null> {
  const exists = await vault.adapter.exists(path);
  if (!exists) return null;
  let raw: string;
  try {
    raw = await vault.adapter.read(path);
  } catch (e) {
    throw new LibraryStoreError('read-failed', path, safeErrorMessage(e));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new LibraryStoreError('malformed', path, `invalid JSON in ${label}: ${safeErrorMessage(e)}`);
  }
  if (!guard(parsed)) {
    throw new LibraryStoreError('malformed', path, `invalid ${label} schema`);
  }
  return parsed;
}

/**
 * Write a value as pretty JSON + trailing newline under a per-path mutex,
 * ensuring the parent folder exists first (D3 dialect — mirrors
 * ProtocolDocumentStore.write at src/protocol/protocol-document-store.ts:67-80).
 */
export async function writeJsonFile(
  vault: Vault,
  mutex: WriteMutex,
  path: string,
  parentDir: string,
  value: unknown,
): Promise<void> {
  await mutex.runExclusive(path, async () => {
    try {
      await ensureFolderPath(vault, parentDir);
      const payload = JSON.stringify(value, null, 2) + '\n';
      await vault.adapter.write(path, payload);
    } catch (e) {
      throw new LibraryStoreError('write-failed', path, safeErrorMessage(e));
    }
  });
}
