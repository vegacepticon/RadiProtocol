import type { ProtocolDocumentV1 } from '../protocol/protocol-document';
import type { ProtocolDocumentStore } from '../protocol/protocol-document-store';

interface DocumentContext {
  path: string | null;
  generation: number;
  readOnly: boolean;
}

export interface EditorDocumentLease {
  readonly path: string;
  readonly generation: number;
}

class StaleDocumentOperation extends Error {}

/** Owns asynchronous document work and resources; the view owns projections. */
export class ProtocolEditorDocumentOwner {
  private closed = false;
  private loading = false;
  private loadRequest = 0;
  private readonly resources = new Set<() => void>();

  constructor(
    private readonly store: Pick<ProtocolDocumentStore, 'read' | 'update'>,
    private readonly context: () => DocumentContext,
    private readonly invalidate: () => void,
  ) {}

  open(): void { this.closed = false; }

  close(): void {
    this.closed = true;
    this.loading = false;
    this.invalidate();
    this.disposeResources();
  }

  async load(
    path: string,
    apply: (doc: ProtocolDocumentV1) => void,
    refreshLease?: EditorDocumentLease,
  ): Promise<'loaded' | 'failed' | 'stale'> {
    if (this.closed) return 'stale';
    if (refreshLease !== undefined) {
      if (refreshLease.path !== path || !this.isCurrent(refreshLease)) return 'stale';
    } else {
      this.invalidate();
      this.loading = true;
      this.disposeResources();
    }
    const request = ++this.loadRequest;
    const generation = this.context().generation;
    try {
      const doc = await this.store.read(path);
      if (this.closed || this.context().generation !== generation || request !== this.loadRequest) return 'stale';
      this.loading = false;
      if (doc === null) return 'failed';
      apply(doc);
      return 'loaded';
    } catch (error) {
      if (this.closed || this.context().generation !== generation || request !== this.loadRequest) return 'stale';
      this.loading = false;
      throw error;
    }
  }

  capture(): EditorDocumentLease | null {
    const { path, generation } = this.context();
    return this.closed || this.loading || path === null ? null : { path, generation };
  }

  isCurrent(lease: EditorDocumentLease): boolean {
    const { path, generation } = this.context();
    return !this.closed && !this.loading && path === lease.path && generation === lease.generation;
  }

  async update(
    lease: EditorDocumentLease | null,
    mutate: (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1,
  ): Promise<ProtocolDocumentV1 | null> {
    if (lease === null || !this.isCurrent(lease) || this.context().readOnly) return null;
    // A new edit supersedes any refresh that read an earlier document version.
    ++this.loadRequest;
    try {
      const doc = await this.store.update(lease.path, (existing) => {
        // Check again after acquiring the store's file lock. Throwing abandons
        // queued mutations without even writing an unchanged document.
        if (!this.isCurrent(lease) || this.context().readOnly) throw new StaleDocumentOperation();
        return mutate(existing);
      });
      if (!this.isCurrent(lease)) return null;
      ++this.loadRequest;
      return doc;
    } catch (error) {
      if (error instanceof StaleDocumentOperation || !this.isCurrent(lease)) return null;
      throw error;
    }
  }

  own(lease: EditorDocumentLease, dispose: () => void): () => void {
    let disposed = false;
    const close = () => {
      if (disposed) return;
      disposed = true;
      this.resources.delete(close);
      dispose();
    };
    if (this.isCurrent(lease)) this.resources.add(close);
    else close();
    return close;
  }

  private disposeResources(): void {
    for (const close of [...this.resources]) close();
  }
}
