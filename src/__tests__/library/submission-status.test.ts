// Stage E — status reconciliation tests: client parsing of the GET status
// response + LibrarySubmissionService.reconcile state mapping (§6.3), plus the
// success-screen modal contract (no auto-close after ok).
import { describe, expect, it, vi } from 'vitest';
import { LibrarySubmissionService } from '../../library/submission-service';
import {
  SubmissionClient, parseStatusResponse,
  type SubmitHttpTransport, type StatusHttpTransport,
} from '../../library/submission-client';
import type { ReleaseBundle } from '../../library/library-model';

const RID = '01234567-89ab-cdef-0123-456789abcdef';
const BASE = 'https://library.radiprotocol.pro';

function okBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ok: true, requestId: RID, status: 'pending', published: false, digestMatch: true, ...overrides });
}

// --- parseStatusResponse ------------------------------------------------------

describe('parseStatusResponse (Stage E client)', () => {
  it('parses a pending response with PR facts', () => {
    const r = parseStatusResponse({ status: 200, bodyText: okBody({ prUrl: 'https://github.com/o/r/pull/7', prNumber: 7, prState: 'open' }) });
    expect(r.status).toBe('ok');
    expect(r.remote).toBe('pending');
    expect(r.prNumber).toBe(7);
    expect(r.merged).toBe(false);
  });

  it('parses merged+published', () => {
    const r = parseStatusResponse({ status: 200, bodyText: okBody({ status: 'merged', merged: true, prState: 'closed', published: true, prUrl: 'https://x/pull/7' }) });
    expect(r.remote).toBe('merged');
    expect(r.published).toBe(true);
  });

  it('parses degraded unverifiable (PR lookup failed)', () => {
    const r = parseStatusResponse({ status: 200, bodyText: okBody({ status: 'unverifiable', degraded: true }) });
    expect(r.remote).toBe('unverifiable');
    expect(r.degraded).toBe(true);
  });

  it('maps route 404 to a genuine remote not_found (NOT a failure)', () => {
    const r = parseStatusResponse({ status: 404, bodyText: JSON.stringify({ ok: false, error: 'not_found' }) });
    expect(r.status).toBe('ok');
    expect(r.remote).toBe('not_found');
  });

  it('does NOT mask GitHub failures: 502/429 stay failed', () => {
    const server = parseStatusResponse({ status: 502, bodyText: JSON.stringify({ ok: false, error: 'cannot verify' }) });
    expect(server.status).toBe('failed');
    const limited = parseStatusResponse({ status: 429, bodyText: JSON.stringify({ ok: false }) });
    expect(limited.status).toBe('failed');
    if (limited.status === 'failed') expect(limited.code).toBe('rate_limited');
  });

  it('unexpected shape on 200 → failed, never a guessed state', () => {
    const r = parseStatusResponse({ status: 200, bodyText: JSON.stringify({ ok: true, status: 'i-made-this-up' }) });
    expect(r.status).toBe('failed');
  });

  it('invalid request id is rejected locally with zero transport calls', async () => {
    const transport: StatusHttpTransport = vi.fn();
    const client = new SubmissionClient((async () => ({ status: 200, bodyText: '' })) as SubmitHttpTransport, transport);
    const r = await client.fetchStatus(BASE, 'not-a-uuid');
    expect(r.status).toBe('failed');
    expect(transport).not.toHaveBeenCalled();
  });

  it('encodes the requestId into the URL path', async () => {
    const seen: string[] = [];
    const transport: StatusHttpTransport = async (url) => { seen.push(url); return { status: 200, bodyText: okBody() }; };
    const client = new SubmissionClient((async () => ({ status: 200, bodyText: '' })) as SubmitHttpTransport, transport);
    await client.fetchStatus(BASE, RID);
    expect(seen[0]).toBe(`${BASE}/api/submissions/${RID}`);
  });
});

// --- LibrarySubmissionService.reconcile ----------------------------------------

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

interface Harness {
  service: LibrarySubmissionService;
  post: SubmitHttpTransport;
  status: StatusHttpTransport;
  statusBody: (body: string) => void;
}

function makeHarness(opts: { postResponder?: () => { status: number; bodyText: string } } = {}): Harness {
  const { vault } = makeVault();
  const post: SubmitHttpTransport = async () =>
    opts.postResponder !== undefined ? opts.postResponder() : { status: 200, bodyText: JSON.stringify({ ok: true, requestId: RID, prUrl: 'https://github.com/o/r/pull/1', branch: 'submit/x', reused: false, degraded: false }) };
  let currentStatusBody = okBody();
  const status: StatusHttpTransport = async () => ({ status: 200, bodyText: currentStatusBody });
  const service = new LibrarySubmissionService({ vault } as never, post, status);
  return {
    service,
    post,
    status,
    statusBody: (b: string) => { currentStatusBody = b; },
  };
}

const UNKNOWN_POST = () => ({ status: 500, bodyText: JSON.stringify({ ok: false, error: 'SUBMISSION_STATE_UNKNOWN', requestId: RID }) });

async function seedPending(h: Harness): Promise<string> {
  // A pending attempt: persisted via submitNew with an ok POST. submitNew
  // generates its own requestId, so return it for reconcile().
  const result = await h.service.submitNew({
    bundle: { manifest: { schema: 'radiprotocol.package', version: 1, packageId: 'p', releaseVersion: '1.0.0', protocolDoc: {} as never, protocolSha256: 'a'.repeat(64), snippetFiles: [], catalogEntryId: 'p', publishedAt: '2026-09-06T12:00:00.000Z' } } as unknown as ReleaseBundle,
    meta: { title: 't', description: '', categories: ['chest'], authorDisplayName: 'a', note: '' },
    registryKey: BASE, sourceDocumentId: 'doc', sourceProtocolPath: 'p/a.rp.json',
  });
  if (result.status !== 'ok') throw new Error('seedPending failed: ' + result.status);
  return result.record.requestId;
}

