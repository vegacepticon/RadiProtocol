// free-text-input-migration.test.ts
// Phase 46 (CLEAN-02) — RED gate: legacy free-text-input canvases must be rejected at parse-time.
// buildNodeOptions-style pure test — no Obsidian mock directive required; the project's vitest
// config aliases 'obsidian' to the __mocks__ stub automatically.
//
// Mandatory acceptance tokens asserted by Task 1 (Phase 84 I18N-02 — defaultT/English fallback):
//   «deprecated» — rejection vocabulary (Phase 46 D-46-01-B, English form)
//   «free-text-input» — literal kind identifier
//   node id — author-facing locator in the error
//
// Test 3 is a negative control: a happy-path canvas (text-block.canvas) MUST still parse,
// proving the rejection branch added in Task 2 is narrowly scoped to free-text-input.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('CanvasParser — Phase 46 CLEAN-02 rejection of legacy free-text-input canvases', () => {
  it('rejects src/__tests__/fixtures/free-text.canvas with English error containing the node id and the literal «free-text-input» token', () => {
    const parser = new CanvasParser();
    const json = fs.readFileSync(path.join(fixturesDir, 'free-text.canvas'), 'utf-8');
    const result = parser.parse(json, 'free-text.canvas');

    expect(result.success).toBe(false);
    if (result.success) return; // type-narrow for TS
    // Phase 84 I18N-02: defaultT (English) is in effect for zero-arg CanvasParser construction.
    expect(result.error).toContain('deprecated');
    expect(result.error).toContain('free-text-input');
    expect(result.error).toContain('n-ft1');
  });

  it('rejects an inline canvas JSON with one start + one free-text-input node; error contains all three tokens', () => {
    const parser = new CanvasParser();
    const inlineJson = '{"nodes":[{"id":"s","type":"text","text":"S","x":0,"y":0,"width":100,"height":60,"radiprotocol_nodeType":"start"},{"id":"ft-x","type":"text","text":"F","x":0,"y":60,"width":100,"height":60,"radiprotocol_nodeType":"free-text-input"}],"edges":[]}';
    const result = parser.parse(inlineJson, 'inline.canvas');

    expect(result.success).toBe(false);
    if (result.success) return;
    // Phase 84 I18N-02: defaultT (English) is in effect for zero-arg CanvasParser construction.
    expect(result.error).toContain('deprecated');
    expect(result.error).toContain('free-text-input');
    expect(result.error).toContain('ft-x');
  });

  it('negative control: text-block.canvas (no free-text-input) still parses cleanly', () => {
    const parser = new CanvasParser();
    const json = fs.readFileSync(path.join(fixturesDir, 'text-block.canvas'), 'utf-8');
    const result = parser.parse(json, 'text-block.canvas');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.graph.nodes.size).toBeGreaterThan(0);
  });
});
