# Phase 25: Snippet Node Runner UI — Research

**Researched:** 2026-04-11
**Domain:** Obsidian plugin — SuggestModal/FuzzySuggestModal, vault file API, runner state machine extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Файлы в `FuzzySuggestModal` отображаются только по имени файла (`file.name`). Путь не показывается.

**D-02** — Picker включает файлы рекурсивно из настроенной папки (`.md` и `.json` в подпапках). Отображается только имя файла.

**D-03** — Нажатие Esc (или иное закрытие без выбора) оставляет runner на snippet-ноде. Никакого advance, никакого текста. Пользователь может выбрать снова или шагнуть назад.

**D-04** — Если в папке нет ни одного `.md` или `.json` файла (рекурсивно) — не открывать модальное окно. Показать Obsidian `Notice`: `"No files found in [folder]"`. Runner остаётся на ноде.

**D-05** — Если и `snippetNodeFolderPath` (пустая строка), и `node.folderPath` (undefined) отсутствуют — не открывать модальное окно. Показать Obsidian `Notice`: `"Snippet folder not configured. Set a path in plugin Settings → Storage."`. Runner остаётся на ноде.

**D-06** — `.json` файл трактуется как `SnippetFile` только если его содержимое является валидным JSON **и** содержит поля: `id` (string), `name` (string), `template` (string). Любой `.json`, не прошедший эту проверку, показывает Notice `"Not a valid snippet file"` и оставляет runner на ноде.

**D-07** — Если пользователь отменяет `SnippetFillInModal` (для `.json` файла) — runner **остаётся на snippet-ноде**. Это отменяет политику Phase 5 D-11 (skip/advance), которая применялась к text-block нодам.

**D-08** — Phase 25 добавляет новый метод `ProtocolRunner` (например, `completeSnippetFile(text, nodeId)`), который добавляет `text` через separator ноды и продвигает runner мимо ноды. Separator разрешается через существующий паттерн `resolveSeparator(node)`.

**D-09** — Метка кнопки следует fallback-цепочке: `node.buttonLabel ?? canvasNodeText ?? "Select file"`.

### Claude's Discretion

- Точное название подкласса `FuzzySuggestModal` (например, `SnippetFilePickerModal`)
- Использовать `app.vault.getFiles()` + фильтр или рекурсивный обход с `TFolder`
- Точные формулировки Notice (незначительная переформулировка паттернов выше допустима)
- Название advance-метода (`completeSnippetFile` или аналогичное)

### Deferred Ideas (OUT OF SCOPE)

- Поля формы Node Editor для `folderPath` и `buttonLabel` на snippet-нодах — отдельная фаза
- Семантика step-back после вставки файла — обрабатывается через `resolveSeparator` + undo stack push в advance-методе
- Предпросмотр содержимого `.md` файла перед вставкой
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIPPET-02 | File picker button renders at snippet node in runner | Паттерн `case 'snippet':` в `runner-view.ts` `case 'at-node'` switch; CSS класс `rp-answer-btn` |
| SNIPPET-03 | Picker scopes to configured folder (per-node override > global setting) | `app.vault.getFiles()` фильтрация по path prefix; `SnippetNode.folderPath` поле; `plugin.settings.snippetNodeFolderPath` |
| SNIPPET-04 | Selecting `.md` file appends raw text and advances runner | `app.vault.read(file)` для чтения; `completeSnippetFile()` метод runner'а |
| SNIPPET-05 | Selecting `.json` opens `SnippetFillInModal`; filled text appended and advances runner | `SnippetFillInModal` уже существует; D-06 validation; D-07 cancel policy |
| SNIPPET-07 | Per-node `folderPath` takes precedence over global `snippetNodeFolderPath` | Логика разрешения папки: `node.folderPath ?? plugin.settings.snippetNodeFolderPath` |
</phase_requirements>

---

## Summary

Phase 25 добавляет UI-слой для snippet-ноды: кнопку в runner и файловый picker. Вся логика сосредоточена в трёх файлах: `runner-view.ts` (рендер кнопки + обработчик), новый `src/views/snippet-file-picker-modal.ts` (FuzzySuggestModal), и `protocol-runner.ts` (новый метод advance).

