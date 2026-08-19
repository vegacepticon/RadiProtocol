# Test Architecture

## Responsibility
Centralized Vitest suite for all source modules. It runs in Node, aliases `obsidian` to the repository mock, and combines pure contracts, in-memory service tests, DOM projections, host integration, and intentional source/wiring guards.

## Dependencies
- **Vitest**: explicit imports, `vitest run`, no Jest globals or browser environment.
- **`src/__mocks__/obsidian.ts`**: default host boundary for Obsidian imports.
- **Node filesystem/crypto APIs**: fixture loading and integrity vectors where the subject requires them.

## Consumers
Tests exercise every production layer. Child guidance owns specialized rules: `.rpiv/guidance/src/__tests__/fixtures/architecture.md`, `runner/architecture.md`, and `views/architecture.md`.

## Module Structure
```
root `*.test.ts`                  # protocol, snippets, settings, utilities, cross-layer guards
graph/ + library/                 # feature-mirrored pure/service suites
runner/ + views/                  # specialized FSM/render and UI/host suites
fixtures/ + helpers/              # test-only serialized data and Canvas parser
```
The tree is partially mirrored: older feature suites remain at the parent root, so placement follows the seam under test rather than a universal folder rule.

## Pure Contract Tests
```typescript
import { describe, expect, it } from 'vitest';
import { orderedOutgoingEdges } from '../graph/edge-order';

it('tests a pure boundary without host mocks', () => {
  const graph = makeGraph();
  expect(orderedOutgoingEdges(graph, 'question')).toEqual(expectedEdges);
});
```
Instantiate models, parsers, validators, runner, path helpers, and hashes directly. Narrow discriminated results before reading variant fields; test positive, malformed, fallback, and no-op behavior.

## In-Memory Host Factories
```typescript
function makeVault(seed: Record<string, string> = {}) {
  const files = { ...seed };
  return {
    files,
    adapter: {
      exists: vi.fn(async (path: string) => path in files),
      read: vi.fn(async (path: string) => files[path] ?? ''),
      write: vi.fn(async (path: string, text: string) => { files[path] = text; }),
    },
  };
}

const vault = makeVault();
const service = new Service(makeApp(vault));
```
Use fresh mutable maps per test; assert both return values and persisted state/call counts. Inject network transports, clocks, sleeps, journals, and service collaborators rather than mocking internals globally.

## Fake DOM and Shared Host Harness
```typescript
class MockEl {
  children: MockEl[] = [];
  text = ''; clickHandler?: () => void;
  createEl(tag: string, options?: { text?: string; cls?: string }): MockEl {
    const child = new MockEl(); child.text = options?.text ?? '';
    this.children.push(child); return child;
  }
}

const host = { bindClick: (el: HTMLElement, handler: () => void) => {
  (el as unknown as MockEl).clickHandler = handler;
}, onChoose: vi.fn(), renderError: vi.fn() };
```
Use the smallest MockEl/FakeNode for extracted renderers. Use `runner-renderer-host-fixtures.ts` only for inline-host lifecycle, Obsidian module, modal/picker, app, and vault integration.

## Async, Negative, and Wiring Guards
```typescript
const pending = deferred<Model>();
const run = view.refresh();
await view.onClose();
pending.resolve(model);
await run;
expect(view.render).not.toHaveBeenCalled(); // stale/closed work is ignored
```
Prefer deferred promises for races and fake timers for debounce; restore globals and reset module captures. Assert “zero I/O,” “no write,” “no marker,” and forbidden legacy calls where those are the contract. Static source tests are tripwires, not substitutes for behavior tests.

## Architectural Boundaries
- `vitest.config.ts` is the single discovery/alias configuration; there is no global setup file.
- Tests must not make production modules depend on the central mock; mocks flow inward from the test boundary.
- Compatibility tests are named and paired with canonical cases; do not promote legacy formats by reusing happy-path fixtures.

<important if="you are adding or modifying a test">
## Adding a Test
1. Classify the seam: pure, parser/fixture, vault/service, renderer, or host/view.
2. Choose inline typed data, a fixture factory, `makeVault()`/`makeApp()`, or MockEl accordingly.
3. Assert the result and side effects plus forbidden calls/no-ops.
4. Use deferred promises/fake timers for async ownership and clean all globals/mocks.
5. Add explicit migration/legacy coverage only at the compatibility boundary, then run the focused test and `npm test`.
</important>
