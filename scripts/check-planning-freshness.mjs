#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const warnOnly = process.argv.includes('--warn-only');

function fail(message) {
  failures.push(message);
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;

if (packageVersion !== manifestVersion) {
  fail(`package.json version ${packageVersion} does not match manifest.json version ${manifestVersion}`);
}

const trackedPlanningFiles = runGit(['ls-files', '.planning']).split('\n').filter(Boolean);
if (trackedPlanningFiles.length > 0) {
  fail(`.planning/ has tracked files in git index — run: git rm --cached -rf .planning/\n${trackedPlanningFiles.map((file) => `  ${file}`).join('\n')}`);
}

const trackedSourceFiles = runGit(['ls-files', 'src']).split('\n').filter(Boolean);
for (const file of trackedSourceFiles) {
  if (!/\.(?:ts|tsx|css)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('.planning/')) {
    fail(`${file}: source file references gitignored .planning/ path`);
  }
}

if (existsSync('.planning/STATE.md')) {
  const state = readFileSync('.planning/STATE.md', 'utf8');
  const versionRegex = new RegExp(`v?${escapeRegExp(packageVersion)}`);
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