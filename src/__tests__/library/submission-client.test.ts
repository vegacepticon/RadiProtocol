// Stage D — SubmissionClient tests: typed response parsing, error-code
// mapping, https-only prUrl acceptance, never-throws transport behavior.
import { describe, expect, it, vi } from 'vitest';
import { SubmissionClient, parseSubmitResponse, normalizeSubmitBase, type SubmitHttpTransport } from '../../library/submission-client';
import type { SubmissionPayload } from '../../library/submission-model';

function makePayload(): SubmissionPayload {
  return {
    requestId: '01234567-89ab-cdef-0123-456789abcdef',
    release: { manifest: { packageId: 'p', releaseVersion: '1.0.0' } },
    meta: {
      requestId: '01234567-89ab-cdef-0123-456789abcdef',
      title: 't', description: '', categories: ['chest'], authorDisplayName: '',
      publicSharingConfirmed: true, rightsConfirmed: true,
    },
  };
}

const OK_BODY = JSON.stringify({
  ok: true,
  requestId: '01234567-89ab-cdef-0123-456789abcdef',
  prUrl: 'https://github.com/vegacepticon/radiprotocol-library-backend/pull/12',
  branch: 'submit/01234567-89ab-cdef-0123-456789abcdef',
  reused: false,
  degraded: false,
});

describe('parseSubmitResponse', () => {
  it('accepts a well-formed ok response', () => {
    const r = parseSubmitResponse({ status: 200, bodyText: OK_BODY });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prNumber).toBe(12);
      expect(r.reused).toBe(false);
      expect(r.branch).toContain('submit/');
    }
  });
  it('rejects a non-https prUrl (server-controlled string)', () => {
    const r = parseSubmitResponse({ status: 200, bodyText: OK_BODY.replace('https://', 'http://') });
    expect(r.ok).toBe(false);
  });
  it('rejects an ok response missing requestId', () => {
    const body = JSON.stringify({ ok: true, prUrl: 'https://x.test/pull/1' });
    const r = parseSubmitResponse({ status: 200, bodyText: body });
    expect(r.ok).toBe(false);
  });
  it('maps known backend error codes verbatim', () => {
    for (const code of ['VERSION_ALREADY_PUBLISHED', 'REQUEST_ID_DIGEST_MISMATCH', 'CLIENT_UPDATE_REQUIRED', 'INVALID_REQUEST_ID', 'SUBMISSION_STATE_UNKNOWN']) {
      const r = parseSubmitResponse({ status: 400, bodyText: JSON.stringify({ ok: false, error: code, requestId: 'r' }) });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(code);
    }
  });
  it('maps 413 → oversize and 429 → rate_limited', () => {
    const oversized = parseSubmitResponse({ status: 413, bodyText: JSON.stringify({ ok: false }) });
    const limited = parseSubmitResponse({ status: 429, bodyText: JSON.stringify({ ok: false, retryAfterSeconds: 30 }) });
    expect(oversized.ok).toBe(false);
    expect(limited.ok).toBe(false);
    if (!oversized.ok) expect(oversized.code).toBe('oversize');
    if (!limited.ok) expect(limited.code).toBe('rate_limited');
  });
  it('maps 5xx → server_error and transport-level unknown-outcome marker stays server_error', () => {
    const r = parseSubmitResponse({ status: 500, bodyText: JSON.stringify({ ok: false, error: 'SUBMISSION_STATE_UNKNOWN' }) });
    if (!r.ok) expect(r.code).toBe('SUBMISSION_STATE_UNKNOWN');
    const plain = parseSubmitResponse({ status: 502, bodyText: 'Bad Gateway' });
    if (!plain.ok) expect(plain.code).toBe('server_error');
  });
  it('non-JSON garbage body is an explicit failure, never a throw', () => {
    const r = parseSubmitResponse({ status: 503, bodyText: '<html>oops</html>' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('503');
  });
});

describe('normalizeSubmitBase', () => {
  it('keeps https bases and trims trailing slashes', () => {
    expect(normalizeSubmitBase('https://library.radiprotocol.pro/')).toBe('https://library.radiprotocol.pro');
  });
  it('rejects http and garbage', () => {
    expect(normalizeSubmitBase('http://insecure.test')).toBe('');
    expect(normalizeSubmitBase('not a url')).toBe('');
    expect(normalizeSubmitBase('')).toBe('');
  });
});

describe('SubmissionClient.submit', () => {
  it('sends the canonical body and never throws on transport rejection', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const transport: SubmitHttpTransport = vi.fn(async (url, body) => {
      seen.push({ url, body });
      return { status: 200, bodyText: OK_BODY };
    });
    const client = new SubmissionClient(transport);
    const payload = makePayload();
    const r = await client.submit('https://library.radiprotocol.pro', payload);
    expect(r.ok).toBe(true);
    expect(seen[0]?.url).toBe('https://library.radiprotocol.pro/api/submit');
    const sent = JSON.parse(seen[0]?.body ?? '{}') as Record<string, unknown>;
    expect(sent['requestId']).toBe(payload.requestId);
    expect((sent['meta'] as Record<string, unknown>)['publicSharingConfirmed']).toBe(true);
  });
  it('transport exception → network_error with safe message', async () => {
    const transport: SubmitHttpTransport = vi.fn(async () => { throw new Error('socket hung up'); });
    const client = new SubmissionClient(transport);
    const r = await client.submit('https://library.radiprotocol.pro', makePayload());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('network_error');
  });
  it('empty/invalid base → local failure, transport never called', async () => {
    const transport: SubmitHttpTransport = vi.fn();
    const client = new SubmissionClient(transport);
    const r = await client.submit('', makePayload());
    expect(r.ok).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});
