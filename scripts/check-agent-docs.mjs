#!/usr/bin/env node
/**
 * check-agent-docs.mjs — verifies that tracked agent/development docs keep the
 * minimal navigation and workflow contract needed by coding agents.
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const required = [
  {
    file: 'CLAUDE.md',
    includes: [
      '## Project snapshot',
      '## Code map',
      '## Authoritative commands',
      '## i18n rules',
      '## Release/version rules',
      '## Agent execution protocol',
      'npm run check',
      'npm version X.Y.Z',
      'Do **not** run `node version-bump.mjs` directly',
    ],
  },
  {
    file: 'docs/DEVELOPMENT-WORKFLOW.md',
    includes: [
      '## Sources of truth',
      '## Session start checklist',
      '## Implementation loop',
      '## Release discipline',
    ],
  },
  {
    file: 'docs/adr/0001-inline-runner-only.md',
    includes: ['#', 'inline'],
  },
];

const errors = [];
for (const entry of required) {
  if (!existsSync(entry.file)) {
    errors.push(`${entry.file}: missing`);
    continue;
  }
  const content = readFileSync(entry.file, 'utf8');
  for (const needle of entry.includes) {
    if (!content.includes(needle)) {
      errors.push(`${entry.file}: missing required text: ${needle}`);
    }
  }
}

let pkgVersion = null;
let manifestVersion = null;
let latestTag = null;
try {
  pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
  latestTag = execSync('git tag --sort=-v:refname | head -1', { encoding: 'utf8' }).trim();
} catch (error) {
  errors.push(`version read failed: ${error.message}`);
}

if (pkgVersion && manifestVersion && pkgVersion !== manifestVersion) {
  errors.push(`package.json version ${pkgVersion} !== manifest.json version ${manifestVersion}`);
}

console.log('Agent docs audit');
console.log(`package.json: ${pkgVersion ?? 'unknown'}`);
console.log(`manifest.json: ${manifestVersion ?? 'unknown'}`);
console.log(`latest tag: ${latestTag || 'none'}`);

if (latestTag && pkgVersion && latestTag !== pkgVersion && latestTag !== `v${pkgVersion}`) {
  console.log(`Advisory: latest tag ${latestTag} does not match package version ${pkgVersion}. This is expected on unreleased local changes.`);
}

if (errors.length > 0) {
  console.log('\nFAILED:');
  errors.forEach(error => console.log(`  - ${error}`));
  process.exit(1);
}

console.log('\nAgent docs audit passed.');
