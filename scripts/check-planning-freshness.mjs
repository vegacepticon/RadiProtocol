#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const failures = [];
const warnOnly = process.argv.includes('--warn-only');

function fail(message) {
  failures.push(message);
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

// 1. No tracked .planning/ files should exist in the index.
//    .planning/ is gitignored; any tracked entries mean someone forgot
//    to run `git rm --cached` or the .gitignore was missing.
try {
  execSync('git ls-files --error-unmatch .planning', {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  // If we get here, .planning/ IS tracked — that's a failure.
  fail('.planning/ has tracked files in git index — run: git rm --cached -rf .planning/');
} catch {
  // Expected: .planning/ is not tracked (gitignored or never added).
}

// 2. Source files must not depend on local gitignored planning docs.
const trackedSourceFiles = run('git', ['ls-files', 'src']).split('\n').filter(Boolean);
for (const file of trackedSourceFiles) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('.planning/')) {
    fail(`${file}: source file references gitignored .planning/ path`);
  }
}

// 3. Planning is local, but if present it must at least identify itself as a local workspace
//    and must not claim an obsolete shipped version.
if (existsSync('.planning/STATE.md')) {
  const state = readFileSync('.planning/STATE.md', 'utf8');
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;

  if (packageVersion !== manifestVersion) {
    fail(`package.json version ${packageVersion} does not match manifest.json version ${manifestVersion}`);
  }

  const versionRegex = new RegExp(`v?${packageVersion.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`);
  if (!versionRegex.test(state)) {
    fail(`.planning/STATE.md does not mention current package version ${packageVersion}`);
  }

  if (!state.includes('Planning Cleanup Notes')) {
    fail('.planning/STATE.md is missing Planning Cleanup Notes section');
  }
}

if (failures.length > 0) {
  console.error('Planning freshness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnOnly) process.exit(0);
  process.exit(1);
}

console.log('Planning freshness check passed.');