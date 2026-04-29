// src/__tests__/donate/wallets.test.ts
// Phase 71 NTC-D-04 — DONATE_WALLETS constant validation (anti-typo tripwire).
//
// A typo in any of these addresses means real cryptocurrency would be sent to a
// wrong wallet with no recovery path. These tests are the cheapest possible
// safety net — they assert the literal strings from REQUIREMENTS.md DONATE-01.

import { describe, it, expect } from 'vitest';
import { DONATE_WALLETS } from '../../donate/wallets';

describe('DONATE_WALLETS (Phase 71 NTC-D-04)', () => {
  it('contains exactly 4 entries', () => {
    expect(DONATE_WALLETS.length).toBe(4);
  });

  it('preserves the EVM → Bitcoin → Solana → Tron order', () => {
    expect(DONATE_WALLETS.map(w => w.name)).toEqual(['EVM', 'Bitcoin', 'Solana', 'Tron']);
  });

  it('has the exact addresses from REQUIREMENTS.md DONATE-01', () => {
    expect(DONATE_WALLETS[0]!.address).toBe('0x0B528dAF919516899617C536ec26D2d5ab7fB02A');
    expect(DONATE_WALLETS[1]!.address).toBe('bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7');
    expect(DONATE_WALLETS[2]!.address).toBe('HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA');
    expect(DONATE_WALLETS[3]!.address).toBe('TPBbBauXk56obAiQMSKzMQgsnUiea12hAB');
  });

  it('EVM entry lists the 6 networks in the canonical order', () => {
    expect(DONATE_WALLETS[0]!.networks).toEqual([
      'Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon',
    ]);
  });

  it('non-EVM entries omit the networks field (undefined, not empty array)', () => {
    expect(DONATE_WALLETS[1]!.networks).toBeUndefined();
    expect(DONATE_WALLETS[2]!.networks).toBeUndefined();
    expect(DONATE_WALLETS[3]!.networks).toBeUndefined();
  });
});