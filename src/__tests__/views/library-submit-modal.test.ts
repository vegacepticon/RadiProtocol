import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const submitSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-submit-modal.ts'), 'utf8');
const exportSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-export-modal.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-submit-modal — wiring guard (Stage D)', () => {
  it('exports LibrarySubmitModal with a Promise result + safeResolve double-guard', () => {
    expect(submitSrc).toContain('export class LibrarySubmitModal');
    expect(submitSrc).toContain('readonly result: Promise<');
    expect(submitSrc).toContain('safeResolve');
  });

  it('delegates the POST to LibrarySubmissionService (persist-before-POST), not a bare transport', () => {
    expect(submitSrc).toContain('LibrarySubmissionService');
    expect(submitSrc).toContain('submitNew(');
    // The modal itself must no longer own the wire payload or transport.
    expect(submitSrc).not.toContain('release: this.bundle');
  });

  it('normalizes the registry base URL and treats empty as unavailable', () => {
    expect(submitSrc).toContain('normalizeRegistryUrl(this.options.registryBaseUrl)');
    expect(submitSrc).toContain('endpointAvailable()');
  });

  it('shows the public-registry patient-data warning before upload', () => {
    expect(submitSrc).toContain('library.submitWarning');
  });

  it('requires BOTH consent checkboxes before any POST (no silent consent)', () => {
    expect(submitSrc).toContain('library.submitConsentPublic');
    expect(submitSrc).toContain('library.submitConsentRights');
    expect(submitSrc).toContain('this.publicConfirmed && this.rightsConfirmed');
    expect(submitSrc).toContain('postStarted');
  });

  it('resolves success only via the service outcome; typed errors surfaced otherwise', () => {
    expect(submitSrc).toContain('library.submitError');
    expect(submitSrc).toContain('SUBMISSION_STATE_UNKNOWN');
    expect(submitSrc).not.toContain('throw new Error'); // explicit results, never throws
  });

  it('the export modal opens the submit modal with source identity and applies the binding on ok', () => {
    expect(exportSrc).toContain('handleSubmitToCommunity');
    expect(exportSrc).toContain('new LibrarySubmitModal');
    expect(exportSrc).toContain('buildLocalPackage');
    expect(exportSrc).toContain('sourceDocumentId');
    expect(exportSrc).toContain('rememberSubmission');
  });

  it('categories are a fixed checkbox taxonomy (one or more), not free text', () => {
    expect(submitSrc).toContain('LIBRARY_SUBMISSION_CATEGORIES');
    expect(submitSrc).toContain("type: 'checkbox'");
    expect(submitSrc).toContain('canSubmit()');
    // The payload filters the fixed taxonomy by selection — no comma splitting.
    expect(submitSrc).toContain("LIBRARY_SUBMISSION_CATEGORIES.filter((c) => this.selectedCategories.has(c))");
    expect(submitSrc).not.toContain(".split(',')");
  });

  it('en/ru submit key parity (24 keys: 15 legacy + 9 Stage D)', () => {
    const en = JSON.parse(enSrc).library as Record<string, string>;
    const ru = JSON.parse(ruSrc).library as Record<string, string>;
    const keys = Object.keys(en).filter((k) => k.startsWith('submit'));
    expect(keys.length).toBe(24);
    for (const k of keys) {
      expect(typeof ru[k]).toBe('string');
      expect(ru[k]!.length).toBeGreaterThan(0);
    }
  });

  it('Stage D error-code keys exist in both locales', () => {
    const en = JSON.parse(enSrc).library as Record<string, string>;
    const ru = JSON.parse(ruSrc).library as Record<string, string>;
    for (const k of ['submitConsentPublic', 'submitConsentRights', 'submitErrClientUpdate', 'submitErrVersionPublished', 'submitErrDigestMismatch', 'submitErrStateUnknown', 'submitErrRateLimited', 'submitErrOversize', 'submitErrNetwork']) {
      expect(en[k]?.length ?? 0).toBeGreaterThan(0);
      expect(ru[k]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