**Критическая находка (BLOCKER):** Текущий HEAD кодовой базы НЕ содержит `SnippetNode` как отдельного вида ноды, паттерна `isAtSnippetNode` в `AtNodeState`, или поддержки `kind: 'snippet'` в `canvas-parser.ts`. Коммит `da9e1b5` (начало Phase 24) откатил изменения Phase 22 обратно: `'snippet'` удалён из `RPNodeKind`, `SnippetNode` интерфейс удалён, `isAtSnippetNode` удалён из `AtNodeState`. Текущий HEAD является "перезапущенной" базой с `free-text-input` и `awaiting-snippet-fill` как активными видами.

**Что это значит для плана:** Phase 25 должна сначала добавить весь graph/runner layer для snippet-ноды (то, что Phase 22 делала в git-ветке, которая была потом squash-нута), а затем реализовать UI. Это не является блокером — просто расширяет объём работы.

**Основная рекомендация:** Разбить на 2 волны: Wave 1 — graph + runner layer (SnippetNode, parser, validator, isAtSnippetNode); Wave 2 — UI layer (кнопка, SnippetFilePickerModal, completeSnippetFile, .md/.json dispatch).

---

## Standard Stack

### Core (все библиотеки встроены в Obsidian)

| Библиотека | Источник | Назначение | Примечание |
|------------|----------|------------|------------|
| `FuzzySuggestModal<T>` | Obsidian API | Fuzzy-поиск файлов с клавиатурной навигацией | Правильный тип для picker с фильтрацией |
| `SuggestModal<T>` | Obsidian API | Базовый класс для suggest-модалей | Уже используется в `NodePickerModal` |
| `app.vault.getFiles()` | Obsidian API | Возвращает все `TFile[]` в vault | Фильтровать по `path.startsWith(folderPath)` |
| `app.vault.read(file)` | Obsidian API | Читает содержимое TFile как строку | Async; для чтения `.md` файлов |
| `TFile`, `TFolder` | Obsidian API | Типы для файлов/папок vault | Уже используются в runner-view.ts |
| `Notice` | Obsidian API | Показ ошибок/предупреждений | Паттерн уже есть везде в коде |

**Установка:** всё встроено в Obsidian, никаких `npm install` не требуется.

### Почему `FuzzySuggestModal` а не `SuggestModal`

`FuzzySuggestModal<T>` — это `SuggestModal<T>` с уже реализованным fuzzy-поиском. `NodePickerModal` использует `SuggestModal` с ручным `includes()` поиском. Для файлового picker'а `FuzzySuggestModal` более подходит, потому что пользователи медицинских шаблонов часто знают лишь часть названия файла. [ASSUMED — на основе Obsidian API patterns; оба варианта работают корректно]

### Альтернативы

| Вместо | Можно использовать | Когда |
|--------|--------------------|-------|
| `FuzzySuggestModal<TFile>` | `SuggestModal<TFile>` с ручным `.includes()` | Если нужен точный substring-поиск (как в `NodePickerModal`) |
| `app.vault.getFiles()` + filter | Рекурсивный обход `TFolder.children` | Если нужно получить TFolder объект для метаданных |

---

## Architecture Patterns

### Структура файлов Phase 25

```
src/
├── views/
│   ├── runner-view.ts              # ИЗМЕНИТЬ: case 'snippet' в at-node switch
│   └── snippet-file-picker-modal.ts  # СОЗДАТЬ: FuzzySuggestModal<TFile>
├── runner/
│   └── protocol-runner.ts          # ИЗМЕНИТЬ: добавить completeSnippetFile()
├── runner/
│   └── runner-state.ts             # ИЗМЕНИТЬ: добавить isAtSnippetNode в AtNodeState
└── graph/
    ├── graph-model.ts              # ИЗМЕНИТЬ: добавить SnippetNode, 'snippet' в RPNodeKind
    ├── canvas-parser.ts            # ИЗМЕНИТЬ: парсинг snippet-ноды
    └── graph-validator.ts          # ИЗМЕНИТЬ: валидация snippet-ноды
```

### Паттерн 1: SnippetNode graph layer (Wave 1)

**Что:** Добавление `'snippet'` в `RPNodeKind`, интерфейса `SnippetNode`, парсинга в `CanvasParser`, halt-логики в `ProtocolRunner`, поля `isAtSnippetNode` в `AtNodeState`.

**Когда использовать:** Первая волна Phase 25 — без этого Wave 2 невозможна.

**Пример (graph-model.ts):**
```typescript
// Source: git ce9613f (Phase 22 commit)
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'
  | 'text-block'
  | 'loop-start'
  | 'loop-end'
  | 'snippet';  // ДОБАВИТЬ

export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  folderPath?: string;   // per-node override (Phase 25)
  buttonLabel?: string;  // fallback chain: buttonLabel ?? canvasText ?? "Select file"
}
```

