#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const repo = process.cwd();
const cssDir = join(repo, 'src/styles');
const sourceDir = join(repo, 'src');
const cssClasses = new Set();
const sourceClasses = new Set();
const generatedClassPrefixes = new Set();
const CLASS_RE = /^(?:rp|is)-[a-zA-Z0-9_-]+$/;
const CLASS_TOKEN_RE = /(?:^|\s)((?:rp|is)-[a-zA-Z0-9_-]+)(?=\s|$)/g;

function walk(dir, predicate, visit) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (['node_modules', '.git', 'dist', '__snapshots__'].includes(name)) continue;
      walk(path, predicate, visit);
      continue;
    }
    if (predicate(path)) visit(path, readFileSync(path, 'utf8'));
  }
}
function addClassTokens(value) {
  let match;
  while ((match = CLASS_TOKEN_RE.exec(value)) !== null) sourceClasses.add(match[1]);
  CLASS_TOKEN_RE.lastIndex = 0;
}
function collectCssClasses(content) {
  const re = /\.((?:rp|is)-[a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = re.exec(content)) !== null) cssClasses.add(match[1]);
}
function collectSourceClasses(path, rawContent) {
  const content = rawContent.split('\n').filter((line) => !/\b(?:id|htmlFor)\s*=\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/.test(line)).join('\n');
  const noComments = content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
  let match;
  const attrLiteralRe = /\b(?:cls|class|className)\s*[:=]\s*["'`]([^"'`]*(?:rp-|is-)[^"'`]*)["'`]/g;
  while ((match = attrLiteralRe.exec(noComments)) !== null) addClassTokens(match[1]);
  const ternaryClsRe = /\bcls\s*:\s*[^,}\]]+\?\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]\s*:\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = ternaryClsRe.exec(noComments)) !== null) { sourceClasses.add(match[1]); sourceClasses.add(match[2]); }
  const obsidianMethodRe = /\.(?:addClass|removeClass|toggleClass)\s*\(\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = obsidianMethodRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  const classListRe = /\.classList\.(?:add|remove|toggle)\s*\(([^)]*)\)/g;
  while ((match = classListRe.exec(noComments)) !== null) {
    const argRe = /["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
    let arg;
    while ((arg = argRe.exec(match[1])) !== null) sourceClasses.add(arg[1]);
  }
  const qsRe = /querySelector(?:All)?\s*\(\s*["'`](?:\.|#)?((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = qsRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  const tplAttrRe = /\b(?:cls|class|className)\s*[:=]\s*`([^`]*(?:rp-|is-)[^`]*)`/g;
  while ((match = tplAttrRe.exec(noComments)) !== null) {
    const template = match[1];
    addClassTokens(template.replace(/\$\{[^}]+\}/g, ''));
    const prefixRe = /((?:rp|is)-[a-zA-Z0-9_-]+-)\$\{/g;
    let prefix;
    while ((prefix = prefixRe.exec(template)) !== null) generatedClassPrefixes.add(prefix[1]);
  }
  if (path.endsWith('css-classes.ts') || path.endsWith('css-classes.js')) {
    const constRe = /['`](((?:rp|is)-[a-zA-Z0-9_-]+))['`]/g;
    while ((match = constRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  }
}
walk(cssDir, (path) => extname(path) === '.css', (_path, content) => collectCssClasses(content));
walk(sourceDir, (path) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(extname(path)), (path, content) => collectSourceClasses(path, content));
const ignoreOrphaned = new Set(['is-active', 'is-committed', 'is-current', 'is-disabled', 'is-expanded', 'is-hidden', 'is-loading', 'is-selected', 'is-untyped', 'is-visible', 'rp-admin-crumb', 'rp-library-crumb', 'rp-stp-select-folder-btn']);
const ignoreMissing = new Set(['is-open', 'is-active', 'rp-insert-snippet-picker-host', 'rp-protocol-editor-drag-active', 'rp-protocol-editor-resize-active', 'rp-protocol-editor-snippet-folder-picker', 'rp-skip-btn', 'rp-step-back-btn', 'rp-step-redo-btn', 'rp-node-kind-badge', 'rp-protocol-editor-modal-checkbox-field', 'rp-protocol-editor-node-kind-modal', 'rp-validation-banner']);
generatedClassPrefixes.add('rp-protocol-editor-minimap-node-');
function isGeneratedClass(cls) { for (const prefix of generatedClassPrefixes) if (cls.startsWith(prefix)) return true; return false; }
const orphaned = [...cssClasses].filter((cls) => CLASS_RE.test(cls)).filter((cls) => !sourceClasses.has(cls) && !ignoreOrphaned.has(cls) && !isGeneratedClass(cls)).sort();
const missing = [...sourceClasses].filter((cls) => CLASS_RE.test(cls)).filter((cls) => !cssClasses.has(cls) && !ignoreMissing.has(cls) && !isGeneratedClass(cls)).sort();
console.log('CSS class drift audit (advisory)');
console.log(`CSS classes: ${cssClasses.size}`);
console.log(`Source class tokens: ${sourceClasses.size}`);
console.log(`Generated class prefixes: ${generatedClassPrefixes.size}`);
if (orphaned.length > 0) { console.log(`\nPotential orphaned CSS classes (${orphaned.length}):`); orphaned.slice(0, 80).forEach((cls) => console.log(`  ${cls}`)); if (orphaned.length > 80) console.log(`  ... ${orphaned.length - 80} more`); }
else console.log('\nNo potential orphaned CSS classes found.');
if (missing.length > 0) { console.log(`\nPotential missing CSS classes (${missing.length}):`); missing.slice(0, 80).forEach((cls) => console.log(`  ${cls}`)); if (missing.length > 80) console.log(`  ... ${missing.length - 80} more`); }
else console.log('\nNo potential missing CSS classes found.');
process.exit(0);