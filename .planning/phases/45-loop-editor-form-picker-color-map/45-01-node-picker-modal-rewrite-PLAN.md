---
phase: 45
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/node-picker-modal.ts
  - src/__tests__/node-picker-modal.test.ts
autonomous: true
requirements: [LOOP-06]
tags: [phase-45, node-picker-modal, loop-06, suggestmodal]

must_haves:
  truths:
    - "buildNodeOptions returns options for all 4 startable kinds: question, text-block, snippet, loop"
    - "buildNodeOptions excludes answer, start, free-text-input, loop-start, loop-end (D-06 осознанное отклонение от ROADMAP SC #3)"
    - "Every option has a non-empty label (text field || node.id fallback per D-07)"
    - "Options sort in kind-group order question → loop → text-block → snippet, alphabetical within group via localeCompare"
    - "Russian kind badges render via KIND_LABELS map: Вопрос / Текст / Сниппет / Цикл"
    - "SuggestModal setPlaceholder remains English 'Search nodes by label…' (D-11)"
  artifacts:
    - path: "src/views/node-picker-modal.ts"
      provides: "Extended NodePickerModal with 4-kind NodeOption union, KIND_LABELS const, KIND_ORDER const, updated buildNodeOptions + renderSuggestion"
      contains: "KIND_LABELS, KIND_ORDER, 'snippet', 'loop'"
    - path: "src/__tests__/node-picker-modal.test.ts"
      provides: "Unit tests locking in buildNodeOptions behaviour + label + sort + KIND_LABELS exhaustiveness + exclusion of non-startable kinds"
      contains: "buildNodeOptions, KIND_LABELS"
  key_links:
    - from: "src/views/node-picker-modal.ts"
      to: "src/graph/graph-model.ts"
      via: "type import of QuestionNode, TextBlockNode, SnippetNode, LoopNode, ProtocolGraph"
      pattern: "import type \\{[^}]*SnippetNode[^}]*LoopNode[^}]*\\} from '\\.\\./graph/graph-model'"
    - from: "src/__tests__/node-picker-modal.test.ts"
      to: "src/views/node-picker-modal.ts"
      via: "import of buildNodeOptions, KIND_LABELS, NodeOption"
      pattern: "from '\\.\\./views/node-picker-modal'"
---

<objective>
Переписать `src/views/node-picker-modal.ts` чтобы `NodePickerModal` стал first-class citizen для 4 startable kinds (question, text-block, snippet, loop) с русскими kind-badges, и покрыть поведение exhaustive unit-тестами.

Purpose: LOOP-06 — `NodePickerModal` должен перечислять `loop` как first-class kind наряду с question/text-block/snippet. Это одна из двух ключевых интеграций фазы (вторая — command wiring в Plan 45-03, которая ЗАВИСИТ от этого плана).

