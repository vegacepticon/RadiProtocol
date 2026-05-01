// Phase 76 Plan 02 (SPLIT-01) — text-block-node form.
// Behavior preserved verbatim from editor-panel-view.ts buildKindForm
// `text-block` arm (Phase 64 growable textarea + Phase 63 field registration
// + Phase 31 D-04 / SEP-02 separator override).
import { Setting } from 'obsidian';
import type { FormContext } from './_shared';

export function renderTextBlockForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  ctx: FormContext,
): void {
  new Setting(container).setHeading().setName('Text-block node');
  const ta_content = ctx.renderGrowableTextarea(container, {
    blockClass: 'rp-text-block-content-block',
    label: 'Content',
    desc: 'Auto-appended to the accumulated text when this node is reached.',
    value:
      (nodeRecord['radiprotocol_content'] as string | undefined) ??
      (nodeRecord['text'] as string | undefined) ??
      '',
    onInput: (value) => {
      ctx.pendingEdits['radiprotocol_content'] = value;
      ctx.pendingEdits['text'] = value;
    },
  });
  // Phase 63 — capture for inbound canvas patches + blur-driven flush.
  // Field key is `radiprotocol_content` (NOT `radiprotocol_text`) per
  // RESEARCH §"Field key vocabulary" + canvas-parser.ts:220.
  ctx.registerFieldRef('radiprotocol_content', ta_content);
  // Separator override dropdown (D-05, D-06, SEP-02)
  new Setting(container)
    .setName('Text separator')
    .setDesc('How this node\'s text is joined to the accumulated report. "use global" inherits the setting from settings > runner.')
    .addDropdown(drop => {
      drop
        .addOption('', 'Use global (default)')
        .addOption('newline', 'Newline')
        .addOption('space', 'Space')
        .setValue((nodeRecord['radiprotocol_separator'] as string | undefined) ?? '')
        .onChange(value => {
          ctx.pendingEdits['radiprotocol_separator'] =
            value === '' ? undefined : (value as 'newline' | 'space');
          ctx.scheduleAutoSave();
        });
    });
}
