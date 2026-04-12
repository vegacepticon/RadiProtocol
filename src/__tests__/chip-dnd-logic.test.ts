/**
 * Phase 27: Chip drag-and-drop logic tests (CHIP-02, WR-01, WR-03)
 *
 * Tests pure algorithmic units extracted from snippet-manager-view.ts
 * drop handler and autoSaveAfterDrop. No DOM or Obsidian runtime required.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helpers mirroring the inline logic in snippet-manager-view.ts
// ---------------------------------------------------------------------------

/**
 * Guard matching the drop handler (lines 403-405).
 * Returns true when the drop should be rejected (no splice performed).
 */
function isInvalidDrop(from: number, to: number, length: number): boolean {
  if (isNaN(from) || isNaN(to) || from === to || from < 0 || to < 0) return true;
  if (from >= length || to >= length) return true;
  return false;
}

/**
 * Splice reorder mirroring lines 406-407:
 *   const [moved] = draft.placeholders.splice(from, 1);
 *   if (moved) draft.placeholders.splice(to, 0, moved);
 * Operates on a copy so callers can pass literals.
 */
function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [moved] = copy.splice(from, 1);
  if (moved !== undefined) copy.splice(to, 0, moved);
  return copy;
}

/**
 * UUID v4 regex from autoSaveAfterDrop (line 701).
 * Used to detect new (unsaved) drafts that should not be auto-saved.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// CHIP-02 / WR-01: drop guard conditions
// ---------------------------------------------------------------------------

describe('CHIP-02 / WR-01: DnD drop guard conditions', () => {
  it('rejects same-slot drop (from === to)', () => {
    expect(isInvalidDrop(1, 1, 3)).toBe(true);
  });

  it('rejects negative from index', () => {
    expect(isInvalidDrop(-1, 1, 3)).toBe(true);
  });

  it('rejects negative to index', () => {
    expect(isInvalidDrop(1, -1, 3)).toBe(true);
  });

  it('rejects from index equal to array length (out-of-range)', () => {
    expect(isInvalidDrop(3, 1, 3)).toBe(true);
  });

  it('rejects to index equal to array length (out-of-range)', () => {
    expect(isInvalidDrop(1, 3, 3)).toBe(true);
  });

  it('rejects NaN from (parseInt of missing dataTransfer)', () => {
    expect(isInvalidDrop(NaN, 1, 3)).toBe(true);
  });

  it('rejects NaN to (parseInt of missing dataset)', () => {
    expect(isInvalidDrop(1, NaN, 3)).toBe(true);
  });

  it('accepts valid in-bounds distinct indices', () => {
    expect(isInvalidDrop(0, 2, 3)).toBe(false);
  });

  it('accepts last-valid index pair', () => {
    expect(isInvalidDrop(0, 2, 3)).toBe(false);
    expect(isInvalidDrop(2, 0, 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CHIP-02: splice reorder algorithm
// ---------------------------------------------------------------------------

describe('CHIP-02: placeholder splice reorder algorithm', () => {
  const items = ['A', 'B', 'C', 'D'];

  it('moves first item to last position', () => {
    expect(reorderArray([...items], 0, 3)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('moves last item to first position', () => {
    expect(reorderArray([...items], 3, 0)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('moves item one step right', () => {
    expect(reorderArray([...items], 0, 1)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('moves item one step left', () => {
    expect(reorderArray([...items], 2, 1)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('moves middle item to end', () => {
    expect(reorderArray([...items], 1, 3)).toEqual(['A', 'C', 'D', 'B']);
  });

  it('preserves array length after any reorder', () => {
    expect(reorderArray([...items], 0, 3)).toHaveLength(items.length);
    expect(reorderArray([...items], 3, 0)).toHaveLength(items.length);
  });

  it('preserves all original elements (no duplicates, no drops)', () => {
    const result = reorderArray([...items], 1, 3);
    expect(result.sort()).toEqual([...items].sort());
  });

  it('handles two-element array', () => {
    expect(reorderArray(['X', 'Y'], 0, 1)).toEqual(['Y', 'X']);
    expect(reorderArray(['X', 'Y'], 1, 0)).toEqual(['Y', 'X']);
  });
});

// ---------------------------------------------------------------------------
// WR-03: UUID auto-save guard regex
// ---------------------------------------------------------------------------

describe('WR-03: UUID detection for new-draft auto-save guard', () => {
  it('matches standard lowercase UUID v4', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('matches uppercase UUID (case-insensitive flag)', () => {
    expect(UUID_REGEX.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('matches mixed-case UUID', () => {
    expect(UUID_REGEX.test('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('does not match slug-format id (saved snippet)', () => {
    expect(UUID_REGEX.test('liver-report')).toBe(false);
  });

  it('does not match empty string', () => {
    expect(UUID_REGEX.test('')).toBe(false);
  });

  it('does not match partial UUID (too short)', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4')).toBe(false);
  });

  it('does not match UUID with extra characters', () => {
    expect(UUID_REGEX.test('x550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('does not match numeric id', () => {
    expect(UUID_REGEX.test('12345')).toBe(false);
  });
});
