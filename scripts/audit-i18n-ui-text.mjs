#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGET_DIRS = ['src/views', 'src/settings.ts'];
const ALLOW_COMMENT_PATTERNS = [/\/\/\s*User-authored content/i, /\/\/\s*Internal enum value/i, /\/\/\s*Non-translatable/i, /\/\/\s*Caller-supplied localized/i, /\/\/\s*Dynamic validation/i, /\/\/\s*pass-through localized/i, /\/\/\s*msg is pass-through/i];
const TRANSLATED_RE = /\b(?:(?:this|plugin)\.)?(?:i18n\.)?t\(\s*['"`]/;
const CHECK_PATTERNS = [[/\.setButtonText\(\s*'([^']+)'\s*\)/, 'setButtonText with string literal'], [/\.setPlaceholder\(\s*'([^']+)'\s*\)/, 'setPlaceholder with string literal'], [/\.textContent\s*=\s*'([^']+)'/, 'textContent with single-quoted string'], [/\.textContent\s*=\s*`([^`]+)`/, 'textContent with template literal'], [/\.innerText\s*=\s*'([^']+)'/, 'innerText with single-quoted string'], [/\.addOption\([^,]+,\s*'([^']+)'\s*\)/, 'addOption label with string literal'], [/new Notice\(\s*`/, 'Notice with template literal'], [/new Notice\(\s*'/, 'Notice with single-quoted string']];
const SKIP_PATHS = [/__mocks__/, /\.test\.ts$/, /\.spec\.ts$/];
function collectFiles() { const files = []; for (const target of TARGET_DIRS) { const full = join(ROOT, target); if (statSync(full).isFile()) files.push(full); else walkDir(full, files); } return files; }
function walkDir(dir, out) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const full = join(dir, entry.name); if (entry.isDirectory()) walkDir(full, out); else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full); } }
function isAllowListed(line) { return ALLOW_COMMENT_PATTERNS.some((pattern) => pattern.test(line)); }
function isTranslated(line) { return TRANSLATED_RE.test(line); }
function isIgnorableCapturedText(value) { const trimmed = value.trim(); return trimmed === '' || /^[.,;:!?\-–—\s/\\]+$/.test(trimmed) || !/\p{L}/u.test(trimmed) || /^(?:rp-|radi-|mod-|javascript:|#|\.)/.test(trimmed); }
function audit() {
  const violations = [];
  for (const file of collectFiles()) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (SKIP_PATHS.some((pattern) => pattern.test(rel))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTranslated(line) || isAllowListed(line)) continue;
      for (const [pattern, desc] of CHECK_PATTERNS) {
        if (!pattern.test(line)) continue;
        const match = line.match(pattern);
        const captured = match?.[1] ?? '';
        if (isIgnorableCapturedText(captured)) continue;
        violations.push({ file: rel, line: i + 1, desc, snippet: line.trim(), captured });
      }
    }
  }
  return violations;
}
const violations = audit();
if (violations.length === 0) { console.log('i18n UI text audit: PASS — no unlocalised user-facing strings detected.'); process.exit(0); }
console.error(`i18n UI text audit: FAIL — ${violations.length} violation(s) found:\n`);
for (const violation of violations) { console.error(`  ${violation.file}:${violation.line} [${violation.desc}]`); console.error(`    ${violation.snippet}`); if (violation.captured) console.error(`    captured: "${violation.captured}"`); console.error(); }
process.exit(1);