Output:
- Расширенный `node-picker-modal.ts` (append-only расширение `buildNodeOptions`, новые const'ы `KIND_LABELS` + `KIND_ORDER`, обновлённый `renderSuggestion`).
- Новый `src/__tests__/node-picker-modal.test.ts` с 7+ test-cases покрывающих D-06 .. D-10.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md
@src/views/node-picker-modal.ts
@src/graph/graph-model.ts

<interfaces>
<!-- Current state (BEFORE Phase 45) — extracted verbatim from src/views/node-picker-modal.ts:1-75 -->

```typescript
// Current NodeOption interface (node-picker-modal.ts:6-10):
export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block';
}

// Current buildNodeOptions (node-picker-modal.ts:17-38):
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      options.push({ id, label: (node as QuestionNode).questionText, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const preview = (node as TextBlockNode).content.slice(0, 60);
      options.push({ id, label: preview, kind: 'text-block' });
    }
  }
  options.sort((a, b) => {
    if (a.kind !== b.kind) { return a.kind === 'question' ? -1 : 1; }
    return a.label.localeCompare(b.label);
  });
  return options;
}

// Current renderSuggestion (node-picker-modal.ts:67-70):
renderSuggestion(option: NodeOption, el: HTMLElement): void {
  el.createEl('div', { text: option.label });
  el.createEl('small', { text: option.kind, cls: 'rp-node-kind-badge' });
}
```

Relevant types from src/graph/graph-model.ts:
```typescript
// LoopNode (graph-model.ts:67-70) — Phase 43 D-02:
export interface LoopNode extends RPNodeBase {
  kind: 'loop';
  headerText: string;
}

// SnippetNode (graph-model.ts:92-99) — Phase 29:
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;
  snippetLabel?: string;
  radiprotocol_snippetSeparator?: 'newline' | 'space';
}

// ProtocolGraph (graph-model.ts:135-142):
export interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;
  edges: RPEdge[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
  startNodeId: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend NodePickerModal to 4 kinds with Russian badges + entry-order sort</name>
  <files>src/views/node-picker-modal.ts</files>
  <read_first>
    - src/views/node-picker-modal.ts (ВСЕ 75 строк — это файл, который редактируется)
    - src/graph/graph-model.ts:9-18 (RPNodeKind union)
    - src/graph/graph-model.ts:54-70 (TextBlockNode, LoopNode)
    - src/graph/graph-model.ts:92-99 (SnippetNode)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md секция `<decisions>` D-06 .. D-11
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md §"Code Examples" Example 4
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"2) src/views/node-picker-modal.ts"
  </read_first>
  <behavior>
    - buildNodeOptions с пустым graph → []
    - buildNodeOptions с mixed graph (1 question "Q", 1 loop "L", 1 text-block "T", 1 snippet "sub/path") → 4 options в порядке [question 'Q', loop 'L', text-block 'T', snippet 'sub/path']
    - buildNodeOptions исключает nodes с kind='answer', 'start', 'free-text-input', 'loop-start', 'loop-end'
    - Label fallback: question без questionText → label === node.id; text-block с пустым content → label === node.id; snippet без subfolderPath → label === '(корень snippets)' (не id, так как '(корень snippets)' truthy); loop без headerText → label === node.id
    - Внутри одной kind-группы sort alphabetical по label.toLowerCase() через localeCompare (стабильный для ES2019+)
    - KIND_LABELS: Record<NodeOption['kind'], string> exhaustive — 'question':'Вопрос', 'text-block':'Текст', 'snippet':'Сниппет', 'loop':'Цикл'
    - KIND_ORDER массив в точной последовательности: ['question', 'loop', 'text-block', 'snippet']
    - renderSuggestion: первый child — div с option.label, второй — small с text === KIND_LABELS[option.kind], cls 'rp-node-kind-badge'
    - setPlaceholder остаётся 'Search nodes by label…' (D-11, английский unchanged)
  </behavior>
  <action>
## Реализация

Файл `src/views/node-picker-modal.ts` переписывается с сохранением всех существующих API (экспорт `NodeOption`, `buildNodeOptions`, `NodePickerModal`). Изменения — **append-only в logic-слой** + расширение union; класс, конструктор, public API (`getSuggestions`, `onChooseSuggestion`) **не трогать**.

### Шаг 1 — Расширить import (строка 4)

Заменить:
```typescript
import type { ProtocolGraph, QuestionNode, TextBlockNode } from '../graph/graph-model';
```
на:
```typescript
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model';
```

### Шаг 2 — Расширить NodeOption.kind union (строка 9)

Заменить:
```typescript
export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block';
}
```
на (D-09):
```typescript
export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block' | 'snippet' | 'loop';
}
```

### Шаг 3 — Добавить `KIND_LABELS` и `KIND_ORDER` const'ы после интерфейса (между `NodeOption` и `buildNodeOptions`, примерно строка 11+)

Добавить точно эти два блока — скопируй verbatim:

```typescript
/**
 * Phase 45 (LOOP-06, D-10): Russian kind badges rendered by renderSuggestion().
 * Exhaustive over NodeOption['kind'] — TypeScript will complain if a new kind
 * is added to the union without updating this map.
 */
export const KIND_LABELS: Record<NodeOption['kind'], string> = {
  'question': 'Вопрос',
  'text-block': 'Текст',
  'snippet': 'Сниппет',
  'loop': 'Цикл',
};

/**
 * Phase 45 (LOOP-06, D-08): sort key for kind-group ordering in buildNodeOptions.
 * Order: question (most common start) → loop (common for repeating blocks) →
 * text-block → snippet. Within each group options sort alphabetically by label.
 */
