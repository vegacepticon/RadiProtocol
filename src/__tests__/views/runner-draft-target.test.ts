import { describe, expect, it } from 'vitest';
import { RunnerDraftTarget } from '../../views/runner-draft-target';

function setup() {
  const note = { path: 'target.md' };
  const first = { file: note, editor: { id: 'first' }, getMode: () => 'source', save: async () => {} };
  const second = { file: note, editor: { id: 'second' }, getMode: () => 'source', save: async () => {} };
  const other = { file: { path: 'other.md' }, editor: { id: 'other' }, getMode: () => 'source', save: async () => {} };
  const leaves = [{ view: first }, { view: second }, { view: other }];
  const workspace = {
    activeEditor: second as typeof first | null,
    iterateAllLeaves: (callback: (leaf: typeof leaves[number]) => void) => leaves.forEach(callback),
  };
  const target = new RunnerDraftTarget({ workspace } as any, note as any);
  return { note, first, second, other, leaves, workspace, target };
}

describe('RunnerDraftTarget', () => {
  it('remembers the focused bound-note editor across Runner and unrelated-note focus', () => {
    const h = setup();
    expect(h.target.resolve()?.editor).toBe(h.second.editor);
    h.workspace.activeEditor = null;
    expect(h.target.resolve()?.editor).toBe(h.second.editor);
    h.workspace.activeEditor = h.other;
    expect(h.target.resolve()?.editor).toBe(h.second.editor);
    h.workspace.activeEditor = h.first;
    expect(h.target.resolve()?.editor).toBe(h.first.editor);
  });

  it('never uses another note and discards a closed or repurposed editor', () => {
    const h = setup();
    h.target.resolve();
    h.leaves.splice(1, 1);
    expect(h.target.resolve()?.editor).toBe(h.first.editor);
    h.first.file = { path: 'different.md' };
    expect(h.target.resolve()).toBeNull();
  });

  it('tracks renames by the bound file object and refuses reading mode', () => {
    const h = setup();
    h.note.path = 'renamed.md';
    expect(h.target.resolve()?.editor).toBe(h.second.editor);
    h.first.getMode = () => 'preview';
    h.second.getMode = () => 'preview';
    expect(h.target.resolve()).toBeNull();
  });
});
