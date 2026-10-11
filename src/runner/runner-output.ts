export interface AccumulatorDelta {
  text: string;
  hasSyntheticLeadingSeparator: boolean;
}

interface OutputAdapter {
  withLock(operation: () => Promise<void>): Promise<void>;
  read(): Promise<string>;
  write(content: string): Promise<void>;
  separator(): string;
  isCurrent(): boolean;
}

/** Retains accepted output until acknowledged; callers block further actions while pending. */
export class RunnerOutput {
  private pending: AccumulatorDelta | null = null;
  private attemptedContent: string | null = null;
  private writing = false;

  constructor(private readonly adapter: OutputAdapter) {}

  isBlocked(): boolean { return this.pending !== null; }
  isWriting(): boolean { return this.writing; }
  getPendingText(): string { return this.pending?.text ?? ''; }

  accept(delta: AccumulatorDelta): void {
    if (this.pending !== null) throw new Error('Runner output is awaiting acknowledgement');
    if (delta.text !== '') this.pending = delta;
  }

  async flush(): Promise<void> {
    if (this.writing || this.pending === null) return;
    this.writing = true;
    try {
      await this.adapter.withLock(async () => {
        if (!this.adapter.isCurrent() || this.pending === null) return;
        const current = await this.adapter.read();
        if (!this.adapter.isCurrent()) return;
        // A write can succeed on disk and still reject. Recognize its exact result on retry.
        if (this.attemptedContent !== null && current === this.attemptedContent) {
          this.pending = null;
          this.attemptedContent = null;
          return;
        }
        const { text, hasSyntheticLeadingSeparator } = this.pending;
        const separator = this.adapter.separator();
        const appended = hasSyntheticLeadingSeparator
          && current.endsWith(separator) && text.startsWith(separator)
          ? text.slice(separator.length) : text;
        this.attemptedContent = current + appended;
        await this.adapter.write(this.attemptedContent);
        this.pending = null;
        this.attemptedContent = null;
      });
    } finally {
      this.writing = false;
    }
  }
}
