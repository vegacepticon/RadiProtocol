# Phase 29: Snippet Node — Model, Editor, Validator — Research

**Researched:** 2026-04-13
**Domain:** TypeScript graph model extension, EditorPanel form, Obsidian vault API
**Confidence:** HIGH — все ключевые решения зафиксированы в CONTEXT.md; исходный код всех точек интеграции прочитан напрямую

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Добавить `'snippet'` в union `RPNodeKind` в `graph-model.ts`.
- **D-02:** Интерфейс `SnippetNode`: `kind: 'snippet'`, `subfolderPath?: string` (optional — отсутствие означает корень `.radiprotocol/snippets`).
- **D-03:** Имя canvas-свойства: `radiprotocol_subfolderPath` (следует конвенции `radiprotocol_*`).
- **D-04:** Добавить `'snippet'` в массив `validKinds[]` в `canvas-parser.ts`.
- **D-05:** Парсить `radiprotocol_subfolderPath` как optional string в `switch`-ветке `'snippet'`.
- **D-06:** Добавить option `'snippet'` в dropdown узла в EditorPanel (label: `"Snippet"`).
- **D-07:** `buildKindForm` case `'snippet'`: async dropdown (Obsidian `Setting.addDropdown`), заполняется рекурсивным листингом всех подпапок `.radiprotocol/snippets/` через `vault.adapter.list()`. Показывает полные относительные пути (напр. `CT/adrenal`, `CT/lung/nodes`).
- **D-08:** Пустое состояние (подпапок нет): dropdown показывает единственную disabled-опцию `"No subfolders found"`.
- **D-09:** Первая опция: `""` → `"— root (all snippets) —"` — сохраняет `subfolderPath: undefined`.
- **D-10:** Поле `text` на canvas-узле содержит только путь к подпапке (напр. `CT/adrenal`). При выборе root — `text` = `""` или отсутствует (без префикса "Snippet:").
- **D-11:** `NODE_COLOR_MAP['snippet'] = '6'` (фиолетовый — единственный свободный слот палитры).
- **D-12:** Новое правило валидации для отсутствующей подпапки не добавляется. Отсутствие `subfolderPath` — валидное состояние; runtime использует корневую папку. SNIPPET-NODE-08 superseded by D-12.

### Claude's Discretion

- Реализация хелпера рекурсивного листинга папок (inline в `buildKindForm` или отдельная утилита).
- Точный паттерн async-загрузки в EditorPanel (немедленно при `loadNode` или лениво при рендере формы).

### Deferred Ideas (OUT OF SCOPE)

Нет — обсуждение не вышло за рамки фазы.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIPPET-NODE-01 | Parser и graph model распознают `snippet` как валидный 8-й вид узла | D-01, D-04, D-05 — точки расширения в `graph-model.ts` и `canvas-parser.ts` прочитаны |
| SNIPPET-NODE-02 | Форма EditorPanel для snippet-узла включает picker подпапки внутри `.radiprotocol/snippets/` | D-06, D-07, D-08, D-09 — паттерн `vault.adapter.list()` верифицирован в `snippet-service.ts` |
| SNIPPET-NODE-08 | Superseded by D-12: GraphValidator не предупреждает об отсутствии `subfolderPath`; отсутствие — valid state | `graph-validator.ts` прочитан — изменений не требуется |
</phase_requirements>

---

## Summary

Фаза 29 добавляет `snippet` как 8-й тип узла в систему, в которой уже 7 типов. Все файлы, которые нужно изменить, хорошо знакомы из предыдущих фаз и прочитаны в этой сессии. Контракты строго заданы в CONTEXT.md.

Ключевая сложность — async-заполнение dropdown подпапок в `buildKindForm`: все остальные dropdown-кейсы в EditorPanel синхронные; `snippet`-кейс должен читать vault асинхронно. `buildKindForm` сейчас — синхронный метод `private buildKindForm(...)` без `async`. Нужно либо сделать его `async`, либо (предпочтительнее согласно паттернам Obsidian) запустить `void asyncHelper()` внутри синхронного метода и постфактум заполнить DOM.

Второй момент — `NODE_COLOR_MAP` типизирован как `Record<RPNodeKind, string>`. Добавление `'snippet'` в `RPNodeKind` немедленно вызовет TS compile error в `node-color-map.ts`, пока запись не добавлена. Это ожидаемо и служит полезным checklist-ом интеграции.

