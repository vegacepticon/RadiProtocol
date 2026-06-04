---
date: 2026-06-04T19:01:08+0300
author: Roman Shulgha
commit: b145f15
branch: main
repository: RadiProtocol
topic: "Conservative cleanup, documentation, and release process"
tags: [plan, cleanup, documentation, release, github-actions, scripts]
status: ready
parent: .rpiv/artifacts/research/2026-06-04_18-40-54_conservative-cleanup-docs-release-process.md
phase_count: 4
unresolved_phase_count: 0
last_updated: 2026-06-04T19:01:08+0300
last_updated_by: Roman Shulgha
---

# Conservative Cleanup, Documentation, and Release Process Implementation Plan

## Overview
This plan turns the cleanup research into four conservative implementation slices: split the bilingual README without preserving version-drift text, restore the package-referenced repository gates, align release automation with the restored release gate, and remove one verified unused test mock export. The approach preserves Obsidian plugin behavior, avoids generated root asset edits, and keeps all process checks grounded in existing package/workflow contracts.

## Requirements
- Preserve current plugin runtime behavior and avoid broad refactors.
- Split bilingual README content into `README.md` (English) and `README.ru.md` (Russian).
- Remove hardcoded latest-release lines from README surfaces; point users to GitHub Releases instead.
- Remove broken `docs/` links rather than recreating the `docs/` directory.
- Restore the five missing `scripts/*.mjs` gates referenced by `package.json`.
- Keep `.github` active and align release automation with restored `npm run check:release`.
- Keep `.githooks` optional; document enabling hooks but do not add an installer.
- Remove `src/__mocks__/obsidian.ts` `requestUrl` only if targeted grep and repo gates cover it.
- Never directly edit generated root `main.js` or `styles.css`.

## Current State Analysis
The repository already declares the desired gates and release surfaces, but some referenced files are absent. Documentation also carries duplicated release version text and broken links to missing docs.

### Key Discoveries
- `package.json:13-19` references `check:planning`, `check:consistency`, `check:agent-docs`, `check:css`, `audit:i18n`, `check`, and `check:release`, but `find scripts` returns no files.
- `.github/workflows/ci.yml:29-45` already consumes three package checks after build/lint/test.
- `.github/workflows/release.yml:31-38` runs only build/lint/test before version verification and upload, weaker than `package.json:19` release intent.
- `.github/workflows/release.yml:54-57` uploads `main.js`, `styles.css`, and `manifest.json`; these remain required release artifacts.
- `README.md:7` and `README.md:92` hardcode latest release text outside `version-bump.mjs:3-16` propagation.
- `README.md:80-82` and `README.md:165-167` link missing `docs/` files; developer chose to remove links rather than restore docs.
- `.githooks/pre-commit:10-34` and `.githooks/pre-push:10-11` define useful optional local gates, but `package.json:6-20` has no hook installer.
- `esbuild.config.mjs:52-57` writes generated root `styles.css`; `esbuild.config.mjs:100-123` writes generated root `main.js`.
- `user-intention.md:29-32` requires full checks, generated-output discipline, and numeric release tags.
- `.rpiv/guidance/architecture.md:24-31` documents the command surface now used for agent guidance; no tracked `CLAUDE.md` exists.
- `vitest.config.ts:6-7` aliases `obsidian` to `src/__mocks__/obsidian.ts`; `src/__mocks__/obsidian.ts:308-310` exports unused test-only `requestUrl`.

## Desired End State
```bash
# Local/CI gates restored
npm run check:planning
npm run check:consistency
npm run check:agent-docs
npm run check:css
npm run audit:i18n
npm run check
npm run check:release
```

```yaml
# Release workflow shape after scripts exist
- name: Release checks
  run: npm run check:release

- name: Verify version matches tag
  run: |
    TAG=${GITHUB_REF#refs/tags/}
    TAG_STRIPPED=${TAG#v}
    MANIFEST_VERSION=$(node -p "require('./manifest.json').version")
    test "$TAG_STRIPPED" = "$MANIFEST_VERSION"
```

```md
<!-- README.md -->
# RadiProtocol

[Русская версия](README.ru.md)

Download `main.js`, `styles.css`, and `manifest.json` from the latest GitHub release.
```

```md
<!-- README.ru.md -->
# RadiProtocol на русском

[English version](README.md)

Скачайте `main.js`, `styles.css` и `manifest.json` из последнего GitHub release.
```

## What We're NOT Doing
- Not recreating the `docs/` directory or restoring old docs links; developer chose link removal.
- Not adding a hook installer, Husky, Lefthook, or `prepare` script; `.githooks` remain optional local tooling.
- Not editing generated root `main.js` or `styles.css` directly.
- Not removing deprecated legacy loop support or other runtime compatibility paths.
- Not changing version numbers or release tags.
- Not making broad CSS/i18n/source cleanup beyond the one approved unused mock export.
- Not changing Obsidian plugin commands, settings, runner behavior, parser behavior, graph validation, or snippet behavior.

## Decisions

### Restore missing package gates as read-only ESM scripts
`package.json:13-19` already defines the script surface, and the developer confirmed missing scripts are accidental drift. Restore the five `scripts/*.mjs` files as small Node ESM checks modeled after `version-bump.mjs:1-16`, with clear output and nonzero exits only for blocking checks.

### Use `.rpiv/guidance` as the agent-docs source
Ambiguity: old historical `check-agent-docs.mjs` expected `CLAUDE.md` and tracked `docs/`, but the current checkout has tracked `.rpiv/guidance/*.md` and no tracked `CLAUDE.md` or `docs/`.
Explored:
- Option A: recreate `CLAUDE.md`/`docs` to satisfy old script. Pro: mirrors old history. Con: contradicts developer choice to remove docs links and current guidance architecture.
- Option B: adapt `check-agent-docs.mjs` to verify `.rpiv/guidance/architecture.md` plus layer guidance. Pro: matches `.rpiv/guidance/architecture.md:3-31` and current session guidance. Con: differs from historical script internals.
Decision: use Option B.

### Remove broken docs links instead of recreating docs
Developer checkpoint: for missing docs linked at `README.md:80-82` and `README.md:165-167`, choose **Remove links**. README split keeps user docs self-contained and does not create `docs/` files.