**Пример (AtNodeState в runner-state.ts):**
```typescript
// Source: git c67671e (Phase 22-03 commit)
export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
  loopIterationLabel?: string;
  isAtLoopEnd?: boolean;
  isAtSnippetNode?: boolean;  // ДОБАВИТЬ — Phase 25 рендерит кнопку picker'а
}
```

**Halt в `advanceThrough` (protocol-runner.ts):**
```typescript
case 'snippet': {
  // Halt — RunnerView рендерит file-picker button
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;
}
```

**`isAtSnippetNode` в `getState()` (protocol-runner.ts):**
```typescript
case 'at-node': {
  return {
    status: 'at-node',
    currentNodeId: this.currentNodeId ?? '',
    accumulatedText: this.accumulator.current,
    canStepBack: this.undoStack.length > 0,
    loopIterationLabel,
    isAtLoopEnd: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'loop-end',
    isAtSnippetNode: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'snippet', // ДОБАВИТЬ
  };
}
```

### Паттерн 2: SnippetFilePickerModal (Wave 2)

**Что:** Новый файл `src/views/snippet-file-picker-modal.ts`. Subclass `FuzzySuggestModal<TFile>`.

**Когда использовать:** Wave 2. Зависит от наличия `SnippetNode` из Wave 1.

**Пример:**
```typescript
// Source: структура на основе NodePickerModal (src/views/node-picker-modal.ts)
import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class SnippetFilePickerModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChooseCb: (file: TFile) => void;
  private resolved = false;

  constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.files = files;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Search snippet files\u2026');
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.name;  // D-01: только имя файла, без пути
  }

  onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.resolved = true;
    this.onChooseCb(file);
  }

  onClose(): void {
    // Cancel path — resolved guard prevents double-call
    if (!this.resolved) {
      // D-03: Esc = stay on node; просто закрыть без action
    }
    super.onClose();
  }
}
```

**Важно:** `FuzzySuggestModal<T>` требует `getItems()` и `getItemText()` вместо `getSuggestions()` и `renderSuggestion()` которые использует `SuggestModal<T>`. Это разные API. [VERIFIED: существующий Obsidian mock в `src/__mocks__/obsidian.ts` покрывает оба класса]

### Паттерн 3: resolveSnippetFolder (логика разрешения папки)

**Что:** Логика определения эффективной папки для picker'а. Реализуется как inline-функция в обработчике клика в `runner-view.ts`.

**Fallback-цепочка (D-05, D-07 из CONTEXT.md):**
```typescript
// Source: CONTEXT.md D-05, D-07
function resolveSnippetFolder(
  node: SnippetNode,
  globalFolderPath: string,
): string | null {
  const path = node.folderPath?.trim() || globalFolderPath.trim();
  return path === '' ? null : path;
}
```

**Использование:**
```typescript
const folderPath = resolveSnippetFolder(snippetNode, this.plugin.settings.snippetNodeFolderPath);
if (folderPath === null) {
  new Notice('Snippet folder not configured. Set a path in plugin Settings → Storage.');
  return;  // D-05: runner остаётся на ноде
}
```

### Паттерн 4: рекурсивная выборка файлов из папки

**Два варианта** (оба корректны; выбор на усмотрение реализующего):

**Вариант A: `app.vault.getFiles()` + filter (проще):**
```typescript
// Source: CONTEXT.md "Claude's Discretion"
const files = this.app.vault.getFiles().filter(f =>
  (f.extension === 'md' || f.extension === 'json') &&
  f.path.startsWith(folderPath + '/')
);
```

**Вариант B: Рекурсивный обход TFolder (как в canvas-selector-widget.ts):**
```typescript
const rootFolder = this.app.vault.getAbstractFileByPath(folderPath);
if (!(rootFolder instanceof TFolder)) { /* ошибка */ }
// рекурсивный обход children
```

**Рекомендация:** Вариант A проще и достаточен. Вариант B нужен только если требуются метаданные TFolder. [VERIFIED: canvas-selector-widget.ts использует Вариант B; для простой выборки файлов достаточно Варианта A]

**Граничный случай:** Если `folderPath = "Templates"`, то путь файла будет `"Templates/MRI/liver.md"`. Проверка `startsWith("Templates/")` (со слешем) правильна; без слеша может захватить `"Templates2/..."`.