**Основная рекомендация:** Реализовать рекурсивный листинг как приватный async-метод на `EditorPanelView` (`private async listSnippetSubfolders(): Promise<string[]>`), вызывать его через `void` внутри синхронного `buildKindForm` с немедленным заполнением контейнера после await, используя паттерн `void (async () => { ... })()`.

---

## Standard Stack

### Core (без новых зависимостей)

| Файл | Что меняется | Почему |
|------|-------------|--------|
| `src/graph/graph-model.ts` | Добавить `'snippet'` в `RPNodeKind`, добавить `SnippetNode` interface | Граф-модель — источник правды для всех типов узлов |
| `src/graph/canvas-parser.ts` | `validKinds[]` + `switch case 'snippet'` | Парсер должен знать все валидные виды |
| `src/views/editor-panel-view.ts` | `addOption('snippet', ...)` + `case 'snippet': buildKindForm` | EditorPanel — точка входа для конфигурирования узлов |
| `src/canvas/node-color-map.ts` | `'snippet': '6'` | Record<RPNodeKind, string> — exhaustive, обязателен |

### Obsidian API (уже используется, новых импортов нет)

| API | Использование | Источник паттерна |
|-----|--------------|-------------------|
| `vault.adapter.list(path)` | Рекурсивный листинг подпапок `.radiprotocol/snippets/` | `snippet-service.ts` (верифицировано) |
| `vault.adapter.exists(path)` | Проверка существования базовой папки snippets | `snippet-service.ts` (верифицировано) |
| `new Setting(container).addDropdown()` | Dropdown выбора подпапки | `editor-panel-view.ts` — все 7 кейсов используют этот паттерн |

---

## Architecture Patterns

### Паттерн 1: Расширение RPNodeKind (exhaustive union)

**Что:** TypeScript discriminated union `RPNodeKind` строго типизирован; `NODE_COLOR_MAP` — `Record<RPNodeKind, string>`.

**Порядок изменений (критически важен для компиляции):**
1. `graph-model.ts` — добавить `'snippet'` в union + добавить `SnippetNode` interface + добавить в `RPNode` union
2. `node-color-map.ts` — добавить `'snippet': '6'` (TS compile error не пройдёт иначе)
3. `canvas-parser.ts` — добавить в `validKinds[]`, добавить `case 'snippet'`
4. `editor-panel-view.ts` — добавить `addOption`, добавить `case 'snippet'` в `buildKindForm`

**Почему порядок важен:** `NODE_COLOR_MAP` типизирован как `Record<RPNodeKind, string>`, поэтому как только `'snippet'` появится в union, TS потребует запись в карте до следующей компиляции. Проще добавлять файлы в порядке зависимостей.

[VERIFIED: читал `node-color-map.ts` — строка 12 `export const NODE_COLOR_MAP: Record<RPNodeKind, string>`]

### Паттерн 2: Рекурсивный листинг подпапок через vault.adapter.list()

**Что:** `vault.adapter.list(path)` возвращает `{ files: string[], folders: string[] }`. Для рекурсии нужно вызывать list() для каждого найденного subfolder.

**Пример структуры хелпера:**

```typescript
// Source: верифицировано в snippet-service.ts — тот же vault.adapter.list() паттерн
private async listSnippetSubfolders(basePath: string): Promise<string[]> {
  const exists = await this.plugin.app.vault.adapter.exists(basePath);
  if (!exists) return [];

  const results: string[] = [];
  const queue: string[] = [basePath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const listing = await this.plugin.app.vault.adapter.list(current);
    for (const folder of listing.folders) {
      // folder — полный путь, нужен относительный от basePath
      const rel = folder.slice(basePath.length + 1); // убрать basePath + '/'
      results.push(rel);
      queue.push(folder); // BFS — рекурсивно
    }
  }

  return results;
}
```

[ASSUMED] Точный формат строк из `listing.folders` (полный путь vs. имя) — потребует проверки при реализации. На основании изучения `snippet-service.ts` ожидается полный путь аналогично `listing.files`.

### Паттерн 3: Async-заполнение dropdown в синхронном buildKindForm

**Что:** `buildKindForm` — синхронный метод. Dropdown с подпапками требует async vault-вызова.

**Рекомендуемый паттерн (согласуется с `void this.renderNodeForm(...)` в `loadNode`):**

