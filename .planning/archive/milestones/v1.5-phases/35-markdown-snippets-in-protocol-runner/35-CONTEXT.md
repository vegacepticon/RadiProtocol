---
phase: 35
type: context
created: 2026-04-15
language: ru
---

# Phase 35 — CONTEXT (Discussion Outcome)

> Markdown Snippets в Protocol Runner. Гайд для `gsd-phase-researcher` и `gsd-planner`: какие UX-решения уже зафиксированы user'ом в discuss-сессии, чтобы downstream-агенты не переспрашивали.

## Phase goal (from ROADMAP)

`.md` snippets appear in the Runner snippet picker alongside `.json` snippets, insert their content as-is without a fill-in modal, and work transparently inside `awaiting-snippet-pick` and mixed answer+snippet branching.

**Requirements:** MD-01, MD-02, MD-03, MD-04
**Depends on:** Phase 32 (MdSnippet model + listFolder), Phase 34 (rename/move ref sync stability)

## Current state (scouted from codebase)

- `src/snippets/snippet-model.ts` уже определяет `MdSnippet { kind: 'md'; name: string; content: string; path: string }`, `Snippet = JsonSnippet | MdSnippet`. Ничего нового в модели не нужно.
- `SnippetService.listFolder()` возвращает `{ folders, snippets: Snippet[] }` — MD-файлы уже попадают в выдачу начиная с фазы 32.
- `src/views/runner-view.ts:625` в `renderSnippetPicker` содержит явный фильтр `if (snippet.kind !== 'json') continue;` — это тот место, которое фаза 35 снимает и расширяет на MD.
- `handleSnippetPickerSelection(snippet: SnippetFile)` сейчас принимает только `JsonSnippet` (через псевдоним `SnippetFile = JsonSnippet`). Путь "zero-placeholder" (`snippet.placeholders.length === 0`) уже вызывает `completeSnippet(template)` напрямую — это тот же технический путь, который нужен для MD (с `content` вместо `template`).
- `ProtocolRunner.pickSnippet()` делает undo-snapshot `accumulatedText` перед вставкой; `completeSnippet(rendered)` коммитит текст и продвигает runner; `stepBack()` откатывает оба. Всё это уже работает и нужно только переиспользовать для MD-ветки.
- `Session` сериализует `accumulatedText`, `currentNodeId`, undo-stack — MD-вставки попадут в snapshot автоматически, без расширения формата сессии.

## Decisions (locked by user in discuss session)

### D-01 — Тип-индикатор в picker
**Решение:** префикс-иконка перед именем.
- `.json` → `📄 snippet-name`
- `.md`   → `📝 snippet-name`
- `📁 folderName` остаётся как есть (консистентно с существующими folder-строками).

**Обоснование:** минимальные изменения, нулевая зависимость от CSS, полная симметрия с текущим стилем папок. Если в будущем понадобится более насыщенная визуализация (цвет, hover-preview) — отдельная UX-фаза, не блокер здесь.

### D-02 — Форматирование вставки MD-контента
**Решение:** verbatim — `mdSnippet.content` вставляется байт-в-байт.
- Никакой обработки: ни strip trailing whitespace, ни strip frontmatter, ни разделителей между блоками.
- User контролирует содержимое через файл напрямую.

**Обоснование (user):** «в md сниппетах будет только нужный текст лежать, больше ничего». Frontmatter/техническую метаинформацию user в MD-сниппеты не кладёт, так что strip-логика была бы лишней сложностью.

**Implication для planner'а:** вызов `completeSnippet(mdSnippet.content)` без трансформации — единственный путь. Никаких helper-функций типа `normalizeMdContent`/`stripFrontmatter` в этой фазе не создавать.

### D-03 — Пустой / whitespace-only `.md` файл
**Решение:** валидный пик, симметрично с JSON-zero-placeholder path.
- Клик по пустому `.md` вызывает `completeSnippet('')` (или `completeSnippet(whitespaceContent)`), runner продвигается как обычно.
- Никакой валидации содержимого на стороне picker'а, никакого Notice, никакого disabled-состояния строки.

**Обоснование:** симметрия с JSON (пустой template → пустая вставка, runner двигается), edge case редкий, user отвечает за содержимое файла.

### D-04 — Preview MD-контента в picker
**Решение:** никакого preview — клик сразу коммитит.
- Нет hover-tooltip, нет expand-on-click, нет отдельной preview-панели.
- Путь полностью эквивалентен JSON-zero-placeholder path (фаза 30, D-09).