const KIND_ORDER: NodeOption['kind'][] = ['question', 'loop', 'text-block', 'snippet'];
```

Примечание: `KIND_LABELS` экспортируется (именно `export const`) — так exhaustive test в `node-picker-modal.test.ts` может импортировать его напрямую (PATTERNS.md §9 "Landmine" рекомендует). `KIND_ORDER` оставляем module-internal.

### Шаг 4 — Переписать `buildNodeOptions` (строки 17-38)

Заменить текущую реализацию целиком на:

```typescript
/**
 * Build a sorted list of NodeOption values from a ProtocolGraph.
 * Includes question, text-block, snippet, and loop nodes (Phase 45 LOOP-06, D-06).
 *
 * Excluded by design (D-06 — осознанное отклонение от ROADMAP SC #3):
 *   - answer (renders as button under question, not a self-starting point)
 *   - start (implicit entry node, not author-picked)
 *   - free-text-input (scheduled for removal in Phase 46, CLEAN-01..04)
 *   - loop-start, loop-end (legacy parseable kinds — validator rejects canvases
 *     containing them via MIGRATE-01; they must not appear as picker options)
 *
 * Label fallback (D-07): every option carries a non-empty label — text field or node.id.
 * Sort order (D-08): kind-group entry order (see KIND_ORDER), alphabetical within group
 * via toLowerCase().localeCompare().
 */
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      const q = node as QuestionNode;
      options.push({ id, label: q.questionText || id, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const tb = node as TextBlockNode;
      const preview = tb.content.slice(0, 60);
      options.push({ id, label: preview || id, kind: 'text-block' });
    } else if (node.kind === 'snippet') {
      const s = node as SnippetNode;
      // D-07 + D-CL-05: subfolderPath может быть undefined → fallback '(корень snippets)';
      // id — последний fallback (defense-in-depth, не должен срабатывать так как '(корень snippets)' truthy).
      options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
    } else if (node.kind === 'loop') {
      const l = node as LoopNode;
      options.push({ id, label: l.headerText || id, kind: 'loop' });
    }
    // answer, start, free-text-input, loop-start, loop-end — сознательно исключены (D-06)
  }

  // D-08: kind-group entry order via KIND_ORDER indexOf, alphabetical within group.
  options.sort((a, b) => {
    const kaIdx = KIND_ORDER.indexOf(a.kind);
    const kbIdx = KIND_ORDER.indexOf(b.kind);
    if (kaIdx !== kbIdx) return kaIdx - kbIdx;
    return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  });

  return options;
}
```

### Шаг 5 — Обновить `renderSuggestion` (строки 67-70)

Заменить:
```typescript
renderSuggestion(option: NodeOption, el: HTMLElement): void {
  el.createEl('div', { text: option.label });
  el.createEl('small', { text: option.kind, cls: 'rp-node-kind-badge' });
}
```
на:
```typescript
renderSuggestion(option: NodeOption, el: HTMLElement): void {
  el.createEl('div', { text: option.label });
  el.createEl('small', { text: KIND_LABELS[option.kind], cls: 'rp-node-kind-badge' });
}
```

### Шаг 6 — ОСТАВИТЬ БЕЗ ИЗМЕНЕНИЙ

- `setPlaceholder('Search nodes by label\u2026')` (строка 58) — D-11, английский остаётся.
- `constructor` signature — не трогать.
- `getSuggestions` — не трогать.
- `onChooseSuggestion` — не трогать.
- Имя класса `NodePickerModal` и его `extends SuggestModal<NodeOption>` — не трогать.
- JSDoc на классе (строки 40-49) — можно оставить как есть либо обновить чтобы упомянуть 4 kinds (не обязательно).

## CLAUDE.md правило (обязательно echo)

"Never remove existing code you didn't add." В этом файле существующие code artifacts:
- JSDoc заголовок файла (строки 1-2)
- JSDoc комментарий перед `buildNodeOptions` (строки 12-16) — можно заменить на новый JSDoc как показано выше, это **замена своим кодом функции**, а не удаление чужого кода
- JSDoc комментарий перед классом (строки 40-49) — оставить как есть
- `getSuggestions` + `onChooseSuggestion` method bodies — оставить полностью как есть

## Verification после изменений

```bash
npx tsc --noEmit --skipLibCheck   # должно быть exit 0 — типы согласованы
npm test -- --run src/__tests__/node-picker-modal.test.ts   # FAIL пока Task 2 не создал файл — ожидаемо
```
  </action>
  <verify>
    <automated>npx tsc --noEmit --skipLibCheck && grep -c "KIND_LABELS" src/views/node-picker-modal.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "kind: 'question' | 'text-block' | 'snippet' | 'loop'" src/views/node-picker-modal.ts` returns exactly one match (NodeOption interface)
    - `grep -n "export const KIND_LABELS" src/views/node-picker-modal.ts` returns exactly one match
    - `grep -n "'Вопрос'" src/views/node-picker-modal.ts && grep -n "'Текст'" src/views/node-picker-modal.ts && grep -n "'Сниппет'" src/views/node-picker-modal.ts && grep -n "'Цикл'" src/views/node-picker-modal.ts` — все 4 строки присутствуют
    - `grep -n "const KIND_ORDER: NodeOption\\['kind'\\]\\[\\] = \\['question', 'loop', 'text-block', 'snippet'\\]" src/views/node-picker-modal.ts` returns exactly one match
    - `grep -n "SnippetNode" src/views/node-picker-modal.ts` returns at least 2 matches (import + cast in buildNodeOptions)
    - `grep -n "LoopNode" src/views/node-picker-modal.ts` returns at least 2 matches (import + cast)
    - `grep -n "KIND_LABELS\\[option.kind\\]" src/views/node-picker-modal.ts` returns exactly one match (в renderSuggestion)
    - `grep -n "'Search nodes by label" src/views/node-picker-modal.ts` returns exactly one match (D-11 placeholder unchanged)
    - `grep -c "extends SuggestModal<NodeOption>" src/views/node-picker-modal.ts` === 1 (class shape preserved)
    - `grep -c "getSuggestions" src/views/node-picker-modal.ts` === 1 (method preserved)
    - `grep -c "onChooseSuggestion" src/views/node-picker-modal.ts` === 1 (method preserved)
    - `npx tsc --noEmit --skipLibCheck` returns exit 0
    - **CLAUDE.md rule honoured:** `getSuggestions` body unchanged from pre-Phase-45 state (same trim/lowercase/filter logic), `onChooseSuggestion` body unchanged, `constructor` body unchanged, JSDoc на классе NodePickerModal (строки 40-49 pre-edit) preserved
  </acceptance_criteria>
  <done>
    `src/views/node-picker-modal.ts` содержит 4-kind union, KIND_LABELS + KIND_ORDER const'ы, обновлённый buildNodeOptions с 4 kind-ветками и KIND_ORDER-based sort, обновлённый renderSuggestion с русскими badges. Компилируется без type-errors. Существующая public API класса не затронута.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests locking in buildNodeOptions + KIND_LABELS behaviour</name>
  <files>src/__tests__/node-picker-modal.test.ts</files>
  <read_first>
    - src/views/node-picker-modal.ts (после Task 1 edits)
    - src/__tests__/runner-commands.test.ts (pattern для dynamic/static import)
    - src/graph/graph-model.ts (types для mock graph builder)
    - src/__tests__/fixtures/unified-loop-valid.canvas (reference fixture — хотя в этом тесте лучше in-memory mock graph)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-18, D-19
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"9) src/__tests__/node-picker-modal.test.ts" (mock graph builder template)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md §"Common Pitfalls" Pitfall 6, 7
  </read_first>
  <behavior>
    - Test 1 (D-19 ветка "all 4 kinds"): graph с question/text-block/snippet/loop → buildNodeOptions.length === 4, set of kinds === {'question','text-block','snippet','loop'}
    - Test 2 (D-06, Pitfall 6): graph с answer/start/free-text-input/loop-start/loop-end/question → buildNodeOptions содержит только 1 option (question); none of them имеют kind === 'answer', 'start', 'free-text-input', 'loop-start', 'loop-end'
    - Test 3 (D-07 label fallback): question без questionText (empty string) → label === node.id; text-block с empty content → label === node.id; snippet без subfolderPath → label === '(корень snippets)'; loop без headerText → label === node.id
    - Test 4 (D-08 kind-group order): graph с по одному узлу каждого kind + произвольный insertion order → buildNodeOptions порядок kinds === ['question', 'loop', 'text-block', 'snippet']
    - Test 5 (D-08 within-group alphabetical): graph с 3 question узлами ("Zebra", "alpha", "Beta") → порядок labels [alpha, Beta, Zebra] (alphabetical case-insensitive через toLowerCase + localeCompare)
    - Test 6 (D-10 KIND_LABELS exhaustive): KIND_LABELS имеет ровно 4 ключа; значения === {'Вопрос','Текст','Сниппет','Цикл'}
    - Test 7 (D-19 legacy loop-start/loop-end excluded): graph с loop-start, loop-end, loop → buildNodeOptions содержит только loop option (1 штука)
    - Test 8 (D-CL-03 factory smoke): buildNodeOptions не бросает при empty graph (пустой Map nodes)
  </behavior>
  <action>
