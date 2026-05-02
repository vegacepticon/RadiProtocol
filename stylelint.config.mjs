/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Catch duplicated property declarations (copy-paste error)
    'declaration-block-no-duplicate-properties': true,

    // Catch invalid selectors
    'selector-pseudo-class-no-unknown': true,
    'selector-pseudo-element-no-unknown': true,
    'selector-type-no-unknown': true,

    // Project convention: per-feature files should have a Phase header comment.
    // stylelint does not have a built-in "required comment" rule;
    // we enforce this via custom message in CI docs, not lint gate.
    'comment-empty-line-before': null,

    // Allow BEM-like naming with prefixes
    'selector-class-pattern': null,

    // Disable noisy rules that conflict with Obsidian CSS variable usage
    'property-no-vendor-prefix': null,
    'value-no-vendor-prefix': null,

    // Disable rules that flag pre-existing patterns in legacy CSS files;
    // gate focuses on duplicated properties + invalid selectors only.
    'no-duplicate-selectors': null,
    'rule-empty-line-before': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'alpha-value-notation': null,
    'no-descending-specificity': null,
    'declaration-property-value-keyword-no-deprecated': null,

    // Allow empty blocks (placeholders)
    'block-no-empty': null,
  },
};
