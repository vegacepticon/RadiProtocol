import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ProtocolRunner } from '../runner/protocol-runner';
import type { ProtocolGraph } from '../graph/graph-model';
import { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import { GraphValidator } from '../graph/graph-validator';
import { defaultT } from '../i18n';

// Regression for the real-user bug on «ОГК ОБП ОМТ short.rp.json»:
// walking a loop body through a snippet/free-text branch (instead of the
// isLoopExit edge) left the loop frame open; a later dead-end then returned
// the runner to an organ loop picker the user had already finished —
// "меня отбрасывает на начальные вопросы" after answering the bone question.
//
// The protocol's abdomen block wires each organ snippet BOTH as a body branch
// of the loop question AND onward into the next question, and each loop's exit
// edge targets that same next question ("trivial" loop). With such authoring,
// every branch walk must close the frame whose exit edge targets the branch's
// continuation — not only the innermost one.

const PROTOCOL_PATH = '/home/hermes/Documents/working-base/templates/AlGO/ОГК ОБП ОМТ short.rp.json';

const ID = {
  lungsQ: 'node-1787416810734-uvghyt',
  tracheaQ: 'node-1779449413949-l0nid7',
  mediastinumQ: 'node-1779449527388-aqqkv8',
  pleuraQ: 'node-1779449585307-2tgd7v',
  abdomenEntryQ: 'node-1780648229969-teedxv',
  liverQ: 'node-1779448182733-ahj3o6',
  kidneyQ: 'node-1779448291954-16ea9z',
  spleenQ: 'node-1779448340020-y8ed6h',
  adrenalQ: 'node-1779448364935-o5ek4m',
  pancreasQ: 'node-1779448410271-wa5mi6',
  gallbladderQ: 'node-1779695144502-hpkh7q',
  intestineQ: 'node-1781075323495-1jmf55',
  retroperitoneumQ: 'node-1781082375141-bpzzev',
  omtQ: 'node-1780313476576-xb1wxa',
  boneQ: 'node-1779452245177-m46jud',
  boneYesAnswer: 'node-1779452436863-jzevrq',
};

const PROTOCOL_AVAILABLE = existsSync(PROTOCOL_PATH);

function loadGraph(): ProtocolGraph {
  if (!PROTOCOL_AVAILABLE) throw new Error('protocol fixture unavailable');
  const content = readFileSync(PROTOCOL_PATH, 'utf-8');
  const parser = new ProtocolDocumentParser(defaultT);
  const res = parser.parse(content, 'test.rp.json');
  expect(res.success).toBe(true);
  if (!res.success) throw new Error('parse failed');
  const errs = new GraphValidator({ t: defaultT }).validate(res.graph);
  expect(errs).toEqual([]);
  return res.graph;
}

/** Dispatches the branch with the given label from the current UI state, the way the host does. */
function pick(runner: ProtocolRunner, graph: ProtocolGraph, fromQ: string, label: string, text?: string): void {
  const edge = graph.edges.find((e) => e.fromNodeId === fromQ && e.label === label);
  expect(edge, `edge from ${fromQ} with label ${label}`).toBeDefined();
  const st = runner.getState();
  const target = graph.nodes.get(edge!.toNodeId);
  expect(target).toBeDefined();
  if (st.status === 'awaiting-loop-pick') {
    expect(runner.chooseLoopBranch(edge!.id, target!.kind === 'answer' && (target as { freeText?: boolean }).freeText === true ? (text ?? 'тест') : undefined)).toBe(true);
    return;
  }
  expect(st.status).toBe('at-node');
  expect((st as { currentNodeId: string }).currentNodeId).toBe(fromQ);
  if (target!.kind === 'answer' && (target as { freeText?: boolean }).freeText === true) {
    expect(runner.chooseAnswer(edge!.toNodeId, text ?? 'тест')).toBe(true);
  } else if (target!.kind === 'answer') {
    runner.chooseAnswer(edge!.toNodeId);
  } else if (target!.kind === 'question') {
    runner.chooseQuestionBranch(edge!.id);
  } else if (target!.kind === 'snippet') {
    const p = (target as { radiprotocol_snippetPath?: string }).radiprotocol_snippetPath;
    if (typeof p === 'string' && p !== '') runner.pickFileBoundSnippet(fromQ, target!.id, p);
    else runner.chooseSnippetBranch(target!.id);
  }
}

function finishSnippet(runner: ProtocolRunner, text: string): void {
  const st = runner.getState();
  if (st.status === 'awaiting-snippet-pick') runner.pickSnippet('test-snippet');
  expect(st.status === 'awaiting-snippet-pick' || st.status === 'awaiting-snippet-fill').toBe(true);
  runner.completeSnippet(text);
}

function loopStackIds(runner: ProtocolRunner): string[] {
  const s = runner.getSerializableState();
  if (s === null) return [];
  return s.loopContextStack.map((f) => f.loopNodeId);
}

describe('regression: ОГК ОБП ОМТ short — escaped loop bodies must not leak frames', () => {
  // Fixture lives in the local working vault (user template, not patient data);
  // on machines without it these suites skip — the inline-graph suites above cover CI.
  const itLocal = PROTOCOL_AVAILABLE ? it : it.skip;

  itLocal('bone answer reaches complete instead of an organ loop picker', () => {
    const graph = loadGraph();
    const runner = new ProtocolRunner({ t: defaultT });
    runner.start(graph);

    // Легкие: сниппет-ветка в пикере лёгких, затем «Нет» (exit-эквивалент)
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    pick(runner, graph, ID.lungsQ, 'snippet');
    finishSnippet(runner, 'Свежих очаговых и инфильтративных изменений в легких не выявлено.');
    // Сниппет-ветка лёгких тупиковая → возврат в пикер лёгких (легитимный цикл)
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    pick(runner, graph, ID.lungsQ, 'Нет');

    // ОГК без сниппетов
    pick(runner, graph, ID.tracheaQ, 'Да');
    pick(runner, graph, ID.mediastinumQ, 'Нет');
    pick(runner, graph, ID.pleuraQ, 'Да');
    // ОБП: Да → печень (пикер)
    pick(runner, graph, ID.abdomenEntryQ, 'Да');
    expect(runner.getState().status).toBe('awaiting-loop-pick');

    // ПЕЧЕНЬ через «Вставить сниппет» (ветка тела, обходящая exit-ребро)
    pick(runner, graph, ID.liverQ, 'Вставить сниппет');
    finishSnippet(runner, 'Печень без изменений.');
    // После сниппета авто-переход к почкам (цель exit-ребра печени) —
    // фрейм печени обязан закрыться; остаётся только фрейм почек (они тоже луп).
    expect(loopStackIds(runner)).toEqual([ID.kidneyQ]);
    expect(runner.getState().status).toBe('awaiting-loop-pick'); // почки — тоже луп

    pick(runner, graph, ID.kidneyQ, 'Нет');
    pick(runner, graph, ID.spleenQ, 'Нет');
    pick(runner, graph, ID.adrenalQ, 'Нет');
    pick(runner, graph, ID.pancreasQ, 'Нет');
    // общая формулировка (сниппет-нода после поджелудочной)
    const stAfterPancreas = runner.getState();
    if (stAfterPancreas.status === 'awaiting-snippet-fill' || stAfterPancreas.status === 'awaiting-snippet-pick') {
      finishSnippet(runner, 'Органы брюшной полости без патологических изменений.');
    }
    expect(loopStackIds(runner)).toEqual([]);

    pick(runner, graph, ID.gallbladderQ, 'Нет');
    pick(runner, graph, ID.intestineQ, 'Нет');
    pick(runner, graph, ID.retroperitoneumQ, 'Нет');
    pick(runner, graph, ID.omtQ, 'Нет');
    expect(runner.getState().status).toBe('at-node');
    expect((runner.getState() as { currentNodeId: string }).currentNodeId).toBe(ID.boneQ);
    expect(loopStackIds(runner)).toEqual([]);

    // Раньше: этот ответ заканчивал dead-end'ом в утечённый фрейм → пикер печени.
    pick(runner, graph, ID.boneQ, 'Есть изменения, укажу какие', 'Костно-деструктивных изменений не выявлено.');
    expect(runner.getState().status).toBe('complete');
  });

  itLocal('legitimate multi-organ loop (exit back into the looped question) keeps its frame', () => {
    const graph = loadGraph();
    const runner = new ProtocolRunner({ t: defaultT });
    runner.start(graph);
    // Лёгкие: «Нет» — preset-ответ авто-прошёл бы к трахее, но сам вопрос лёгких
    // является пикером: выбираем тело лупа, ведущее на «Укажу характер…»,
    // затем выходим через exit-ребро. Фрейм лёгких живёт, пока пользователь в цикле.
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    pick(runner, graph, ID.lungsQ, 'Нет');
    // «Нет» preset answer auto-advances out of the lungs loop → трахея;
    // фрейм лёгких при этом закрыт (exit-ребро трахеи = trivial loop pop).
    expect(loopStackIds(runner)).toEqual([]);
    expect(runner.getState().status).toBe('at-node');
    expect((runner.getState() as { currentNodeId: string }).currentNodeId).toBe(ID.tracheaQ);
  });
});