**Обоснование:** минимум кода, максимум скорости workflow, промахи обратимы через `Step back`. Если UX потребует preview — будущая фаза.

### D-05 — Имя MD-сниппета в picker
**Решение:** `mdSnippet.name` (basename без расширения, то же поле, что и у JSON).
- Никакой магии с извлечением H1-title из content'а.
- Никаких двухстрочных row'ов с subtitle.

**Обоснование:** полная симметрия с JSON-веткой и SnippetManager tree — имя в picker === имя в tree === basename файла в vault. Предсказуемо, `toCanvasKey`-консистентно, ноль чтений content'а только ради заголовка.

### D-06 — Step-back после MD-вставки
**Решение:** симметрично JSON — step-back откатывает MD-вставку полностью.
- `pickSnippet()` делает snapshot `accumulatedText` перед вставкой (уже работает).
- `completeSnippet(mdSnippet.content)` мержит content и продвигает runner.
- `stepBack()` откатывает `accumulatedText` и `currentNodeId` к состоянию до MD, picker открывается заново.
- Никакой специальной MD-логики в `protocol-runner.ts` — вся undo-механика переиспользуется.

**Обоснование:** ноль нового кода в runner-ядре, предсказуемое поведение, save/resume работает «бесплатно» через существующую сериализацию `accumulatedText`.

## Scope boundary (out of phase 35)

**НЕ входит в эту фазу** (если всплывёт — `gsd-add-backlog` или «Deferred Ideas»):

- Preview MD-контента (hover, expand, side panel) — см. D-04.
- Извлечение title из H1 или других метаданных — см. D-05.
- Frontmatter stripping / Markdown-to-plain-text рендеринг — см. D-02.
- Разделители/автоматические пустые строки между вставками — см. D-02.
- Новые колонки / фильтры / сортировка в picker — вообще вне фазы, не обсуждалось.
- Копирование MD-сниппета в clipboard / экспорт — вне фазы.
- Drag-and-drop MD-сниппета в Runner preview — вне фазы.

## Implementation hotspots (for researcher & planner)

1. **`src/views/runner-view.ts` `renderSnippetPicker`** — снять `if (snippet.kind !== 'json') continue;`, добавить MD-branch с префиксом `📝` и обработчиком клика, вызывающим `handleSnippetPickerSelection(snippet)`.
2. **`handleSnippetPickerSelection(snippet: SnippetFile)`** — расширить сигнатуру с `SnippetFile` (= `JsonSnippet`) до `Snippet` (= `JsonSnippet | MdSnippet`), внутри сделать `kind`-switch: JSON path остаётся как сейчас (modal или zero-placeholder), MD path всегда идёт через `completeSnippet(snippet.content)` без modal.
3. **Type indicator rendering** — один дополнительный префикс, один if. CSS-класс можно оставить общим `rp-snippet-item-row` или добавить модификатор (`--md` / `--json`) на будущее; planner решит по месту.
4. **Тесты runner picker** — расширить существующие тесты `runner-extensions.test.ts` / соответствующие фикстуры на MD-файлы; проверить mixed answer+snippet branching с MD-branch (SC-04 фазы); проверить session save/resume с частично вставленным MD-контентом (SC-05 фазы).
5. **Drill-down с MD в глубине** (`awaiting-snippet-pick` + subfolder navigation + MD-файл на дне) — unit- или integration-тест, чтобы доказать SC-03.

## Known non-blockers / follow-ups from neighbouring phases

- **Node Editor panel stale `subfolderPath`** после folder rename/move (carry-over из фазы 34) — неблокер для 35, но если researcher/planner наткнётся на похожий refresh gap в Runner при MD insert — сообщить.
- Три pre-existing падения в `src/__tests__/runner-extensions.test.ts` («RED until Plan 02» фаза 26) — это ветка phase-26 и к фазе 35 отношения не имеет. НЕ чинить в рамках 35, но не удивляться при запуске suite.

## Deferred ideas (из обсуждения)

Ничего не отложено — user дал чёткие короткие ответы на все 6 серых зон, никаких боковых предложений не прозвучало.

## Next step

Запустить `/gsd-plan-phase 35` (или сначала `/gsd-research-phase 35` если хочется отдельный research-проход). Researcher + planner получат этот CONTEXT.md и не должны переспрашивать ни одну из D-01..D-06.
