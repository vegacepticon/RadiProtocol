import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const submitSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-submit-modal.ts'), 'utf8');
const exportSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-export-modal.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-submit-modal — wiring guard (Variant B)', () => {
  it('exports LibrarySubmitModal with a Promise result + safeResolve double-guard', () => {
    expect(submitSrc).toContain('export class LibrarySubmitModal');
    expect(submitSrc).toContain('readonly result: Promise<');
    expect(submitSrc).toContain('safeResolve');
  });

  it('POSTs { release, meta } to <registry>/api/submit via the injected transport', () => {
    expect(submitSrc).toContain('/api/submit');
    expect(submitSrc).toContain('release: this.bundle');
    expect(submitSrc).toContain('transport ?? requestUrlSubmitTransport');
  });

  it('normalizes the registry base URL and treats empty as unavailable', () => {
    expect(submitSrc).toContain('normalizeRegistryUrl(this.options.registryBaseUrl)');
    expect(submitSrc).toContain('endpointAvailable()');
  });

  it('shows the public-registry patient-data warning before upload', () => {
    expect(submitSrc).toContain('library.submitWarning');
  });

  it('resolves success only on HTTP 200 + ok:true + prUrl; surfaces explicit errors otherwise', () => {
    expect(submitSrc).toContain('parsed.ok === true');
    expect(submitSrc).toContain('library.submitError');
    expect(submitSrc).not.toContain('throw new Error'); // explicit results, never throws
  });

  it('the export modal opens the submit modal with a freshly built bundle', () => {
    expect(exportSrc).toContain('handleSubmitToCommunity');
    expect(exportSrc).toContain('new LibrarySubmitModal');
    expect(exportSrc).toContain('buildLocalPackage');
  });

  it('categories are a fixed checkbox taxonomy (one or more), not free text', () => {
    expect(submitSrc).toContain('LIBRARY_SUBMISSION_CATEGORIES');
    expect(submitSrc).toContain("type: 'checkbox'");
    expect(submitSrc).toContain('canSubmit()');
    // The payload filters the fixed taxonomy by selection — no comma splitting.
    expect(submitSrc).toContain("LIBRARY_SUBMISSION_CATEGORIES.filter((c) => this.selectedCategories.has(c))");
    expect(submitSrc).not.toContain(".split(',')");
  });

  it('en/ru submit key parity (15 keys)', () => {
    const en = JSON.parse(enSrc).library as Record<string, string>;
    const ru = JSON.parse(ruSrc).library as Record<string, string>;
    const keys = Object.keys(en).filter((k) => k.startsWith('submit'));
    expect(keys.length).toBe(15);
    for (const k of keys) {
      expect(typeof ru[k]).toBe('string');
      expect(ru[k]!.length).toBeGreaterThan(0);
    }
  });
});
