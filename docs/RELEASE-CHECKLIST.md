# RadiProtocol Release Checklist

Use this checklist before submitting or updating RadiProtocol in the Obsidian Community Plugin list.

## Scope

RadiProtocol ships as a desktop-only Obsidian plugin with no backend, no auth, no payments, and no automatic production deploy. Release artifacts are generated from TypeScript source by `npm run build`.

## Pre-release checks

Run from the repository root on the final release branch:

```bash
git fetch --all --tags --prune
git status --short --branch
node -e "for (const f of ['package.json','manifest.json']) console.log(f, require('./'+f).version)"
npm run check:release
git diff --check
```

`npm run check:release` includes:

- TypeScript build and production bundle generation.
- ESLint and Stylelint.
- Vitest suite.
- Planning freshness guard.
- Package/manifest/docs consistency guard.
- Agent docs guard.
- CSS class drift audit.
- i18n user-facing string audit.

## Versioning

Use npm's version workflow only:

```bash
npm version X.Y.Z
```

Do not run `node version-bump.mjs` directly. The npm lifecycle updates:

- `package.json`
- `package-lock.json`
- `manifest.json`
- `versions.json`
- git tag

RadiProtocol uses numeric tags because `.npmrc` sets `tag-version-prefix=""`:

```text
1.22.7
```

Do not create `v`-prefixed tags unless repairing an old release.

After the version bump, keep README latest-release text aligned with `manifest.json` and amend the version commit if needed.

## Required release assets

GitHub Release assets must contain exactly the Obsidian plugin install artifacts:

- `main.js`
- `styles.css`
- `manifest.json`

Verify they exist locally after build:

```bash
npm run build
ls -lh main.js styles.css manifest.json
```

After pushing the tag, verify GitHub Release assets directly before telling users to install through BRAT or Community plugins.

## BRAT smoke test

Before Community Plugin list submission or a stable release announcement:

1. Install/update RadiProtocol through BRAT from the target branch or release.
2. Confirm the plugin enables in Obsidian without console errors.
3. Open settings and verify protocol/snippet folder settings render.
4. Open the protocol editor and load/create a `.rp.json` protocol.
5. Run a protocol inline against a Markdown note.
6. Verify snippet insertion, placeholder fill-in, loop picker, Back/Skip, and final note write still work.
7. Verify root `styles.css` loaded from the release asset, not a dev vault stale copy.

## Community Plugin list readiness

Before creating/updating the Obsidian Community Plugin list PR:

- `manifest.json.id` is stable: `radiprotocol`.
- `manifest.json.name` is human-readable: `RadiProtocol`.
- `manifest.json.description` describes the current `.rp.json` guided workflow, not legacy Canvas-first behavior.
- `manifest.json.minAppVersion` is intentional.
- `manifest.json.isDesktopOnly` is intentional because local library admin/dev workflows use desktop capabilities.
- README installation and usage sections match current commands and UI.
- No secrets, `.env`, vault database, or local planning files are committed.
- The release tag points at the commit intended for users to install.
- The GitHub Release contains `main.js`, `styles.css`, and `manifest.json` built from that tag.

## Rollback

If a release is bad:

1. Do not force-push or delete history as first response.
2. Publish a patch release using `npm version patch` after fixing the issue.
3. If the tag/release assets are wrong before users installed it, delete/recreate the release tag only after confirming the desired commit and explaining the scope.
