// runner/render/render-complete.ts
// Phase 75 Plan 05 (DEDUP-01) — shared `complete` state heading.
//
// Owns:
//   - "Protocol complete" `<h2 class="rp-complete-heading">` heading.
//
// Hosts retain:
//   - Run-again button (RunnerView only — inline modal has no equivalent).
//   - Preview zone / output toolbar wiring around the heading.

/** Render the shared "Protocol complete" heading. Returns the heading element
 *  so hosts can append host-specific chrome (e.g. RunnerView's Run again button)
 *  alongside it. */
export function renderCompleteHeading(zone: HTMLElement): HTMLElement {
  return zone.createEl('h2', {
    text: 'Protocol complete',
    cls: 'rp-complete-heading',
  });
}
