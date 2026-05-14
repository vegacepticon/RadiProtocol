// Phase 76 Plan 04 (SPLIT-01) — snippet-node form.
// Behavior preserved verbatim from editor-panel-view.ts buildKindForm `snippet`
// arm (Phase 51 Plan 03 D-05 hierarchical SnippetTreePicker, Phase 31 D-01
// branch label, Phase 31 D-04 separator override, Phase 63 field registration).
//
// SnippetTreePicker lifecycle invariant: the dispatcher unmounts any prior
// picker at the head of buildKindForm BEFORE delegating here. This module
// constructs the new picker and registers it back via ctx.setSnippetTreePicker
// so the dispatcher can unmount it on the next form render.
import { Setting } from 'obsidian';
import { SnippetTreePicker } from '../../snippet-tree-picker';
import type { FormContext } from './_shared';
import { CSS_CLASS } from '../../../constants/css-classes';

export function renderSnippetForm(
  container: HTMLElement,
  nodeRecord: Record<string, unknown>,
  ctx: FormContext,
): void {
  new Setting(container).setHeading().setName('Snippet node');

  // Phase 51 Plan 03 D-05 (PICKER-02) — inline hierarchical picker replaces the
  // Phase 30 flat-list addDropdown. Mode 'both' lets the author pick a folder
  // (legacy directory binding via radiprotocol_subfolderPath) OR a specific snippet
  // file (new file binding via radiprotocol_snippetPath, D-01 mutual exclusivity on
  // write). Host wrapper class `rp-stp-editor-host` is defined in
  // src/styles/snippet-tree-picker.css (owned by Plan 02). This plan does NOT modify
  // CSS. See `docs/ARCHITECTURE-NOTES.md#snippet-node-binding-and-picker`.
  new Setting(container)
    .setName('Target')
    .setDesc(ctx.plugin.i18n.t('snippetForm.targetDesc'));

  const pickerHost = container.createDiv({ cls: CSS_CLASS.STP_EDITOR_HOST });

  const existingFilePath = nodeRecord['radiprotocol_snippetPath'];
  const existingFolderPath = nodeRecord['radiprotocol_subfolderPath'];
  const initialSelection =
    (typeof existingFilePath === 'string' && existingFilePath !== '')
      ? existingFilePath
      : (typeof existingFolderPath === 'string' && existingFolderPath !== '')
        ? existingFolderPath
        : undefined;

  // Lifecycle: dispatcher head unmounts any prior picker before delegation.
  // The single-site cleanup keeps the invariant clean; no defensive re-check needed.
  const picker = new SnippetTreePicker({
    app: ctx.app,
    snippetService: ctx.plugin.snippetService,
    container: pickerHost as unknown as HTMLElement,
    mode: 'both',
    rootPath: ctx.plugin.settings.snippetFolderPath,
    initialSelection,
    onSelect: (result) => {
      if (result.kind === 'folder') {
        // D-01 mutual exclusivity: setting folder clears file binding.
        ctx.pendingEdits['radiprotocol_subfolderPath'] = result.relativePath || undefined;
        ctx.pendingEdits['radiprotocol_snippetPath'] = undefined;
        // Phase 31 D-10 text-mirroring contract — folder path mirrored verbatim.
        ctx.pendingEdits['text'] = result.relativePath;
      } else {
        // File selection — D-01 mutual exclusivity: setting file clears folder binding.
        ctx.pendingEdits['radiprotocol_snippetPath'] = result.relativePath;
        ctx.pendingEdits['radiprotocol_subfolderPath'] = undefined;
        // Mirror basename-without-extension into text (canvas card label).
        const lastSlash = result.relativePath.lastIndexOf('/');
        const basename = lastSlash >= 0
          ? result.relativePath.slice(lastSlash + 1)
          : result.relativePath;
        const dot = basename.lastIndexOf('.');
        const stem = dot > 0 ? basename.slice(0, dot) : basename;
        ctx.pendingEdits['text'] = stem;
      }
      ctx.scheduleAutoSave();
    },
  });
  ctx.setSnippetTreePicker(picker);
  void picker.mount();

  // Phase 31 D-01: optional label shown on branch-list button when this snippet node
  // is reached as a variant of a question. Empty fallback = "📁 Snippet".
  const ta_snippetLabel = ctx.renderGrowableTextarea(container, {
    blockClass: 'rp-snippet-branch-label-block',
    label: 'Branch label',
    desc: 'Shown on the branch-list button when a question has outgoing edges to this snippet. Leave empty to use "📁 Snippet".',
    value: (nodeRecord['radiprotocol_snippetLabel'] as string | undefined) ?? '',
    onInput: (value) => {
      ctx.pendingEdits['radiprotocol_snippetLabel'] = value || undefined;
    },
  });
  // Phase 63 — capture for inbound canvas patches + blur-driven flush.
  // The Phase 50-mirror snippetLabel ↔ incoming-edge sync (Plan 01 + Plan 02
  // reconciler arm) writes the canonical edge-wins value back through the
  // same dispatch bus, so this site receives both author edits on canvas
  // AND reconciler-driven mirror updates.
  ctx.registerFieldRef('radiprotocol_snippetLabel', ta_snippetLabel);

  // Phase 31 D-04: per-node separator override. '' = use global default from settings.
  new Setting(container)
    .setName('Separator override')
    .setDesc('How the rendered snippet text is joined to the accumulated protocol. Default uses the global text separator setting.')
    .addDropdown(drop => {
      drop.addOption('', '— use global default —');
      drop.addOption('newline', 'Newline');
      drop.addOption('space', 'Space');
      const current = (nodeRecord['radiprotocol_snippetSeparator'] as string | undefined) ?? '';
      drop.setValue(current);
      drop.onChange(v => {
        ctx.pendingEdits['radiprotocol_snippetSeparator'] = (v === 'space' || v === 'newline') ? v : undefined;
        ctx.scheduleAutoSave();
      });
    });
}
