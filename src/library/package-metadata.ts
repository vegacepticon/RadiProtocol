// src/library/package-metadata.ts
// Pure helpers for the library export/submit flow: the fixed submission
// category taxonomy (checkbox list in the submit modal; ids are stable API
// values, labels are localized via i18n keys `library.category.<id>`), and
// automatic package metadata derivation (packageId from the protocol title,
// next release version from settings bookkeeping, export file name).
// Zero Obsidian imports — fully unit-testable.

import { slugifyLabel } from '../snippets/snippet-model';

/** Stable category ids sent to the registry (`meta.categories`). Order is the
 *  display order of the checkbox list. Extend here — the UI renders whatever
 *  this array contains. */
export const LIBRARY_SUBMISSION_CATEGORIES: readonly string[] = [
  'brain',
  'neck',
  'cervical-spine',
  'chest',
  'thoracic-spine',
  'abdomen-retroperitoneum',
  'pelvis',
  'lumbosacral-spine',
  'upper-extremities',
  'lower-extremities',
];

/**
 * Derive a packageId from a protocol title: slugified (Unicode-aware, Cyrillic
 * preserved), non-empty fallback for titles that slugify to nothing (e.g. pure
 * punctuation). The installer's validPackageSlug requires a non-empty slug.
 */
export function derivePackageId(protocolTitle: string): string {
  const slug = slugifyLabel(protocolTitle);
  return slug === '' ? 'protocol' : slug;
}

/** Parse "major.minor.patch"; returns null for anything else. */
export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (m === null) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * Next patch version after `previous`. Unparseable/absent previous → '1.0.0'
 * (fresh package). Never decrements.
 */
export function nextReleaseVersion(previous: string | undefined): string {
  const parsed = previous === undefined ? null : parseSemver(previous);
  if (parsed === null) return '1.0.0';
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/** Export file name: `<packageId>-<version>.json` (both slug-safe). */
export function exportFileName(packageId: string, version: string): string {
  return `${slugifyLabel(packageId)}-${slugifyLabel(version)}.json`;
}