### Паттерн 5: .json dispatch с валидацией (D-06)

**Что:** Лёгкая структурная валидация JSON-файла перед открытием `SnippetFillInModal`.

```typescript
// Source: CONTEXT.md D-06
async function tryLoadSnippetFile(
  app: App,
  file: TFile,
): Promise<SnippetFile | null> {
  const content = await app.vault.read(file);
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof (parsed as Record<string, unknown>)['id'] === 'string' &&
      typeof (parsed as Record<string, unknown>)['name'] === 'string' &&
      typeof (parsed as Record<string, unknown>)['template'] === 'string'
    ) {
      return parsed as SnippetFile;
    }
  } catch { /* invalid JSON */ }
  return null;
}
```

### Паттерн 6: completeSnippetFile() в ProtocolRunner (D-08)

**Что:** Новый метод, который добавляет текст через separator snippet-ноды и продвигает runner.

```typescript
// Source: CONTEXT.md D-08; паттерн взят из completeSnippet()
completeSnippetFile(text: string, snippetNodeId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null) return;

  const snippetNode = this.graph.nodes.get(snippetNodeId);
  if (snippetNode === undefined || snippetNode.kind !== 'snippet') return;

  // Undo entry ПЕРЕД мутацией (паттерн BUG-01 / D-03)
  this.undoStack.push({
    nodeId: snippetNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  this.accumulator.appendWithSeparator(text, this.resolveSeparatorForSnippet(snippetNode));

  const neighbors = this.graph.adjacency.get(snippetNodeId);
  const next = neighbors !== undefined ? neighbors[0] : undefined;
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  this.advanceThrough(next);
}
```

**Проблема с `resolveSeparator`:** Текущий `resolveSeparator()` принимает только `AnswerNode | FreeTextInputNode | TextBlockNode`. Нужно либо расширить сигнатуру типа, либо добавить отдельный private метод для snippet-ноды. Snippet-нода в текущей модели не имеет поля `radiprotocol_separator` — нужно решить, добавлять ли его или использовать `defaultSeparator`. [ASSUMED: SnippetNode будет использовать `defaultSeparator`, без per-node separator, если явно не указано иное в Phase 25 дизайне]

### Паттерн 7: runner-view.ts — рендер кнопки

```typescript
// Source: существующий паттерн из case 'question' в runner-view.ts
case 'snippet': {
  // Resolve button label: D-09 fallback chain
  const snippetNode = node as SnippetNode;
  const btnLabel = snippetNode.buttonLabel ?? node.text ?? 'Select file';
  // Примечание: canvas node text — нужно проверить как canvas-parser маппит его в SnippetNode

  const btn = questionZone.createEl('button', {
    cls: 'rp-answer-btn',  // SC-1: идентичный стиль с answer-кнопками
    text: btnLabel,
  });
  this.registerDomEvent(btn, 'click', () => {
    void this.handleSnippetNodeClick(snippetNode);
  });
  break;
}
```

**Важно:** `node.text` не доступно через `RPNodeBase` (только `id`, `kind`, `x`, `y`, `width`, `height`, `color`). Нужно проверить, как canvas-parser передаёт текст canvas-ноды в `SnippetNode`. Из кода Phase 22 (git ce9613f) видно, что `raw.text` используется как fallback через `getString(props, 'radiprotocol_buttonLabel', raw.text ?? '')`. Значит `buttonLabel` в `SnippetNode` может хранить как явное значение, так и текст ноды с canvas'а.

### Паттерн 8: handleSnippetNodeClick — полный flow

