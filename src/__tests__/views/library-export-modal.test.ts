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

  // Simplified UX (2026-08-23): metadata is derived, not typed.
  it('derives package identity automatically instead of manual fields', () => {
    expect(modalSrc).toContain('derivePackageId');
    expect(modalSrc).toContain('nextReleaseVersion');
    expect(modalSrc).not.toContain('radi-library-export-pkgid');
    expect(modalSrc).not.toContain('radi-library-export-version');
    expect(modalSrc).not.toContain('radi-library-export-name');
  });
  it('shows the derived id/version as a read-only summary line', () => {
    expect(modalSrc).toContain('exportSummaryIdentity');
  });
  it('suggests +0.0.1 from remembered submissions in settings', () => {
    expect(modalSrc).toContain('libraryLastSubmittedVersions');
    expect(modalSrc).toContain('rememberSubmittedVersion');
  });
  it('defaults the export folder to the last used one', () => {
    expect(modalSrc).toContain('libraryLastExportFolder');
  });
  it('splits the modal into labeled local-export vs submit-to-library sections', () => {
    expect(modalSrc).toContain('exportLocalSection');
    expect(modalSrc).toContain('exportSubmitSection');
    expect(modalSrc).toContain('exportLocalHint');
    expect(modalSrc).toContain('exportSubmitHint');
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
