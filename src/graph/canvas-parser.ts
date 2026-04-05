// graph/canvas-parser.ts
// Pure module — zero Obsidian API imports (PARSE-06, NFR-01)
import type { ParseResult } from './graph-model';

export class CanvasParser {
  parse(_jsonString: string, _canvasFilePath: string): ParseResult {
    // TODO: Phase 1 — Plan 01-03 implements this
    return { success: false, error: 'Not implemented' };
  }
}