```typescript
private async handleSnippetNodeClick(snippetNode: SnippetNode): Promise<void> {
  // 1. syncManualEdit ПЕРЕД любым действием (BUG-01)
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');

  // 2. Resolve folder
  const folderPath = snippetNode.folderPath?.trim() ||
    this.plugin.settings.snippetNodeFolderPath.trim();
  if (folderPath === '') {
    new Notice('Snippet folder not configured. Set a path in plugin Settings → Storage.');
    return;  // D-05
  }

  // 3. Collect files recursively
  const files = this.app.vault.getFiles().filter(f =>
    (f.extension === 'md' || f.extension === 'json') &&
    f.path.startsWith(folderPath + '/')
  );

  // 4. Empty folder guard
  if (files.length === 0) {
    new Notice(`No files found in ${folderPath}`);
    return;  // D-04
  }

  // 5. Open picker — await selection
  const selectedFile = await new Promise<TFile | null>(resolve => {
    const modal = new SnippetFilePickerModal(this.app, files, resolve);
    modal.open();
    // onClose без выбора — вызовем resolve(null) через guard в modal
  });

  if (selectedFile === null) return;  // D-03: cancel = stay

  // 6. Dispatch by extension
  if (selectedFile.extension === 'md') {
    const content = await this.app.vault.read(selectedFile);
    this.runner.completeSnippetFile(content, snippetNode.id);
    void this.autoSaveSession();
    this.render();
  } else if (selectedFile.extension === 'json') {
    const snippetFile = await tryLoadSnippetFile(this.app, selectedFile);
    if (snippetFile === null) {
      new Notice('Not a valid snippet file');
      return;  // D-06: stay on node
    }
    const modal = new SnippetFillInModal(this.app, snippetFile);
    modal.open();
    const rendered = await modal.result;
    if (rendered === null) return;  // D-07: cancel = stay
    this.runner.completeSnippetFile(rendered, snippetNode.id);
    void this.autoSaveSession();
    this.render();
  }
}
```

### Anti-Patterns to Avoid

- **Использовать `innerHTML`** — запрещено в CLAUDE.md и критических правилах проекта. Только `createEl()`.
- **Advance без `syncManualEdit()`** — нарушение паттерна BUG-01. Всегда вызывать `syncManualEdit()` перед любым advance action.
- **Вызывать `autoSaveSession()` с `await`** — все вызовы должны быть `void this.autoSaveSession()` (NFR-09).
- **Проверять расширение без toLowerCase()** — `file.extension` в Obsidian API уже lowercase, но если читать из `file.name` нужен toLowerCase.
- **Неправильный startsWith для folder** — `startsWith(folderPath + '/')` со слешем, не без него. Иначе `"Templates2/..."` будет ложно включён при `folderPath="Templates"`.
- **Открывать SnippetFillInModal для invalid JSON** — проверка D-06 идёт ДО открытия модального окна.

---

## Don't Hand-Roll

| Проблема | Не строить | Использовать вместо | Почему |
|----------|------------|---------------------|--------|
| Fuzzy search UI | Custom input + results list | `FuzzySuggestModal<TFile>` | Keyboard nav, a11y, theme integration — бесплатно |
| File listing | Recursive fs.walk() | `app.vault.getFiles()` + filter | vault.getFiles() работает с in-memory индексом, не с диском |
| Modal infrastructure | Custom overlay div | `FuzzySuggestModal` / `Modal` | Esc handling, focus management, Obsidian portal |
| Text notification | Custom DOM toast | `new Notice(message)` | Стандартный паттерн; auto-dismiss; no CSS needed |
| Snippet fill-in UI | Новый modal для JSON | `SnippetFillInModal` (уже существует) | Phase 5 уже реализовала полный UI с preview |

---

## Common Pitfalls

### Pitfall 1: `FuzzySuggestModal` vs `SuggestModal` — разный API

**Что идёт не так:** Попытка использовать методы `SuggestModal` (`getSuggestions`, `renderSuggestion`, `onChooseSuggestion`) в subclass `FuzzySuggestModal`.

**Почему:** `FuzzySuggestModal<T>` требует `getItems(): T[]`, `getItemText(item: T): string`, `onChooseItem(item, evt)`. `SuggestModal<T>` требует `getSuggestions()`, `renderSuggestion()`, `onChooseSuggestion()`. API не совместимы.

**Как избежать:** При наследовании `FuzzySuggestModal` — реализовывать только `getItems`, `getItemText`, `onChooseItem`.

**Ранние признаки:** TypeScript ошибки о missing methods.

### Pitfall 2: Cancel/resolve race в picker modal

**Что идёт не так:** `onChooseItem` вызывается, затем `onClose` тоже вызывается — Promise resolve срабатывает дважды.

**Почему:** Obsidian вызывает `onClose()` всегда при закрытии modal, включая случай когда item выбран.

**Как избежать:** Добавить `resolved = false` guard, как в `SnippetFillInModal.safeResolve()`. Устанавливать `resolved = true` в `onChooseItem()`.

### Pitfall 3: `startsWith` без trailing slash

**Что идёт не так:** `f.path.startsWith('Templates')` включает файлы из `"Templates2/"` папки.

**Почему:** String prefix matching без разделителя.

**Как избежать:** Всегда `f.path.startsWith(folderPath + '/')`.

