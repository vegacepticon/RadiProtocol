import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { LIBRARY_SUBMISSION_CATEGORIES, derivePackageId, nextReleaseVersion, parseSemver } from '../../library/package-metadata';

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
});
