# Plan 01-00: Wave 0 — Test Infrastructure and Fixture Stubs

**Phase**: 1 — Project Scaffold and Canvas Parsing Foundation
**Requirements**: DEV-04, DEV-05, PARSE-07, PARSE-08
**Wave**: 0
**Depends on**: None

## Goal

Install Vitest, create the test directory structure, author all canvas fixture files, and write stub test files with failing tests — so every subsequent implementation plan has a verified test harness from its first commit.

## Context

Wave 0 must complete before any implementation work begins. The VALIDATION.md requires `vitest.config.ts`, `src/__tests__/canvas-parser.test.ts`, `src/__tests__/graph-validator.test.ts`, and four fixture `.canvas` files to exist before any Wave 1 task runs. This plan creates those files plus the `package.json` `"test"` script. Nothing here produces passing tests — the stubs fail RED and stay RED until Plans 01-03 and 01-04 provide the implementations.

---

## Tasks

### Task 01-00-01: Add Vitest to package.json and create vitest.config.ts

**Requirement**: DEV-04
**Verify**: `npx vitest run --reporter=verbose 2>&1 | head -20` — should print "No test files found" or list stub files; must NOT error on config load.

1. Open `package.json` (which will be created in Plan 01-01; see note below). Because this is Wave 0 and the scaffold does not exist yet, this task is ordered to run immediately after Plan 01-01 completes — see dependency note at the bottom of this plan. For now, document the exact changes to make:

   Add to `devDependencies`:
   ```json
   "vitest": "4.1.2"
   ```

   Add to `scripts`:
   ```json
   "test": "vitest run"
   ```

   The full `scripts` block after the change:
   ```json
   "scripts": {
     "dev": "node esbuild.config.mjs",
     "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
     "version": "node version-bump.mjs && git add manifest.json versions.json",
     "lint": "eslint .",
     "test": "vitest run"
   }
   ```

2. Run `npm install --save-dev vitest@4.1.2` from the project root to add Vitest.