### Align release workflow to `npm run check:release`
Developer checkpoint: after restoring scripts, `.github/workflows/release.yml:31-38` should be replaced with a single `Release checks` step running `npm run check:release`, then keep the existing tag-vs-manifest check and release asset upload.

### Include unused test mock removal
Developer checkpoint: include removal of `src/__mocks__/obsidian.ts:308-310` `requestUrl` because it is test-only (`vitest.config.ts:6-7`) and current grep found no references.

### Keep generated root assets untouched
Root `main.js` and `styles.css` are ignored build outputs (`.gitignore:5-8`) but required release assets (`.github/workflows/release.yml:54-57`). Any generated changes must come from `npm run build`, not source-editing generated artifacts.

### Keep `.githooks` optional
`.githooks/pre-commit:10-34` and `.githooks/pre-push:10-11` are useful local gates, but no package installer config exists. Document optional `git config core.hooksPath .githooks`; do not add automatic hook installation.

## Phase 1: README split and release-text cleanup

### Overview
This phase removes duplicated README version state and broken docs links while preserving all user-facing installation/workflow content. Depends on no prior phases; later gate scripts will validate this post-split documentation shape.

### Changes Required:

#### 1. README.md
**File**: README.md
**Changes**: MODIFY — keep English content only, add Russian cross-link, remove latest-release line, remove missing docs links, and add optional contributor hook notes.
```md
# RadiProtocol

[Русская версия](README.ru.md)

RadiProtocol is an [Obsidian](https://obsidian.md) plugin for radiologists who want to run structured examination protocols inside their reporting vault. It turns a protocol into a guided clinical checklist: choose the relevant branch, insert prepared report text or snippets, repeat sections for multiple findings, and write the generated text into the active Markdown note.

Protocols are authored as **`.rp.json`** files in the built-in visual protocol editor. Legacy `.canvas` protocol files can still be used and migrated, but new protocol work should use `.rp.json`.

## What RadiProtocol helps with

- **Standardized radiology reporting.** Encode local protocols, modality workflows, follow-up recommendations, or structured report templates as reusable decision trees.
- **Guided branching.** Question and answer nodes let the radiologist choose the clinically appropriate path without searching through long static templates.
- **Reusable report fragments.** Snippet nodes insert prepared text from a configurable snippet folder. JSON snippets can ask for typed placeholders such as free text, choice, multi-choice, number, or date.
- **Repeated findings.** Loop nodes support workflows such as multiple lesions, multiple nodules, repeated measurements, or several anatomical levels.
- **Inline note-anchored execution.** The runner opens as a draggable inline panel over the active Markdown note and appends the selected protocol output to that note.
- **Visual protocol authoring.** The protocol editor supports start, question, answer, text-block, snippet, and loop nodes connected as a graph.

## Typical clinical workflow

1. Open or create the Markdown note for the examination report.
2. Run **Run protocol in inline** from the command palette.
3. Select a protocol from the configured protocol folder.
4. Answer each clinical question in the inline runner.
5. Fill snippet placeholders when prompted.
6. Review the generated text appended to the note and edit it as needed before final reporting.

RadiProtocol is a documentation aid. The radiologist remains responsible for clinical judgment, wording, and final report validation.

## Installation

### BRAT (recommended)

1. Install the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings, choose **Add Beta plugin** and paste the GitHub URL of this repository.
3. Enable **RadiProtocol** in Obsidian's Community plugins list.

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest [GitHub release](https://github.com/vegacepticon/RadiProtocol/releases).
2. Copy those files into `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Reload Obsidian.
4. Enable **RadiProtocol** in Obsidian's Community plugins list.

## Setup

1. Open RadiProtocol settings.
2. Set **Protocol folder** to the vault-relative folder that contains `.rp.json` protocol files.
3. Set **Snippet folder** to the vault-relative folder that contains snippet JSON or Markdown files.
4. Choose the preferred text separator for accumulated report text: newline or space.
5. Select the interface language if needed.

## Creating a protocol

1. Run **Open protocol editor**.
2. Create or open a `.rp.json` protocol file in the configured protocol folder.
3. Add a **Start** node.
4. Add clinical **Question** nodes and connect them to **Answer** nodes or other protocol nodes.
5. Use **Text block** nodes for fixed report text.
6. Use **Snippet** nodes to insert reusable report fragments from a file or folder.
7. Use **Loop** nodes when the same reporting section may need to be repeated.
8. Save the protocol and test it with **Run protocol in inline** on a Markdown note.

## Snippets

RadiProtocol supports two snippet types:

- **Markdown snippets**: inserted as written.
- **JSON snippets**: structured snippets with placeholders that are filled during protocol execution.

A snippet node can point to a specific snippet file or to a directory. When it points to a directory, the inline runner lets the user choose one snippet from that directory during execution.

## Existing `.canvas` protocols

Existing JSON Canvas protocol files remain supported for compatibility. Use **Convert Canvas protocol to .rp.json** when you are ready to migrate them to the current protocol format. New protocols should be created as `.rp.json`.

## For contributors

Repository hooks live in `.githooks/` and are optional for each local clone. To enable them, run:

`git config core.hooksPath .githooks`

The pre-commit hook runs staged TypeScript/CSS lint plus affected Vitest tests. The pre-push hook runs `npm run check`. Bypass hooks only when you have a clear reason and run the equivalent checks manually before opening a pull request.

For releases, use `npm version X.Y.Z` so `manifest.json` and `versions.json` are updated by the version lifecycle. Git tags are numeric because `.npmrc` sets an empty tag prefix. Release assets are `main.js`, `styles.css`, and `manifest.json` from the latest GitHub release.

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
```

#### 2. README.ru.md
**File**: README.ru.md
**Changes**: NEW — move Russian README content into its own file with English cross-link and no hardcoded latest-release line or docs links.
```md
# RadiProtocol на русском

[English version](README.md)

