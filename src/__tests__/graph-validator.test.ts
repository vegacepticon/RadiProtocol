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
      expect(errors.some(e => e.includes('has no outgoing branches'))).toBe(true);
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

    // Phase 43 D-10: устаревший orphan-loop-end тест удалён — Check 6 исчез из validator'а
    // вместе с LoopEndNode kind. Legacy узлы теперь ловятся Migration Check'ом (MIGRATE-01),
    // см. тесты в describe 'GraphValidator — Phase 43: unified loop + migration' ниже.

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

  // Phase 43 D-16 + D-19: loop-body.canvas и loop-start.canvas теперь legacy канвасы.
  // Проверка happy-path для unified loop — см. тест 'unified-loop-valid.canvas passes ...'
  // в describe 'GraphValidator — Phase 43' ниже.
  // Сам describe-блок loop validation удалён: единственный его тест переформулирован в
  // MIGRATE-01 (legacy → migration-error) в Phase 43-тестах ниже.
});

describe('GraphValidator — Phase 31: mixed and snippet-only question branches', () => {
  it('allows question with outgoing edges only to snippet nodes (D-07)', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'n-start', type: 'text', text: 'S', x: 0, y: 0, width: 100, height: 60,
          radiprotocol_nodeType: 'start' },
        { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 120, width: 100, height: 60,
          radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Pick template' },
        { id: 'n-sn1', type: 'text', text: 'Snippet', x: 0, y: 240, width: 100, height: 60,
          radiprotocol_nodeType: 'snippet' },
      ],
      edges: [
        { id: 'e1', fromNode: 'n-start', toNode: 'n-q1' },
        { id: 'e2', fromNode: 'n-q1', toNode: 'n-sn1' },
      ],
    });
    const parser = new CanvasParser();
    const result = parser.parse(json, 'p31-snippet-only.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const errors = new GraphValidator().validate(result.graph);
    expect(errors).toEqual([]);
  });

  it('allows question with mixed outgoing edges to answer + snippet (D-06)', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'n-start', type: 'text', text: 'S', x: 0, y: 0, width: 100, height: 60,
          radiprotocol_nodeType: 'start' },
        { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 120, width: 100, height: 60,
          radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' },
        { id: 'n-a1', type: 'text', text: 'A1', x: 0, y: 240, width: 100, height: 60,
          radiprotocol_nodeType: 'answer', radiprotocol_answerText: 'yes' },
        { id: 'n-sn1', type: 'text', text: 'Snippet', x: 150, y: 240, width: 100, height: 60,
          radiprotocol_nodeType: 'snippet' },
      ],
      edges: [
        { id: 'e1', fromNode: 'n-start', toNode: 'n-q1' },
        { id: 'e2', fromNode: 'n-q1', toNode: 'n-a1' },
        { id: 'e3', fromNode: 'n-q1', toNode: 'n-sn1' },
      ],
    });
    const parser = new CanvasParser();
    const result = parser.parse(json, 'p31-mixed.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const errors = new GraphValidator().validate(result.graph);
    expect(errors).toEqual([]);
  });
});