## Реализация

Создать новый файл `src/__tests__/node-picker-modal.test.ts`. `buildNodeOptions` — pure function без Obsidian dependency, поэтому `vi.mock('obsidian')` **не нужен** (в отличие от editor-panel тестов). Mock graph строится in-memory.

### Skeleton файла

```typescript
import { describe, it, expect } from 'vitest';
import { buildNodeOptions, KIND_LABELS, type NodeOption } from '../views/node-picker-modal';
import type {
  ProtocolGraph,
  RPNode,
  QuestionNode,
  TextBlockNode,
  SnippetNode,
  LoopNode,
  AnswerNode,
  StartNode,
  FreeTextInputNode,
  LoopStartNode,
  LoopEndNode,
} from '../graph/graph-model';

// ── Mock graph builder ──────────────────────────────────────────────────
function makeGraph(nodes: RPNode[]): ProtocolGraph {
  const map = new Map<string, RPNode>();
  for (const n of nodes) map.set(n.id, n);
  return {
    canvasFilePath: 'test.canvas',
    nodes: map,
    edges: [],
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: nodes[0]?.id ?? '',
  };
}

// ── Node factories (zero-width/height OK — не влияют на buildNodeOptions) ──
const baseNodeProps = { x: 0, y: 0, width: 0, height: 0 };

function question(id: string, questionText: string): QuestionNode {
  return { ...baseNodeProps, id, kind: 'question', questionText };
}
function textBlock(id: string, content: string): TextBlockNode {
  return { ...baseNodeProps, id, kind: 'text-block', content };
}
function snippet(id: string, subfolderPath?: string): SnippetNode {
  return { ...baseNodeProps, id, kind: 'snippet', subfolderPath };
}
function loop(id: string, headerText: string): LoopNode {
  return { ...baseNodeProps, id, kind: 'loop', headerText };
}
function answer(id: string, answerText: string): AnswerNode {
  return { ...baseNodeProps, id, kind: 'answer', answerText };
}
function start(id: string): StartNode {
  return { ...baseNodeProps, id, kind: 'start' };
}
function freeText(id: string, promptLabel: string): FreeTextInputNode {
  return { ...baseNodeProps, id, kind: 'free-text-input', promptLabel };
}
function loopStart(id: string, loopLabel: string, exitLabel: string): LoopStartNode {
  return { ...baseNodeProps, id, kind: 'loop-start', loopLabel, exitLabel };
}
function loopEnd(id: string, loopStartId: string): LoopEndNode {
  return { ...baseNodeProps, id, kind: 'loop-end', loopStartId };
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('buildNodeOptions (Phase 45 LOOP-06 / D-06..D-08)', () => {
  it('returns options for all 4 startable kinds (question, text-block, snippet, loop)', () => {
    const g = makeGraph([
      question('q1', 'Is there a lesion?'),
      textBlock('t1', 'Some content'),
      snippet('s1', 'organ/lesion'),
      loop('l1', 'Lesion loop'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(4);
    const kindSet = new Set(opts.map(o => o.kind));
    expect(kindSet).toEqual(new Set(['question', 'text-block', 'snippet', 'loop']));
  });

  it('excludes answer, start, free-text-input, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)', () => {
    const g = makeGraph([
      question('q1', 'Q'),
      answer('a1', 'A'),
      start('s1'),
      freeText('f1', 'prompt'),
      loopStart('ls1', 'inner', 'выход'),
      loopEnd('le1', 'ls1'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(1);
    expect(opts[0]?.kind).toBe('question');
    // Defensive — none of the non-startable kinds appeared
    expect(opts.find(o => (o.kind as string) === 'answer')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'start')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'free-text-input')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'loop-start')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'loop-end')).toBeUndefined();
  });

  it('label falls back to id when primary text field is empty (D-07 — all 4 kinds)', () => {
    const g = makeGraph([
      question('q-empty', ''),          // questionText пустой → label === id
      textBlock('t-empty', ''),         // content пустой → label === id
      snippet('s-empty'),               // subfolderPath undefined → label === '(корень snippets)'
      loop('l-empty', ''),              // headerText пустой → label === id
    ]);
    const opts = buildNodeOptions(g);
    const byKind = Object.fromEntries(opts.map(o => [o.kind, o]));
    expect(byKind['question']?.label).toBe('q-empty');
    expect(byKind['text-block']?.label).toBe('t-empty');
    expect(byKind['snippet']?.label).toBe('(корень snippets)');
    expect(byKind['loop']?.label).toBe('l-empty');
  });

  it('sorts kind-groups in entry order: question → loop → text-block → snippet (D-08)', () => {
    // Insertion order deliberately scrambled — output MUST be in KIND_ORDER sequence.
    const g = makeGraph([
      snippet('s1', 'a'),
      textBlock('t1', 'z content'),
      loop('l1', 'mid header'),
      question('q1', 'Start here'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts.map(o => o.kind)).toEqual(['question', 'loop', 'text-block', 'snippet']);
  });

  it('sorts within-group alphabetically via toLowerCase().localeCompare (D-08)', () => {
    const g = makeGraph([
      question('q1', 'Zebra protocol'),
      question('q2', 'alpha check'),
      question('q3', 'Beta run'),
    ]);
    const opts = buildNodeOptions(g);
    // Case-insensitive alphabetical: alpha → Beta → Zebra
    expect(opts.map(o => o.label)).toEqual(['alpha check', 'Beta run', 'Zebra protocol']);
  });

  it('excludes legacy loop-start / loop-end even when unified loop also present', () => {
    const g = makeGraph([
      loopStart('ls1', 'legacy', 'выход'),
      loopEnd('le1', 'ls1'),
      loop('l1', 'Unified'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(1);
    expect(opts[0]?.kind).toBe('loop');
    expect(opts[0]?.label).toBe('Unified');
  });

  it('returns [] for empty graph', () => {
    const g = makeGraph([]);
    expect(buildNodeOptions(g)).toEqual([]);
  });
});

describe('KIND_LABELS (Phase 45 LOOP-06 / D-10)', () => {
  it('has Russian labels for exactly 4 startable kinds', () => {
    const keys = Object.keys(KIND_LABELS).sort();
    expect(keys).toEqual(['loop', 'question', 'snippet', 'text-block']);
  });

  it('maps each kind to its locked Russian badge text', () => {
    expect(KIND_LABELS.question).toBe('Вопрос');
    expect(KIND_LABELS['text-block']).toBe('Текст');
    expect(KIND_LABELS.snippet).toBe('Сниппет');
    expect(KIND_LABELS.loop).toBe('Цикл');
  });
});
```

