// Phase 76 Plan 03 (SPLIT-01) — answer-node form.
// Behavior preserved verbatim from editor-panel-view.ts buildKindForm `answer`
// arm (Phase 48 NODEUI-03 field order, Phase 50 D-10 displayLabel edge sync,
// Phase 63 field registration, Phase 31 D-04 / SEP-02 separator override).
import { Setting } from 'obsidian';
import type { FormContext } from './_shared';

export function renderAnswerForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  ctx: FormContext,
): void {
  new Setting(container).setHeading().setName('Answer node');
  // Phase 50 D-10: Answer.displayLabel is the single source of truth for every
  // incoming Question→Answer edge label. Multi-incoming Answer nodes share ONE
  // label across all incoming edges — per-edge override is explicitly out of scope
  // for v1.8. Writes flow through saveNodeEdits (D-14 atomic batch): node
  // radiprotocol_displayLabel + every incoming edge.label land in ONE saveLiveBatch
  // or ONE vault.modify call. Undefined displayLabel strips the 'label' key on
  // every incoming edge (D-08 symmetry with canvas-parser.ts:207-209).
  // Design source: .planning/notes/answer-label-edge-sync.md
  // Phase 48 NODEUI-03: Display label renders BEFORE Answer text (swapped from original order).
  new Setting(container)
    .setName('Display label (optional)')
    .setDesc('Short label shown in the runner button if set. Leave blank to use answer text.')
    .addText(t => {
      t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
        .onChange(v => {
          ctx.pendingEdits['radiprotocol_displayLabel'] = v || undefined;
          ctx.scheduleAutoSave();
        });
      // Phase 63 — capture displayLabel inputEl for inbound canvas patches
      // (Phase 50 surface — reconciler-driven displayLabel updates ride on
      // the same dispatch bus). registerFieldRef applies the same blur
      // flush + formFieldRefs.set semantics as the textarea sites.
      ctx.registerFieldRef('radiprotocol_displayLabel', t.inputEl);
    });
  const ta_answerText = ctx.renderGrowableTextarea(container, {
    blockClass: 'rp-answer-text-block',
    label: 'Answer text',
    desc: 'Appended to the accumulated report text when this answer is chosen.',
    value:
      (nodeRecord['radiprotocol_answerText'] as string | undefined) ??
      (nodeRecord['text'] as string | undefined) ??
      '',
    onInput: (value) => {
      ctx.pendingEdits['radiprotocol_answerText'] = value;
      ctx.pendingEdits['text'] = value;
    },
  });
  // Phase 63 — capture for inbound canvas patches + blur-driven flush.
  ctx.registerFieldRef('radiprotocol_answerText', ta_answerText);
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
