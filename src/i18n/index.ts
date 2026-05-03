// src/i18n/index.ts
import { I18nService } from './i18n-service';

export { I18nService } from './i18n-service';
export type { Locale } from './i18n-service';

/** Phase 84 (I18N-02): Translator function shape used by pure modules
 *  (canvas-parser, graph-validator, protocol-runner) that have no plugin
 *  reference. Production callers pass `plugin.i18n.t.bind(plugin.i18n)`;
 *  pure-test sites can rely on the default English-only fallback. */
export type Translator = (key: string, params?: Record<string, string>, fallback?: string) => string;

/** Phase 84 (I18N-02): default English translator for pure modules constructed
 *  without a plugin reference (legacy zero-arg call sites in tests + dispatch
 *  paths that still construct a one-shot validator). Locale is fixed to 'en';
 *  do not mutate. */
const DEFAULT_EN_I18N = new I18nService('en');

export const defaultT: Translator = (key, params, fallback) =>
  DEFAULT_EN_I18N.t(key, params, fallback);

