import type { WorkspaceLeaf } from 'obsidian';

/** Obsidian has no supported onClose veto. Intercept only this leaf's native
 * tab close gestures before detach starts; never patch workspace methods.
 * Commands, app shutdown and programmatic detach remain outside this guard.
 */
export function guardRunnerTabClose(
  leaf: WorkspaceLeaf,
  hasUninsertedDraft: () => boolean,
  requestClose: () => void,
  eventRoot: Document = document,
): () => void {
  const intercept = (event: MouseEvent): void => {
    const header = (leaf as WorkspaceLeaf & { tabHeaderEl?: HTMLElement }).tabHeaderEl;
    const target = event.target as Element | null;
    if (header === undefined || target === null || typeof target.closest !== 'function' || !header.contains(target)
      || !hasUninsertedDraft()) return;
    const closeClick = event.type === 'click' && event.button === 0
      && target.closest('.workspace-tab-header-inner-close-button') !== null;
    const middleClick = event.type === 'auxclick' && event.button === 1;
    if (!closeClick && !middleClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requestClose();
  };
  eventRoot.addEventListener('click', intercept, true);
  eventRoot.addEventListener('auxclick', intercept, true);
  return () => {
    eventRoot.removeEventListener('click', intercept, true);
    eventRoot.removeEventListener('auxclick', intercept, true);
  };
}
