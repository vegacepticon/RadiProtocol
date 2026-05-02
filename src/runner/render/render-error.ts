// runner/render/render-error.ts
// Phase 75 Plan 05 (DEDUP-01) — shared error-list body.
//
// Owns:
//   - "Protocol error" title paragraph (cls optional — preserves divergence
//     between RunnerView's no-class title and inline modal's `rp-error-title`).
//   - `<ul class="rp-error-list">` of `<li>` messages.
//
// Hosts retain:
//   - Outer chrome divergence: RunnerView rebuilds the entire view (selector
//     bar + `.rp-runner-view` + `.rp-question-zone.rp-validation-panel`).
//     InlineRunnerModal renders zone-locally inside `.rp-error-panel`.

export interface ErrorListOptions {
  /** Optional class for the "Protocol error" title paragraph. RunnerView omits
   *  it; inline modal passes 'rp-error-title'. */
  titleClass?: string;
}

export function renderErrorList(
  parent: HTMLElement,
  messages: string[],
  options: ErrorListOptions = {},
): void {
  const titleOpts: { text: string; cls?: string } = { text: 'Protocol error' };
  if (options.titleClass !== undefined) titleOpts.cls = options.titleClass;
  parent.createEl('p', titleOpts);

  const ul = parent.createEl('ul', { cls: 'rp-error-list' });
  for (const message of messages) {
    ul.createEl('li', { text: message });
  }
}
