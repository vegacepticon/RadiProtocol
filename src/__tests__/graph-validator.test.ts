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

  // ── LOOP-04 happy path (Phase 49 EDGE-01) ───────────────────────────────────
  it('unified-loop-valid.canvas passes LOOP-04 checks (no label/body errors under Phase 49 convention)', () => {
    // Fixture: один loop узел с ровно одним помеченным (exit) ребром + одним непомеченным body-ребром.
    // Post-Phase-49: «проверка»-метка на body-ребре снята (см. Plan 04 fixture audit).
    const graph = parseFixture('unified-loop-valid.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(false);
    expect(errors.some(e => e.includes('несколько помеченных исходящих рёбер'))).toBe(false);
    expect(errors.some(e => e.includes('не имеет тела'))).toBe(false);
    // И никаких migration-ошибок (в этом канвасе нет legacy узлов):
    expect(errors.some(e => e.includes('устаревшие узлы loop-start/loop-end'))).toBe(false);
  });

  // ── LOOP-04 D-01 — missing labeled (exit) edge ──────────────────────────────
  it('unified-loop-missing-exit.canvas flags zero labeled outgoing edges (Phase 49 D-01)', () => {
    const graph = parseFixture('unified-loop-missing-exit.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(true);
    const err = errors.find(e => e.includes('не имеет выхода'));
    expect(err).toBeDefined();
    if (err === undefined) return;
    expect(err).toContain('Пометьте ровно одно исходящее ребро');
    expect(err).toContain('Lesion loop');
  });

  // ── LOOP-04 D-02 — ≥2 labeled edges (with offending edge IDs) ───────────────
  it('unified-loop-duplicate-exit.canvas flags multiple labeled edges with edge IDs (Phase 49 D-02)', () => {
    // Fixture has three labeled edges: e2 (label "проверка"), e3 (label "выход"), e4 (label "выход")
    // — all three are "labeled" under D-05, so D-02 fires listing all three ids.
    const graph = parseFixture('unified-loop-duplicate-exit.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('несколько помеченных исходящих рёбер'))).toBe(true);
    const dupErr = errors.find(e => e.includes('несколько помеченных исходящих рёбер'));
    expect(dupErr).toBeDefined();
    if (dupErr === undefined) return;
    expect(dupErr).toContain('e2');
    expect(dupErr).toContain('e3');
    expect(dupErr).toContain('e4');
    expect(dupErr).toContain('снимите метки с остальных');
  });

  // ── LOOP-04 D-03 — zero body (unlabeled) edges ──────────────────────────────
  it('unified-loop-no-body.canvas flags zero unlabeled outgoing edges (Phase 49 D-03)', () => {
    const graph = parseFixture('unified-loop-no-body.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('не имеет тела'))).toBe(true);
    const err = errors.find(e => e.includes('не имеет тела'));
    expect(err).toBeDefined();
    if (err === undefined) return;
    expect(err).toContain('добавьте исходящее ребро без метки');
  });

  // ── LOOP-04 D-02 — stray label on what was meant to be a body edge ──────────
  it('unified-loop-stray-body-label.canvas flags a second labeled edge (Phase 49 D-02 + D-16)', () => {
    // Fixture (Plan 04): n-loop has e2 (label "проверка", meant as body) + e3 (label "выход", legit exit)
    // → two labeled edges → D-02 fires listing both e2 and e3.
    const graph = parseFixture('unified-loop-stray-body-label.canvas');
    const validator = new GraphValidator();
    const errors = validator.validate(graph);
    expect(errors.some(e => e.includes('несколько помеченных исходящих рёбер'))).toBe(true);
    const dupErr = errors.find(e => e.includes('несколько помеченных исходящих рёбер'));
    expect(dupErr).toBeDefined();
    if (dupErr === undefined) return;
    expect(dupErr).toContain('e2');
    expect(dupErr).toContain('e3');
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
    // НЕТ Phase 49 D-01 «не имеет выхода» ошибки:
    expect(errors.some(e => e.includes('не имеет выхода'))).toBe(false);
    // И старое Phase 43 D-08.1 сообщение «не имеет ребра «выход»» больше нигде не выпускается
    // валидатором (гарантия чистоты Phase 49 rewrite — literal removed from LOOP-04 block):
    expect(errors.some(e => e.includes('не имеет ребра'))).toBe(false);
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
