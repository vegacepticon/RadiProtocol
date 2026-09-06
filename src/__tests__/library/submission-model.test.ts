// Stage D — pure submission model tests: record guard, requestId generation,
// request digest stability, canonical payload form.
import { describe, expect, it } from 'vitest';
import {
  SUBMISSION_RECORD_SCHEMA, SUBMISSION_RECORD_VERSION,
  isSubmissionRecord, isRequestUuid, generateRequestId, requestDigest,
  canonicalPayloadJson, type SubmissionRecord, type SubmissionPayload,
} from '../../library/submission-model';

function makePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    requestId: '01234567-89ab-cdef-0123-456789abcdef',
    release: { manifest: { packageId: 'test-pkg', releaseVersion: '1.0.0' } },
    meta: {
      title: 'Тест КТ',
      description: 'desc',
      categories: ['chest'],
      authorDisplayName: 'Автор',
      publicSharingConfirmed: true,
      rightsConfirmed: true,
      ...overrides.meta,
    },
    ...overrides,
  } as SubmissionPayload;
}

function makeRecord(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  return {
    schema: SUBMISSION_RECORD_SCHEMA,
    version: SUBMISSION_RECORD_VERSION,
    requestId: '01234567-89ab-cdef-0123-456789abcdef',
    createdAt: '2026-09-06T12:00:00.000Z',
    updatedAt: '2026-09-06T12:00:00.000Z',
    state: 'draft',
    digest: 'a'.repeat(64),
    registryKey: 'https://library.radiprotocol.pro',
    sourceDocumentId: 'doc-1',
    sourceProtocolPath: 'Protocols/test.rp.json',
    packageId: 'test-pkg',
    releaseVersion: '1.0.0',
    payload: makePayload(),
    receipt: null,
    lastError: null,
    ...overrides,
  };
}

describe('submission-model', () => {
  describe('isRequestUuid', () => {
    it('accepts canonical lowercase/uppercase hex uuid', () => {
      expect(isRequestUuid('01234567-89ab-cdef-0123-456789abcdef')).toBe(true);
      expect(isRequestUuid('01234567-89AB-CDEF-0123-456789ABCDEF')).toBe(true);
    });
    it('rejects malformed ids', () => {
      expect(isRequestUuid('')).toBe(false);
      expect(isRequestUuid('short')).toBe(false);
      expect(isRequestUuid('01234567-89ab-cdef-0123-456789abcde')).toBe(false);
      expect(isRequestUuid('01234567_89ab-cdef-0123-456789abcdef')).toBe(false);
    });
  });

  describe('generateRequestId', () => {
    it('produces valid uuid-shaped ids', () => {
      const id = generateRequestId();
      expect(isRequestUuid(id)).toBe(true);
    });
    it('produces unique ids across calls', () => {
      const seen = new Set(Array.from({ length: 50 }, () => generateRequestId()));
      expect(seen.size).toBe(50);
    });
  });

  describe('requestDigest + canonicalPayloadJson', () => {
    it('digest is stable for the same payload', async () => {
      const p = makePayload();
      expect(await requestDigest(p)).toBe(await requestDigest(structuredClone(p)));
    });
    it('digest changes when any payload part changes (frozen attempt semantics)', async () => {
      const base = await requestDigest(makePayload());
      expect(await requestDigest(makePayload({ meta: { title: 'Другой' } as never }))).not.toBe(base);
      expect(await requestDigest(makePayload({ requestId: 'ffffffff-0000-0000-0000-000000000000' }))).not.toBe(base);
    });
    it('canonical form is deterministic pretty JSON with trailing newline', () => {
      const p = makePayload();
      const json = canonicalPayloadJson(p);
      expect(json.endsWith('\n')).toBe(true);
      expect(json).toContain('"requestId": "01234567-89ab-cdef-0123-456789abcdef"');
      expect(json).toBe(JSON.stringify({ requestId: p.requestId, release: p.release, meta: p.meta }, null, 2) + '\n');
    });
  });

  describe('isSubmissionRecord', () => {
    it('accepts a valid record', () => {
      expect(isSubmissionRecord(makeRecord())).toBe(true);
    });
    it('rejects wrong schema/version', () => {
      expect(isSubmissionRecord({ ...makeRecord(), schema: 'other' })).toBe(false);
      expect(isSubmissionRecord({ ...makeRecord(), version: 2 })).toBe(false);
    });
    it('rejects empty identity strings', () => {
      expect(isSubmissionRecord({ ...makeRecord(), requestId: '' })).toBe(false);
      expect(isSubmissionRecord({ ...makeRecord(), packageId: '' })).toBe(false);
      expect(isSubmissionRecord({ ...makeRecord(), digest: '' })).toBe(false);
    });
    it('rejects unknown transport states', () => {
      expect(isSubmissionRecord({ ...makeRecord(), state: 'published' })).toBe(false);
      expect(isSubmissionRecord({ ...makeRecord(), state: 'weird' })).toBe(false);
    });
    it('rejects payload with consent flags not exactly true', () => {
      const r = makeRecord();
      const bad = structuredClone(r);
      (bad.payload.meta as unknown as Record<string, unknown>)['publicSharingConfirmed'] = false;
      expect(isSubmissionRecord(bad)).toBe(false);
    });
    it('rejects malformed receipt shapes', () => {
      expect(isSubmissionRecord({ ...makeRecord(), receipt: { prUrl: 'not-https-but-string' } as never })).toBe(false);
      expect(isSubmissionRecord({ ...makeRecord(), receipt: {} as never })).toBe(false);
    });
    it('accepts a record with a complete receipt and typed error null', () => {
      expect(isSubmissionRecord(makeRecord({
        state: 'pending',
        receipt: { prUrl: 'https://github.com/x/y/pull/1', prNumber: 1, branch: 'submit/abc', reused: false, degraded: false, receivedAt: '2026-09-06T12:00:01.000Z' },
      }))).toBe(true);
    });
  });
});
