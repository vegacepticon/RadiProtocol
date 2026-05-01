// Phase 76 Plan 01 — unified loop node form + legacy loop-start/loop-end stubs.
// Behaviour preserved verbatim from editor-panel-view.ts buildKindForm switch arms
// (Phase 44 UAT-fix unified loop, Phase 43 D-03 legacy migration informational).
import { Setting } from 'obsidian';
import type { FormContext } from './_shared';

export function renderLoopForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  kind: 'loop' | 'loop-start' | 'loop-end',
  ctx: FormContext,
): void {
  if (kind === 'loop-start' || kind === 'loop-end') {
    // Phase 44 (RUN-07) — legacy kinds retained for parser migration-error path (Phase 43 D-03).
    // Validator rejects any canvas containing these; the form below is informational only.
    new Setting(container).setHeading().setName('Legacy loop node');
    new Setting(container).setDesc(
      'This node type is obsolete. Rebuild the loop using a unified "loop" node. The canvas will fail validation until the legacy nodes are removed.',
    );
    return;
  }

  // Phase 44 UAT-fix: unified loop node form (RUN-01 header text + picker).
  // Sync both `radiprotocol_headerText` (runtime source) and `text` (canvas visual label)
  // so the header is visible on the canvas node AND picked up by the runner — same pattern
  // as question/answer.
  new Setting(container).setHeading().setName('Loop node');
  const ta_headerText = ctx.renderGrowableTextarea(container, {
    blockClass: 'rp-loop-header-block',
    label: 'Header text',
    desc: 'Displayed above the branch picker when the runner halts at this loop, and also shown as the canvas node label. Leave blank for no header.',
    value:
      (nodeRecord['radiprotocol_headerText'] as string | undefined) ??
      (nodeRecord['text'] as string | undefined) ??
      '',
    onInput: (value) => {
      ctx.pendingEdits['radiprotocol_headerText'] = value;
      ctx.pendingEdits['text'] = value;
    },
  });
  // Phase 63 — capture for inbound canvas patches + blur-driven flush.
  ctx.registerFieldRef('radiprotocol_headerText', ta_headerText);
}