## Замечания по реализации

1. **Никакого vi.mock('obsidian')** — `buildNodeOptions` pure, а `NodePickerModal` класс в этом тесте не инстанцируется. `renderSuggestion` поведение (Russian badge) уже покрыто тестом "KIND_LABELS" + grep в Task 1 acceptance criteria (на `KIND_LABELS[option.kind]` в renderSuggestion).
2. **Baseline node props** (x/y/width/height) — требуются графовой моделью но не влияют на buildNodeOptions. 0 везде OK.
3. **Pitfall 7 (sort instability)** — избегаю кириллицу в sort test; использую ASCII ('Zebra', 'alpha', 'Beta') для детерминированного `toLowerCase().localeCompare`.
4. **Type cast для "excluded kinds" asserts** — используется `o.kind as string` чтобы TypeScript не блокировал сравнение с литералами, которых нет в NodeOption.kind union (answer/start/и т.д. — по сути compile-time assert что они не попадают).
5. **Test 7 (`excludes legacy even with unified`)** — важен: PATTERNS.md "LANDMINE" предупреждает что грег-assertion на legacy loop-start/loop-end не должен случайно match `loop` (unified). Тест гарантирует семантику.

## CLAUDE.md правило

Новый файл — append-only. Ничего не удаляем.
  </action>
  <verify>
    <automated>npm test -- --run src/__tests__/node-picker-modal.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/__tests__/node-picker-modal.test.ts` exit 0 (файл создан)
    - `grep -c "^describe\\|^  it\\|^  describe" src/__tests__/node-picker-modal.test.ts` >= 9 (2 describe + 7 it — минимум)
    - `grep -n "from '\\.\\./views/node-picker-modal'" src/__tests__/node-picker-modal.test.ts` returns exactly one match, строка содержит `buildNodeOptions, KIND_LABELS`
    - `grep -n "'Вопрос'" src/__tests__/node-picker-modal.test.ts && grep -n "'Текст'" src/__tests__/node-picker-modal.test.ts && grep -n "'Сниппет'" src/__tests__/node-picker-modal.test.ts && grep -n "'Цикл'" src/__tests__/node-picker-modal.test.ts` — все 4 literal строки присутствуют
    - `grep -n "loop-start\\|loop-end" src/__tests__/node-picker-modal.test.ts` returns at least 4 matches (imports + usage в exclusion тестах)
    - `grep -n "answer\\|'start'\\|free-text-input" src/__tests__/node-picker-modal.test.ts` returns at least 3 matches (все три non-startable kinds покрыты asserts)
    - `grep -n "localeCompare\\|toLowerCase" src/__tests__/node-picker-modal.test.ts` — minimum 1 match (within-group sort test упоминает семантику)
    - `npm test -- --run src/__tests__/node-picker-modal.test.ts` exit 0 — все тесты зелёные
    - `npm test -- --run` (full suite) всё ещё зелёный (baseline 402 passed + 1 skipped — этот плана только добавляет тесты, не ломает существующие)
    - Нет `vi.mock('obsidian')` в файле — `grep -c "vi.mock" src/__tests__/node-picker-modal.test.ts` === 0 (подтверждает pure test)
    - **CLAUDE.md rule honoured:** новый файл — никакого существующего кода не удалялось
  </acceptance_criteria>
  <done>
    Файл `src/__tests__/node-picker-modal.test.ts` создан с 9+ тестами; все зелёные через `npm test -- --run src/__tests__/node-picker-modal.test.ts`; полный suite остаётся зелёным. D-06..D-10 поведение покрыто exhaustive unit-проверками.
  </done>
</task>

</tasks>

<verification>
```bash
# Type check
npx tsc --noEmit --skipLibCheck