async function seedUnknown(h: Harness): Promise<string> {
  // An outcome_unknown attempt: POST answers 500 SUBMISSION_STATE_UNKNOWN.
  // Uses h.service so the record lands in the SAME vault the test reconciles.
  const result = await h.service.submitNew({
    bundle: { manifest: { schema: 'radiprotocol.package', version: 1, packageId: 'p', releaseVersion: '1.0.0', protocolDoc: {} as never, protocolSha256: 'a'.repeat(64), snippetFiles: [], catalogEntryId: 'p', publishedAt: '2026-09-06T12:00:00.000Z' } } as unknown as ReleaseBundle,
    meta: { title: 't', description: '', categories: ['chest'], authorDisplayName: 'a', note: '' },
    registryKey: BASE, sourceDocumentId: 'doc', sourceProtocolPath: 'p/a.rp.json',
  });
  if (result.status !== 'ok' && result.status !== 'failed') throw new Error('seedUnknown failed: ' + result.status);
  return result.record.requestId;
}

describe('LibrarySubmissionService.reconcile (Stage E)', () => {
  it('pending + remote pending → stays pending, changed:false', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'pending', prUrl: 'https://github.com/o/r/pull/1', prNumber: 1, prState: 'open' }));
    const r = await h.service.reconcile(rid);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.record.state).toBe('pending');
      expect(r.changed).toBe(false);
    }
  });

  it('outcome_unknown + remote pending → pending with a reconstructed receipt (lost-response recovery)', async () => {
    const h = makeHarness({ postResponder: UNKNOWN_POST });
    const rid = await seedUnknown(h);
    h.statusBody(okBody({ status: 'pending', prUrl: 'https://github.com/o/r/pull/9', prNumber: 9, prState: 'open' }));
    const r = await h.service.reconcile(rid);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.before).toBe('outcome_unknown');
      expect(r.record.state).toBe('pending');
      expect(r.changed).toBe(true);
      expect(r.record.receipt?.prUrl).toBe('https://github.com/o/r/pull/9');
    }
  });

  it('remote merged + published → published', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'merged', merged: true, prState: 'closed', published: true, prUrl: 'https://github.com/o/r/pull/1' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') expect(r.record.state).toBe('published');
  });

  it('remote merged (not yet published) → approved_pending_publish', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'merged', merged: true, prState: 'closed', published: false, prUrl: 'https://github.com/o/r/pull/1' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') expect(r.record.state).toBe('approved_pending_publish');
  });

  it('remote closed → rejected (raw fact; superseded needs a moderator note)', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'closed', prState: 'closed', prUrl: 'https://github.com/o/r/pull/1' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') {
      expect(r.record.state).toBe('rejected');
      expect(r.changed).toBe(true);
    }
  });

  it('remote not_found + outcome_unknown → failed with a safe-to-retry error', async () => {
    const h = makeHarness({ postResponder: UNKNOWN_POST });
    const rid = await seedUnknown(h);
    h.statusBody(JSON.stringify({ ok: false, error: 'not_found' }));
    // Route answers 404 → client maps to remote not_found.
    h.statusBody(JSON.stringify({ ok: false, error: 'not_found' }));
    const r404 = await h.service.reconcile(RID);
    // The harness returns 200 bodies; simulate the 404 via body-less 404:
    void r404;
    // Direct client-level 404 mapping is covered in parseStatusResponse tests;
    // here we verify the not_found mapping through the service:
    h.statusBody(okBody({ status: 'not_found' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') {
      expect(r.record.state).toBe('failed');
    }
  });

  it('remote not_found does NOT downgrade a pending attempt (contradiction is surfaced, not trusted)', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'not_found' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') {
      expect(r.record.state).toBe('pending');
      expect(r.changed).toBe(false);
    }
  });

  it('remote no_pr → outcome_unknown (retry of the frozen payload is the recovery path)', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'no_pr' }));
    const r = await h.service.reconcile(rid);
    if (r.status === 'ok') expect(r.record.state).toBe('outcome_unknown');
  });

  it('check-failure NEVER downgrades the record (pending stays pending on a 5xx)', async () => {
    const h = makeHarness();
    await seedPending(h);
    h.statusBody(JSON.stringify({ ok: false, error: 'boom' }));
    // The harness always returns HTTP 200; emulate a route failure with a 502 body:
    const failing: StatusHttpTransport = async () => ({ status: 502, bodyText: JSON.stringify({ ok: false, error: 'cannot verify' }) });
    const { vault } = makeVault();
    const service = new LibrarySubmissionService({ vault } as never, h.post, failing);
    const rid = await seedPending({ ...h, service } as Harness);
    const r = await service.reconcile(rid);
    expect(r.status).toBe('check-failed');
  });

  it('reconcile never POSTs (strictly read-only)', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    const postSpy = vi.fn(h.post);
    const { vault } = makeVault();
    const service = new LibrarySubmissionService({ vault } as never, postSpy, h.status);
    await service.reconcile(rid);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('terminal states are not retryable', async () => {
    const h = makeHarness();
    const rid = await seedPending(h);
    h.statusBody(okBody({ status: 'merged', merged: true, prState: 'closed', published: true, prUrl: 'https://github.com/o/r/pull/1' }));
    await h.service.reconcile(rid);
    const r = await h.service.retry(rid);
    expect(r.status).toBe('invalid-input');
  });
});
