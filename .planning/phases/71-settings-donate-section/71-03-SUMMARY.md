---
phase: 71-settings-donate-section
plan: 03
status: complete
completed: 2026-04-29
wave: 2
autonomous: false
---

## Plan 71-03 Summary

**Plan:** Insert "Помочь разработке" donate section into Settings tab
**Completed:** 2026-04-29
**Wave:** 2
**Commits:** `27ad737` — `feat(71-03): insert Помочь разработке donate section into settings tab`

### What was built

Updated `src/settings.ts` to render the donate section as the first/top-most block of the Settings tab:

1. **Extended obsidian import** (line 3): Added `Notice` to `{ PluginSettingTab, Setting, Notice }`
2. **Added donate constants import** (lines 7-11): `DONATE_WALLETS`, `DONATE_INVITATION_TEXT`, `DONATE_NOTICE_TEXT`, `DONATE_TOOLTIP_TEXT` from `./donate/wallets`
3. **Inserted donate section** (lines 64-100): After `containerEl.empty()`, before `// Group 1 — Runner`

The donate block renders:
- Heading: `new Setting(containerEl).setName('Помочь разработке').setHeading()`
- Invitation paragraph with `cls: 'rp-donate-intro'`
- Four wallet rows (EVM → Bitcoin → Solana → Tron), each with:
  - Name and network description (EVM shows six networks separated by ` · `)
  - Full address inside `<code class="rp-donate-address">` via `setting.descEl.createEl()`
  - Copy button with tooltip and `void navigator.clipboard.writeText(address).then(() => new Notice(...))`

### Key implementation decisions

- **Broke method chain to avoid `.then()` bug**: The Obsidian `Setting` class's `.then()` is synchronous (returns the Setting), not a Promise chain. Using `.then(setting => { setting.descEl.createEl(...) })` alongside `.addExtraButton()` caused test failures. Fixed by storing the Setting in a variable first: `const setting = new Setting(...); setting.descEl.createEl(...); setting.addExtraButton(...)`.
- **Mock updated for test isolation**: `src/__mocks__/obsidian.ts` `Setting` mock now includes `descEl: MockElement` and `addExtraButton()` to support the new API usage. All 64 test files (818 tests) pass.

### Verification

| Check | Result |
|-------|--------|
| `npm run build` | PASS — TypeScript compiles cleanly |
| `npm test` | PASS — 818/818 tests passing |
| `grep "Помочь разработке" src/settings.ts` | 1 occurrence |
| `grep "DONATE_WALLETS" src/settings.ts` | present |
| `grep "void navigator.clipboard.writeText" src/settings.ts` | present |
| `grep "new Notice(DONATE_NOTICE_TEXT)" src/settings.ts` | present |
| `grep "rp-donate-address" src/settings.ts` | present |
| All 4 existing group comments preserved | PASS |

### Next step

Human UAT verification (Task 2, checkpoint:human-verify) requires testing in a live Obsidian dev vault to confirm:
1. Section appears top-most (above Runner/Protocol/Output/Storage)
2. Four rows in correct order with full addresses
3. Copy button → Notice fires correctly
4. No regressions in existing settings groups

The phase cannot be marked complete until human verification passes.