### Pitfall 4: `syncManualEdit` не вызван перед advance

**Что идёт не так:** Пользователь вручную отредактировал textarea. Вставка файла через completeSnippetFile() перезаписывает ручные правки.

**Почему:** Паттерн BUG-01 требует `syncManualEdit()` перед КАЖДЫМ advance action.

**Как избежать:** Первая строка в `handleSnippetNodeClick`: `this.runner.syncManualEdit(this.previewTextarea?.value ?? '')`.

### Pitfall 5: SnippetNode отсутствует в текущем HEAD

**Что идёт не так:** Попытка реализовать Wave 2 (UI) без Wave 1 (graph layer). TypeScript ошибки о unknown `'snippet'` kind.

**Почему:** Коммит `da9e1b5` (начало Phase 24) откатил изменения Phase 22, удалив `SnippetNode` из `graph-model.ts`, `canvas-parser.ts`, `runner-state.ts`.

**Как избежать:** Wave 1 должна быть первым планом (см. рекомендуемую структуру волн). Проверить тестами что `case 'snippet'` обрабатывается в `advanceThrough`.

### Pitfall 6: resolveSeparator не принимает SnippetNode

**Что идёт не так:** TypeScript ошибка при вызове `resolveSeparator(snippetNode)` — тип `SnippetNode` не входит в union аргументов.

**Почему:** Текущий `resolveSeparator()` принимает только `AnswerNode | FreeTextInputNode | TextBlockNode`.

**Как избежать:** Либо добавить `radiprotocol_separator` в `SnippetNode` и расширить union, либо использовать `this.defaultSeparator` напрямую в `completeSnippetFile()`. [ASSUMED: проще использовать `defaultSeparator` если CONTEXT.md не требует per-node separator для snippet]

### Pitfall 7: Файлы из vault root при неправильном folderPath

**Что идёт не так:** Если `folderPath = ""` (пустая строка) не отловлен, `getFiles().filter(f => f.path.startsWith('/'  ))` может вернуть неожиданные результаты.

**Почему:** Проверка D-05 должна срабатывать ДО вызова `getFiles()`.

**Как избежать:** Проверить `folderPath === ''` прежде чем вызывать `getFiles()`.

---

## Runtime State Inventory

> Phase 25 — UI phase (не rename/refactor). Runtime State Inventory не применяется.
> None — verified: phase adds new UI code, no string-renaming, no migration of stored data.

---

## Environment Availability

> Phase 25 — чистый TypeScript + Obsidian API. Нет внешних зависимостей помимо уже установленных.

| Зависимость | Нужна для | Доступна | Версия | Fallback |
|-------------|-----------|----------|--------|----------|
| Node.js | Сборка (esbuild) | ✓ | (проект уже собирается) | — |
| TypeScript | Типизация | ✓ | (проект уже компилируется) | — |
| Vitest | Тесты | ✓ | (уже настроен) | — |
| Obsidian API | Runtime | ✓ | (plugin runtime) | — |
| `FuzzySuggestModal` | Picker modal | ✓ | встроен в Obsidian | — |

**Нет блокирующих отсутствующих зависимостей.**

---

## Validation Architecture

### Test Framework

| Свойство | Значение |
|----------|---------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (или `package.json` scripts) |
| Quick run | `npm test` (= `vitest run`) |
| Full suite | `npm test` |

### Phase Requirements → Test Map

| Req ID | Поведение | Тип теста | Команда | Файл |
|--------|-----------|-----------|---------|------|
| SNIPPET-01 (Wave 1) | SnippetNode в graph-model, parser, validator, runner halt | unit | `npm test -- src/__tests__/canvas-parser.test.ts src/__tests__/runner/protocol-runner.test.ts` | ❌ Wave 0 |
| SNIPPET-02 | Кнопка рендерится в runner на snippet-ноде | manual | Obsidian-only — нельзя автоматизировать | N/A |
| SNIPPET-03 | Picker scope to folder (per-node > global) | manual | Obsidian-only | N/A |
| SNIPPET-04 | `.md` файл добавляет plain text и advances runner | unit (runner) + manual | `npm test -- src/__tests__/runner/protocol-runner.test.ts` | ❌ Wave 0 |
| SNIPPET-05 | `.json` открывает SnippetFillInModal | manual | Obsidian-only (modal interaction) | N/A |
| SNIPPET-07 | per-node folderPath > global | unit (runner) | `npm test -- src/__tests__/runner/protocol-runner.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/canvas-parser.test.ts` — добавить тест для `kind: 'snippet'` parsing
- [ ] `src/__tests__/graph-validator.test.ts` — добавить тест snippet-ноды в valid graph
- [ ] `src/__tests__/runner/protocol-runner.test.ts` — добавить тест halt на snippet-ноде, `isAtSnippetNode: true`, `completeSnippetFile()`
- [ ] `src/__tests__/fixtures/snippet-node.canvas` — fixture файл (был в Phase 22 ce9613f, нужно воссоздать)

