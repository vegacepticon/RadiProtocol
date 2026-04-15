# Phase 31: Mixed Answer + Snippet Branching at Question Nodes — Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 11 (8 source + 3 test)
**Analogs found:** 11 / 11 (все файлы — in-place extension, аналог = сам файл или его сосед из Phase 30)

Фаза 31 — это *точечное расширение* уже существующих файлов. Почти для каждого файла "аналог" — это либо сам файл (нужно добавить поля/методы рядом с уже существующими), либо соседний case в том же switch. Планнер должен копировать структуру, а не изобретать её.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/graph/graph-model.ts` | model (type def) | transform | `SnippetNode` + `AnswerNode.radiprotocol_separator` (same file, lines 33-53, 67-70) | exact (self) |
| `src/graph/canvas-parser.ts` | parser | transform | `case 'snippet'` + `case 'answer'` (same file, lines 194-205, 261-272) | exact (self) |
| `src/graph/graph-validator.ts` | validator | transform | `Check 5: Dead-end questions` (same file, lines 60-71) | exact (self) |
| `src/runner/protocol-runner.ts` | state-machine | event-driven | `chooseAnswer` + `completeSnippet` + `stepBack` + `resolveSeparator` (same file, lines 73-101, 147-158, 189-211, 440-452) | exact (self) |
| `src/runner/runner-state.ts` | model (type def) | transform | `AtNodeState` + `getSerializableState` undoStack shape (same file + protocol-runner.ts:359-389) | exact (self) |
| `src/views/runner-view.ts` | view | request-response | `case 'question'` in render switch (same file, lines 332-355) | exact (self) |
| `src/views/editor-panel-view.ts` | view (form) | transform | `case 'snippet'` subfolderPath dropdown (same file, lines 566-613) | exact (self) |
| `src/styles/runner-view.css` | css | — | `.rp-answer-list` + `.rp-answer-btn` (same file, lines 103-118) | role-match |
| `src/__tests__/runner/protocol-runner.test.ts` | test | event-driven | existing Phase 30 `pickSnippet` / `completeSnippet` tests | role-match |
| `src/__tests__/graph-validator.test.ts` | test | transform | existing `'detects dead-end question...'` test | role-match |
| `src/__tests__/canvas-parser.test.ts` | test | transform | existing `radiprotocol_subfolderPath` parse test | role-match |

---

## Pattern Assignments

### 1. `src/graph/graph-model.ts` (model)

**Analog:** самого себя — поля `radiprotocol_separator` на `AnswerNode/FreeTextInputNode/TextBlockNode` и `SnippetNode.subfolderPath`.

**Pattern — optional string/enum field on a node interface** (lines 33-38, 67-70):
```ts
export interface AnswerNode extends RPNodeBase {
  kind: 'answer';
  answerText: string;
  displayLabel?: string;
  radiprotocol_separator?: 'newline' | 'space';
}
...
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;  // отсутствие = корень .radiprotocol/snippets (D-02, D-03)
}
```

**What to mirror for Phase 31 (D-01, D-04):** добавить в `SnippetNode` два optional поля — `snippetLabel?: string` и `radiprotocol_snippetSeparator?: 'newline' | 'space'`. Комментарий к полю в стиле существующих (одна строка с reference на D-XX).

**Critical:** `SnippetNode` — единственный интерфейс, который трогаем. Не трогать никакие другие.

---

### 2. `src/graph/canvas-parser.ts` (parser)

**Analog:** `case 'answer'` (lines 194-205) — pattern нормализации enum-separator; `case 'snippet'` (lines 261-272) — pattern обработки string с null/"" → undefined.

**Pattern A — enum separator normalisation** (lines 202-204):
```ts
radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
  : props['radiprotocol_separator'] === 'newline' ? 'newline'
  : undefined,