```typescript
case 'snippet': {
  new Setting(container).setHeading().setName('Snippet node');
  const dropSetting = new Setting(container)
    .setName('Subfolder path')
    .setDesc('Select the subfolder within .radiprotocol/snippets/. Leave as root to use all snippets.');

  // Async заполнение — синхронный метод запускает async worker
  void (async () => {
    const subfolders = await this.listSnippetSubfolders(
      `${this.plugin.settings.snippetFolderPath}`
    );
    dropSetting.addDropdown(drop => {
      drop.addOption('', '— root (all snippets) —');
      if (subfolders.length === 0) {
        const el = drop.selectEl.createEl('option', {
          text: 'No subfolders found',
        });
        el.disabled = true;
        el.selected = false;
      } else {
        for (const sub of subfolders) {
          drop.addOption(sub, sub);
        }
      }
      const current = (nodeRecord['radiprotocol_subfolderPath'] as string | undefined) ?? '';
      drop.setValue(current);
      drop.onChange(v => {
        this.pendingEdits['radiprotocol_subfolderPath'] = v || undefined;
        this.pendingEdits['text'] = v; // D-10: text mirrors path
        this.scheduleAutoSave();
      });
    });
  })();
  break;
}
```

[ASSUMED] Точный API для отключения одиночной `<option>` через Obsidian `DropdownComponent` не верифицирован — возможно, потребуется прямая манипуляция `selectEl` DOM-элементом.

### Паттерн 4: SnippetNode interface (следует паттерну других RPNodeBase-наследников)

```typescript
// Source: graph-model.ts — паттерн всех существующих интерфейсов
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;  // отсутствие = корень .radiprotocol/snippets
}
```

И добавить в union `RPNode`:

```typescript
export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode
  | SnippetNode;  // Phase 29
```

[VERIFIED: читал graph-model.ts строки 81-88 — паттерн RPNode union]

### Паттерн 5: canvas-parser switch case для snippet

```typescript
case 'snippet': {
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    subfolderPath: props['radiprotocol_subfolderPath'] !== undefined
      ? getString(props, 'radiprotocol_subfolderPath')
      : undefined,
  };
  return node;
}
```

[VERIFIED: читал canvas-parser.ts — паттерн идентичен `case 'text-block'` для optional полей, строки 224-237]

### Паттерн 6: nodeLabel для GraphValidator (нужно добавить case)

`GraphValidator.nodeLabel()` содержит exhaustive switch. После добавления `'snippet'` в `RPNodeKind` TypeScript потребует добавить case.

```typescript
case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
```

[VERIFIED: читал graph-validator.ts строки 192-203 — exhaustive switch в nodeLabel()]

### Anti-Patterns to Avoid

- **Не менять `buildKindForm` на `async`** — это сломает сигнатуру; паттерн проекта — `void asyncHelper()` внутри синхронного метода (см. `void this.renderNodeForm(...)` в `loadNode`).
- **Не добавлять `radiprotocol_subfolderPath` в PROTECTED_FIELDS** в `saveNodeEdits` — `PROTECTED_FIELDS` содержит только `['id', 'x', 'y', 'width', 'height', 'type']`; кастомные поля должны сохраняться.
- **Не хранить `snippetFolderPath` в локальной переменной** — использовать `this.plugin.settings.snippetFolderPath` напрямую (живая настройка).

---

## Don't Hand-Roll

| Проблема | Не строить | Использовать вместо | Почему |
|---------|-----------|---------------------|--------|
| Async vault listing | Свой рекурсивный файловый обход | `vault.adapter.list()` (BFS-loop) | Уже используется в `SnippetService.list()` |
| TS-безопасный exhaustive switch | `as any` cast | TypeScript compile error как checklist | `RPNodeKind` union + `Record<RPNodeKind, string>` покрывает все case |
| Сохранение edits | Прямой vault.modify() | `pendingEdits` + `scheduleAutoSave()` | 800ms debounce уже реализован, Pattern B / Strategy A обрабатывается в `saveNodeEdits` |

---

## Common Pitfalls

### Pitfall 1: Порядок добавления вызывает каскадные TS compile errors

**Что идёт не так:** Добавили `'snippet'` в `RPNodeKind`, но ещё не обновили `NODE_COLOR_MAP` — `tsc` упадёт на отсутствующем ключе в `Record<RPNodeKind, string>`.

**Почему:** `NODE_COLOR_MAP: Record<RPNodeKind, string>` — строго exhaustive.

**Как избежать:** Соблюдать порядок: `graph-model.ts` → `node-color-map.ts` → `canvas-parser.ts` → `editor-panel-view.ts`. Можно запускать `npm run build` после каждого файла как check.