3. Create `vitest.config.ts` at the project root with this exact content:

   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       environment: 'node',
       include: ['src/__tests__/**/*.test.ts'],
       globals: false,
     },
   });
   ```

4. Verify Vitest can resolve its config: `npx vitest run --reporter=verbose 2>&1 | head -30`. The output must not contain "Error" or "Cannot find module vitest". It is acceptable if it says "No test files found" at this point.

---

### Task 01-00-02: Create canvas fixture files

**Requirement**: DEV-05, PARSE-03
**Verify**: `ls src/__tests__/fixtures/*.canvas | wc -l` — must print `4`.

Create the directory `src/__tests__/fixtures/` and write the following four `.canvas` files. Each fixture is minimal (3–5 RadiProtocol nodes, synthetic labels only per D-04).

**File: `src/__tests__/fixtures/linear.canvas`**

A valid linear protocol: Start → Question → Answer → complete path. No errors expected.

```json
{
  "nodes": [
    {
      "id": "n-start",
      "type": "text",
      "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1",
      "type": "text",
      "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    },
    {
      "id": "n-a1",
      "type": "text",
      "text": "A1",
      "x": 0, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "A1",
      "radiprotocol_displayLabel": "A1"
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" }
  ]
}
```

**File: `src/__tests__/fixtures/branching.canvas`**

A valid branching protocol: Start → Question → two Answers. No errors expected. Also includes one plain canvas text node (no `radiprotocol_nodeType`) to verify PARSE-03 (silently skipped).

```json
{
  "nodes": [
    {
      "id": "n-start",
      "type": "text",
      "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1",
      "type": "text",
      "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    },
    {
      "id": "n-a1",
      "type": "text",
      "text": "A1",
      "x": -150, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "A1",
      "radiprotocol_displayLabel": "A1"
    },
    {
      "id": "n-a2",
      "type": "text",
      "text": "A2",
      "x": 150, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "A2",
      "radiprotocol_displayLabel": "A2"
    },
    {
      "id": "n-plain",
      "type": "text",
      "text": "Plain canvas note — no radiprotocol fields",
      "x": 500, "y": 0, "width": 300, "height": 60
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" },
    { "id": "e3", "fromNode": "n-q1",   "toNode": "n-a2" }
  ]
}
```

**File: `src/__tests__/fixtures/dead-end.canvas`**

A protocol where a question has no outgoing edges. `GraphValidator` must report: "Question 'Q1' has no answers".

```json
{
  "nodes": [
    {
      "id": "n-start",
      "type": "text",
      "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1",
      "type": "text",
      "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" }
  ]
}
```

**File: `src/__tests__/fixtures/cycle.canvas`**

A protocol with an unintentional cycle (not through a loop-end node). `GraphValidator` must report a cycle error.

```json
{
  "nodes": [
    {
      "id": "n-start",
      "type": "text",
      "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1",
      "type": "text",
      "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    },
    {
      "id": "n-a1",
      "type": "text",
      "text": "A1",
      "x": 0, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "A1",
      "radiprotocol_displayLabel": "A1"
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" },
    { "id": "e3", "fromNode": "n-a1",   "toNode": "n-q1" }
  ]
}
```

---

### Task 01-00-03: Write stub test files (RED — failing by design)

**Requirement**: DEV-04, PARSE-01, PARSE-02, PARSE-03, PARSE-06, PARSE-07, PARSE-08
**Verify**: `npx vitest run src/__tests__ 2>&1 | grep -E "FAIL|Cannot find|passed|failed"` — must show FAIL (tests failing) or "Cannot find module" errors for the not-yet-implemented source files. Must NOT show a Vitest config error.

Create `src/__tests__/canvas-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

describe('CanvasParser', () => {
  describe('parse() — valid fixtures', () => {
    it('parses linear.canvas and returns a ProtocolGraph with correct node kinds', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('linear.canvas'), 'linear.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const graph = result.graph;
      expect(graph.nodes.size).toBe(3);
      expect(graph.nodes.get('n-start')?.kind).toBe('start');
      expect(graph.nodes.get('n-q1')?.kind).toBe('question');
      expect(graph.nodes.get('n-a1')?.kind).toBe('answer');
      expect(graph.startNodeId).toBe('n-start');
    });

    it('parses branching.canvas and builds correct adjacency map', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('branching.canvas'), 'branching.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const graph = result.graph;
      const q1Edges = graph.adjacency.get('n-q1');
      expect(q1Edges).toBeDefined();
      expect(q1Edges).toContain('n-a1');
      expect(q1Edges).toContain('n-a2');
    });

    it('silently skips plain canvas nodes without radiprotocol_nodeType (PARSE-03)', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('branching.canvas'), 'branching.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      // branching.canvas has 5 raw nodes but 1 is plain — expect 4 RP nodes
      expect(result.graph.nodes.size).toBe(4);
      expect(result.graph.nodes.has('n-plain')).toBe(false);
    });

    it('returns error on invalid JSON, not a thrown exception (PARSE-06 resilience)', () => {
      const parser = new CanvasParser();
      const result = parser.parse('not valid json{{{', 'bad.canvas');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('CanvasParser has zero Obsidian API imports (NFR-01, PARSE-06)', () => {
    it('module can be imported without Obsidian runtime', () => {
      // If this test file loads, the import at the top succeeded in a pure Node.js env.
      // This proves CanvasParser has no obsidian imports.
      expect(typeof CanvasParser).toBe('function');
    });
  });
});
```

Create `src/__tests__/graph-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';
import { GraphValidator } from '../graph/graph-validator';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

function parseFixture(name: string) {
  const parser = new CanvasParser();
  const result = parser.parse(loadFixture(name), name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

describe('GraphValidator', () => {
  describe('valid protocols', () => {
    it('returns no errors for linear.canvas', () => {
      const graph = parseFixture('linear.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for branching.canvas', () => {
      const graph = parseFixture('branching.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });
  });

  describe('error detection (PARSE-07, PARSE-08)', () => {
    it('detects dead-end question with no outgoing edges', () => {
      const graph = parseFixture('dead-end.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('q1') || e.toLowerCase().includes('answer') || e.toLowerCase().includes('dead'))).toBe(true);
    });

    it('detects unintentional cycle not through loop-end node', () => {
      const graph = parseFixture('cycle.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('cycle'))).toBe(true);
    });

    it('detects missing start node', () => {
      const noStartJson = JSON.stringify({
        nodes: [
          { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }
        ],
        edges: []
      });
      const parser = new CanvasParser();
      const result = parser.parse(noStartJson, 'no-start.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('start'))).toBe(true);
    });

    it('detects multiple start nodes', () => {
      const multiStartJson = JSON.stringify({
        nodes: [
          { id: 'n-s1', type: 'text', text: 'S1', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-s2', type: 'text', text: 'S2', x: 200, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' }
        ],
        edges: []
      });
      const parser = new CanvasParser();
      const result = parser.parse(multiStartJson, 'multi-start.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('multiple') || e.toLowerCase().includes('start'))).toBe(true);
    });

    it('detects unreachable nodes', () => {
      const unreachableJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 120, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' },
          { id: 'n-orphan', type: 'text', text: 'Orphan', x: 500, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Orphan' }
        ],
        edges: [
          { id: 'e1', fromNode: 'n-start', toNode: 'n-q1' }
        ]
      });
      const parser = new CanvasParser();
      const result = parser.parse(unreachableJson, 'unreachable.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('unreachable') || e.toLowerCase().includes('reach'))).toBe(true);
    });

    it('detects orphaned loop-end node', () => {
      const orphanLoopEndJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-le', type: 'text', text: 'LoopEnd', x: 0, y: 120, width: 100, height: 60,
            radiprotocol_nodeType: 'loop-end', radiprotocol_loopStartId: 'nonexistent-id' }
        ],
        edges: [
          { id: 'e1', fromNode: 'n-start', toNode: 'n-le' }
        ]
      });
      const parser = new CanvasParser();
      const result = parser.parse(orphanLoopEndJson, 'orphan-loop-end.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('loop') || e.toLowerCase().includes('orphan'))).toBe(true);
    });

    it('returns all errors as plain English strings, not code exceptions (PARSE-08)', () => {
      const graph = parseFixture('dead-end.canvas');
      const validator = new GraphValidator();
      let errors: string[] = [];
      expect(() => { errors = validator.validate(graph); }).not.toThrow();
      for (const e of errors) {
        expect(typeof e).toBe('string');
        expect(e.length).toBeGreaterThan(0);
      }
    });
  });
});
```

---

## Wave 0 Dependency Note

This plan (01-00) requires the project root to exist with `package.json` before `npm install` can run. The correct execution order is:

1. **Plan 01-01** (plugin scaffold) — creates `package.json`, project structure, runs `npm install`
2. **Plan 01-00** (this plan) — adds Vitest to `package.json`, creates fixtures and test stubs

Despite the logical ordering being Wave 0, the executor must complete Plan 01-01's scaffold setup first, then return to this plan to add Vitest. The `vitest.config.ts` and test files require the `src/` directory to exist (created by Plan 01-02).

Practical execution order: **01-01 → 01-00 → 01-02 → 01-03 → 01-04 → 01-05**

---

## Recommended Commit

```
test(01): add wave-0 test infrastructure — vitest config, fixtures, and stub tests (RED)
```

All stub tests must fail (RED) after this commit. Passing tests at this point would indicate the stubs are not testing the right things.
