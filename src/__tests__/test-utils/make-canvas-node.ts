// src/__tests__/test-utils/make-canvas-node.ts
// Canonical test helper for creating typed canvas node fixtures.
// Color is automatically derived from NODE_COLOR_MAP — prevents manual sync drift (D-07, D-08).
//
// Phase 28: NODE-COLOR-03

import { NODE_COLOR_MAP } from '../../canvas/node-color-map';
import type { RPNodeKind } from '../../graph/graph-model';

/**
 * Creates a canvas node record with the correct `color` field derived from NODE_COLOR_MAP.
 * Use this helper in all tests that need a typed canvas node fixture.
 *
 * @param type - RPNodeKind for the node (must be a known type in NODE_COLOR_MAP)
 * @param overrides - Optional fields to override defaults
 */
export function makeCanvasNode(
  type: RPNodeKind,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `node-${Math.random().toString(36).slice(2, 9)}`,
    type: 'text',
    x: 0,
    y: 0,
    width: 200,
    height: 60,
    radiprotocol_nodeType: type,
    color: NODE_COLOR_MAP[type],
    ...overrides,
  };
}
