// runner/text-accumulator.ts
// Pure module — zero Obsidian API imports (NFR-01)

/**
 * Append-only text buffer with O(1) full-snapshot undo support (RUN-07, D-04).
 *
 * Design note: JavaScript strings are immutable primitives. Assigning `this.buffer`
 * to a variable copies the value, not a reference. This makes snapshot() naturally
 * safe — no deep-clone is required.
 */
export class TextAccumulator {
  private buffer = '';

  /** Append text to the end of the buffer. */
  append(text: string): void {
    this.buffer += text;
  }

  /** Read the current accumulated text. */
  get current(): string {
    return this.buffer;
  }

  /**
   * Capture the current buffer as an immutable value snapshot.
   * Callers store this before any mutation; pass to restoreTo() to revert.
   */
  snapshot(): string {
    // String assignment copies the value — no clone needed (see design note above).
    return this.buffer;
  }

  /**
   * Replace the buffer with a previously captured snapshot.
   * This is the O(1) revert operation. Cannot partially corrupt text.
   */
  restoreTo(snapshot: string): void {
    this.buffer = snapshot;
  }
}
