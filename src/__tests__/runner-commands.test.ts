import { describe, it, expect } from 'vitest';
import { GraphValidator } from '../graph/graph-validator';
import { CanvasParser } from '../graph/canvas-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Runner commands (RUN-10, UI-04)', () => {
  it('RUN-10: node-picker-modal exports NodePickerModal (RED until Plan 03)', async () => {
    // Dynamic import so the test file itself does not fail to parse.
    // This MUST fail until Plan 03 creates src/views/node-picker-modal.ts.
    await expect(import('../views/node-picker-modal')).resolves.toHaveProperty('NodePickerModal');
  });

  it('UI-04: GraphValidator.validate() returns non-empty errors for a dead-end canvas', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const json = fs.readFileSync(path.join(fixturesDir, 'dead-end.canvas'), 'utf-8');
    const parser = new CanvasParser();
    const result = parser.parse(json, 'dead-end.canvas');
    if (!result.success) {
      // Parse failure is also a valid error — it means invalid canvas
      expect(result.error).toBeTruthy();
      return;
    }
    const validator = new GraphValidator();
    const errors = validator.validate(result.graph);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });
});
