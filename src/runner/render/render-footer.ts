// runner/render/render-footer.ts
// Phase 87 — shared runner Back/Skip footer icon buttons.
import { setIcon } from 'obsidian';
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
      cls: 'rp-step-back-btn rp-runner-icon-btn',
      attr: { 'aria-label': 'Go back one step' },
    });
    setIcon(backBtn, 'arrow-left');
    // Phase 66 D-01 + D-02 + D-03: visual half of the double-click guard.
    // Disable Back synchronously on first click; runner-side guards handle any races.
    host.bindClick(backBtn, () => {
      backBtn.disabled = true;
      options.onBack();
    });
  }
  if (options.showSkip === true && options.onSkip !== undefined) {
    const skipBtn = createButton(footerRow, {
      cls: 'rp-skip-btn rp-runner-icon-btn',
      attr: { 'aria-label': 'Skip this question' },
    });
    setIcon(skipBtn, 'skip-forward');
    host.bindClick(skipBtn, options.onSkip);
  }
}
