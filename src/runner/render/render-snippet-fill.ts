// runner/render/render-snippet-fill.ts
// Phase 75 Plan 05 (DEDUP-01) — shared awaiting-snippet-fill renderer helpers.
import { CSS_CLASS } from '../../constants/css-classes';
//
// Owns:
//   - "Loading snippet..." placeholder paragraph rendered while host loads the
//     snippet asynchronously.
//   - "Snippet '{id}' not found" copy emitted when the host's load returns null.
//   - Phase 51 D-14 path-shape detection — distinguishes legacy id-string callers
//     (Phase 32/35) from full-vault-path callers (Phase 51 auto-insert).
//
// Hosts retain:
//   - Snippet path resolution (RunnerView simple, InlineRunnerModal WR-03 +
//     basename fallback scan).
//   - SnippetFillInModal lifecycle (`fillModal`/`isFillModalOpen` gate is
//     inline-only; RunnerView calls modal directly).
//   - Validation-error chrome (RunnerView RU Notice + stepBack/autosave/render;
//     inline modal EN Notice + stepBack/render).
//   - completeSnippet dispatch + autosave / accumulator-delta append + re-render.

/** Phase 51 D-14 path-shape detection (lifted unchanged from RunnerView /
 *  InlineRunnerModal handleSnippetFill). */
export function isFullSnippetPath(snippetId: string): boolean {
  return snippetId.includes('/') ||
    snippetId.endsWith('.md') ||
    snippetId.endsWith('.json');
}

/** Render the "Loading snippet..." placeholder. Host calls this synchronously
 *  before kicking off the async snippet load. */
export function renderSnippetFillLoading(zone: HTMLElement): void {
  zone.createEl('p', {
    text: 'Loading snippet...',
    cls: CSS_CLASS.EMPTY_STATE_BODY,
  });
}

export interface SnippetFillNotFoundOptions {
  /** Optional trailing copy appended to the base "Snippet '{id}' not found." line.
   *  RunnerView passes the legacy " The snippet may have been deleted. Use
   *  step-back to continue." trailer; inline modal omits it. */
  trailer?: string;
}

/** Replace the zone with a localised not-found message. */
export function renderSnippetFillNotFound(
  zone: HTMLElement,
  snippetId: string,
  options: SnippetFillNotFoundOptions = {},
): void {
  zone.empty();
  const trailer = options.trailer ?? '';
  zone.createEl('p', {
    text: `Snippet '${snippetId}' not found.${trailer}`,
    cls: CSS_CLASS.EMPTY_STATE_BODY,
  });
}