RadiProtocol — плагин для [Obsidian](https://obsidian.md), который помогает врачу-рентгенологу выполнять структурированные протоколы исследования прямо в рабочем хранилище. Плагин превращает протокол в пошаговый клинический сценарий: выберите нужную ветку, вставьте готовый текст или сниппет, повторите раздел для нескольких находок и добавьте сформированный текст в активную Markdown-заметку.

Протоколы создаются как файлы **`.rp.json`** во встроенном визуальном редакторе. Старые протоколы `.canvas` всё ещё поддерживаются и могут быть конвертированы, но новые протоколы следует создавать в формате `.rp.json`.

## Для чего нужен RadiProtocol

- **Стандартизация радиологических заключений.** Можно оформить локальные протоколы, алгоритмы по модальностям, рекомендации по follow-up или шаблоны структурированных заключений как дерево решений.
- **Пошаговые клинические ветвления.** Узлы вопросов и ответов помогают выбрать подходящий клинический путь без поиска по длинным статическим шаблонам.
- **Повторно используемые фрагменты текста.** Узлы сниппетов вставляют подготовленный текст из настроенной папки. JSON-сниппеты могут запрашивать плейсхолдеры: свободный текст, выбор, множественный выбор, число или дату.
- **Повторяющиеся находки.** Узлы циклов подходят для нескольких очагов, узлов, измерений, анатомических уровней или других повторяемых разделов.
- **Inline-запуск поверх заметки.** Runner открывается как перетаскиваемая inline-панель над активной Markdown-заметкой и добавляет выбранный текст протокола в эту заметку.
- **Визуальное создание протоколов.** Редактор протоколов поддерживает узлы старта, вопроса, ответа, текстового блока, сниппета и цикла, соединённые в граф.

## Типичный клинический сценарий

1. Откройте или создайте Markdown-заметку для заключения.
2. Запустите команду **Run protocol in inline** из палитры команд.
3. Выберите протокол из настроенной папки протоколов.
4. Ответьте на клинические вопросы в inline runner.
5. Заполните плейсхолдеры сниппетов, если они появятся.
6. Проверьте добавленный в заметку текст и при необходимости отредактируйте его перед финальным заключением.

RadiProtocol помогает оформлять документацию. Клиническое решение, формулировки и финальная проверка заключения остаются ответственностью врача.

## Установка

### Через BRAT (рекомендуется)

1. Установите [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. В настройках BRAT выберите **Add Beta plugin** и вставьте GitHub URL этого репозитория.
3. Включите **RadiProtocol** в списке Community plugins Obsidian.

### Ручная установка

1. Скачайте `main.js`, `styles.css` и `manifest.json` из последнего [GitHub release](https://github.com/vegacepticon/RadiProtocol/releases).
2. Скопируйте эти файлы в `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Перезагрузите Obsidian.
4. Включите **RadiProtocol** в списке Community plugins.

## Настройка

1. Откройте настройки RadiProtocol.
2. Укажите **Protocol folder** — папку в хранилище, где лежат файлы протоколов `.rp.json`.
3. Укажите **Snippet folder** — папку в хранилище, где лежат JSON- или Markdown-сниппеты.
4. Выберите разделитель накопленного текста заключения: новая строка или пробел.
5. При необходимости выберите язык интерфейса.

## Создание протокола

1. Запустите **Open protocol editor**.
2. Создайте или откройте `.rp.json` файл в настроенной папке протоколов.
3. Добавьте узел **Start**.
4. Добавьте клинические узлы **Question** и соедините их с узлами **Answer** или другими узлами протокола.
5. Используйте **Text block** для фиксированного текста заключения.
6. Используйте **Snippet** для вставки повторно используемых фрагментов из файла или папки.
7. Используйте **Loop**, если один и тот же раздел может повторяться.
8. Сохраните протокол и проверьте его командой **Run protocol in inline** на Markdown-заметке.

## Сниппеты

RadiProtocol поддерживает два типа сниппетов:

- **Markdown-сниппеты**: вставляются как обычный текст.
- **JSON-сниппеты**: структурированные сниппеты с плейсхолдерами, которые заполняются во время выполнения протокола.

Узел сниппета может ссылаться на конкретный файл или на папку. Если выбрана папка, inline runner во время выполнения предложит выбрать один сниппет из этой папки.

## Существующие `.canvas` протоколы

Старые протоколы JSON Canvas остаются доступными для совместимости. Используйте команду **Convert Canvas protocol to .rp.json**, когда будете готовы перенести их в текущий формат. Новые протоколы следует создавать как `.rp.json`.

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
```

### Success Criteria:

#### Automated Verification:
- [x] README hardcoded release text is removed: `grep -R "Latest release\|Последний релиз" README.md README.ru.md` returns no matches.
- [x] README docs links are removed: `grep -R "docs/" README.md README.ru.md` returns no matches.
- [x] Russian README exists and is linked from English README: `grep -F "[Русская версия](README.ru.md)" README.md && test -f README.ru.md`.
- [x] English README is linked from Russian README: `grep -F "[English version](README.md)" README.ru.md`.

#### Manual Verification:
- [x] `README.md` contains only English user/contributor content and no Russian section.
- [x] `README.ru.md` contains the Russian user content and no duplicated hardcoded latest-release version.
- [x] Manual installation instructions in both README files still name `main.js`, `styles.css`, and `manifest.json` as release assets.

## Phase 2: Restore repository gate scripts

### Overview
This phase restores the five package-referenced read-only checks after Phase 1 creates the documentation shape those checks enforce. Depends on Phase 1.

### Changes Required:

#### 1. scripts/check-planning-freshness.mjs
**File**: scripts/check-planning-freshness.mjs
**Changes**: NEW — restore planning freshness and package/manifest alignment check.
```js
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const warnOnly = process.argv.includes('--warn-only');

function fail(message) {
  failures.push(message);
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;

if (packageVersion !== manifestVersion) {
  fail(`package.json version ${packageVersion} does not match manifest.json version ${manifestVersion}`);
}

const trackedPlanningFiles = runGit(['ls-files', '.planning']).split('\n').filter(Boolean);
if (trackedPlanningFiles.length > 0) {
  fail(`.planning/ has tracked files in git index — run: git rm --cached -rf .planning/\n${trackedPlanningFiles.map((file) => `  ${file}`).join('\n')}`);
}

const trackedSourceFiles = runGit(['ls-files', 'src']).split('\n').filter(Boolean);
for (const file of trackedSourceFiles) {
  if (!/\.(?:ts|tsx|css)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('.planning/')) {
    fail(`${file}: source file references gitignored .planning/ path`);
  }
}

if (existsSync('.planning/STATE.md')) {
  const state = readFileSync('.planning/STATE.md', 'utf8');
  const versionRegex = new RegExp(`v?${escapeRegExp(packageVersion)}`);
  if (!versionRegex.test(state)) {
    fail(`.planning/STATE.md does not mention current package version ${packageVersion}`);
  }

  if (!state.includes('Planning Cleanup Notes')) {
    fail('.planning/STATE.md is missing Planning Cleanup Notes section');
  }
}

if (failures.length > 0) {
  console.error('Planning freshness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnOnly) process.exit(0);
  process.exit(1);
}

console.log('Planning freshness check passed.');
```

#### 2. scripts/check-consistency.mjs
**File**: scripts/check-consistency.mjs
**Changes**: NEW — enforce version surface alignment, README split invariants, no broken docs links, no stale planning/source references, and advisory knip output.
```js
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const errors = [];
const warnings = [];

function fail(message) { errors.push(`❌ ${message}`); }
function warn(message) { warnings.push(`⚠️  ${message}`); }
function info(message) { console.log(`  ${message}`); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readText(path) { return readFileSync(path, 'utf8'); }
function git(args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function trackedFiles(pathspec) { return git(['ls-files', pathspec]).split('\n').filter(Boolean); }

console.log('\n▸ Check 1: version surfaces');
const pkg = readJson('package.json');
const manifest = readJson('manifest.json');
const lock = readJson('package-lock.json');
const versions = readJson('versions.json');

if (pkg.version !== manifest.version) fail(`package.json version "${pkg.version}" !== manifest.json version "${manifest.version}"`);
else info(`OK: package.json "${pkg.version}" ↔ manifest.json "${manifest.version}"`);

if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail(`package-lock.json root versions must both equal package.json version "${pkg.version}"`);
else info(`OK: package-lock.json mirrors package version "${pkg.version}"`);

if (versions[manifest.version] !== manifest.minAppVersion) fail(`versions.json["${manifest.version}"] must equal manifest minAppVersion "${manifest.minAppVersion}"`);
else info(`OK: versions.json maps ${manifest.version} → ${manifest.minAppVersion}`);

console.log('\n▸ Check 2: README split and release text');
if (!existsSync('README.md')) fail('README.md is missing');
if (!existsSync('README.ru.md')) fail('README.ru.md is missing');

const readme = existsSync('README.md') ? readText('README.md') : '';
const readmeRu = existsSync('README.ru.md') ? readText('README.ru.md') : '';
const latestReleaseRe = /Latest release|Последний релиз/;
const docsLinkRe = /\bdocs\//;

if (!readme.includes('[Русская версия](README.ru.md)')) fail('README.md must link to README.ru.md with [Русская версия](README.ru.md)');
if (!readmeRu.includes('[English version](README.md)')) fail('README.ru.md must link back to README.md with [English version](README.md)');
if (latestReleaseRe.test(readme) || latestReleaseRe.test(readmeRu)) fail('README files must not hardcode latest-release text; link to GitHub Releases instead');
if (docsLinkRe.test(readme) || docsLinkRe.test(readmeRu)) fail('README files must not link missing docs/ paths');
for (const asset of ['main.js', 'styles.css', 'manifest.json']) {
  if (!readme.includes(asset) || !readmeRu.includes(asset)) fail(`Both README files must mention release asset ${asset}`);
}
if (errors.length === 0) info('OK: README split invariants hold');

console.log('\n▸ Check 3: stale .planning/ references in tracked files');
let planningRefs = [];
try { planningRefs = git(['grep', '--name-only', '\\.planning/', '--', ':(exclude).planning/*']).split('\n').filter(Boolean); }
catch { planningRefs = []; }
const planningPolicyFiles = new Set(['.gitignore', 'eslint.config.mjs', 'scripts/check-planning-freshness.mjs', 'scripts/check-consistency.mjs']);
const stalePlanningRefs = planningRefs.filter((file) => !planningPolicyFiles.has(file) && !file.startsWith('.rpiv/artifacts/'));
if (stalePlanningRefs.length > 0) fail(`${stalePlanningRefs.length} tracked file(s) have stale .planning/ references:\n${stalePlanningRefs.map((file) => `    ${file}`).join('\n')}`);
else info(`OK: no stale tracked .planning/ references (${planningRefs.length} total reference file(s))`);

console.log('\n▸ Check 4: phantom source references');
const phantomPatterns = ['runner-view.ts', 'session-recovery-coordinator.ts', 'SessionService', 'sessionFolderPath'];
const srcFiles = trackedFiles('src/**/*.ts');
let phantomFound = 0;
for (const pattern of phantomPatterns) {
  const matches = [];
  for (const file of srcFiles) {
    if (readText(file).includes(pattern)) matches.push(file);
  }
  const nonTestMatches = matches.filter((file) => !file.includes('__tests__'));
  if (nonTestMatches.length > 0) {
    warn(`Phantom ref "${pattern}" found in: ${nonTestMatches.join(', ')}`);
    phantomFound++;
  }
}
if (phantomFound === 0) info('OK: no phantom references in source');

console.log('\n▸ Check 5: stale phase anchors in TODO/FIXME');
const phasePattern = /TODO\s+(Phase\s+\d+|Plan\s+\d+)|FIXME\s+(Phase\s+\d+|Plan\s+\d+)/;
const todoHits = [];
for (const file of srcFiles) {
  readText(file).split('\n').forEach((line, index) => {
    if (phasePattern.test(line)) todoHits.push(`${file}:${index + 1}: ${line.trim()}`);
  });
}
if (todoHits.length > 0) warn(`Found ${todoHits.length} stale phase-anchored TODO/FIXME:\n${todoHits.map((hit) => `    ${hit}`).join('\n')}`);
else info('OK: no stale phase references in TODO/FIXME');

console.log('\n▸ Check 6: unused exports advisory');
try {
  const knip = execSync('npx knip --reporter compact 2>&1', { encoding: 'utf8', timeout: 60000 });
  if (/Unused (exports|files|dependencies)/i.test(knip)) warn(`Knip reported possible unused code:\n${knip.trim()}`);
  else info('OK: knip reports no unused exports/files/dependencies');
} catch (error) {
  warn(`Knip advisory skipped or reported issues: ${error.message}`);
}

console.log('\n═══════════════════════════════════════════════');
if (errors.length > 0) {
  console.log(`❌ FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
  errors.forEach((error) => console.log(`  ${error}`));
  warnings.forEach((warning) => console.log(`  ${warning}`));
  process.exit(1);
}
if (warnings.length > 0) {
  console.log(`⚠️  PASSED with ${warnings.length} warning(s)`);
  warnings.forEach((warning) => console.log(`  ${warning}`));
  process.exit(0);
}
console.log('✅ All checks passed');
```

#### 3. scripts/check-agent-docs.mjs
**File**: scripts/check-agent-docs.mjs
**Changes**: NEW — verify `.rpiv/guidance` architecture files and command guidance instead of old CLAUDE/docs requirements.
```js
#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const required = [
  { file: '.rpiv/guidance/architecture.md', includes: ['## Project Map', '## Architecture', '## Commands', '`src/main.ts`', '`src/protocol/`', '`src/runner/`', '`src/views/`', '`npm run build`', '`npm run lint`', '`npm test`'] },
  { file: '.rpiv/guidance/src/graph/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/graph/'] },
  { file: '.rpiv/guidance/src/protocol/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/protocol/'] },
  { file: '.rpiv/guidance/src/runner/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/runner/'] },
  { file: '.rpiv/guidance/src/snippets/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/snippets/'] },
  { file: '.rpiv/guidance/src/views/architecture.md', includes: ['## Responsibility', '## Dependencies', '## Consumers', '## Module Structure', 'src/views/'] },
];

