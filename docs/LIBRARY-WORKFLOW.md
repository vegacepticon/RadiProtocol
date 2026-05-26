# RadiProtocol Library Workflow

RadiProtocol can install clinical snippets from the external `vegacepticon/RadiProtocol-Library` repository.

## User workflow

1. Open the Snippet manager view.
2. Click **Library**.
3. Choose the library language: **Russian**, **English**, or **All**.
4. Browse folders or search snippets.
5. Click **Preview** to check placeholder behaviour.
6. Click **Install** or install the current folder/all snippets.

Installed snippets are written into the configured snippet folder as clinical `.md` files. Technical repository files such as scripts, schemas, generated metadata, CI config, and README files are not downloaded into the vault.

## Snippet formats

The plugin keeps backwards compatibility with:

- legacy JSON snippets (`.json`);
- plain Markdown snippets (`.md` without frontmatter);
- Markdown template snippets (`.md` with frontmatter).

Markdown template snippets are represented at runtime as `md-template` snippets. Their body is the template text. Placeholder definitions live in frontmatter and use the same `{{placeholder-id}}` syntax as legacy JSON snippets.

Preferred placeholder types for new library content:

- `free-text`;
- `choice`.

Deprecated legacy placeholder types such as `number` and `multi-choice` should not be used for new shared-library snippets.

## Maintainer contribution workflow

The old local-git Library Admin entrypoint is disabled. Maintainers should use the GitHub PR workflow instead.

Minimal Obsidian-side flow:

1. Create or edit a local structured snippet in the Snippet manager.
2. Right-click the snippet.
3. Choose **Export library contribution**.
4. The plugin writes a normalized Markdown template file to:

   ```text
   RadiProtocol Library Contributions/snippets/<lang>/<category>/<snippet>.md
   ```

5. Upload that file to `vegacepticon/RadiProtocol-Library` through GitHub web UI, create a branch/PR, and wait for CI validation.

The library repository CI validates generated indexes and frontmatter consistency before merge.

## Library repository layout

Expected public-library source layout:

```text
snippets/ru/**/*.md
snippets/en/**/*.md
protocols/ru/**/*.rp.json
protocols/en/**/*.rp.json
```

Generated public indexes:

```text
generated/index.ru.json
generated/index.en.json
generated/library.ru.json
generated/library.en.json
generated/protocols-index.ru.json
generated/protocols-index.en.json
```

Top-level `index.json`, `library.json`, and `protocols-index.json` are RU compatibility aliases for one transition release.

## Verification checklist

- `npm run build` in the plugin repository passes.
- `node scripts/generate-indexes.mjs` in the library repository passes.
- `node scripts/validate-library.mjs` in the library repository passes.
- Installing a RU snippet stores a `.md` clinical snippet under the configured vault snippet folder.
- Switching the browser to EN shows an empty state until EN content exists.
- Legacy JSON snippets and plain Markdown snippets still load and insert.
- Exporting a contribution creates a `.md` file under `RadiProtocol Library Contributions/...`.
