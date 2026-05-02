// runner/render/render-footer.ts
// Phase 75 DEDUP-01 — shared runner Back/Skip footer row.
import { createButton } from '../../utils/dom-helpers';

export interface RunnerFooterOptions {
  showBack: boolean;
  onBack: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
}

export interface RunnerFooterHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
}

export function renderRunnerFooter(
  zone: HTMLElement,
  host: RunnerFooterHost,
  options: RunnerFooterOptions,
): void {
  if (!options.showBack && options.showSkip !== true) return;

  const footerRow = zone.createDiv({ cls: 'rp-runner-footer-row' });
  if (options.showBack) {
    const backBtn = createButton(footerRow, {
      cls: 'rp-step-back-btn',
      text: 'Back',
    });
    if ('setAttribute' in backBtn) backBtn.setAttribute('aria-label', 'Go back one step');
    backBtn.title = 'Go back one step';
    // Phase 66 D-01 + D-02 + D-03: visual half of the double-click guard.
    // Disable Back synchronously on first click; runner-side guards handle any races.
    host.bindClick(backBtn, () => {
      backBtn.disabled = true;
      options.onBack();
    });
  }
  if (options.showSkip === true && options.onSkip !== undefined) {
    const skipBtn = createButton(footerRow, {
      cls: 'rp-skip-btn',
      text: 'Skip',
    });
    if ('setAttribute' in skipBtn) skipBtn.setAttribute('aria-label', 'Skip this question');
    skipBtn.title = 'Skip this question';
    host.bindClick(skipBtn, options.onSkip);
  }
}
