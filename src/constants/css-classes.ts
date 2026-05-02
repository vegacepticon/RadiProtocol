// src/constants/css-classes.ts
// Phase 79 EXTRACT-TYPES-01 — typed constants for shared CSS class names.
// Only classes referenced in 2+ production TS files are included.

export const CSS_CLASS = {
  // Runner / inline shared
  QUESTION_ZONE: 'rp-question-zone',
  EMPTY_STATE_BODY: 'rp-empty-state-body',
  ERROR_TITLE: 'rp-error-title',

  // Snippet tree picker host wrappers
  STP_RUNNER_HOST: 'rp-stp-runner-host',
  STP_INLINE_HOST: 'rp-stp-inline-host',
  STP_EDITOR_HOST: 'rp-stp-editor-host',
} as const;

export type CssClass = typeof CSS_CLASS[keyof typeof CSS_CLASS];
