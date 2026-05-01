// Phase 76 Plan 01 — start-node informational form.
import { Setting } from 'obsidian';
import type { FormContext } from './_shared';

export function renderStartForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  ctx: FormContext,
): void {
  void nodeRecord;
  void ctx;
  new Setting(container).setHeading().setName('Start node');
  container.createEl('p', {
    text: 'Start node has no additional properties.',
    cls: 'rp-editor-start-note',
  });
}
