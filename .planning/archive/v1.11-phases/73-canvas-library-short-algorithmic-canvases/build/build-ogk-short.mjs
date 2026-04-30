// Build ОГК short 1.0.0.canvas per 73-01-PLAN.md.
// Source template: Z:\projects\references\short - ОГК ОБП ОМТ жен.md (lines 4-7; ОГК section byte-equivalent in муж file).
// Reference shape: Phase 72 build-pkop.mjs (linear single-trunk, no fan-out, no loops).

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from '../../72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs';

const c = new Canvas('6'); // ОГК short → prefix '6'

const X = 0;
const X_NORM = -340;
const X_FREE = 340;
const X_SNIP = 720;
const STEP = 160;

// Helper: standard linear section (verbatim from Phase 72 build-pkop.mjs)
function section({ headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: X, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: X, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: X_NORM, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: X_FREE, y: y + STEP * 2, height: 80 });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: X_SNIP, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}

function converge(branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// === Start node (NO procedure preamble per D-04 + Pattern S5) ===
let y = -200;
const start = c.start({ x: X, y });
y += STEP;

// === Section 1: ЛЕГКИЕ (verbatim from short-жен MD line 4) ===
const sec1 = section({
  headerText: 'ЛЕГКИЕ:',
  normText: 'В легких свежих очаговых и инфильтративных изменений не выявлено.',
  sectionName: 'легкими',
  snippetSubfolder: 'ОГК/ЛЕГКИЕ',
  y,
});
c.edge({ from: start, to: sec1.header });
y += STEP * 2 + 200;

// === Section 2: ТРАХЕЯ И БРОНХИ (verbatim from short-жен MD line 5; no snippet folder per PATTERNS.md) ===
const sec2 = section({
  headerText: 'ТРАХЕЯ И БРОНХИ:',
  normText: 'Трахея и главные бронхи проходимы, не деформированы, обычного диаметра.',
  sectionName: 'трахеей и бронхами',
  y,
});
converge(sec1.branches, sec2.header);
y += STEP * 2 + 200;

// === Section 3: СРЕДОСТЕНИЕ (verbatim from short-жен MD line 6) ===
const sec3 = section({
  headerText: 'СРЕДОСТЕНИЕ:',
  normText: 'Лимфоузлы средостения не увеличены.',
  sectionName: 'средостением',
  snippetSubfolder: 'ОГК/СРЕДОСТЕНИЕ',
  y,
});
converge(sec2.branches, sec3.header);
y += STEP * 2 + 200;

// === Section 4: ПЛЕВРАЛЬНЫЕ ПОЛОСТИ (verbatim from short-жен MD line 7) ===
const sec4 = section({
  headerText: 'ПЛЕВРАЛЬНЫЕ ПОЛОСТИ:',
  normText: 'Плевральные полости и полость перикарда свободны.',
  sectionName: 'плевральными полостями',
  snippetSubfolder: 'ОГК/ПЛЕВРАЛЬНЫЕ ПОЛОСТИ',
  y,
});
converge(sec3.branches, sec4.header);
y += STEP * 2 + 200;

// === Terminal Заключение/Рекомендации text-block ===
// Verbatim from short MD lines 19-26; trailing-space `РКТ-признаки ` becomes `РКТ-признаки ==диагноз==` per D-13.
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: X, y, height: 220,
});
converge(sec4.branches, terminal);

// === Verify + write ===
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: ['ЛЕГКИЕ:', 'ТРАХЕЯ И БРОНХИ:', 'СРЕДОСТЕНИЕ:', 'ПЛЕВРАЛЬНЫЕ ПОЛОСТИ:'],
  zaklyuchenie: 'РКТ-признаки',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОГК short 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОГК short 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
