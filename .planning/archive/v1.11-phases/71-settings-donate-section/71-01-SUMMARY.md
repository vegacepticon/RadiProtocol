---
phase: "71"
plan: "01"
subsystem: "settings-donate-section"
tags: ["DONATE-01", "constants", "anti-phishing", "NTC-D-04"]
dependency_graph:
  requires: []
  provides: ["src/donate/wallets.ts: DONATE_WALLETS + DonateWallet + text constants", "src/__tests__/donate/wallets.test.ts: 5-invariant tripwire"]
  affects: ["src/settings.ts (Plan 03 will import DONATE_WALLETS)"]
tech_stack:
  added: ["src/donate/wallets.ts (pure TypeScript, no Obsidian imports)", "src/__tests__/donate/wallets.test.ts (vitest, no mock)"]
  patterns: ["ReadonlyArray<T> typed constants", "Obsidian-free module for test isolation"]
key_files:
  created:
    - "src/donate/wallets.ts"
    - "src/__tests__/donate/wallets.test.ts"
decisions:
  - id: "NTC-D-03"
    description: "DONATE_WALLETS in src/donate/wallets.ts with DonateWallet interface + text constants exported from same module"
  - id: "NTC-D-04"
    description: "5 invariant tests: length, order, exact addresses, EVM networks order, undefined networks for BTC/SOL/TRX"
metrics:
  duration: "PT2M"
  completed: "2026-04-29T19:16:00Z"
---

# Phase 71 Plan 01 Summary

## One-liner

DONATE_WALLETS constants module and anti-typo vitest tripwire for four crypto wallet addresses.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create constants module src/donate/wallets.ts | 3a58e6a | src/donate/wallets.ts |
| 2 | Create unit test src/__tests__/donate/wallets.test.ts | 03d28de | src/__tests__/donate/wallets.test.ts |

## What Was Built

**`src/donate/wallets.ts`** — Obsidian-free TypeScript constants module containing:
- `DonateWallet` interface: `{ readonly name: string; readonly networks?: readonly string[]; readonly address: string }`
- `DONATE_WALLETS: ReadonlyArray<DonateWallet>` — 4 entries in EVM → Bitcoin → Solana → Tron order
  - EVM: `0x0B528dAF919516899617C536ec26D2d5ab7fB02A` with networks `['Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon']`
  - Bitcoin: `bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7` (no networks field)
  - Solana: `HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA` (no networks field)
  - Tron: `TPBbBauXk56obAiQMSKzMQgsnUiea12hAB` (no networks field)
- `DONATE_INVITATION_TEXT` — Russian invitation string
- `DONATE_NOTICE_TEXT` — Russian copy confirmation
- `DONATE_TOOLTIP_TEXT` — Russian copy tooltip

**`src/__tests__/donate/wallets.test.ts`** — 5 invariant tests (NTC-D-04):
1. `DONATE_WALLETS.length === 4`
2. Order: `['EVM', 'Bitcoin', 'Solana', 'Tron']`
3. Exact 4 addresses from REQUIREMENTS.md DONATE-01
4. EVM networks in canonical order: `['Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon']`
5. BTC/SOL/TRX `networks === undefined` (not empty array)

## Verification

- ✅ `npm run build` exits 0 (TypeScript compiles cleanly)
- ✅ `npm test -- src/__tests__/donate/wallets.test.ts` — 5/5 tests passing
- ✅ All 4 wallet addresses verified present in wallets.ts
- ✅ Module is Obsidian-free (no `from 'obsidian'` import)
- ✅ Does not use `as const` — explicit `ReadonlyArray<DonateWallet>` type annotation

## Deviations from Plan

None — plan executed exactly as written.

## Ready for Downstream

Constants module (`src/donate/wallets.ts`) is ready to be imported by `src/settings.ts` in Plan 03 to render the "Помочь разработке" donate section at the top of the Settings tab.