#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const required = [
  { file: '.rpiv/guidance/architecture.md', includes: ['## Project Map', '## Architecture', '## Commands', '`src/main.ts`', '`src/protocol/`', '`src/runner/`', '`src/views/`', '`npm run build`', '`npm run lint`', '`npm test`'] },
  { file: '.rpiv/guidance/src/graph/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/graph/'] },
  { file: '.rpiv/guidance/src/protocol/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/protocol/'] },
  { file: '.rpiv/guidance/src/runner/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/runner/'] },
  { file: '.rpiv/guidance/src/snippets/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/snippets/'] },
  { file: '.rpiv/guidance/src/views/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/views/'] },
];

const errors = [];
for (const entry of required) {
  if (!existsSync(entry.file)) {
    errors.push(`${entry.file}: missing`);
    continue;
  }
  const content = readFileSync(entry.file, 'utf8');
  for (const needle of entry.includes) {
    if (!content.includes(needle)) errors.push(`${entry.file}: missing required text: ${needle}`);
  }
}

let pkgVersion = null;
let manifestVersion = null;
try {
  pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
} catch (error) {
  errors.push(`version read failed: ${error.message}`);
}
if (pkgVersion !== null && manifestVersion !== null && pkgVersion !== manifestVersion) errors.push(`package.json version ${pkgVersion} !== manifest.json version ${manifestVersion}`);

console.log('Agent guidance audit');
console.log(`package.json: ${pkgVersion ?? 'unknown'}`);
console.log(`manifest.json: ${manifestVersion ?? 'unknown'}`);
if (errors.length > 0) {
  console.log('\nFAILED:');
  errors.forEach((error) => console.log(`  - ${error}`));
  process.exit(1);
}
console.log('\nAgent guidance audit passed.');