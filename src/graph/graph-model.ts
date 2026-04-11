// graph/graph-model.ts
// Pure TypeScript types — zero Obsidian API imports (NFR-01, PARSE-06)

export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'text-block'
  | 'loop-start'
  | 'loop-end'
  | 'snippet';

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

export interface TextBlockNode extends RPNodeBase {
  kind: 'text-block';
  content: string;
  radiprotocol_separator?: 'newline' | 'space';
}

export interface LoopStartNode extends RPNodeBase {
  kind: 'loop-start';
  loopLabel: string;
  exitLabel: string;
  maxIterations: number;
}

export interface LoopEndNode extends RPNodeBase {
  kind: 'loop-end';
  loopStartId: string;
}

export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  /** Per-node override for the folder from which the file picker opens.
   *  undefined means use the global setting (Phase 24). */
  folderPath?: string;
  /** Label for the file-picker button rendered in Phase 25.
   *  Falls back to canvas node text, then to "Select file". */
  buttonLabel?: string;
}

/**
 * One frame on the loop context stack.
 * Pushed when the runner enters a loop-start node.
 * Contains only primitives — shallow array copy is sufficient for snapshots (LOOP-05).
 */
export interface LoopContext {
  /** ID of the loop-start node that opened this frame */
  loopStartId: string;
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
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode
  | SnippetNode;

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
