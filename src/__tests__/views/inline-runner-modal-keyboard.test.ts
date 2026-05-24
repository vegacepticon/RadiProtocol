// src/__tests__/views/inline-runner-modal-keyboard.test.ts
// TASK #88 — Keyboard shortcuts for InlineRunnerModal.
// Verifies that handleKeydown delegates to runner.stepBack / runner.redo /
// modal.close with the correct key combos, and that the input/textarea guard
// suppresses shortcuts while the user is typing.

import { describe, it, expect, vi } from 'vitest';
import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { makeBasePlugin, makeBaseApp } from '../runner/runner-renderer-host-fixtures';
import { TFile } from 'obsidian';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});

function makeTargetNote(): TFile {
  return new (TFile as any)('notes/target.md');
}

function makeKeyboardEvent(opts: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: { tagName: string } | null;
}): KeyboardEvent {
  return {
    key: opts.key,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    target: opts.target ?? null,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('InlineRunnerModal keyboard shortcuts (TASK #88)', () => {
  function setup() {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const targetNote = makeTargetNote();
    const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote);
    const stepBackSpy = vi.spyOn((modal as any).runner, 'stepBack').mockImplementation(() => {});
    const redoSpy = vi.spyOn((modal as any).runner, 'redo').mockImplementation(() => {});
    const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});
    const renderSpy = vi.spyOn(modal as any, 'render').mockImplementation(() => {});
    return { modal, stepBackSpy, redoSpy, closeSpy, renderSpy };
  }

  it('Ctrl+ArrowLeft calls stepBack then render', () => {
    const { modal, stepBackSpy, renderSpy, closeSpy, redoSpy } = setup();
    const ev = makeKeyboardEvent({ key: 'ArrowLeft', ctrlKey: true });
    (modal as any).handleKeydown(ev);
    expect(stepBackSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('Alt+ArrowLeft calls stepBack then render', () => {
    const { modal, stepBackSpy, renderSpy } = setup();
    const ev = makeKeyboardEvent({ key: 'ArrowLeft', altKey: true });
    (modal as any).handleKeydown(ev);
    expect(stepBackSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+ArrowRight calls redo then render', () => {
    const { modal, redoSpy, renderSpy, stepBackSpy, closeSpy } = setup();
    const ev = makeKeyboardEvent({ key: 'ArrowRight', ctrlKey: true });
    (modal as any).handleKeydown(ev);
    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('Alt+ArrowRight calls redo then render', () => {
    const { modal, redoSpy, renderSpy } = setup();
    const ev = makeKeyboardEvent({ key: 'ArrowRight', altKey: true });
    (modal as any).handleKeydown(ev);
    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('Escape calls close', () => {
    const { modal, closeSpy, stepBackSpy, redoSpy, renderSpy } = setup();
    const ev = makeKeyboardEvent({ key: 'Escape' });
    (modal as any).handleKeydown(ev);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('ignores shortcuts when an INPUT is focused', () => {
    const { modal, stepBackSpy, redoSpy, closeSpy, renderSpy } = setup();
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'ArrowLeft', ctrlKey: true, target: { tagName: 'INPUT' } }));
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'ArrowRight', ctrlKey: true, target: { tagName: 'INPUT' } }));
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'Escape', target: { tagName: 'INPUT' } }));
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when a TEXTAREA is focused', () => {
    const { modal, stepBackSpy, redoSpy, closeSpy, renderSpy } = setup();
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'ArrowLeft', ctrlKey: true, target: { tagName: 'TEXTAREA' } }));
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('ignores plain arrow keys without Ctrl/Alt', () => {
    const { modal, stepBackSpy, redoSpy, closeSpy, renderSpy } = setup();
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'ArrowLeft' }));
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'ArrowRight' }));
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys even with Ctrl/Alt', () => {
    const { modal, stepBackSpy, redoSpy, closeSpy, renderSpy } = setup();
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'Enter', ctrlKey: true }));
    (modal as any).handleKeydown(makeKeyboardEvent({ key: 'a', altKey: true }));
    expect(stepBackSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });
});
