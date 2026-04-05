// graph/graph-model.ts
// Pure TypeScript types — zero Obsidian API imports (NFR-01, PARSE-06)

export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'
  | 'text-block'
  | 'loop-start'
  | 'loop-end';

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
}

export interface FreeTextInputNode extends RPNodeBase {
  kind: 'free-text-input';
  promptLabel: string;
  prefix?: string;
  suffix?: string;
}

export interface TextBlockNode extends RPNodeBase {
  kind: 'text-block';
  content: string;
  snippetId?: string;
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

export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode;

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