```

**Pattern B — optional string with empty/null → undefined** (lines 262-269, WR-02):
```ts
const rawPath = props['radiprotocol_subfolderPath'];
const node: SnippetNode = {
  ...base,
  kind: 'snippet',
  // WR-02: treat JSON null and empty string identically to undefined — all mean "root"
  subfolderPath: (typeof rawPath === 'string' && rawPath !== '')
    ? rawPath
    : undefined,
};
```

**What to mirror for Phase 31:** внутри того же `case 'snippet'` блока (append inside the object literal — НЕ переписывать):
- `snippetLabel` — Pattern B (empty-string → undefined)
- `radiprotocol_snippetSeparator` — Pattern A (enum normalise space/newline → undefined)

**Critical:** `case 'snippet'` block — append внутрь object literal, не трогать `subfolderPath`. Ни один другой case не меняется.

---

### 3. `src/graph/graph-validator.ts` (validator)

**Analog:** `Check 5: Dead-end questions` (lines 60-71).

**Current check** (lines 60-71):
```ts
// Check 5: Dead-end questions — question nodes with no outgoing edges
for (const [id, node] of graph.nodes) {
  if (node.kind === 'question') {
    const outgoing = graph.adjacency.get(id);
    if (!outgoing || outgoing.length === 0) {
      errors.push(
        `Question "${node.questionText || id}" has no answers. ` +
        'Add at least one answer node connected from this question.'
      );
    }
  }
}
```

**What to mirror for Phase 31 (D-07):** текст сообщения перефразировать на "has no outgoing branches" (agnostic). Правило `outgoing.length === 0` остаётся. Никаких новых правил, никаких удалений — только reword message. Research подтвердил: других правил, ограничивающих kind outgoing из question, в этом файле нет.

---

### 4. `src/runner/protocol-runner.ts` (state-machine)

Это главный файл фазы. Четыре независимых pattern-точки.

#### 4a. Pattern — `chooseXxx` (push undo BEFORE mutation, then advance)

**Analog:** `chooseAnswer` (lines 73-101).

```ts
chooseAnswer(answerId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const answerNode = this.graph.nodes.get(answerId);
  if (answerNode === undefined || answerNode.kind !== 'answer') {
    this.transitionToError(`Answer node '${answerId}' not found or is not an answer node.`);
    return;
  }

  // Push undo entry BEFORE any mutation (Pitfall 3 — snapshot must come first)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  // Append the answer text
  this.accumulator.appendWithSeparator(answerNode.answerText, this.resolveSeparator(answerNode));

  // Advance to the next node after this answer
  const neighbors = this.graph.adjacency.get(answerId);
  const next = neighbors !== undefined ? neighbors[0] : undefined;
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  this.advanceThrough(next);
}
```

**What to mirror for new `chooseSnippetBranch(snippetNodeId: string)` method:**
1. Валидация — `runnerStatus === 'at-node'`, graph != null, currentNodeId != null.
2. Проверка — `snippetNode.kind === 'snippet'` AND `snippetNode.id ∈ adjacency.get(currentNodeId)`.
3. **Push UndoEntry BEFORE mutation** с новым флагом `returnToBranchList: true`.
4. Установить `this.currentNodeId = snippetNodeId` и `this.runnerStatus = 'awaiting-snippet-pick'`. **НЕ вызывать `advanceThrough` и НЕ трогать accumulator** (D-03: accumulator меняется только после `completeSnippet`).

Важное отличие от `chooseAnswer`: этот метод не вызывает `appendWithSeparator` — именно потому, что текст snippet'а вставляется позже в `completeSnippet`.

#### 4b. Pattern — `stepBack` (pop and restore)

**Analog:** `stepBack` (lines 147-158).

```ts
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return; // Nothing to undo

  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.loopContextStack = [...entry.loopContextStack]; // restore from snapshot (LOOP-05)
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```

**What to mirror for D-08:** добавить *early branch* в начале — если `entry.returnToBranchList === true`, выполнить ту же восстанавливающую последовательность (она фактически идентична — `nodeId` в entry уже указывает на question-узел, а accumulator был snapshot'нут ДО click по branch), и `return`. На практике два ветвления могут слить в один код-путь, но с комментарием отмечающим D-08 семантику.

**Key insight:** реальный код одинаковый для обоих случаев. Флаг `returnToBranchList` — только для session resume round-trip (D-09) и как documentation marker. Если Planner подтвердит это, можно хранить флаг только в serialized shape и вообще не ветвиться в `stepBack`.

#### 4c. Pattern — `completeSnippet` separator hook (extend D-04)

**Analog:** lines 189-211 (actual hook at line 195).

```ts
completeSnippet(renderedText: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-fill') return;
  if (this.graph === null || this.snippetNodeId === null) return;

  const pendingNodeId = this.snippetNodeId;
  const snippetNode = this.graph.nodes.get(pendingNodeId);
  const snippetSep = (snippetNode?.kind === 'text-block')
    ? this.resolveSeparator(snippetNode)
    : this.defaultSeparator;  // ← snippet-kind falls through to global default
  this.accumulator.appendWithSeparator(renderedText, snippetSep);
  ...
}
```

**What to mirror for D-04:** расширить условие, чтобы покрыть и `kind === 'snippet'`:
```ts
const snippetSep = (snippetNode?.kind === 'text-block' || snippetNode?.kind === 'snippet')
  ? this.resolveSeparator(snippetNode)
  : this.defaultSeparator;