**Примечание:** Fixture `src/__tests__/fixtures/snippet-node.canvas` существовал в Phase 22 коммитах, но был удалён в `da9e1b5`. Нужно воссоздать в Wave 0.

---

## Security Domain

> `security_enforcement` не установлен явно в config.json → считается включённым.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local plugin |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | partial | JSON.parse в try/catch + структурная проверка (D-06) |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Паттерн | STRIDE | Стандартная митигация |
|---------|--------|----------------------|
| Malformed JSON crash | Tampering | `JSON.parse` в try/catch — уже учтено в D-06 |
| Path traversal через folderPath | Tampering | `app.vault.getFiles()` работает в vault sandbox; vault API не позволяет выйти за пределы vault |
| Arbitrary file read | Information Disclosure | Picker ограничен конфигурированной папкой через filter по path prefix |

**Нет `innerHTML`** — проектный запрет, все DOM через `createEl()`. [VERIFIED: в STATE.md "Critical Pitfalls" и CLAUDE.md]

---

## Code Examples

### Полная структура SnippetFilePickerModal

```typescript
// Source: паттерн NodePickerModal + FuzzySuggestModal API
// src/views/snippet-file-picker-modal.ts
import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class SnippetFilePickerModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChooseCb: (file: TFile | null) => void;
  private chosen = false;

  constructor(app: App, files: TFile[], onChoose: (file: TFile | null) => void) {
    super(app);
    this.files = files;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Search snippet files\u2026');
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.name;  // D-01: только имя файла
  }

  onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.chosen = true;
    this.onChooseCb(file);
  }

  onClose(): void {
    if (!this.chosen) {
      this.onChooseCb(null);  // D-03: Esc = null = stay on node
    }
    super.onClose();
  }
}
```

### canvas-parser.ts — добавление snippet case

```typescript
// Source: паттерн из ce9613f + структура существующих case в parseNode()
case 'snippet': {
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    folderPath: props['radiprotocol_folderPath'] !== undefined
      ? getString(props, 'radiprotocol_folderPath')
      : undefined,
    buttonLabel: props['radiprotocol_buttonLabel'] !== undefined
      ? getString(props, 'radiprotocol_buttonLabel', raw.text ?? '')
      : undefined,
  };
  return node;
}
```

Также нужно добавить `'snippet'` в `validKinds` array в `parseNode()`.

### graph-validator.ts — добавление snippet case

```typescript
// Source: паттерн из существующих case в validate()
// SnippetNode: valid = ровно 1 исходящее ребро (к следующей ноде)
// Нет специальных структурных ограничений (в отличие от loop-end/loop-start)
```

Нужно добавить `'snippet'` в exhaustiveness switch если он есть.

---

## State of the Art

| Старый подход | Текущий подход | Когда изменено | Влияние |
|---------------|----------------|----------------|---------|
| Phase 5: text-block + snippetId для dynamic snippets | Phase 20+: awaiting-snippet-fill убран как режим runner (код оставлен, но Phase 22 добавила отдельный kind 'snippet') | Phase 20 (dead code removal), Phase 22 (snippet node) | Phase 25 использует отдельный `kind: 'snippet'`, не `text-block.snippetId` |
| Picker открывается сразу при достижении ноды | Picker открывается только по нажатию кнопки | Phase 25 решение | Требует halt в `at-node` состоянии с explicit кнопкой |

