// Phase 76 Plan 02 (SPLIT-01) — question-node form.
// Behavior preserved verbatim from editor-panel-view.ts buildKindForm `question`
// arm (Phase 64 growable-textarea helper + Phase 63 field registration).
import { Setting } from 'obsidian';
import type { FormContext } from './_shared';

export function renderQuestionForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  ctx: FormContext,
): void {
  new Setting(container).setHeading().setName('Question node');
  // Phase 64: shared growable textarea helper preserves the Phase 48
  // custom-DOM Question behavior while exposing common managed classes.
  const ta_questionText = ctx.renderGrowableTextarea(container, {
    blockClass: 'rp-question-block',
    textareaClass: 'rp-question-textarea',
    label: 'Question text',
    desc: 'Displayed to the user during the protocol session.',
    value:
      (nodeRecord['radiprotocol_questionText'] as string | undefined) ??
      (nodeRecord['text'] as string | undefined) ??
      '',
    onInput: (value) => {
      ctx.pendingEdits['radiprotocol_questionText'] = value;
      ctx.pendingEdits['text'] = value;
    },
  });
  // Phase 63 — capture for inbound canvas patches + blur-driven flush of
  // pendingCanvasUpdate. Field key = pendingEdits-key (RESEARCH §"Field
  // key vocabulary"). registerFieldRef wires both formFieldRefs.set and
  // the queueMicrotask-deferred blur handler in one call.
  ctx.registerFieldRef('radiprotocol_questionText', ta_questionText);
}
