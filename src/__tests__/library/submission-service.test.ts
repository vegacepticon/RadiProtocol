// Stage D — LibrarySubmissionService tests: persist-before-POST, frozen-payload
// retry, outcome_unknown on SUBMISSION_STATE_UNKNOWN, late-safe receipt writes.
import { describe, expect, it, vi } from 'vitest';
import { LibrarySubmissionService } from '../../library/submission-service';
import type { SubmitHttpTransport } from '../../library/submission-client';
import type { ReleaseBundle } from '../../library/library-model';

function makeVault() {
  const files: Record<string, string> = {};
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
      list: vi.fn(async (p: string) => {
        const prefix = p + '/';
        const out: string[] = [];
        for (const f of Object.keys(files)) if (f.startsWith(prefix)) out.push(f);
        return { files: out, folders: [] };
      }),
    },
    createFolder: vi.fn(async () => undefined),
  };
  return { vault, files };
}

function makeBundle(packageId = 'test-pkg', version = '1.0.0'): ReleaseBundle {
  return {
    manifest: {
      schema: 'radiprotocol.package', version: 1,
      packageId, releaseVersion: version,
      protocolDoc: {} as never, protocolSha256: 'a'.repeat(64),
      snippetFiles: [], catalogEntryId: packageId,
      publishedAt: '2026-09-06T12:00:00.000Z',
    },
    snippetContents: [],
  };
}

function makeService(transport: SubmitHttpTransport) {
  const { vault, files } = makeVault();
  const service = new LibrarySubmissionService({ vault } as never, transport);
  return { service, files };
}

const META = {
  title: 'КТ грудной клетки',
  description: '',
  categories: ['chest'],
  authorDisplayName: 'Автор',
  note: '',
};

const OK_RESPONSE = JSON.stringify({
  ok: true, requestId: 'PLACEHOLDER',
  prUrl: 'https://github.com/o/r/pull/1', branch: 'submit/x', reused: false, degraded: false,
});

