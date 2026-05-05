/**
 * Regression smoke tests.
 *
 * These tests catch the class of bug where an executor agent silently removes
 * CSS rules or TypeScript functions while editing a shared file for a new phase.
 * They do NOT test behaviour — they test that critical code still EXISTS.
 *
 * Add a new assertion here whenever a regression is fixed, so it can't regress again.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cssFile(name: string): string {
  return fs.readFileSync(path.resolve(`src/styles/${name}.css`), 'utf8');
}

function srcFile(name: string): string {
  return fs.readFileSync(path.resolve(`src/${name}`), 'utf8');
}

function hasRule(css: string, selector: string): boolean {
  // Checks the selector appears followed eventually by `{`
  return new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + /\s*\{/.source).test(css);
}

function hasSymbol(src: string, symbol: string): boolean {
  return src.includes(symbol);
}

// ── CSS regressions ───────────────────────────────────────────────────────────

describe('CSS regression: editor-panel.css', () => {
  let css: string;
  beforeAll(() => { css = cssFile('editor-panel'); });

  // Regressed in phase-27 commit 96022c2 — saved indicator removed, auto-save invisible
  it('has .rp-editor-saved-indicator rule', () => {
    expect(hasRule(css, '.rp-editor-saved-indicator')).toBe(true);
  });

  it('has .rp-editor-saved-indicator.is-visible rule', () => {
    expect(css).toContain('.rp-editor-saved-indicator.is-visible');
  });
});

describe('CSS regression: snippet-manager.css', () => {
  let css: string;
  beforeAll(() => { css = cssFile('snippet-manager'); });

  // Phase 27 chip classes — must not be removed by future phases
  it('has .rp-placeholder-chip rule', () => {
    expect(hasRule(css, '.rp-placeholder-chip')).toBe(true);
  });

  it('has .rp-placeholder-chip-handle drag handle rule', () => {
    expect(hasRule(css, '.rp-placeholder-chip-handle')).toBe(true);
  });
});

describe('CSS regression: inline-runner.css — Phase 60 compact draggable layout', () => {
  let css: string;
  beforeAll(() => { css = cssFile('inline-runner'); });

  it('has the Phase 60 compact draggable inline runner section', () => {
    expect(css).toContain('/* Phase 60: compact draggable inline runner */');
  });

  it('guards against the old full note-width bottom bar as the final container shape', () => {
    expect(css).toMatch(/\.rp-inline-runner-container\s*\{[\s\S]*?width:\s*min\(/);
    expect(css).toMatch(/\.rp-inline-runner-container\s*\{[\s\S]*?max-width:\s*calc\(100vw/);
    expect(css).toMatch(/\.rp-inline-runner-container\s*\{[\s\S]*?max-height:\s*min\(/);
    expect(css).toMatch(/\.rp-inline-runner-container\s*\{[\s\S]*?border:\s*1px solid var\(--background-modifier-border\)/);
  });

  it('bounds content and tightens question/list/toolbar spacing', () => {
    expect(css).toMatch(/\.rp-inline-runner-content\s*\{[\s\S]*?padding:\s*var\(--size-4-2\)/);
    expect(css).toContain('.rp-inline-runner-content .rp-question-zone');
    expect(css).toMatch(/\.rp-inline-runner-content \.rp-question-text\s*\{[\s\S]*?margin:\s*0 0 var\(--size-4-2\) 0/);
    expect(css).not.toContain('.rp-inline-runner-content .rp-output-toolbar');
  });
});

// ── TypeScript regressions ────────────────────────────────────────────────────

describe('TS regression: editor-panel-view.ts — auto-save', () => {
  let src: string;
  beforeAll(() => { src = srcFile('views/editor-panel-view.ts'); });

  // Regressed in phase-27 commit 96022c2 — scheduleAutoSave removed
  it('exports scheduleAutoSave function', () => {
    expect(hasSymbol(src, 'scheduleAutoSave')).toBe(true);
  });

  it('has _debounceTimer field', () => {
    expect(hasSymbol(src, '_debounceTimer')).toBe(true);
  });

  it('has showSavedIndicator function', () => {
    expect(hasSymbol(src, 'showSavedIndicator')).toBe(true);
  });
});

describe('TS regression: editor-panel-view.ts — tab auto-switch', () => {
  let src: string;
  beforeAll(() => { src = srcFile('views/editor-panel-view.ts'); });

  // Regressed in phase-27 commit 96022c2 — ensureEditorPanelVisible removed
  it('has ensureEditorPanelVisible function', () => {
    expect(hasSymbol(src, 'ensureEditorPanelVisible')).toBe(true);
  });
});

describe('TS regression: canvas/node-color-map.ts — node type colors', () => {
  // Regressed in phase-27 commit 96022c2 — entire file deleted
  it('file exists', () => {
    expect(() => srcFile('canvas/node-color-map.ts')).not.toThrow();
  });

  it('exports a color map or lookup', () => {
    const src = srcFile('canvas/node-color-map.ts');
    // Should contain some form of color mapping (object, Map, or function)
    expect(hasSymbol(src, 'color') || hasSymbol(src, 'Color')).toBe(true);
  });
});

describe('TS regression: canvas/canvas-live-editor.ts — color not protected', () => {
  let src: string;
  beforeAll(() => { src = srcFile('canvas/canvas-live-editor.ts'); });

  // Regressed in phase-27 via PROTECTED_FIELDS — color writes silently discarded
  it('does not list "color" in PROTECTED_FIELDS', () => {
    // Find the PROTECTED_FIELDS set and check 'color' is not in it
    const match = src.match(/PROTECTED_FIELDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (match) {
      expect(match[1]).not.toContain("'color'");
      expect(match[1]).not.toContain('"color"');
    } else {
      // If structure changed, just confirm the file exists and has no obvious color protection
      expect(src).not.toMatch(/PROTECTED_FIELDS[^;]*'color'/);
    }
  });
});
