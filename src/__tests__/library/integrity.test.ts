import { describe, it, expect } from 'vitest';
import { sha256String, sha256Bytes, verifyIntegrity } from '../../library/integrity';

describe('integrity — sha256String', () => {
  it('matches known SHA-256 of "abc"', async () => {
    expect(await sha256String('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('is lowercase 64-char hex', async () => {
    expect(await sha256String('hello')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('integrity — sha256Bytes', () => {
  it('matches sha256String for the same UTF-8 bytes', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Bytes(bytes)).toBe(await sha256String('abc'));
  });
  it('accepts ArrayBuffer', async () => {
    const buf = new TextEncoder().encode('abc').buffer as ArrayBuffer;
    expect(await sha256Bytes(buf)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('integrity — verifyIntegrity', () => {
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  it('returns true on matching hash', async () => {
    expect(await verifyIntegrity('abc', hash)).toBe(true);
  });
  it('returns false on mismatching hash (no throw)', async () => {
    expect(await verifyIntegrity('abc', '0'.repeat(64))).toBe(false);
  });
  it('is case-insensitive on expected hex', async () => {
    expect(await verifyIntegrity('abc', hash.toUpperCase())).toBe(true);
  });
});