# Targeted tests
npm test -- --run src/__tests__/node-picker-modal.test.ts

# Full suite regression check
npm test -- --run

# Grep on key invariants
grep -n "KIND_LABELS\\|KIND_ORDER" src/views/node-picker-modal.ts
grep -n "'Вопрос'\\|'Цикл'" src/views/node-picker-modal.ts
grep -c "'loop'" src/views/node-picker-modal.ts   # ≥ 3 (import, union, case branch)
```

Expected: все команды exit 0; full suite ≥ 402 passed + N new (7+) tests, 0 failed.
</verification>

<success_criteria>
- `src/views/node-picker-modal.ts` содержит расширенный 4-kind `NodeOption.kind` union, exported `KIND_LABELS` const, module-internal `KIND_ORDER` const, обновлённый `buildNodeOptions` с 4 ветками и KIND_ORDER-based sort, и обновлённый `renderSuggestion` использующий `KIND_LABELS[option.kind]`.
- `src/__tests__/node-picker-modal.test.ts` новый файл с 9+ тестами покрывающими D-06 (exclusions), D-07 (label fallback), D-08 (sort), D-10 (KIND_LABELS).
- `npx tsc --noEmit --skipLibCheck` exit 0.
- `npm test -- --run` exit 0; полный suite растёт на 9+ passing tests без регрессий.
- Существующий `NodePickerModal` class shape (constructor, getSuggestions, onChooseSuggestion, setPlaceholder) сохранён без изменений.
</success_criteria>

<output>
После завершения создать `.planning/phases/45-loop-editor-form-picker-color-map/45-01-SUMMARY.md` следующим шаблоном:

```markdown
# Phase 45, Plan 01 — NodePickerModal rewrite: SUMMARY

**Completed:** YYYY-MM-DD
**Status:** Green
**Requirements:** LOOP-06 (partial — picker layer)

## What shipped
- [concise list]

## Decisions implemented
- D-06..D-11: [one line per decision]

## Tests added
- [N unit tests в node-picker-modal.test.ts]

## Full suite
- Before: 402 passed + 1 skipped
- After: XXX passed + 1 skipped / 0 failed

## Downstream impact
- Plan 45-03 (start-from-node command) — зависит от этого плана, импортирует buildNodeOptions из обновлённого node-picker-modal.ts.
```
</output>
