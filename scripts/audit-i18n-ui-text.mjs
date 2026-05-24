#!/usr/bin/env node
// scripts/audit-i18n-ui-text.mjs
// Audits TypeScript UI code for likely hardcoded user-facing strings that
// should go through the i18n translator. Intentionally noisy filters are
// suppressed via known-allowlisted patterns and inline comment markers.
//
// Exit 0 if no violations found, exit 1 otherwise.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TARGET_DIRS = ['src/views', 'src/settings.ts'];

// Inline-comment patterns that mark a line as intentionally non-translated.
const ALLOW_COMMENT_PATTERNS = [
  /\/\/\s*User-authored content/i,
  /\/\/\s*Internal enum value/i,
  /\/\/\s*Non-translatable/i,
  /\/\/\s*Caller-supplied localized/i,
  /\/\/\s*Dynamic validation/i,
  /\/\/\s*pass-through localized/i,
  /\/\/\s*msg is pass-through/i,
];

// Regex for already-translated calls: t('...'), this.t('...'), etc.
const TRANSLATED_RE = /\b(?:this\.)?(?:plugin\.)?i18n\.t\(\s*['"`]/;

// Patterns that indicate a likely hardcoded user-facing string.
// Each entry is [labelRegex, description] — we check if the label regex is
// present on a line that is NOT already using i18n and NOT allowlisted.
const CHECK_PATTERNS = [
  [/\.setButtonText\(\s*'([^']+)'\s*\)/, 'setButtonText with string literal'],
  [/\.setPlaceholder\(\s*'([^']+)'\s*\)/, 'setPlaceholder with string literal'],
  [/\.textContent\s*=\s*'([^']+)'/, 'textContent with single-quoted string'],
  [/\.textContent\s*=\s*`([^`]+)`/, 'textContent with template literal'],
  [/\.innerText\s*=\s*'([^']+)'/, 'innerText with single-quoted string'],
  [/\.addOption\([^,]+,\s*'([^']+)'\s*\)/, 'addOption label with string literal'],
  [/new Notice\(\s*`/, 'Notice with template literal'],
  [/new Notice\(\s*'/, 'Notice with single-quoted string'],
];

// Filenames or paths to skip entirely (test mocks, generated files).
const SKIP_PATHS = [/__mocks__/, /\.test\.ts$/, /\.spec\.ts$/];

function collectFiles() {
  const files = [];
  for (const target of TARGET_DIRS) {
    const full = join(ROOT, target);
    if (statSync(full).isFile()) {
      files.push(full);
    } else {
      walkDir(full, files);
    }
  }
  return files;
}

function walkDir(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
}

function isAllowListed(line) {
  return ALLOW_COMMENT_PATTERNS.some(pat => pat.test(line));
}

function isTranslated(line) {
  return TRANSLATED_RE.test(line);
}

function audit() {
  const files = collectFiles();
  const violations = [];

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (SKIP_PATHS.some(p => p.test(rel))) continue;

    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip if the line is already i18n-translated.
      if (isTranslated(line)) continue;

      // Skip if the line has an allowlisting comment.
      if (isAllowListed(line)) continue;

      for (const [pattern, desc] of CHECK_PATTERNS) {
        if (pattern.test(line)) {
          // Extract the captured string for context.
          const match = line.match(pattern);
          const captured = match?.[1] ?? '';
          // Ignore empty strings and pure whitespace / punctuation-only.
          if (captured.trim() === '' || /^[.,;:!?\-–—\s/\\]+$/.test(captured)) continue;
          // Ignore strings that contain no Unicode letters at all (pure
          // symbols, punctuation, digits, emoji like ✎ × ⠿).
          if (!/\p{L}/u.test(captured)) continue;
          // Ignore CSS class names, HTML ids, technical identifiers.
          if (/^(rp-|mod-|javascript:|#|\.)/.test(captured)) continue;
          violations.push({ file: rel, line: lineNum, desc, snippet: line.trim(), captured });
        }
      }
    }
  }

  return violations;
}

const violations = audit();
if (violations.length === 0) {
  console.log('i18n UI text audit: PASS — no unlocalised user-facing strings detected.');
  process.exit(0);
} else {
  console.error(`i18n UI text audit: FAIL — ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.desc}]`);
    console.error(`    ${v.snippet}`);
    if (v.captured) console.error(`    captured: "${v.captured}"`);
    console.error();
  }
  process.exit(1);
}