```

Это автоматически делает override рабочим ДЛЯ ОБОИХ кодовых путей — и Phase 30 (snippet после answer), и Phase 31 (branch-entered picker).

#### 4d. Pattern — `resolveSeparator` private helper

**Analog:** lines 446-452.

```ts
private resolveSeparator(
  node: import('../graph/graph-model').AnswerNode
        | import('../graph/graph-model').FreeTextInputNode
        | import('../graph/graph-model').TextBlockNode,
): 'newline' | 'space' {
  return node.radiprotocol_separator ?? this.defaultSeparator;
}
```

**What to mirror:** добавить `SnippetNode` в union и разветвить по `kind`:
```ts
private resolveSeparator(
  node: AnswerNode | FreeTextInputNode | TextBlockNode | SnippetNode,
): 'newline' | 'space' {
  if (node.kind === 'snippet') {
    return node.radiprotocol_snippetSeparator ?? this.defaultSeparator;
  }
  return node.radiprotocol_separator ?? this.defaultSeparator;
}
```

Ветвление — потому что поле на SnippetNode имеет другое имя (D-04 verbatim `radiprotocol_snippetSeparator`).

---

### 5. `src/runner/runner-state.ts` + `getSerializableState/restoreFrom` (serialization)

**Analog:** `getSerializableState` (protocol-runner.ts:359-389) + `restoreFrom` (lines 415-435).

**Pattern — undoStack deep-copy** (lines 380-384):
```ts
undoStack: this.undoStack.map(e => ({
  nodeId: e.nodeId,
  textSnapshot: e.textSnapshot,
  loopContextStack: e.loopContextStack.map(f => ({ ...f })),
})),
```

**What to mirror for D-09:**
1. Обновить TypeScript shape в обеих сигнатурах (getSerializableState return type + restoreFrom parameter) — добавить `returnToBranchList?: boolean` в элемент undoStack.
2. В `.map(e => ({...}))` добавить `returnToBranchList: e.returnToBranchList,` (в обоих местах — serialise и restore).
3. Никаких новых top-level полей. `currentNodeId` уже покрывает "selected snippet variant node id" автоматически (research §"Session Resume").
4. `AtNodeState` в `runner-state.ts` НЕ меняется — branch list derivable из graph.
5. Resumable-statuses whitelist (line 368-372) уже включает `awaiting-snippet-pick` — не трогать.

---

### 6. `src/views/runner-view.ts` (view render)

**Analog:** `case 'question'` в render switch (lines 332-355).

```ts
case 'question': {
  questionZone.createEl('p', {
    text: node.questionText,
    cls: 'rp-question-text',
  });
  const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
  const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];
  for (const answerId of neighborIds) {
    const answerNode = this.graph.nodes.get(answerId);
    if (answerNode === undefined || answerNode.kind !== 'answer') continue;
    const btn = answerList.createEl('button', {
      cls: 'rp-answer-btn',
      text: answerNode.displayLabel ?? answerNode.answerText,
    });
    this.registerDomEvent(btn, 'click', () => {
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01
      this.runner.chooseAnswer(answerNode.id);
      void this.autoSaveSession();   // SESSION-01
      void this.renderAsync();
    });
  }
  break;
}
```

**What to mirror for D-01, D-02:** ТОЛЬКО тело `case 'question'` (не трогать `free-text-input`, `loop-end`, default):
1. Одним проходом по `neighborIds` партиционировать в два массива — `answerNeighbors` и `snippetNeighbors` (сохраняя порядок обхода для стабильности).
2. Если `answerNeighbors.length > 0` — существующий `rp-answer-list` + `rp-answer-btn` pattern, код button click идентичен текущему (`syncManualEdit` → `chooseAnswer` → `autoSaveSession` → `renderAsync`).
3. Если `snippetNeighbors.length > 0` — новый `rp-snippet-branch-list` div с `rp-snippet-branch-btn` кнопками. Label: `snippetNode.snippetLabel ? '📁 ' + snippetNode.snippetLabel : '📁 Snippet'` (D-01 fallback).
4. Button click — same pipeline, но вызывает `this.runner.chooseSnippetBranch(snippetNode.id)`.
5. `registerDomEvent` — обязательно (Obsidian cleanup contract).

**CLAUDE.md constraint:** shared file. НЕ удалять соседние case-ы, НЕ рефакторить другие части switch. Только тело `case 'question'`.

---

### 7. `src/views/editor-panel-view.ts` (form field UI)

**Analog:** `case 'snippet'` subfolderPath dropdown (lines 566-613).

```ts
case 'snippet': {
  new Setting(container).setHeading().setName('Snippet node');
  const subfolderSetting = new Setting(container)
    .setName('Subfolder path')
    .setDesc('...');

  void (async () => {
    try {
      ...
      subfolderSetting.addDropdown(drop => {
        drop.addOption('', '\u2014 root (all snippets) \u2014');
        ...
        drop.setValue(currentPath);
        drop.onChange(v => {
          this.pendingEdits['radiprotocol_subfolderPath'] = v || undefined;
          this.pendingEdits['text'] = v;
          this.scheduleAutoSave();
        });
      });
    } catch {
      subfolderSetting.setDesc('Could not load subfolders. ...');
    }
  })();
  break;
}
```

**Key patterns to mirror:**
- `new Setting(container).setName(...).setDesc(...).addText(...)` / `.addDropdown(...)` fluent
- `this.pendingEdits[key] = v || undefined` — empty → undefined (D-09 norm)
- `this.scheduleAutoSave()` после каждого `onChange`
- Для snippetLabel — `addText`, без async, без IIFE
- Для snippetSeparator — `addDropdown` с тремя опциями: `''` (use global default), `'newline'`, `'space'`; mapping `v === '' ? undefined : v`

**Placement:** append внутри существующего `case 'snippet'` блока, **после** закрывающего `})();` на line 611 и **перед** `break;` на line 612. НЕ трогать subfolderPath dropdown. НЕ переписывать async IIFE. НЕ трогать `setHeading`.

---

### 8. `src/styles/runner-view.css` (CSS)

**Analog:** `.rp-answer-list` + `.rp-answer-btn` (lines 103-118).

```css
.rp-answer-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-1); /* 4px */
}

