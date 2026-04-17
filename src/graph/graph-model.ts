// graph/graph-model.ts
// Pure TypeScript types — zero Obsidian API imports (NFR-01, PARSE-06)

// Phase 43 D-01: unified 'loop' kind добавлен; 'loop-start' / 'loop-end' сохраняются
// как legacy parseable kinds до Phase 44 (runtime stub) и последующих фаз.
// D-CL-05 вариант (b): сохраняем имена LoopStartNode / LoopEndNode с @deprecated JSDoc —
// downstream (editor-panel-view, protocol-runner, validator migration-error) могут продолжать
// ссылаться на них во время парсинга legacy-канвасов; validator выдаёт MIGRATE-01 поверх этих узлов.
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'
  | 'text-block'
  | 'loop-start'      // @deprecated Phase 43 D-03 — legacy parseable for migration-error (D-07)
  | 'loop-end'        // @deprecated Phase 43 D-03 — legacy parseable for migration-error (D-07)
  | 'snippet'         // Phase 29
  | 'loop';           // Phase 43 D-01 — unified loop kind (see v1.7 LOOP-01, LOOP-02)

export interface RPNodeBase {
  id: string;
  kind: RPNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface StartNode extends RPNodeBase {
  kind: 'start';
}

export interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
}

export interface AnswerNode extends RPNodeBase {
  kind: 'answer';
  answerText: string;
  displayLabel?: string;
  radiprotocol_separator?: 'newline' | 'space';
}

export interface FreeTextInputNode extends RPNodeBase {
  kind: 'free-text-input';
  promptLabel: string;
  prefix?: string;
  suffix?: string;
  radiprotocol_separator?: 'newline' | 'space';
}

export interface TextBlockNode extends RPNodeBase {
  kind: 'text-block';
  content: string;
  snippetId?: string;
  radiprotocol_separator?: 'newline' | 'space';
}

/**
 * Phase 43 D-02 — unified loop node (LOOP-01, LOOP-02).
 * Замена пары LoopStartNode/LoopEndNode. headerText — текст заголовка над picker'ом,
 * рендерится runtime в Phase 44. Отсутствие / undefined в canvas JSON нормализуется
 * парсером в пустую строку (D-05).
 */
export interface LoopNode extends RPNodeBase {
  kind: 'loop';
  headerText: string;
}

/**
 * @deprecated Phase 43 D-03, D-CL-05 — legacy parseable kind.
 * Canvas с этим узлом теперь отвергается GraphValidator'ом c migration-error (MIGRATE-01).
 * Удаление — в будущей фазе после того как все legacy-канвасы пересобраны.
 */
export interface LoopStartNode extends RPNodeBase {
  kind: 'loop-start';
  loopLabel: string;
  exitLabel: string;
}

/**
 * @deprecated Phase 43 D-03, D-CL-05 — legacy parseable kind.
 * См. {@link LoopStartNode} для контекста.
 */
export interface LoopEndNode extends RPNodeBase {
  kind: 'loop-end';
  loopStartId: string;
}

export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;  // отсутствие = корень .radiprotocol/snippets (D-02, D-03)
  /** Phase 31 D-01: optional label shown on branch-list button when snippet node is reached as a variant. Fallback "📁 Snippet". */
  snippetLabel?: string;
  /** Phase 31 D-04: per-node separator override; applies to both branch-entered and auto-advanced snippet pickers. */
  radiprotocol_snippetSeparator?: 'newline' | 'space';
}

/**
 * One frame on the loop context stack.
 * Pushed when the runner enters a unified loop node (Phase 43 D-04).
 * Contains only primitives — shallow array copy is sufficient for snapshots (LOOP-05).
 */
export interface LoopContext {
  /** Phase 43 D-04 — ID of the unified loop node that opened this frame.
   *  Renamed from loopStartId (v1.0..v1.6). */
  loopNodeId: string;
  /** 1-based iteration counter (starts at 1 on first entry) */
  iteration: number;
  /** Full text snapshot captured immediately before entering the loop body.
   *  Used to restore accumulated text if the user steps back past the loop entry point. */
  textBeforeLoop: string;
}

export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode     // @deprecated — legacy, см. interface JSDoc
  | LoopEndNode       // @deprecated — legacy, см. interface JSDoc
  | SnippetNode       // Phase 29
  | LoopNode;         // Phase 43 D-02 — unified loop (LOOP-01, LOOP-02)

export interface RPEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

export interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;
  edges: RPEdge[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
  startNodeId: string;
}

export type ParseResult =
  | { success: true; graph: ProtocolGraph }
  | { success: false; error: string };
