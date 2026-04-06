import { describe, it, expect, beforeEach } from 'vitest';
import { TextAccumulator } from '../../runner/text-accumulator';

describe('TextAccumulator', () => {
  let acc: TextAccumulator;

  beforeEach(() => {
    acc = new TextAccumulator();
  });

  it('starts with empty current text', () => {
    expect(acc.current).toBe('');
  });

  it('append() adds text to the buffer', () => {
    acc.append('Hello');
    acc.append(', world');
    expect(acc.current).toBe('Hello, world');
  });

  it('snapshot() returns the current buffer as a string value copy', () => {
    acc.append('before');
    const snap = acc.snapshot();
    acc.append(' after');
    // snapshot captured value before append — must not reflect later changes
    expect(snap).toBe('before');
    expect(acc.current).toBe('before after');
  });

  it('restoreTo() replaces buffer with the snapshot value', () => {
    acc.append('first');
    const snap = acc.snapshot();
    acc.append(' second');
    expect(acc.current).toBe('first second');
    acc.restoreTo(snap);
    expect(acc.current).toBe('first');
  });

  it('restoreTo() with empty string snapshot clears the buffer', () => {
    const emptySnap = acc.snapshot(); // ''
    acc.append('some text');
    acc.restoreTo(emptySnap);
    expect(acc.current).toBe('');
  });

  it('handles Unicode characters in medical text (NFR-11)', () => {
    acc.append('Measurement: 3.5 cm² at 37°C');
    expect(acc.current).toBe('Measurement: 3.5 cm² at 37°C');
    const snap = acc.snapshot();
    acc.restoreTo(snap);
    expect(acc.current).toBe('Measurement: 3.5 cm² at 37°C');
  });
});
