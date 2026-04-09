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

  /**
   * Append text with a separator prefix — but only when the buffer is already non-empty.
   * First chunk in a session is never preceded by a separator (D-01).
   *
   * @param text      The text chunk to append.
   * @param separator 'newline' inserts '\n'; 'space' inserts ' '.
   */
  appendWithSeparator(text: string, separator: 'newline' | 'space'): void {
    if (this.buffer === '') {
      this.buffer += text;
    } else {
      this.buffer += (separator === 'newline' ? '\n' : ' ') + text;
    }
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

  /**
   * Replace the buffer with the given text.
   * Used only by ProtocolRunner.syncManualEdit() to inject a manual textarea edit
   * into the accumulator before an advance action. Does NOT push an undo entry —
   * the undo snapshot is captured inside the advance action immediately after.
   */
  overwrite(text: string): void {
    this.buffer = text;
  }
}