const errors = [];
for (const entry of required) {
  if (!existsSync(entry.file)) {
    errors.push(`${entry.file}: missing`);
    continue;
  }
  const content = readFileSync(entry.file, 'utf8');
  for (const needle of entry.includes) {
    if (!content.includes(needle)) errors.push(`${entry.file}: missing required text: ${needle}`);
  }
}

let pkgVersion = null;
let manifestVersion = null;
try {
  pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
} catch (error) {
  errors.push(`version read failed: ${error.message}`);
}
if (pkgVersion !== null && manifestVersion !== null && pkgVersion !== manifestVersion) errors.push(`package.json version ${pkgVersion} !== manifest.json version ${manifestVersion}`);

console.log('Agent guidance audit');
console.log(`package.json: ${pkgVersion ?? 'unknown'}`);
console.log(`manifest.json: ${manifestVersion ?? 'unknown'}`);
if (errors.length > 0) {
  console.log('\nFAILED:');
  errors.forEach((error) => console.log(`  - ${error}`));
  process.exit(1);
}
console.log('\nAgent guidance audit passed.');
```

#### 4. scripts/check-css-classes.mjs
**File**: scripts/check-css-classes.mjs
**Changes**: NEW — restore advisory CSS/source class drift audit.
```js
#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const repo = process.cwd();
const cssDir = join(repo, 'src/styles');
const sourceDir = join(repo, 'src');
const cssClasses = new Set();
const sourceClasses = new Set();
const generatedClassPrefixes = new Set();
const CLASS_RE = /^(?:rp|is)-[a-zA-Z0-9_-]+$/;
const CLASS_TOKEN_RE = /(?:^|\s)((?:rp|is)-[a-zA-Z0-9_-]+)(?=\s|$)/g;

