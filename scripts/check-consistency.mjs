#!/usr/bin/env node
/**
 * check-consistency.mjs — Nightly consistency gate for RadiProtocol.
 *
 * Checks:
 *   1. README version line matches manifest.json version
 *   2. No stale .planning/ references in tracked source
 *   3. No phantom source files (referenced but missing)
 *   4. package.json ↔ manifest.json version alignment
 *   5. Stale TODO/FIXME with old phase anchors
 *   6. Unused exports advisory (knip-style)
 *
 * Exit 0 = clean | Exit 1 = failures found
 * Run: npm run check:consistency
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const repo = process.cwd();
const errors = [];
const warnings = [];

// ─── Helpers ──────────────────────────────────────────────────────────
function fail(msg) { errors.push(`❌ ${msg}`); }
function warn(msg) { warnings.push(`⚠️  ${msg}`); }
function info(msg) { console.log(`  ${msg}`); }

// ─── 1. README version ↔ manifest.json ───────────────────────────────
console.log('\n▸ Check 1: README version vs manifest.json');
const manifest = JSON.parse(readFileSync(`${repo}/manifest.json`, 'utf8'));
const readme = readFileSync(`${repo}/README.md`, 'utf8');
const manifestVersion = manifest.version;
const readmeMatch = readme.match(/\*\*Latest release:\*\*\s*(v?\d+\.\d+\.\d+)/);

if (!readmeMatch) {
  fail('README: no "Latest release" line found');
} else {
  const readmeVersion = readmeMatch[1];
  if (readmeVersion !== manifestVersion && readmeVersion !== `v${manifestVersion}`) {
    fail(`README shows "${readmeVersion}" but manifest.json has "${manifestVersion}"`);
  } else {
    info(`  OK: README "${readmeVersion}" ↔ manifest "${manifestVersion}"`);
  }
}

// ─── 2. Stale .planning/ references in tracked source ─────────────────
console.log('\n▸ Check 2: Stale .planning/ references in tracked files');
let planningRefs = [];
try {
  planningRefs = execSync(
    'git grep --name-only "\\.planning/" -- ":(exclude).planning/*"',
    { cwd: repo, encoding: 'utf8' }
  ).trim().split('\n').filter(Boolean);
} catch { /* no matches */ }

// Tracked policy files that intentionally reference .planning/ (not stale)
  const PLANNING_POLICY_FILES = new Set([
    '.gitignore',
    'scripts/check-planning-freshness.mjs',
    'scripts/check-consistency.mjs',
    'eslint.config.mjs',
  ]);

  if (planningRefs.length > 0) {
    const stale = planningRefs.filter(f => !PLANNING_POLICY_FILES.has(f) && !f.startsWith('docs/'));
    if (stale.length > 0) {
      fail(`${stale.length} tracked file(s) have stale .planning/ references:\n${stale.map(f => `    ${f}`).join('\n')}`);
    } else {
      info(`  OK: only policy/gate files reference .planning/ (${planningRefs.length} total)`);
    }
  } else {
    info('  OK: no tracked .planning/ references');
  }

// ─── 3. Phantom file references (source → missing files) ─────────────
console.log('\n▸ Check 3: Phantom file references in source');
const phantomPatterns = [
  'runner-view\\.ts',
  'session-recovery-coordinator\\.ts',
  'SessionService',
  'sessionFolderPath',
];
const srcFiles = execSync('git ls-files "src/**/*.ts"', { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
let phantomFound = 0;
for (const pattern of phantomPatterns) {
  const matches = [];
  for (const file of srcFiles) {
    const content = readFileSync(`${repo}/${file}`, 'utf8');
    if (content.includes(pattern)) matches.push(file);
  }
  if (matches.length > 0) {
    // Filter known intentional references (ADRs, test comments)
    const nonDocs = matches.filter(f => !f.startsWith('docs/') && !f.includes('__tests__'));
    if (nonDocs.length > 0) {
      warn(`Phantom ref "${pattern}" found in: ${nonDocs.join(', ')}`);
      phantomFound++;
    }
  }
}
if (phantomFound === 0) {
  info('  OK: no phantom references in source');
}

// ─── 4. package.json ↔ manifest.json version ─────────────────────────
console.log('\n▸ Check 4: package.json ↔ manifest.json version');
const pkg = JSON.parse(readFileSync(`${repo}/package.json`, 'utf8'));
if (pkg.version !== manifestVersion) {
  fail(`package.json version "${pkg.version}" !== manifest.json version "${manifestVersion}"`);
} else {
  info(`  OK: package.json "${pkg.version}" ↔ manifest.json "${manifestVersion}"`);
}

// ─── 5. Stale phase anchors in TODO/FIXME ────────────────────────────
console.log('\n▸ Check 5: Stale phase references in TODO/FIXME');
const phasePattern = /TODO\s+(Phase\s+\d+|Plan\s+\d+)|FIXME\s+(Phase\s+\d+|Plan\s+\d+)/;
const todoHits = [];
for (const file of srcFiles) {
  const content = readFileSync(`${repo}/${file}`, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (phasePattern.test(line)) {
      todoHits.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}
if (todoHits.length > 0) {
  warn(`Found ${todoHits.length} stale phase-anchored TODO/FIXME:\n${todoHits.map(h => `    ${h}`).join('\n')}`);
} else {
  info('  OK: no stale phase references in TODO/FIXME');
}

// ─── 6. Unused exports advisory ───────────────────────────────────────
console.log('\n▸ Check 6: Unused exports (advisory)');
try {
  const knip = execSync('npx knip --reporter compact 2>&1', { cwd: repo, encoding: 'utf8', timeout: 60000 });
  const unusedCount = (knip.match(/Unused exports/g) || []).length;
  if (unusedCount > 0) {
    warn(`Knip found ${unusedCount} groups of unused exports (non-blocking)`);
  } else {
    info('  OK: no unused exports');
  }
} catch (e) {
  info('  (skipped — knip not available)');
}

// ─── Summary ──────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
if (errors.length > 0) {
  console.log(`❌ FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
  errors.forEach(e => console.log(`  ${e}`));
  warnings.forEach(w => console.log(`  ${w}`));
  process.exit(1);
} else if (warnings.length > 0) {
  console.log(`⚠️  PASSED with ${warnings.length} warning(s)`);
  warnings.forEach(w => console.log(`  ${w}`));
  process.exit(0);
} else {
  console.log('✅ All checks passed');
  process.exit(0);
}