describe('LibrarySubmissionService.submitNew', () => {
  it('persists the attempt BEFORE the POST (persist-before-POST contract)', async () => {
    const seen: string[] = [];
    let releaseTransport: (() => Promise<{ status: number; bodyText: string }>) | null = null;
    const transport: SubmitHttpTransport = async () => {
      seen.push('post');
      return releaseTransport !== null ? releaseTransport() : Promise.resolve({ status: 200, bodyText: OK_RESPONSE });
    };
    const { service, files } = makeService(transport);
    // Hold the POST open: first persist the record, then release.
    let storedBeforePost = false;
    void files; // files populated by service
    const originalPost = seen.push.bind(seen);
    seen.push = (...args: string[]) => { storedBeforePost = Object.keys(files).length > 0; return originalPost(...args); };
    releaseTransport = async () => ({ status: 200, bodyText: OK_RESPONSE.replace('PLACEHOLDER', '01234567-89ab-cdef-0123-456789abcdef') });
    const result = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(result.status).toBe('ok');
    expect(storedBeforePost).toBe(true);
  });

  it('does NOT send anything when persisting fails', async () => {
    const transport: SubmitHttpTransport = vi.fn();
    const { service, files } = makeService(transport);
    // Corrupt vault: adapter.write fails.
    (files as unknown as Record<string, unknown>)['break'] = true;
    const brokenVault = makeVault();
    brokenVault.vault.adapter.write = vi.fn(async () => { throw new Error('disk full'); });
    const broken = new LibrarySubmissionService({ vault: brokenVault.vault } as never, transport);
    const result = await broken.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(result.status).toBe('persist-failed');
    expect(transport).not.toHaveBeenCalled();
    void service;
  });

  it('rejects invalid input (no categories / no title / no registry) with zero side effects', async () => {
    const transport: SubmitHttpTransport = vi.fn();
    const { service } = makeService(transport);
    expect((await service.submitNew({ bundle: makeBundle(), meta: { ...META, title: '  ' }, registryKey: 'https://x.test', sourceDocumentId: 'd', sourceProtocolPath: 'p' })).status).toBe('invalid-input');
    expect((await service.submitNew({ bundle: makeBundle(), meta: { ...META, categories: [] }, registryKey: 'https://x.test', sourceDocumentId: 'd', sourceProtocolPath: 'p' })).status).toBe('invalid-input');
    expect((await service.submitNew({ bundle: makeBundle(), meta: META, registryKey: '  ', sourceDocumentId: 'd', sourceProtocolPath: 'p' })).status).toBe('invalid-input');
    expect(transport).not.toHaveBeenCalled();
  });

  it('ok response → state pending with receipt', async () => {
    const transport: SubmitHttpTransport = async () => ({ status: 200, bodyText: OK_RESPONSE.replace('PLACEHOLDER', '01234567-89ab-cdef-0123-456789abcdef') });
    const { service } = makeService(transport);
    const result = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.record.state).toBe('pending');
      expect(result.record.receipt?.prUrl).toContain('https://');
    }
  });

  it('SUBMISSION_STATE_UNKNOWN → outcome_unknown (not a clean failure)', async () => {
    const transport: SubmitHttpTransport = async () => ({ status: 500, bodyText: JSON.stringify({ ok: false, error: 'SUBMISSION_STATE_UNKNOWN', requestId: 'r' }) });
    const { service } = makeService(transport);
    const result = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.code).toBe('SUBMISSION_STATE_UNKNOWN');
      expect(result.record.state).toBe('outcome_unknown');
    }
  });

  it('plain 4xx → failed with typed code; record kept for history', async () => {
    const transport: SubmitHttpTransport = async () => ({ status: 409, bodyText: JSON.stringify({ ok: false, error: 'VERSION_ALREADY_PUBLISHED' }) });
    const { service } = makeService(transport);
    const result = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.record.state).toBe('failed');
  });
});

describe('LibrarySubmissionService.retry', () => {
  it('re-sends the FROZEN payload bytes (same requestId, same body)', async () => {
    const bodies: string[] = [];
    const transport: SubmitHttpTransport = async (_url, body) => {
      bodies.push(body);
      if (bodies.length === 1) return { status: 500, bodyText: JSON.stringify({ ok: false, error: 'SUBMISSION_STATE_UNKNOWN', requestId: 'r' }) };
      return { status: 200, bodyText: OK_RESPONSE.replace('PLACEHOLDER', '01234567-89ab-cdef-0123-456789abcdef') };
    };
    const { service } = makeService(transport);
    const first = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    expect(first.status).toBe('failed');
    const requestId = first.status === 'failed' ? first.record.requestId : '';
    const second = await service.retry(requestId);
    expect(second.status).toBe('ok');
    expect(bodies.length).toBe(2);
    expect(bodies[0]).toBe(bodies[1]);
  });

  it('refuses to retry a pending attempt', async () => {
    const transport: SubmitHttpTransport = async () => ({ status: 200, bodyText: OK_RESPONSE.replace('PLACEHOLDER', '01234567-89ab-cdef-0123-456789abcdef') });
    const { service } = makeService(transport);
    const first = await service.submitNew({
      bundle: makeBundle(), meta: META,
      registryKey: 'https://library.radiprotocol.pro',
      sourceDocumentId: 'doc-1', sourceProtocolPath: 'Protocols/a.rp.json',
    });
    if (first.status !== 'ok') throw new Error('expected ok');
    const again = await service.retry(first.record.requestId);
    expect(again.status).toBe('invalid-input');
  });

  it('refuses to retry an unknown requestId', async () => {
    const { service } = makeService(async () => ({ status: 200, bodyText: OK_RESPONSE }));
    expect((await service.retry('ffffffff-0000-4000-8000-000000000000')).status).toBe('invalid-input');
  });
});