**Признаки раннего обнаружения:** Ошибка TS на `node-color-map.ts` строка 12 — "Property 'snippet' is missing in type".

### Pitfall 2: `buildKindForm` не возвращает Promise — async result теряется при ошибке

**Что идёт не так:** Если `vault.adapter.list()` бросает исключение внутри `void (async () => {})()`, оно тихо проглатывается.

**Как избежать:** Обернуть внутренность async-IIFE в try/catch; при ошибке показать placeholder-текст вместо dropdown (`container.createEl('p', { text: 'Could not load subfolders.' })`).

### Pitfall 3: Формат путей из vault.adapter.list().folders

**Что идёт не так:** `listing.folders` возвращает полные vault-пути (напр. `.radiprotocol/snippets/CT/adrenal`), а не просто имена. Без `.slice(basePath.length + 1)` dropdown покажет полные пути вместо относительных.

**Как избежать:** Верифицировать формат при первом ручном тесте; вычислять относительный путь через `folder.slice(basePath.length + 1)` где `basePath` — путь к корневой папке snippets.

**Признаки:** Dropdown показывает `.radiprotocol/snippets/CT/adrenal` вместо `CT/adrenal`.

### Pitfall 4: `nodeLabel()` в GraphValidator не обновлён

**Что идёт не так:** `switch (node.kind)` в `nodeLabel()` станет неполным после добавления `'snippet'` — TypeScript с `noImplicitReturns` сообщит об ошибке; без него функция вернёт `undefined`, что в строковом контексте даст `"undefined"`.

**Как избежать:** После добавления `'snippet'` в RPNodeKind — искать все exhaustive switch по проекту. Основные: `nodeLabel()` в `graph-validator.ts`, `buildKindForm` в `editor-panel-view.ts`.

### Pitfall 5: Сохранение text поля при выборе root

**Что идёт не так:** При выборе `""` (root) нужно сохранить `radiprotocol_subfolderPath: undefined` и `text: ""`. Если `text` остаётся старым значением, canvas покажет устаревший путь.

**Как избежать:** В onChange: `this.pendingEdits['text'] = v` — при `v === ""` это запишет пустую строку в `text`. В `saveNodeEdits` значение `undefined` удаляет ключ из JSON (строка 241: `if (value === undefined) { delete node[key]; }`). `text` при `v = ""` сохранится как `""`.

---

## Code Examples

### Полный паттерн для SnippetNode в graph-model.ts

```typescript
// Source: graph-model.ts — верифицированный паттерн всех RPNodeBase-наследников
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;
}

// Добавить в RPNode union:
export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode
  | SnippetNode;
```

### canvas-parser.ts — импорт и switch case

```typescript
// В импортах добавить:
import type { ..., SnippetNode } from './graph-model';

// В validKinds[]:
const validKinds: RPNodeKind[] = [
  'start', 'question', 'answer', 'free-text-input',
  'text-block', 'loop-start', 'loop-end', 'snippet',  // Phase 29
];

// В switch:
case 'snippet': {
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    subfolderPath: props['radiprotocol_subfolderPath'] !== undefined
      ? getString(props, 'radiprotocol_subfolderPath')
      : undefined,
  };
  return node;
}
```

### node-color-map.ts — добавить одну строку

