// Phase 67: layout clamp + ResizeObserver lifecycle tests
// Reuses scaffolding patterns from src/__tests__/views/inline-runner-position.test.ts.
import { describe, expect, it } from 'vitest';
import { clampInlineRunnerLayout } from '../views/inline-runner-modal';

describe('clampInlineRunnerLayout (Phase 67 D-10)', () => {
  const viewport = { width: 1024, height: 768 };

  it('clamps oversized width and height to viewport - 32px margin', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0, width: 9999, height: 9999 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 1024 - 32, height: 768 - 32 });
  });

  it('falls back to INLINE_RUNNER_DEFAULT_WIDTH/HEIGHT when width/height are missing (D-06)', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 360, height: 240 });
  });

  it('preserves width/height already within bounds', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0, width: 400, height: 200 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 400, height: 200 });
  });

  it('falls back to defaults for non-finite width/height (NaN, negative, zero)', () => {
    const r1 = clampInlineRunnerLayout({ left: 0, top: 0, width: NaN, height: -5 }, viewport);
    expect(r1).toEqual({ left: 0, top: 0, width: 360, height: 240 });
    const r2 = clampInlineRunnerLayout({ left: 0, top: 0, width: 0, height: 0 }, viewport);
    expect(r2).toEqual({ left: 0, top: 0, width: 360, height: 240 });
  });

  it('returns null when layout is null (no recovery)', () => {
    expect(clampInlineRunnerLayout(null, viewport)).toBeNull();
  });
});
