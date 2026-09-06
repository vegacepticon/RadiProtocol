import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { LIBRARY_SUBMISSION_CATEGORIES, derivePackageId, nextReleaseVersion, parseSemver, submissionBindingKey, stableIdSuffix, resolveSubmissionIdentity } from '../../library/package-metadata';

const en = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8'),
) as { library: Record<string, string> };
const ru = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8'),
) as { library: Record<string, string> };

describe('package-metadata', () => {
  describe('LIBRARY_SUBMISSION_CATEGORIES (fixed taxonomy)', () => {
    it('is a non-empty list of stable string ids', () => {
      expect(LIBRARY_SUBMISSION_CATEGORIES.length).toBeGreaterThan(0);
      for (const c of LIBRARY_SUBMISSION_CATEGORIES) expect(typeof c).toBe('string');
    });

    it('contains the ten approved anatomic categories', () => {
      expect([...LIBRARY_SUBMISSION_CATEGORIES]).toEqual([
        'brain', 'neck', 'cervical-spine', 'chest', 'thoracic-spine',
        'abdomen-retroperitoneum', 'pelvis', 'lumbosacral-spine',
        'upper-extremities', 'lower-extremities',
      ]);
    });
  });

  describe('derivePackageId', () => {
    it('derives from the protocol title (Cyrillic preserved)', () => {
      expect(derivePackageId('КТ грудной клетки')).toBe('кт-грудной-клетки');
    });

    it('falls back to "protocol" when the title slugifies to empty', () => {
      expect(derivePackageId('!!!')).toBe('protocol');
    });
  });

  describe('nextReleaseVersion', () => {
    it('returns 1.0.0 when no previous version exists', () => {
      expect(nextReleaseVersion(undefined)).toBe('1.0.0');
    });

    it('increments the patch component', () => {
      expect(nextReleaseVersion('1.2.3')).toBe('1.2.4');
      expect(nextReleaseVersion('0.9.9')).toBe('0.9.10');
    });

    it('treats unparseable previous versions as fresh packages', () => {
      expect(nextReleaseVersion('garbage')).toBe('1.0.0');
      expect(nextReleaseVersion('1.2')).toBe('1.0.0');
    });
  });

  describe('parseSemver', () => {
    it('parses strict major.minor.patch and rejects the rest', () => {
      expect(parseSemver('1.22.3')).toEqual({ major: 1, minor: 22, patch: 3 });
      expect(parseSemver('v1.0.0')).toBeNull();
      expect(parseSemver('')).toBeNull();
    });
  });

  describe('i18n category labels', () => {
    it('every taxonomy id has localized labels in both locales', () => {
      for (const c of LIBRARY_SUBMISSION_CATEGORIES) {
        const key = `category.${c}`;
        expect(en.library[key]?.length ?? 0).toBeGreaterThan(0);
        expect(ru.library[key]?.length ?? 0).toBeGreaterThan(0);
      }
    });
  });

  describe('submissionBindingKey (Stage D)', () => {
    it('combines registry key and document id with a | separator', () => {
      expect(submissionBindingKey('https://library.radiprotocol.pro', 'doc-1'))
        .toBe('https://library.radiprotocol.pro|doc-1');
    });
    it('normalizes trailing slashes on the registry key', () => {
      expect(submissionBindingKey('https://x.test/', 'd')).toBe('https://x.test|d');
    });
  });

  describe('stableIdSuffix (Stage D)', () => {
    it('is deterministic for the same seed and differs across seeds', async () => {
      const a1 = await stableIdSuffix('https://x.test|doc-1');
      const a2 = await stableIdSuffix('https://x.test|doc-1');
      const b = await stableIdSuffix('https://x.test|doc-2');
      expect(a1).toBe(a2);
      expect(a1).not.toBe(b);
      expect(a1).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('resolveSubmissionIdentity (Stage D)', () => {
    it('a saved binding wins: packageId reused, version = next patch after accepted', () => {
      const id = resolveSubmissionIdentity({
        boundPackageId: 'bound-pkg', boundLastAcceptedVersion: '2.3.0',
        titleSlug: 'переименованный-протокол', suffix: 'deadbeef',
      });
      expect(id).toEqual({ packageId: 'bound-pkg', isNew: false, suggestedVersion: '2.3.1' });
    });
    it('a new package gets slug + stable suffix (two authors with the same title do not collide)', () => {
      const id = resolveSubmissionIdentity({ titleSlug: 'КТ головного мозга', suffix: 'abc12345' });
      expect(id.packageId).toBe(`${derivePackageId('КТ головного мозга')}-abc12345`);
      expect(id.isNew).toBe(true);
      expect(id.suggestedVersion).toBe('1.0.0');
    });
    it('legacy advisory version suggests a newer version WITHOUT binding identity', () => {
      const id = resolveSubmissionIdentity({ titleSlug: 'x', suffix: 'abc12345', legacyLastSubmitted: '3.1.4' });
      expect(id.isNew).toBe(true);
      expect(id.suggestedVersion).toBe('3.1.5');
      expect(id.packageId).toContain('-abc12345');
    });
    it('title change does NOT change a bound packageId (rename must not fork the package)', () => {
      const before = resolveSubmissionIdentity({ boundPackageId: 'p-abc12345', titleSlug: 'old title', suffix: 'abc12345' });
      const after = resolveSubmissionIdentity({ boundPackageId: 'p-abc12345', titleSlug: 'совершенно новое название', suffix: 'abc12345' });
      expect(before.packageId).toBe(after.packageId);
    });
  });
});