function walk(dir, predicate, visit) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (['node_modules', '.git', 'dist', '__snapshots__'].includes(name)) continue;
      walk(path, predicate, visit);
      continue;
    }
    if (predicate(path)) visit(path, readFileSync(path, 'utf8'));
  }
}
function addClassTokens(value) {
  let match;
  while ((match = CLASS_TOKEN_RE.exec(value)) !== null) sourceClasses.add(match[1]);
  CLASS_TOKEN_RE.lastIndex = 0;
}
function collectCssClasses(content) {
  const re = /\.((?:rp|is)-[a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = re.exec(content)) !== null) cssClasses.add(match[1]);
}
function collectSourceClasses(path, rawContent) {
  const content = rawContent.split('\n').filter((line) => !/\b(?:id|htmlFor)\s*=\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/.test(line)).join('\n');
  const noComments = content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
  let match;
  const attrLiteralRe = /\b(?:cls|class|className)\s*[:=]\s*["'`]([^"'`]*(?:rp-|is-)[^"'`]*)["'`]/g;
  while ((match = attrLiteralRe.exec(noComments)) !== null) addClassTokens(match[1]);
  const ternaryClsRe = /\bcls\s*:\s*[^,}\]]+\?\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]\s*:\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = ternaryClsRe.exec(noComments)) !== null) { sourceClasses.add(match[1]); sourceClasses.add(match[2]); }
  const obsidianMethodRe = /\.(?:addClass|removeClass|toggleClass)\s*\(\s*["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = obsidianMethodRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  const classListRe = /\.classList\.(?:add|remove|toggle)\s*\(([^)]*)\)/g;
  while ((match = classListRe.exec(noComments)) !== null) {
    const argRe = /["'`]((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
    let arg;
    while ((arg = argRe.exec(match[1])) !== null) sourceClasses.add(arg[1]);
  }
  const qsRe = /querySelector(?:All)?\s*\(\s*["'`](?:\.|#)?((?:rp|is)-[a-zA-Z0-9_-]+)["'`]/g;
  while ((match = qsRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  const tplAttrRe = /\b(?:cls|class|className)\s*[:=]\s*`([^`]*(?:rp-|is-)[^`]*)`/g;
  while ((match = tplAttrRe.exec(noComments)) !== null) {
    const template = match[1];
    addClassTokens(template.replace(/\$\{[^}]+\}/g, ''));
    const prefixRe = /((?:rp|is)-[a-zA-Z0-9_-]+-)\$\{/g;
    let prefix;
    while ((prefix = prefixRe.exec(template)) !== null) generatedClassPrefixes.add(prefix[1]);
  }
  if (path.endsWith('css-classes.ts') || path.endsWith('css-classes.js')) {
    const constRe = /['`](((?:rp|is)-[a-zA-Z0-9_-]+))['`]/g;
    while ((match = constRe.exec(noComments)) !== null) sourceClasses.add(match[1]);
  }
}
walk(cssDir, (path) => extname(path) === '.css', (_path, content) => collectCssClasses(content));
walk(sourceDir, (path) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(extname(path)), (path, content) => collectSourceClasses(path, content));
const ignoreOrphaned = new Set(['is-active', 'is-committed', 'is-current', 'is-disabled', 'is-expanded', 'is-hidden', 'is-loading', 'is-selected', 'is-untyped', 'is-visible', 'rp-admin-crumb', 'rp-library-crumb', 'rp-stp-select-folder-btn']);
const ignoreMissing = new Set(['is-open', 'is-active', 'rp-insert-snippet-picker-host', 'rp-protocol-editor-drag-active', 'rp-protocol-editor-resize-active', 'rp-protocol-editor-snippet-folder-picker', 'rp-skip-btn', 'rp-step-back-btn', 'rp-step-redo-btn', 'rp-node-kind-badge', 'rp-protocol-editor-modal-checkbox-field', 'rp-protocol-editor-node-kind-modal', 'rp-validation-banner']);
generatedClassPrefixes.add('rp-protocol-editor-minimap-node-');
function isGeneratedClass(cls) { for (const prefix of generatedClassPrefixes) if (cls.startsWith(prefix)) return true; return false; }
const orphaned = [...cssClasses].filter((cls) => CLASS_RE.test(cls)).filter((cls) => !sourceClasses.has(cls) && !ignoreOrphaned.has(cls) && !isGeneratedClass(cls)).sort();
const missing = [...sourceClasses].filter((cls) => CLASS_RE.test(cls)).filter((cls) => !cssClasses.has(cls) && !ignoreMissing.has(cls) && !isGeneratedClass(cls)).sort();
console.log('CSS class drift audit (advisory)');
console.log(`CSS classes: ${cssClasses.size}`);
console.log(`Source class tokens: ${sourceClasses.size}`);
console.log(`Generated class prefixes: ${generatedClassPrefixes.size}`);
if (orphaned.length > 0) { console.log(`\nPotential orphaned CSS classes (${orphaned.length}):`); orphaned.slice(0, 80).forEach((cls) => console.log(`  ${cls}`)); if (orphaned.length > 80) console.log(`  ... ${orphaned.length - 80} more`); }
else console.log('\nNo potential orphaned CSS classes found.');
if (missing.length > 0) { console.log(`\nPotential missing CSS classes (${missing.length}):`); missing.slice(0, 80).forEach((cls) => console.log(`  ${cls}`)); if (missing.length > 80) console.log(`  ... ${missing.length - 80} more`); }
else console.log('\nNo potential missing CSS classes found.');
process.exit(0);
```

#### 5. scripts/audit-i18n-ui-text.mjs
**File**: scripts/audit-i18n-ui-text.mjs
**Changes**: NEW — restore user-facing UI string audit for view/settings code.
```js
#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGET_DIRS = ['src/views', 'src/settings.ts'];
const ALLOW_COMMENT_PATTERNS = [/\/\/\s*User-authored content/i, /\/\/\s*Internal enum value/i, /\/\/\s*Non-translatable/i, /\/\/\s*Caller-supplied localized/i, /\/\/\s*Dynamic validation/i, /\/\/\s*pass-through localized/i, /\/\/\s*msg is pass-through/i];
const TRANSLATED_RE = /\b(?:(?:this|plugin)\.)?(?:i18n\.)?t\(\s*['"`]/;
const CHECK_PATTERNS = [[/\.setButtonText\(\s*'([^']+)'\s*\)/, 'setButtonText with string literal'], [/\.setPlaceholder\(\s*'([^']+)'\s*\)/, 'setPlaceholder with string literal'], [/\.textContent\s*=\s*'([^']+)'/, 'textContent with single-quoted string'], [/\.textContent\s*=\s*`([^`]+)`/, 'textContent with template literal'], [/\.innerText\s*=\s*'([^']+)'/, 'innerText with single-quoted string'], [/\.addOption\([^,]+,\s*'([^']+)'\s*\)/, 'addOption label with string literal'], [/new Notice\(\s*`/, 'Notice with template literal'], [/new Notice\(\s*'/, 'Notice with single-quoted string']];
const SKIP_PATHS = [/__mocks__/, /\.test\.ts$/, /\.spec\.ts$/];
function collectFiles() { const files = []; for (const target of TARGET_DIRS) { const full = join(ROOT, target); if (statSync(full).isFile()) files.push(full); else walkDir(full, files); } return files; }
function walkDir(dir, out) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const full = join(dir, entry.name); if (entry.isDirectory()) walkDir(full, out); else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full); } }
function isAllowListed(line) { return ALLOW_COMMENT_PATTERNS.some((pattern) => pattern.test(line)); }
function isTranslated(line) { return TRANSLATED_RE.test(line); }
function isIgnorableCapturedText(value) { const trimmed = value.trim(); return trimmed === '' || /^[.,;:!?\-–—\s/\\]+$/.test(trimmed) || !/\p{L}/u.test(trimmed) || /^(?:rp-|radi-|mod-|javascript:|#|\.)/.test(trimmed); }
function audit() {
  const violations = [];
  for (const file of collectFiles()) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (SKIP_PATHS.some((pattern) => pattern.test(rel))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTranslated(line) || isAllowListed(line)) continue;
      for (const [pattern, desc] of CHECK_PATTERNS) {
        if (!pattern.test(line)) continue;
        const match = line.match(pattern);
        const captured = match?.[1] ?? '';
        if (isIgnorableCapturedText(captured)) continue;
        violations.push({ file: rel, line: i + 1, desc, snippet: line.trim(), captured });
      }
    }
  }
  return violations;
}
const violations = audit();
if (violations.length === 0) { console.log('i18n UI text audit: PASS — no unlocalised user-facing strings detected.'); process.exit(0); }
console.error(`i18n UI text audit: FAIL — ${violations.length} violation(s) found:\n`);
for (const violation of violations) { console.error(`  ${violation.file}:${violation.line} [${violation.desc}]`); console.error(`    ${violation.snippet}`); if (violation.captured) console.error(`    captured: "${violation.captured}"`); console.error(); }
process.exit(1);
```

### Success Criteria:

#### Automated Verification:
- [x] Planning freshness check runs: `npm run check:planning` exits 0.
- [x] Consistency check enforces post-split docs and version surfaces: `npm run check:consistency` exits 0.
- [x] Agent guidance check runs against `.rpiv/guidance`: `npm run check:agent-docs` exits 0.
- [x] Advisory CSS class audit runs without failing the gate: `npm run check:css` exits 0.
- [x] UI i18n audit runs: `npm run audit:i18n` exits 0.
- [x] Knip dead-detection script runs: `npm run knip` exits 0.

#### Manual Verification:
- [x] `scripts/check-agent-docs.mjs` checks `.rpiv/guidance` files and does not require `CLAUDE.md` or `docs/`.
- [x] `scripts/check-consistency.mjs` rejects hardcoded README latest-release lines and README `docs/` links.
- [x] All restored scripts are read-only checks and do not write repository files.

#### 6. package.json
**File**: package.json
**Changes**: MODIFY — add `"knip": "knip"` script to align guidance docs with package scripts.
```json
    "knip": "knip",
    "check:planning": "node scripts/check-planning-freshness.mjs",
```

## Phase 3: Release workflow gate alignment

### Overview
This phase makes release automation consume the restored package-level release gate. Depends on Phase 2; cannot run before `npm run check:release` exists.

### Changes Required:

#### 1. .github/workflows/release.yml:31-38
**File**: .github/workflows/release.yml
**Changes**: MODIFY — replace separate Build/Lint/Test steps with one `Release checks` step running `npm run check:release`.
```yaml
      - name: Release checks
        run: npm run check:release

      - name: Verify version matches tag
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          TAG_STRIPPED=${TAG#v}
          MANIFEST_VERSION=$(node -p "require('./manifest.json').version")
          if [ "$TAG_STRIPPED" != "$MANIFEST_VERSION" ]; then
            echo "Error: tag $TAG (stripped: $TAG_STRIPPED) does not match manifest.json version $MANIFEST_VERSION"
            exit 1
          fi
          echo "Version match: $TAG_STRIPPED"
```

### Success Criteria:

#### Automated Verification:
- [x] Release workflow uses the restored release gate: `grep -F "npm run check:release" .github/workflows/release.yml` returns a match.
- [x] Release workflow no longer runs separate build/lint/test steps before version verification: `grep -E "name: (Build|Lint|Test)$" .github/workflows/release.yml` returns no matches.
- [x] Release workflow still verifies tag against manifest: `grep -F "Verify version matches tag" .github/workflows/release.yml && grep -F "TAG_STRIPPED" .github/workflows/release.yml`.
- [x] Release workflow preserves Node 22 setup: `grep -F "actions/setup-node" .github/workflows/release.yml && grep -F "node-version: 22" .github/workflows/release.yml`.
- [x] Release workflow still uploads required assets: `grep -F "main.js" .github/workflows/release.yml && grep -F "styles.css" .github/workflows/release.yml && grep -F "manifest.json" .github/workflows/release.yml`.

#### Manual Verification:
- [x] The `Release checks` step appears after `npm ci` and before `Verify version matches tag`.
- [x] Tag trigger patterns and `softprops/action-gh-release` asset upload remain unchanged.

## Phase 4: Remove unused Obsidian requestUrl mock

### Overview
This phase removes the approved unused test mock export and runs terminal full verification across the completed cleanup. Depends on Phase 3; terminal phase carries full project gate checks.

### Changes Required:

#### 1. src/__mocks__/obsidian.ts:308-310
**File**: src/__mocks__/obsidian.ts
**Changes**: MODIFY — delete the unused `requestUrl` export.
```diff
 export class SuggestModal<T> {
   app: unknown;
   constructor(app: unknown) { this.app = app; }
   getSuggestions(_query: string): T[] { return []; }
   renderSuggestion(_item: T, _el: unknown): void {}
   onChooseSuggestion(_item: T, _evt: unknown): void {}
   setPlaceholder(_placeholder: string): void {}
   open(): void {}
   close(): void {}
 }
-
-export async function requestUrl(_request: unknown): Promise<{ text: string }> {
-  return { text: '' };
-}
 
 export class Notice {
   constructor(_message: string, _timeout?: number) {}
 }
```

### Success Criteria:

#### Automated Verification:
- [x] `requestUrl` mock export is removed: `grep -R "requestUrl" src package.json vitest.config.ts` returns no matches.
- [x] Type checking and production bundle pass: `npm run build` exits 0.
- [x] Lint passes after docs/scripts/workflow/mock cleanup: `npm run lint` exits 0.
- [x] Vitest suite passes after mock cleanup: `npm test` exits 0.
- [x] Restored full local gate passes: `npm run check` exits 0.
- [x] Restored release gate passes: `npm run check:release` exits 0.
- [x] Generated root assets were not source-edited: `git diff -- main.js styles.css` is empty unless implementation intentionally regenerated them via `npm run build`.

#### Manual Verification:
- [x] The only `src/__mocks__/obsidian.ts` change is deleting the unused `requestUrl` function.
- [x] No production Obsidian API mock behavior used by tests was removed.
- [x] Review final diff to confirm no generated root asset or unrelated runtime cleanup was mixed into this plan.

## Ordering Constraints
- Phase 1 must precede Phase 2 because `check-consistency.mjs` will enforce the split README and no-latest-release invariants.
- Phase 2 must precede Phase 3 because release automation will call `npm run check:release`, which depends on restored scripts.
- Phase 4 is last so terminal full verification covers all documentation, script, workflow, and mock cleanup changes together.
- No phases are parallelized; each phase intentionally changes the acceptance surface for later phases.

## Verification Notes
- Verify no generated root assets are source-edited: `git diff -- main.js styles.css` should be empty unless they were regenerated by `npm run build` as part of implementation.
- Verify README no longer hardcodes latest release text: `grep -R "Latest release\|Последний релиз" README.md README.ru.md` should return no matches.
- Verify README no longer links missing docs: `grep -R "docs/" README.md README.ru.md` should return no matches.
- Verify restored package scripts run individually: `npm run check:planning`, `npm run check:consistency`, `npm run check:agent-docs`, `npm run check:css`, and `npm run audit:i18n`.
- Verify full gates after scripts are restored: `npm run build`, `npm run lint`, `npm test`, `npm run check`, and `npm run check:release`.
- Verify release workflow still uploads only required Obsidian assets: `main.js`, `styles.css`, and `manifest.json`.
- Verify `requestUrl` removal is safe: `grep -R "requestUrl" src package.json vitest.config.ts` should return no matches after removal.

## Precedents & Lessons
- Release hygiene changes previously caused README version drift follow-ups (`74913a8`, `ddaf072`, `f075658`); remove duplicated README version state instead of adding another sync obligation.
- CI/release workflow edits previously exposed Node/action/tag-format bugs; keep Node 22, `npm ci`, tag-vs-manifest verification, and asset upload structure intact.
- Cleanup removals need ordered closed-subgraph deletion plus grep/build/lint/test gates; this plan removes only the approved test mock export.
- Generated build artifacts and version files are release-critical; never treat ignored root `main.js`/`styles.css` as disposable from the release asset set.
- Hook optionality should be documented before tightening gates; this plan documents `.githooks` but does not install them automatically.

## Performance Considerations
All restored scripts are repository scans intended for local/CI execution, not plugin runtime. `check-css-classes.mjs` and `audit-i18n-ui-text.mjs` walk source files synchronously but are bounded by repository size and do not affect Obsidian plugin performance. Release workflow runtime may increase because `check:release` includes all restored checks, but this is expected pre-release verification cost.

## Migration Notes
No persisted plugin schema or user vault data changes. Documentation files move/split only in the repository. Release workflow changes affect future tag pushes only. `.githooks` remain opt-in via Git config.

## Pattern References
- `version-bump.mjs:1-16` — small ESM maintenance script style with synchronous file IO.
- `package.json:13-19` — canonical package check surface to restore.
- `.github/workflows/ci.yml:29-45` — explicit CI verification wiring that already consumes restored checks.
- `.github/workflows/release.yml:40-58` — tag-vs-manifest and release asset upload structure to preserve.
- `.githooks/pre-commit:10-34` and `.githooks/pre-push:10-11` — optional hook behavior to document, not install.
- `.rpiv/guidance/architecture.md:24-31` — current command guidance for agent-docs checks.
- `src/__mocks__/obsidian.ts:308-310` with `vitest.config.ts:6-7` — test-only mock export removal target.

## Developer Context
- Discover Q: `.github` is active release/CI infrastructure (`.github/workflows/ci.yml:29-45`, `.github/workflows/release.yml:31-58`). Answer: Confirm keep.
- Discover Q: `.githooks` contains useful local gates but no configured installer (`.githooks/pre-commit:19-34`, `.githooks/pre-push:10-11`). Answer: Optional docs.
- Discover Q: README is bilingual and links absent docs (`README.md:78-82`, `README.md:163-167`). Answer: Confirm cleanup.
- Discover Q: release/versioning should be documented/minimally tightened rather than heavy automation (`package.json:18-19`, `.github/workflows/release.yml:31-38`). Answer: Confirm minimal.
- Discover Q: missing custom gates should be restored or removed (`package.json:13-19`, `.github/workflows/ci.yml:38-45`). Answer: Restore scripts.
- Discover Q: README hardcodes latest version outside `version-bump.mjs:3-16`. Answer: Remove latest text and point to GitHub Releases.
- Blueprint Q: README links missing docs at `README.md:80-82` and `README.md:165-167`; which cleanup? Answer: Remove links.
- Blueprint Q: after restoring scripts, how should release automation align? Answer: Use check:release.
- Blueprint Q: should the plan include removing `src/__mocks__/obsidian.ts:308-310` `requestUrl`? Answer: Include removal.
- Blueprint design confirmation: proceed with 5 new scripts + `README.ru.md`, modified `README.md`, release workflow, and mock cleanup; not recreating docs, not adding hook installer, not editing generated assets. Answer: Proceed.
- Blueprint decomposition confirmation: 4 sequential slices — README split, gate scripts, release workflow, mock cleanup. Answer: Approve.

## Plan History
- Phase 1: README split and release-text cleanup — approved as generated
- Phase 2: Restore repository gate scripts — approved as revised: moved package/manifest alignment outside the optional `.planning/STATE.md` branch
- Phase 3: Release workflow gate alignment — approved as generated
- Phase 4: Remove unused Obsidian requestUrl mock — approved as generated

## References
- `.rpiv/artifacts/research/2026-06-04_18-40-54_conservative-cleanup-docs-release-process.md`
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md`
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md`
- `.rpiv/artifacts/plans/2026-06-02_18-26-22_cleanup-and-ux-fixes.md`

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 2 §2 (check-consistency.mjs) | eslint.config.mjs:112 | blocker | actionability | Phase 2's stale `.planning/` reference check will flag the existing ESLint ignore entry `'.planning/**'`, because `planningPolicyFiles` does not allow `eslint.config.mjs`, so `npm run check:consistency` exits 1. | Add `eslint.config.mjs` to `planningPolicyFiles` or remove the existing `.planning/**` ignore before enabling the check. | applied: added `eslint.config.mjs` to the Phase 2 `planningPolicyFiles` allowlist. |
| coverage | ## Precedents & Lessons §2 | <n/a> | blocker | verification-coverage | Lesson “keep Node 22, `npm ci`, tag-vs-manifest verification, and asset upload structure intact” — criteria NOT FOUND for `Node 22` preservation, code NOT FOUND for a `setup-node`/`node-version: 22` mirror | Add a Phase 3 `#### Automated Verification:` bullet that greps `.github/workflows/release.yml` for `setup-node` and `node-version: 22` | applied: added Phase 3 automated verification for `actions/setup-node` and `node-version: 22`. |
| code | Phase 2 §3 (check-agent-docs.mjs) | .rpiv/guidance/architecture.md:31 | concern | codebase-fit | Phase 2 blesses `.rpiv/guidance/architecture.md` as command guidance even though it lists `npm run knip` and `package.json` defines no `knip` script. | Add a Phase 2 `package.json` modification defining `"knip": "knip"` before validating this guidance. | applied: added `package.json` modification with `"knip": "knip"` script to Phase 2. |