```typescript
export const NODE_COLOR_MAP: Record<RPNodeKind, string> = {
  'start':           '4',
  'question':        '5',
  'answer':          '2',
  'free-text-input': '2',
  'text-block':      '3',
  'loop-start':      '1',
  'loop-end':        '1',
  'snippet':         '6',  // Phase 29: purple — last unused slot
};
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (verифицировано: `package.json` scripts `"test": "vitest run"`) |
| Config file | `vitest.config.ts` или в `package.json` |
| Quick run command | `npm test -- canvas-parser` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SNIPPET-NODE-01 | CanvasParser распознаёт `radiprotocol_nodeType = "snippet"`, возвращает `SnippetNode` с корректными полями | unit | `npm test -- canvas-parser` | ❌ Wave 0: нужен fixture `snippet-node.canvas` |
| SNIPPET-NODE-01 | Parser корректно парсит `radiprotocol_subfolderPath` как optional | unit | `npm test -- canvas-parser` | ❌ Wave 0 |
| SNIPPET-NODE-02 | (Форма EditorPanel) — DOM-зависимый; EditorPanel unit test ограничен мок-окружением | unit/manual | `npm test -- editor-panel` | ⚠️ Существует; нужны новые cases |
| SNIPPET-NODE-08 (superseded) | GraphValidator не падает на snippet-узле без subfolderPath | unit | `npm test -- graph-validator` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `src/__tests__/fixtures/snippet-node.canvas` — fixture с snippet-узлом, содержащим `radiprotocol_subfolderPath`
- [ ] `src/__tests__/fixtures/snippet-node-no-path.canvas` — fixture snippet-узла без пути (для теста D-12 / SNIPPET-NODE-08 superseded)
- [ ] Новые `it()` cases в `canvas-parser.test.ts` — парсинг snippet kind
- [ ] Новые `it()` cases в `graph-validator.test.ts` — snippet-узел без subfolderPath не генерирует ошибок

---

## Environment Availability

Step 2.6: Фаза — чисто код/конфиг изменения без внешних зависимостей. Все API (vault.adapter.list, Obsidian Setting) — часть Obsidian runtime, всегда доступны в plugin-окружении. Внешние инструменты не требуются.

---

## Security Domain

Фаза работает с путями к подпапкам внутри vault. Применимые ASVS категории:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Путь `subfolderPath` принимается только от Obsidian vault API через `vault.adapter.list()` — не от прямого пользовательского ввода. Dropdown ограничивает выбор реально существующими подпапками. |
| V4 Access Control | no | Нет новой аутентификации или ролей |
| V6 Cryptography | no | Нет новых криптографических операций |

**Path traversal риск:** НИЗКИЙ — `subfolderPath` заполняется только из результатов `vault.adapter.list(basePath)`, что ограничивает значения реально существующими подпапками внутри basePath. Прямого ввода пути пользователем нет.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `listing.folders` из `vault.adapter.list()` возвращает полные vault-пути (не только имена) | Pitfall 3, Code Examples | Если возвращает только имена — slice не нужен; BFS-рекурсия сломается |
| A2 | `Setting.addDropdown()` поддерживает манипуляцию `selectEl` для disabled option | Architecture Patterns 3 | Если нет — нужен другой способ отображения "No subfolders found" |
| A3 | `this.plugin.settings.snippetFolderPath` — корректный путь к папке snippets | Code Examples | Если settings-ключ называется иначе — нужно прочитать settings interface |

---

## Open Questions

1. **Точный ключ `snippetFolderPath` в settings**
   - Что знаем: `snippet-service.ts` использует `this.settings.snippetFolderPath`
   - Не ясно: нужно верифицировать имя поля в `RadiProtocolSettings` при реализации
   - Рекомендация: исполнитель читает `src/settings.ts` в Wave 0

2. **Как заполнить disabled option в Obsidian DropdownComponent**
   - Что знаем: `addOption(value, label)` — стандартный путь
   - Не ясно: поддерживает ли `DropdownComponent` disabled опции напрямую
   - Рекомендация: использовать `drop.selectEl` (нативный HTMLSelectElement) для создания disabled option через DOM API (безопасно — не `innerHTML`)

---

## Sources

### Primary (HIGH confidence)
- `src/graph/graph-model.ts` — прочитан напрямую; `RPNodeKind` union, `RPNode` union, все интерфейсы
- `src/graph/canvas-parser.ts` — прочитан напрямую; `validKinds[]`, `parseNode()` switch, паттерны optional-полей
- `src/views/editor-panel-view.ts` — прочитан напрямую; `buildKindForm()` switch, `pendingEdits`, `scheduleAutoSave()`
- `src/canvas/node-color-map.ts` — прочитан напрямую; `Record<RPNodeKind, string>`
- `src/snippets/snippet-service.ts` — прочитан напрямую; `vault.adapter.list()` паттерн
- `src/graph/graph-validator.ts` — прочитан напрямую; `nodeLabel()` exhaustive switch
- `.planning/phases/29-snippet-node-model-editor-validator/29-CONTEXT.md` — все locked decisions D-01 to D-12

### Secondary (MEDIUM confidence)
- `src/__tests__/canvas-parser.test.ts` — fixture паттерны и тест-структура верифицированы
- `src/__tests__/graph-validator.test.ts` — тест-паттерны верифицированы
- `src/__tests__/editor-panel.test.ts` — существующий test file верифицирован

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — все файлы прочитаны напрямую
- Architecture: HIGH для model/parser/color; MEDIUM для async dropdown pattern (A2 assumption)
- Pitfalls: HIGH — основаны на прямом чтении кода

**Research date:** 2026-04-13
**Valid until:** Стабильный домен — актуален до следующего рефакторинга EditorPanel
