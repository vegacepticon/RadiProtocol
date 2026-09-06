// Stage D — SubmissionStore tests: per-file persistence, list isolation,
// identity guard, explicit read errors (mirrors installed-record-store tests).
import { describe, expect, it, vi } from 'vitest';
import { SubmissionStore, submissionRecordPath } from '../../library/submission-store';
import { LibraryStoreError } from '../../library/library-model';
import { SUBMISSION_RECORD_SCHEMA, SUBMISSION_RECORD_VERSION, type SubmissionRecord } from '../../library/submission-model';

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
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

let counter = 0;
function makeRecord(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  counter += 1;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  return {
    schema: SUBMISSION_RECORD_SCHEMA,
    version: SUBMISSION_RECORD_VERSION,
    requestId: id,
    createdAt: '2026-09-06T12:00:00.000Z',
    updatedAt: '2026-09-06T12:00:00.000Z',
    state: 'draft',
    digest: 'a'.repeat(64),
    registryKey: 'https://library.radiprotocol.pro',
    sourceDocumentId: 'doc-1',
    sourceProtocolPath: 'Protocols/test.rp.json',
    packageId: 'test-pkg',
    releaseVersion: '1.0.0',
    payload: {
      requestId: id,
      release: { manifest: {} },
      meta: { requestId: id, title: 't', description: '', categories: ['chest'], authorDisplayName: '', publicSharingConfirmed: true, rightsConfirmed: true },
    },
    receipt: null,
    lastError: null,
    ...overrides,
  };
}

describe('SubmissionStore', () => {
  it('round-trips a record through write/read', async () => {
    const { vault } = makeVault();
    const store = new SubmissionStore(makeApp(vault) as never);
    const record = makeRecord();
    await store.write(record);
    const read = await store.read(record.requestId);
    expect(read).not.toBeNull();
    expect(read?.packageId).toBe('test-pkg');
    expect(read?.payload.meta.title).toBe('t');
  });

  it('read returns null for a missing record (no such attempt)', async () => {
    const store = new SubmissionStore(makeApp(makeVault().vault) as never);
    expect(await store.read('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('read throws LibraryStoreError on corrupt JSON (a receipt must never vanish silently)', async () => {
    const { vault, files } = makeVault();
    const store = new SubmissionStore(makeApp(vault) as never);
    const record = makeRecord();
    await store.write(record);
    files[submissionRecordPath(record.requestId)] = '{not json';
    await expect(store.read(record.requestId)).rejects.toBeInstanceOf(LibraryStoreError);
  });

  it('read throws on identity mismatch (path expects X, record carries Y)', async () => {
    const { vault, files } = makeVault();
    const store = new SubmissionStore(makeApp(vault) as never);
    const record = makeRecord();
    await store.write(record);
    const other = makeRecord();
    files[submissionRecordPath(record.requestId)] = JSON.stringify(other);
    await expect(store.read(record.requestId)).rejects.toBeInstanceOf(LibraryStoreError);
  });

  it('list is newest-first and skips corrupt/wrong-schema files', async () => {
    const { vault, files } = makeVault();
    const store = new SubmissionStore(makeApp(vault) as never);
    const older = makeRecord({ createdAt: '2026-09-06T10:00:00.000Z' });
    const newer = makeRecord({ createdAt: '2026-09-06T11:00:00.000Z' });
    await store.write(older);
    await store.write(newer);
    files[submissionRecordPath('ffffffff-0000-4000-8000-000000000000')] = '{corrupt';
    files[submissionRecordPath('eeeeeeee-0000-4000-8000-000000000000')] = '{"schema":"nope"}';
    const list = await store.list();
    expect(list.map((r) => r.requestId)).toEqual([newer.requestId, older.requestId]);
  });

  it('list returns [] when the submissions dir does not exist', async () => {
    const store = new SubmissionStore(makeApp(makeVault().vault) as never);
    expect(await store.list()).toEqual([]);
  });

  it('delete removes the record; deleting a missing record is a no-op', async () => {
    const { vault, files } = makeVault();
    const store = new SubmissionStore(makeApp(vault) as never);
    const record = makeRecord();
    await store.write(record);
    await store.delete(record.requestId);
    expect(files[submissionRecordPath(record.requestId)]).toBeUndefined();
    await expect(store.delete(record.requestId)).resolves.toBeUndefined();
  });
});
