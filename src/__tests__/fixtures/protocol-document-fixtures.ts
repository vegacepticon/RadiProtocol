// src/__tests__/fixtures/protocol-document-fixtures.ts
// Factory functions returning ProtocolGraph instances parsed from .canvas fixture files.

import { CanvasParser } from '../helpers/canvas-parser';
import type { ProtocolGraph } from '../../graph/graph-model';
import * as fs from 'fs';
import * as path from 'path';

const parser = new CanvasParser();

function loadGraphFromFixture(name: string): ProtocolGraph {
  const fixturesDir = path.join(__dirname);
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const result = parser.parse(json, name);
  if (!result.success) {
    throw new Error(`Failed to parse fixture ${name}: ${result.error}`);
  }
  return result.graph;
}

export function linearGraph(): ProtocolGraph {
  return loadGraphFromFixture('linear.canvas');
}

export function branchingGraph(): ProtocolGraph {
  return loadGraphFromFixture('branching.canvas');
}

export function textBlockGraph(): ProtocolGraph {
  return loadGraphFromFixture('text-block.canvas');
}

export function snippetBlockGraph(): ProtocolGraph {
  return loadGraphFromFixture('snippet-block.canvas');
}

export function snippetNodeWithExitGraph(): ProtocolGraph {
  return loadGraphFromFixture('snippet-node-with-exit.canvas');
}

export function loopStartGraph(): ProtocolGraph {
  return loadGraphFromFixture('loop-start.canvas');
}

export function startTextBlockGraph(): ProtocolGraph {
  return loadGraphFromFixture('start-text-block.canvas');
}

export function unifiedLoopValidGraph(): ProtocolGraph {
  return loadGraphFromFixture('unified-loop-valid.canvas');
}

export function unifiedLoopLabeledBodyGraph(): ProtocolGraph {
  return loadGraphFromFixture('unified-loop-labeled-body.canvas');
}

export function unifiedLoopLongBodyGraph(): ProtocolGraph {
  return loadGraphFromFixture('unified-loop-long-body.canvas');
}

export function unifiedLoopNestedGraph(): ProtocolGraph {
  return loadGraphFromFixture('unified-loop-nested.canvas');
}