.rp-answer-btn {
  width: 100%;
  text-align: left;
  min-height: 40px;
  padding: var(--size-4-1) var(--size-4-2); /* 8px 16px */
  white-space: normal;
  word-break: break-word;
  font-size: var(--font-text-size);
  line-height: 1.5;
}
```

**What to mirror:** в самом низу файла (append-only, CLAUDE.md) с заголовком-комментарием:
```css
/* Phase 31: mixed answer + snippet branches at question nodes */
.rp-snippet-branch-list { ... }
.rp-snippet-branch-btn { ... }
```

Новые классы используют те же Obsidian CSS variables (`var(--size-2-1)`, `var(--font-text-size)`, etc.) для визуальной согласованности. Визуальное отличие (`📁` в тексте + более тусклый accent) опционально — CONTEXT.md оставляет это на Claude's discretion.

**Post-change:** `npm run build` регенерирует `styles.css`. НЕ коммитить `styles.css` вручную.

**Critical:** Не трогать существующие `.rp-answer-*`, Phase 30 `.rp-snippet-folder-row`, `.rp-snippet-item-row` (lines ~220-238). Append only.

---

### 9. Tests — `src/__tests__/runner/protocol-runner.test.ts`

**Analog:** существующие Phase 30 тесты на `pickSnippet` / `completeSnippet` (точные имена не цитированы, но research §"Tests" их перечисляет).

**What to mirror:** fixture factory (question + 2 answer + 1 snippet), then:
- `it('chooseSnippetBranch transitions at-node → awaiting-snippet-pick')`
- `it('chooseSnippetBranch pushes undo entry with returnToBranchList=true')`
- `it('stepBack from branch-entered picker returns to branch list')` — pop → status=='at-node' && currentNodeId===questionId
- `it('stepBack from Phase 30 auto-advance picker still reverts to predecessor')` — regression guard
- `it('completeSnippet applies per-node radiprotocol_snippetSeparator override')` — D-04
- `it('completeSnippet falls back to global separator when snippet node has no override')`
- `it('chooseSnippetBranch rejects non-snippet node target')`
- `it('chooseSnippetBranch rejects target not in adjacency')`
- Session round-trip: getSerializableState → restoreFrom preserves `returnToBranchList` flag.

---

### 10. Tests — `src/__tests__/graph-validator.test.ts`

**What to mirror:**
- Update expected message substring in existing `'detects dead-end question...'` test (wording change — "has no outgoing branches").
- New: `'accepts question with only snippet outgoing edges silently'` — validate returns `[]`.
- New: `'accepts question with mixed answer + snippet outgoing edges silently'` — validate returns `[]`.

---

### 11. Tests — `src/__tests__/canvas-parser.test.ts`

**Analog:** existing test for `radiprotocol_subfolderPath` (Phase 29/30).

**What to mirror:**
- `it('parses radiprotocol_snippetLabel on snippet node')`
- `it('treats empty snippetLabel as undefined')`
- `it('parses radiprotocol_snippetSeparator = "space" | "newline"')`
- `it('treats invalid/missing radiprotocol_snippetSeparator as undefined')`

---

## Shared Patterns

### Append-only discipline (CLAUDE.md)
**Apply to:** `runner-view.ts`, `editor-panel-view.ts`, `styles/runner-view.css`, `graph-model.ts`, `protocol-runner.ts`.

Не удалять соседние `case`-ы, не рефакторить, не переписывать. Все правки — точечные вставки внутрь существующих блоков. Каждое изменение должно быть diff-friendly (минимальный patch).

### Undo-before-mutate invariant (Pitfall 1 / Pitfall 3)
**Apply to:** `chooseSnippetBranch` (new method in protocol-runner.ts).

Паттерн цитирован выше в §4a. **Всегда** push UndoEntry ДО любой мутации `currentNodeId`, `runnerStatus`, `accumulator`.

### Deep-copy serialization
**Apply to:** `getSerializableState` / `restoreFrom` extension.

Паттерн цитирован в §5. `this.undoStack.map(e => ({...e, loopContextStack: e.loopContextStack.map(f => ({...f}))}))` — без shared references.

### `pendingEdits[key] = v || undefined`
**Apply to:** оба новых поля в editor-panel-view.ts.

Empty-string нормализуется в `undefined`, parser это учитывает (Pattern B в §2).

### `registerDomEvent` для всех button clicks в runner-view
**Apply to:** обе новые snippet-branch кнопки.

Obsidian cleanup contract — не `addEventListener`.

---

## No Analog Found

Нет файлов без аналога. Каждое изменение в фазе 31 опирается на уже существующий pattern.

---

## Metadata

**Analog search scope:**
- `src/graph/` (graph-model, canvas-parser, graph-validator)
- `src/runner/` (protocol-runner, runner-state)
- `src/views/` (runner-view, editor-panel-view)
- `src/styles/runner-view.css`
- `src/__tests__/**`

**Key source references verified:**
- `src/graph/graph-model.ts` lines 33-38, 40-46, 48-53, 67-70
- `src/graph/canvas-parser.ts` lines 194-205, 208-222, 225-237, 261-272
- `src/graph/graph-validator.ts` lines 60-71
- `src/runner/protocol-runner.ts` lines 73-101, 147-158, 168-211, 359-435, 440-452
- `src/runner/runner-state.ts` lines 1-80
- `src/views/runner-view.ts` lines 320-355
- `src/views/editor-panel-view.ts` lines 566-613
- `src/styles/runner-view.css` lines 103-118

**Pattern extraction date:** 2026-04-15