**Deprecated/outdated:**
- `awaiting-snippet-fill` status: существует в текущем HEAD (для Phase 5 dynamic snippets через text-block.snippetId), но Phase 25 не использует его. Snippet-ноды останавливаются в `at-node` с `isAtSnippetNode: true`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SnippetNode` будет использовать `defaultSeparator` (без per-node `radiprotocol_separator`) в `completeSnippetFile()` | Architecture Patterns #6 | Если нужен per-node separator — нужно добавить поле в `SnippetNode` и расширить `resolveSeparator()` |
| A2 | `FuzzySuggestModal` предпочтительнее `SuggestModal` для файлового picker'а | Standard Stack | Оба работают; если SuggestModal предпочтителен — изменить базовый класс |
| A3 | Canvas node text (`raw.text`) маппится в `buttonLabel` в canvas-parser как fallback | Code Examples | Если нет — нужен другой способ получить label из canvas-ноды |
| A4 | `folderPath + '/'` — правильный способ prefix-фильтрации в Obsidian vault paths | Architecture Patterns #4 | Если vault paths не используют forward slash на Windows — логика фильтрации сломается |

**Если таблица пуста:** Все claims verified. Таблица не пуста — A1-A4 требуют подтверждения при реализации.

---

## Open Questions

1. **Separator для SnippetNode**
   - Что знаем: текущий `resolveSeparator()` принимает только `AnswerNode | FreeTextInputNode | TextBlockNode`
   - Что неясно: должна ли snippet-нода поддерживать per-node separator или всегда использовать `defaultSeparator`?
   - Рекомендация: использовать `defaultSeparator` в Phase 25; добавить `radiprotocol_separator` в `SnippetNode` в будущей фазе если потребуется

2. **Canvas node text в SnippetNode**
   - Что знаем: `RPNodeBase` не имеет поля `text`; canvas nodes имеют `raw.text`
   - Что неясно: как именно Phase 22 (git ce9613f) передавала `raw.text` как fallback для `buttonLabel`
   - Рекомендация: по коммиту ce9613f — парсить `getString(props, 'radiprotocol_buttonLabel', raw.text ?? '')` для `buttonLabel`; таким образом `buttonLabel` всегда содержит либо явное значение, либо canvas text — нет нужды в отдельном поле `text` на `SnippetNode`

3. **Vault paths на Windows**
   - Что знаем: проект работает на Windows 11; Obsidian vault paths используют forward slash даже на Windows
   - Что неясно: гарантированно ли `TFile.path` использует `/` на Windows?
   - Рекомендация: [ASSUMED] Obsidian нормализует все vault paths к forward slash на всех платформах; следовать существующему паттерну в `canvas-selector-widget.ts` который не делает платформо-специфичных проверок

---

## Sources

### Primary (HIGH confidence)
- `src/graph/graph-model.ts` (HEAD) — текущая структура RPNodeKind, отсутствие SnippetNode
- `src/runner/runner-state.ts` (HEAD) — AtNodeState без isAtSnippetNode
- `src/runner/protocol-runner.ts` (HEAD) — advanceThrough, resolveSeparator, completeSnippet pattern
- `src/views/runner-view.ts` (HEAD) — at-node switch pattern, registerDomEvent, BUG-01 pattern
- `src/views/node-picker-modal.ts` (HEAD) — SuggestModal subclass pattern
- `src/views/snippet-fill-in-modal.ts` (HEAD) — safeResolve guard, result Promise pattern
- `src/views/canvas-selector-widget.ts` (HEAD) — TFolder recursive traversal, folderPath handling
- `src/settings.ts` (HEAD) — snippetNodeFolderPath field confirmed
- `git log` + `git show ce9613f` — Phase 22 SnippetNode implementation (reference)
- `git show da9e1b5` — подтверждение что Phase 22 код был откачен

### Secondary (MEDIUM confidence)
- `.planning/phases/25-snippet-node-runner-ui/25-CONTEXT.md` — locked decisions D-01..D-09
- `.planning/phases/25-snippet-node-runner-ui/25-UI-SPEC.md` — FuzzySuggestModal API, CSS классы
- `.planning/STATE.md` — Critical Pitfalls, Key Decisions

### Tertiary (LOW confidence)
- [ASSUMED] FuzzySuggestModal API (getItems/getItemText/onChooseItem) — на основе Obsidian patterns в mocks

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — все библиотеки встроены в Obsidian, паттерны верифицированы в коде
- Architecture: HIGH — паттерны взяты из существующего кода (node-picker-modal, runner-view)
- Graph layer blocker: HIGH — подтверждено через `git show HEAD:src/graph/graph-model.ts` и `git show da9e1b5`
- Pitfalls: HIGH — FuzzySuggestModal vs SuggestModal различие, BUG-01 паттерн, startsWith pitfall — всё из реального кода
- FuzzySuggestModal exact API: MEDIUM — не было возможности проверить через Context7; основано на Obsidian mock и UI-SPEC

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (стабильный Obsidian plugin API)
