// src/utils/dom-helpers.ts
// Phase 81 TYPE-SAFETY-01 — typed wrappers over Obsidian DOM helpers.
// Reduces `as HTMLButtonElement` casts at hot-path call sites.

import type { Component } from 'obsidian';

interface ButtonOpts {
  cls?: string;
  text?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createButton(parent: HTMLElement, opts: ButtonOpts = {}): HTMLButtonElement {
  const btn = parent.createEl('button', {
    cls: opts.cls,
    text: opts.text,
    attr: opts.attr,
  });
  return btn as HTMLButtonElement;
}

interface InputOpts {
  cls?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createInput(parent: HTMLElement, opts: InputOpts = {}): HTMLInputElement {
  const input = parent.createEl('input', {
    cls: opts.cls,
    type: opts.type ?? 'text',
    placeholder: opts.placeholder,
    value: opts.value,
    attr: opts.attr,
  });
  return input as HTMLInputElement;
}

interface TextareaOpts {
  cls?: string;
  placeholder?: string;
  value?: string;
  attr?: Record<string, string | number | boolean>;
}

export function createTextarea(parent: HTMLElement, opts: TextareaOpts = {}): HTMLTextAreaElement {
  const ta = parent.createEl('textarea', {
    cls: opts.cls,
    placeholder: opts.placeholder,
    value: opts.value,
    attr: opts.attr,
  });
  return ta as HTMLTextAreaElement;
}

/**
 * Typed wrapper over `Component.registerDomEvent`.
 * Narrows the event type by event name so handlers are correctly typed.
 */
export function registerEvent<K extends keyof HTMLElementEventMap>(
  scope: Component,
  target: HTMLElement,
  event: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
): void {
  scope.registerDomEvent(target, event, handler);
}