describe('GraphValidator — snippet node (Phase 29, D-12)', () => {
  it('returns no errors for snippet-node-no-path.canvas (missing subfolderPath is valid per D-12)', () => {
    const graph = parseFixture('snippet-node-no-path.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 43 D-19 — LOOP-04 + MIGRATE-01 + cycle-through-loop tests
// ─────────────────────────────────────────────────────────────────────────────
describe('GraphValidator — Phase 43: unified loop + migration (LOOP-04, MIGRATE-01)', () => {

  // ── LOOP-04 happy path (Phase 50.1 EDGE-03) ─────────────────────────────────
  it('unified-loop-valid.canvas passes LOOP-04 checks (no +-prefix/body errors under Phase 50.1 convention)', () => {
    // Fixture (post-Plan-04): один loop узел с одним "+выход" ребром и одним непомеченным body-ребром.
    const graph = parseFixture('unified-loop-valid.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(false);
    expect(errors.some(e => e.includes('"+"-рёбер'))).toBe(false);       // D-06 wording
    expect(errors.some(e => e.includes('не имеет тела'))).toBe(false);    // D-07 fragment
    expect(errors.some(e => e.includes('не имеет подписи'))).toBe(false); // D-08 fragment
    expect(errors.some(e => e.includes('устаревшие узлы loop-start/loop-end'))).toBe(false);
  });

  // ── LOOP-04 D-04 — zero "+"-edges, no other labeled edges ───────────────────
  it('unified-loop-missing-exit.canvas flags D-04 (zero "+"-edges, no other labeled edges)', () => {
    const graph = parseFixture('unified-loop-missing-exit.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const d04 = errors.find(e => e.includes('не имеет выхода. Пометьте ровно одно исходящее ребро префиксом "+"'));
    expect(d04).toBeDefined();
    if (d04 === undefined) return;
    expect(d04).toContain('"Lesion loop"');
    expect(d04).toContain('текст после "+" станет подписью кнопки выхода');
  });

  // ── LOOP-04 D-05 — zero "+"-edges, ≥1 legacy labeled edge ───────────────────
  it('unified-loop-legacy-vyhod.canvas flags D-05 (zero "+"-edges, ≥1 legacy labeled edge)', () => {
    const graph = parseFixture('unified-loop-legacy-vyhod.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const d05 = errors.find(e => e.includes('не имеет выхода с префиксом "+"'));
    expect(d05).toBeDefined();
    if (d05 === undefined) return;
    expect(d05).toContain('"Lesion loop"');
    expect(d05).toContain('Добавьте "+" к одному из помеченных рёбер');
    expect(d05).toContain('текст после "+" станет подписью кнопки выхода');
    // {edgeIds} — fixture from Plan 04 has edge id e3 on the legacy-"выход" edge.
    expect(d05).toMatch(/\(e3\)|\(e3, /);
  });

  // ── LOOP-04 D-06 — ≥2 "+"-edges ─────────────────────────────────────────────
  it('unified-loop-duplicate-exit.canvas flags D-06 (≥2 "+"-edges)', () => {
    const graph = parseFixture('unified-loop-duplicate-exit.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const d06 = errors.find(e => e.includes('имеет несколько "+"-рёбер'));
    expect(d06).toBeDefined();
    if (d06 === undefined) return;
    expect(d06).toContain('"Lesion loop"');
    expect(d06).toContain('Должно быть ровно одно выходное ребро');
    expect(d06).toContain('уберите "+" с остальных');
    // Plan 04 fixture assigns "+"-prefix to e3 and e4 (the two exits). edgeIds comma-joined.
    expect(d06).toMatch(/e3.*e4|e4.*e3/);
  });

  // ── LOOP-04 D-07 — zero non-"+" outgoing edges ──────────────────────────────
  it('unified-loop-no-body.canvas flags D-07 (zero non-"+" outgoing edges)', () => {
    const graph = parseFixture('unified-loop-no-body.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const d07 = errors.find(e => e.includes('не имеет тела — добавьте исходящее ребро без префикса "+"'));
    expect(d07).toBeDefined();
    if (d07 === undefined) return;
    expect(d07).toContain('"Lesion loop"');
  });

  // ── LOOP-04 D-08 — per-offending-edge, empty caption post-strip ─────────────
  it('unified-loop-empty-plus.canvas flags D-08 (per-offending-edge, empty caption post-strip)', () => {
    const graph = parseFixture('unified-loop-empty-plus.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const d08 = errors.find(e => e.includes('не имеет подписи — добавьте текст после "+"'));
    expect(d08).toBeDefined();
    if (d08 === undefined) return;
    expect(d08).toContain('"Lesion loop"');
    expect(d08).toMatch(/"\+"-ребро \w+ не имеет подписи/);
  });

  // ── LOOP-04 Phase 49↔50 conflict regression: labeled body edge + "+"-exit ───
  it('unified-loop-labeled-body.canvas VALIDATES — labeled body edge + "+"-exit coexist (Phase 49↔50 conflict resolved)', () => {
    // Fixture: loop node with one "+выход" exit AND a body edge pointing to an Answer node
    // that carries displayLabel — Phase 50 reconciler legitimately labels the body edge.
    // Under Phase 49 this broke validation (body edge counted as a second exit). Under
    // Phase 50.1 the body edge has no "+" prefix so it is a body, not an exit.
    const graph = parseFixture('unified-loop-labeled-body.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    // No LOOP-04 errors:
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(false);
    expect(errors.some(e => e.includes('"+"-рёбер'))).toBe(false);
    expect(errors.some(e => e.includes('не имеет тела'))).toBe(false);
    expect(errors.some(e => e.includes('не имеет подписи'))).toBe(false);
  });

  // ── LOOP-04 — stray non-"+" body label is accepted under Phase 50.1 ─────────
  it('unified-loop-stray-body-label.canvas VALIDATES under 50.1 — non-"+" body label is allowed', () => {
    // Plan 04 migration: e3 → "+выход" (legit exit); e2 "проверка" preserved as a labeled body edge.
    // Under Phase 50.1 labeled body edges are legal (body = any edge without "+"), so this fixture
    // now validates cleanly rather than firing Phase 49 D-02.
    const graph = parseFixture('unified-loop-stray-body-label.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('"+"-рёбер'))).toBe(false);
  });

  // ── MIGRATE-01 (D-07) — legacy loop-body.canvas ─────────────────────────────
  it('legacy loop-body.canvas returns migration-error with required literals (MIGRATE-01, D-07)', () => {
    const graph = parseFixture('loop-body.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    // Должна быть ровно одна сводная migration-строка, содержащая все обязательные лексемы.
    const migrationErr = errors.find(e =>
      e.includes('loop-start') &&
      e.includes('loop-end') &&
      e.includes('loop') &&
      e.includes('«выход»'),
    );
    expect(migrationErr).toBeDefined();
    if (migrationErr === undefined) return;
    // Русская формулировка: «устаревшие узлы» или эквивалент из Plan 05.
    expect(migrationErr).toMatch(/устаревш/);
  });

  // ── MIGRATE-01 (D-07) — legacy loop-start.canvas ────────────────────────────
  it('legacy loop-start.canvas returns migration-error with required literals (MIGRATE-01, D-07)', () => {
    const graph = parseFixture('loop-start.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    const migrationErr = errors.find(e =>
      e.includes('loop-start') &&
      e.includes('loop-end') &&
      e.includes('loop') &&
      e.includes('«выход»'),
    );
    expect(migrationErr).toBeDefined();
  });

  // ── D-CL-02 order: migration check runs BEFORE LOOP-04 (early-return) ───────
  it('legacy canvas with 0 outgoing edges gives migration-error, NOT LOOP-04 exit error (D-CL-02 order, Phase 49)', () => {
    // loop-start.canvas содержит loop-start без continue-edge. Без early-return
    // в Migration Check, LOOP-04 сгенерировал бы D-01 «не имеет выхода» поверх.
    // Правильный порядок (D-CL-02): migration check срабатывает первым и делает return.
    const graph = parseFixture('loop-start.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    // Migration-error присутствует:
    expect(errors.some(e => e.includes('устаревш'))).toBe(true);
    // НЕТ Phase 49 D-01 / Phase 50.1 D-04 «не имеет выхода» ошибки:
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(false);
    // И старое Phase 43 D-08.1 сообщение «не имеет ребра «выход»» больше нигде не выпускается
    // валидатором (гарантия чистоты Phase 49 rewrite — literal removed from LOOP-04 block):
    expect(errors.some(e => e.includes('не имеет ребра'))).toBe(false);
    // Phase 50.1 guard: no D-06 «"+"-рёбер» wording leaks into a legacy-migration canvas.
    expect(errors.some(e => e.includes('"+"-рёбер'))).toBe(false);
  });

  // ── D-09: cycle through unified loop node is NOT flagged as unintentional ───
  it('cycle through unified loop node is NOT flagged as unintentional (D-09)', () => {
    // unified-loop-valid.canvas содержит cycle n-loop → n-q1 → n-a1 → n-loop,
    // проходящий через loop-узел — detectUnintentionalCycles теперь маркирует
    // это как намеренный цикл (kind === 'loop').
    const graph = parseFixture('unified-loop-valid.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    // Не должно быть cycle-error'а:
    expect(errors.some(e => e.toLowerCase().includes('unintentional cycle'))).toBe(false);
  });

  // ── D-09 negative control: cycle WITHOUT loop node IS flagged ───────────────
  it('cycle WITHOUT loop node is still flagged as unintentional (D-09 negative control)', () => {
    // Существующий cycle.canvas fixture — cycle из не-loop узлов → должен flag'аться.
    const graph = parseFixture('cycle.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.toLowerCase().includes('unintentional cycle'))).toBe(true);
    // Сообщение обновлено на «loop node» (не «loop-end node»):
    expect(errors.some(e => e.includes('loop node'))).toBe(true);
    expect(errors.some(e => e.includes('loop-end node'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 51 — D-04 snippet missing-file check (PICKER-01)
// See `.planning/notes/snippet-node-binding-and-picker.md`.
// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 51 — D-04 snippet missing-file check (PICKER-01)', () => {
  /** Map-backed fake probe. Keys are absolute paths; `true` = file exists. */
  function makeProbe(exists: Record<string, boolean>): (absPath: string) => boolean {
    return (absPath: string) => exists[absPath] === true;
  }

  /** Build a minimal canvas containing one start → one snippet node + snippet props. */
  function buildGraphWithSnippet(snippetProps: Record<string, unknown>, extraSnippetNodes: Array<{ id: string; props: Record<string, unknown> }> = []) {
    const nodes: Array<Record<string, unknown>> = [
      { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60, radiprotocol_nodeType: 'start' },
      { id: 'n-snippet-1', type: 'text', text: 'Snippet 1', x: 200, y: 0, width: 100, height: 60, radiprotocol_nodeType: 'snippet', ...snippetProps },
    ];
    const edges: Array<Record<string, unknown>> = [
      { id: 'e1', fromNode: 'n-start', toNode: 'n-snippet-1' },
    ];
    for (const extra of extraSnippetNodes) {
      nodes.push({ id: extra.id, type: 'text', text: extra.id, x: 400, y: 0, width: 100, height: 60, radiprotocol_nodeType: 'snippet', ...extra.props });
      edges.push({ id: `e-${extra.id}`, fromNode: 'n-snippet-1', toNode: extra.id });
    }
    const json = JSON.stringify({ nodes, edges });
    const parser = new CanvasParser();
    const result = parser.parse(json, 'phase51-d04.canvas');
    if (!result.success) throw new Error(result.error);
    return result.graph;
  }

  const ROOT = '.radiprotocol/snippets';

  it('Test 1 — happy path: bound file exists → no D-04 error', () => {
    const graph = buildGraphWithSnippet({ radiprotocol_snippetPath: 'abdomen/ct.md' });
    const validator = new GraphValidator({
      snippetFileProbe: makeProbe({ [`${ROOT}/abdomen/ct.md`]: true }),
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не найден'))).toBe(false);
    expect(errors.some(e => e.includes('Snippet-узел'))).toBe(false);
  });

  it('Test 2 — missing file: emits one error naming nodeId (via label) and relative path verbatim', () => {
    const graph = buildGraphWithSnippet({ radiprotocol_snippetPath: 'missing/file.md' });
    const validator = new GraphValidator({
      snippetFileProbe: makeProbe({}), // nothing exists
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    const d04 = errors.find(e => e.includes('Snippet-узел') && e.includes('не найден'));
    expect(d04).toBeDefined();
    if (d04 === undefined) return;
    // nodeId surfaces via nodeLabel() — for a snippet with no snippetLabel falls back to id.
    expect(d04).toContain('n-snippet-1');
    expect(d04).toContain('missing/file.md');
    expect(d04).toContain(ROOT);
    // Only one D-04 error for one offending node
    const d04Count = errors.filter(e => e.includes('Snippet-узел') && e.includes('не найден')).length;
    expect(d04Count).toBe(1);
  });

  it('Test 3 — mutual exclusivity: both subfolderPath and snippetPath set; probe=true → no error (mutual-exclusivity is write-time, not validator-time)', () => {
    const graph = buildGraphWithSnippet({
      radiprotocol_subfolderPath: 'abdomen',
      radiprotocol_snippetPath: 'liver/r.md',
    });
    const validator = new GraphValidator({
      snippetFileProbe: makeProbe({ [`${ROOT}/liver/r.md`]: true }),
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не найден'))).toBe(false);
  });

  it('Test 4 — back-compat directory binding: no snippetPath → probe never decides; no D-04 error regardless', () => {
    const graph = buildGraphWithSnippet({ radiprotocol_subfolderPath: 'abdomen' });
    let probeCalls = 0;
    const validator = new GraphValidator({
      snippetFileProbe: (_abs: string) => { probeCalls += 1; return false; },
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('Snippet-узел') && e.includes('не найден'))).toBe(false);
    expect(probeCalls).toBe(0);
  });

  it('Test 5 — back-compat root binding: no subfolderPath / no snippetPath → no D-04 error', () => {
    const graph = buildGraphWithSnippet({});
    const validator = new GraphValidator({
      snippetFileProbe: makeProbe({}),
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('Snippet-узел') && e.includes('не найден'))).toBe(false);
  });

  it('Test 6 — no probe configured: legacy zero-arg construction skips D-04 silently even with snippetPath set', () => {
    const graph = buildGraphWithSnippet({ radiprotocol_snippetPath: 'x.md' });
    const validator = new GraphValidator(); // zero-arg, legacy
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('Snippet-узел') && e.includes('не найден'))).toBe(false);
  });

  it('Test 7 — multiple snippet nodes: exactly one error naming only the missing one', () => {
    const graph = buildGraphWithSnippet(
      { radiprotocol_snippetPath: 'good/present.md' },
      [{ id: 'n-snippet-2', props: { radiprotocol_snippetPath: 'bad/absent.md' } }],
    );
    const validator = new GraphValidator({
      snippetFileProbe: makeProbe({ [`${ROOT}/good/present.md`]: true }),
      snippetFolderPath: ROOT,
    });
    const errors = validator.validate(graph);
    const d04Errors = errors.filter(e => e.includes('Snippet-узел') && e.includes('не найден'));
    expect(d04Errors.length).toBe(1);
    const d04 = d04Errors[0]!;
    expect(d04).toContain('n-snippet-2');
    expect(d04).toContain('bad/absent.md');
    expect(d04).not.toContain('good/present.md');
  });
});
