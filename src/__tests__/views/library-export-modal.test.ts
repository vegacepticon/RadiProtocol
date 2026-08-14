import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const modalSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-export-modal.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-export-modal — wiring guard', () => {
  it('exports LibraryExportModal with a Promise result + safeResolve double-guard', () => {
    expect(modalSrc).toContain('export class LibraryExportModal');
    expect(modalSrc).toContain('readonly result: Promise<');
    expect(modalSrc).toContain('safeResolve');
  });
  it('calls buildLocalPackage + writePackageExport on export', () => {
    expect(modalSrc).toContain('buildLocalPackage');
    expect(modalSrc).toContain('writePackageExport');
  });
  it('attaches FolderSuggest to the destination input', () => {
    expect(modalSrc).toContain('FolderSuggest');
  });
  it('surfaces the FR-7 collision warning (collisionWith)', () => {
    expect(modalSrc).toContain('collisionWith');
    expect(modalSrc).toContain('exportCollisionWarning');
  });
  it('disables Export when the destination file already exists (file-collision preflight)', () => {
    expect(modalSrc).toContain('hasFileCollision');
    expect(modalSrc).toContain('!this.hasFileCollision');
  });
  it('main.ts registers the export command + opens the modal via ProtocolPickerSuggestModal', () => {
    expect(mainSrc).toContain("id: 'export-protocol-as-library-package'");
    expect(mainSrc).toContain('LibraryExportModal');
    expect(mainSrc).toContain('ProtocolPickerSuggestModal');
  });
  it('en/ru export key parity (Check 7)', () => {
    for (const key of ['exportTitle', 'exportDestination', 'exportLabel', 'exportedNotice', 'exportError', 'exportCollisionFile', 'exportCollisionWarning']) {
      expect(enSrc).toContain(`"${key}"`);
      expect(ruSrc).toContain(`"${key}"`);
    }
  });
});
