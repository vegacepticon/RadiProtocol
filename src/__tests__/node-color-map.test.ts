// src/__tests__/node-color-map.test.ts
// Tests for COLOR-01 (assign path), COLOR-03 (7-type mapping), D-01, D-02
import { describe, it, expect } from 'vitest';
import { NODE_COLOR_MAP } from '../canvas/node-color-map';

describe('NODE_COLOR_MAP', () => {
  it('maps all 7 node types to valid palette strings ("1"–"6")', () => {
    const types = ['start', 'question', 'answer', 'text-block', 'snippet', 'loop-start', 'loop-end'];
    for (const type of types) {
      expect(NODE_COLOR_MAP[type], `type "${type}" must have a palette string`).toMatch(/^[1-6]$/);
    }
  });

  it('each type maps to the exact palette string per D-01', () => {
    expect(NODE_COLOR_MAP['start']).toBe('4');       // green — entry point
    expect(NODE_COLOR_MAP['question']).toBe('5');    // cyan — information gathering
    expect(NODE_COLOR_MAP['answer']).toBe('2');      // orange — action / selection
    expect(NODE_COLOR_MAP['text-block']).toBe('3');  // yellow — passive content
    expect(NODE_COLOR_MAP['snippet']).toBe('6');     // purple — code / file insertion (D-02: pre-declared)
    expect(NODE_COLOR_MAP['loop-start']).toBe('1'); // red — loop boundary
    expect(NODE_COLOR_MAP['loop-end']).toBe('1');   // red — loop boundary (intentional share)
  });

  it('loop-start and loop-end intentionally share "1" (red) — semantic loop pair (D-01)', () => {
    expect(NODE_COLOR_MAP['loop-start']).toBe(NODE_COLOR_MAP['loop-end']);
  });

  it('unknown or empty type returns undefined (unmark path: no color written)', () => {
    expect(NODE_COLOR_MAP['']).toBeUndefined();
    expect(NODE_COLOR_MAP['free-text']).toBeUndefined();
    expect(NODE_COLOR_MAP['unknown-type']).toBeUndefined();
  });
});
