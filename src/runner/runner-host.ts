// runner/runner-host.ts
// Phase 75 DEDUP-01 — host adapter contract for shared runner rendering.
// Type-only module: host shells own Obsidian chrome, persistence, and lifecycle.
import type { App } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { Snippet } from '../snippets/snippet-model';
import { CSS_CLASS } from '../constants/css-classes';

export type RunnerHostKind = 'runner-view' | 'inline-modal';
export type SnippetCopyLocale = 'ru' | 'en';

export interface RunnerHost {
  readonly kind: RunnerHostKind;
  readonly app: App;
  readonly plugin: RadiProtocolPlugin;

  /** Host-specific click binding. RunnerView uses registerDomEvent; inline modal tracks disposers. */
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;

  /** CSS hook for SnippetTreePicker host layout. */
  readonly snippetPickerHostClass: typeof CSS_CLASS.STP_RUNNER_HOST | typeof CSS_CLASS.STP_INLINE_HOST;

  /** Preserves current RunnerView RU vs InlineRunnerModal EN copy divergence. */
  readonly snippetCopyLocale: SnippetCopyLocale;

  /** Called before runner mutations that must preserve host-local editable text. */
  onBeforeMutate?(): void;

  /** Called after runner mutations and before re-render. */
  onAfterMutate?(beforeText: string): void | Promise<void>;

  /** Host owns its render entrypoint. */
  requestRender(): void;

  /** Host owns fill-modal lifecycle and validation side-effects. */
  openSnippetFillModal(snippet: Snippet): Promise<string | null>;

  /** Host-specific snippet path resolution; inline modal preserves basename fallback. */
  resolveSnippetPath(snippetId: string): Promise<string> | string;

  /** Host-specific handling for unrecoverable snippet validation errors. */
  onSnippetValidationError(snippetId: string): void | Promise<void>;

  /** Renderer can guard async picker callbacks against detached inline modal DOM. */
  isStillMounted?(): boolean;

  /** Host-specific error chrome; RunnerView rebuilds whole view, inline renders in-zone. */
  renderError(messages: string[]): void;
}
