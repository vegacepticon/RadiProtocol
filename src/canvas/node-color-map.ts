// src/canvas/node-color-map.ts
// Maps every RadiProtocol node type (including 'snippet', added in Phase 22)
// to its Obsidian canvas palette string ("1"–"6").
//
// Palette semantics (Obsidian built-in canvas colors):
//   "1" = Red    "2" = Orange   "3" = Yellow
//   "4" = Green  "5" = Cyan     "6" = Purple
//
// Source: CONTEXT.md D-01, D-02; UI-SPEC Semantic Color Contract

import type { RPNodeKind } from '../graph/graph-model';

export const NODE_COLOR_MAP: Record<RPNodeKind, string> = {
  'start':           '4',  // green  — entry point ("go" semantics)
  'question':        '5',  // cyan   — information gathering
  'answer':          '2',  // orange — action / selection
  'text-block':      '3',  // yellow — passive content
  'snippet':         '6',  // purple — code / file insertion (pre-declared per D-02)
  'loop-start':      '1',  // red    — loop boundary
  'loop-end':        '1',  // red    — loop boundary (intentional share with loop-start, D-01)
};
