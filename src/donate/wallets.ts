// src/donate/wallets.ts
// Phase 71 (DONATE-01) — hard-coded crypto wallet constants for the Settings → donate section.
//
// Source of truth: docs/ARCHITECTURE-NOTES.md#donate-wallet-constants (literal addresses) and
// 71-CONTEXT.md decisions Row-D-02, EVM-D-02, EVM-D-03, NTC-D-01..03.
//
// IMPORTANT: Addresses are copied byte-for-byte from REQUIREMENTS.md.
// A typo here means the user sends crypto to a wrong wallet — there is no recovery.
// The companion test src/__tests__/donate/wallets.test.ts is the anti-typo tripwire.
//
// This module is intentionally Obsidian-free: no imports from 'obsidian', no DOM access,
// no runtime functions. It is pure data + types so the unit test runs without the
// obsidian mock.

interface DonateWallet {
  readonly name: string;
  readonly networks?: readonly string[];
  readonly address: string;
}

export const DONATE_WALLETS: ReadonlyArray<DonateWallet> = [
  {
    name: 'EVM',
    networks: ['Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon'],
    address: '0x0B528dAF919516899617C536ec26D2d5ab7fB02A',
  },
  {
    name: 'Bitcoin',
    address: 'bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7',
  },
  {
    name: 'Solana',
    address: 'HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA',
  },
  {
    name: 'Tron',
    address: 'TPBbBauXk56obAiQMSKzMQgsnUiea12hAB',
  },
];

// Phase 84 (I18N-01): user-facing strings moved to src/i18n/locales/*.json.
// Consumers should use plugin.i18n.t('donate.invitation') etc.