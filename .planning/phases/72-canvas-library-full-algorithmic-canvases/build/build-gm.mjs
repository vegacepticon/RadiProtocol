// Build ГМ 1.0.0.canvas per 72-01-PLAN.md.
// Source template: Z:\projects\references\ГМ.md
// Reference shape: Z:\projects\references\ОГК 1.10.0.canvas

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from './canvas-builder.mjs';

const c = new Canvas('1'); // ГМ → prefix '1'

// Layout constants
const X = 0;          // spine
const X_NORM = -340;  // norm answer column
const X_FREE = 340;   // freetext answer column
const X_SNIP1 = 720;  // first extra snippet column
const X_SNIP2 = 1100; // second extra snippet column
const X_LOOP_BODY = 600; // loop body column

// y-cursor advances per section
let y = -200;
const STEP = 160;
const SEC_GAP = 240;

// === Start ===
const start = c.start({ x: X, y });
y += STEP;

// === Procedure text-block (Task 5: ==тип исследования== fill-in chip prefix per D-29) ===
const procedure = c.textBlock({
  text: '\n==тип исследования==\nМСКТ-исследование выполнено по стандартной программе с последующей мультипланарной реконструкцией.',
  x: X, y, height: 140,
});
c.edge({ from: start, to: procedure });
y += 200;

// === Section 1: СРЕДИННЫЕ СТРУКТУРЫ ===
const sec1 = c.textBlock({ text: '\nСРЕДИННЫЕ СТРУКТУРЫ:', x: X, y });
c.edge({ from: procedure, to: sec1 });
y += STEP;
const q1 = c.question({ text: 'СРЕДИННЫЕ СТРУКТУРЫ — норма?', x: X, y });
c.edge({ from: sec1, to: q1 });
y += STEP;
const a1norm = c.answer({ text: 'Не смещены.', displayLabel: 'Норма', x: X_NORM, y });
const a1free = c.answer({ text: '==напишу что не так со срединными структурами==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
c.edge({ from: q1, to: a1norm, label: 'Норма' });
c.edge({ from: q1, to: a1free, label: 'Опишу вручную' });
y += SEC_GAP;

// === Section 2: ВЕЩЕСТВО ГОЛОВНОГО МОЗГА (with focal-lesion loop per D-06) ===
const sec2 = c.textBlock({ text: '\nВЕЩЕСТВО ГОЛОВНОГО МОЗГА:', x: X, y });
c.edge({ from: a1norm, to: sec2 });
c.edge({ from: a1free, to: sec2 });
y += STEP;
const q2 = c.question({ text: 'ВЕЩЕСТВО ГОЛОВНОГО МОЗГА — норма?', x: X, y, height: 80 });
c.edge({ from: sec2, to: q2 });
y += 180;
const a2norm = c.answer({
  text: 'Белое и серое вещество больших полушарий развиты типично, обычной плотности.\nМозолистое тело, зрительный бугор, ствол мозга и мозжечок нормальной плотности.\nМиндалины мозжечка выше уровня линии Мак-Рея.',
  displayLabel: 'Норма', x: X_NORM, y, height: 200,
});
const a2free = c.answer({ text: '==напишу что не так с веществом мозга==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
c.edge({ from: q2, to: a2norm, label: 'Норма' });
c.edge({ from: q2, to: a2free, label: 'Опишу вручную' });
y += 260;
const loop2 = c.loop({ text: 'Видны ли очаги патологической плотности?', headerText: 'Видны ли очаги патологической плотности?', x: X, y, height: 100 });
c.edge({ from: a2norm, to: loop2 });
c.edge({ from: a2free, to: loop2 });
y += 200;
const lb2_no = c.answer({
  text: 'Очагов патологической плотности, объемных образований в веществе головного мозга и по ходу оболочек не выявлено.',
  displayLabel: 'Нет', x: X_LOOP_BODY, y, height: 160,
});
const lb2_snip = c.snippetFolder({ subfolderPath: 'ГМ', text: 'ГМ', snippetLabel: 'Выберу готовый шаблон очага', x: X_LOOP_BODY, y: y + 200 });
const lb2_free = c.answer({ text: '==опишу очаг==', displayLabel: 'Опишу вручную', x: X_LOOP_BODY, y: y + 320, height: 60 });
c.edge({ from: loop2, to: lb2_no, fromSide: 'right', toSide: 'left', label: 'Нет' });
c.edge({ from: loop2, to: lb2_snip, fromSide: 'right', toSide: 'left', label: 'Выберу готовый шаблон очага' });
c.edge({ from: loop2, to: lb2_free, fromSide: 'right', toSide: 'left', label: 'Опишу вручную' });
// loop body returns
c.edge({ from: lb2_no, to: loop2, fromSide: 'left', toSide: 'right' });
c.edge({ from: lb2_snip, to: loop2, fromSide: 'left', toSide: 'right' });
c.edge({ from: lb2_free, to: loop2, fromSide: 'left', toSide: 'right' });
y += 480;

// === Section 3: ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА ===
const sec3 = c.textBlock({ text: '\nЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА:', x: X, y, height: 80 });
c.edge({ from: loop2, to: sec3, label: '+Все указано, продолжаем' });
y += STEP;
const q3 = c.question({ text: 'ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА — норма?', x: X, y, height: 80 });
c.edge({ from: sec3, to: q3 });
y += 180;
const a3norm = c.answer({
  text: 'Субарахноидальное конвекситальное пространство и цистерны мозга не расширены.\nЖелудочки головного мозга обычной формы, не изменены.\nБоковые желудочки симметричны, не расширены.\nШирина III-его желудочка до 5 мм.',
  displayLabel: 'Норма', x: X_NORM, y, height: 220,
});
const a3free = c.answer({ text: '==напишу что не так с ликворосодержащими пространствами==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 100 });
const a3snip1 = c.snippetFile({
  snippetPath: 'ГМ/ЖЕЛУДОЧКИ - расширенное описание.md',
  snippetLabel: 'Расширенное описание желудочков',
  text: 'ЖЕЛУДОЧКИ - расширенное описание', x: X_SNIP1, y, height: 80,
});
const a3snip2 = c.snippetFile({
  snippetPath: 'ГМ/РАСШИРЕНИЕ ликоврных пространств.md',
  snippetLabel: 'Расширение ликворных пространств',
  text: 'РАСШИРЕНИЕ ликворных пространств', x: X_SNIP2, y, height: 80,
});
c.edge({ from: q3, to: a3norm, label: 'Норма' });
c.edge({ from: q3, to: a3free, label: 'Опишу вручную' });
c.edge({ from: q3, to: a3snip1, label: 'Расширенное описание желудочков' });
c.edge({ from: q3, to: a3snip2, label: 'Расширение ликворных пространств' });
y += 280;

// === Section 4: СЕЛЛЯРНАЯ ОБЛАСТЬ ===
const sec4 = c.textBlock({ text: '\nСЕЛЛЯРНАЯ ОБЛАСТЬ:', x: X, y });
c.edge({ from: a3norm, to: sec4 });
c.edge({ from: a3free, to: sec4 });
c.edge({ from: a3snip1, to: sec4 });
c.edge({ from: a3snip2, to: sec4 });
y += STEP;
const q4 = c.question({ text: 'СЕЛЛЯРНАЯ ОБЛАСТЬ — норма?', x: X, y });
c.edge({ from: sec4, to: q4 });
y += STEP;
const a4norm = c.answer({
  text: 'Турецкое седло обычной формы и величины.\nРазмеры, плотность и структура гипофиза в норме.\nПараселлярные структуры обычной плотности и локализации.',
  displayLabel: 'Норма', x: X_NORM, y, height: 180,
});
const a4free = c.answer({ text: '==напишу что не так с селлярной областью==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
c.edge({ from: q4, to: a4norm, label: 'Норма' });
c.edge({ from: q4, to: a4free, label: 'Опишу вручную' });
y += 260;

// === Section 5: ОКОЛОНОСОВЫЕ ПАЗУХИ ===
const sec5 = c.textBlock({ text: '\nОКОЛОНОСОВЫЕ ПАЗУХИ:', x: X, y });
c.edge({ from: a4norm, to: sec5 });
c.edge({ from: a4free, to: sec5 });
y += STEP;
const q5 = c.question({ text: 'ОКОЛОНОСОВЫЕ ПАЗУХИ — норма?', x: X, y });
c.edge({ from: sec5, to: q5 });
y += STEP;
const a5norm = c.answer({ text: 'Без нарушения развития и пневматизации.', displayLabel: 'Норма', x: X_NORM, y });
const a5free = c.answer({ text: '==напишу что не так с пазухами==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
c.edge({ from: q5, to: a5norm, label: 'Норма' });
c.edge({ from: q5, to: a5free, label: 'Опишу вручную' });
y += SEC_GAP;

// === Section 6: ОРБИТЫ ===
const sec6 = c.textBlock({ text: '\nОРБИТЫ:', x: X, y });
c.edge({ from: a5norm, to: sec6 });
c.edge({ from: a5free, to: sec6 });
y += STEP;
const q6 = c.question({ text: 'ОРБИТЫ — норма?', x: X, y });
c.edge({ from: sec6, to: q6 });
y += STEP;
const a6norm = c.answer({
  text: 'Расположены симметрично, нормальных размеров с обычным развитием орбитальных конусов. Стенки орбит не изменены.',
  displayLabel: 'Норма', x: X_NORM, y, height: 140,
});
const a6free = c.answer({ text: '==напишу что не так с орбитами==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
const a6snip1 = c.snippetFile({
  snippetPath: 'ГМ/ФТИЗИС глазного яблока.md',
  snippetLabel: 'Фтизис глазного яблока',
  text: 'ФТИЗИС глазного яблока', x: X_SNIP1, y, height: 80,
});
const a6snip2 = c.snippetFile({
  snippetPath: 'ГМ/ДЕФОРМАЦИЯ медиальной стенки глазницы.md',
  snippetLabel: 'Деформация медиальной стенки',
  text: 'ДЕФОРМАЦИЯ медиальной стенки глазницы', x: X_SNIP2, y, height: 80,
});
c.edge({ from: q6, to: a6norm, label: 'Норма' });
c.edge({ from: q6, to: a6free, label: 'Опишу вручную' });
c.edge({ from: q6, to: a6snip1, label: 'Фтизис глазного яблока' });
c.edge({ from: q6, to: a6snip2, label: 'Деформация медиальной стенки' });
y += 220;

// === Section 7: КОСТНЫЕ СТРУКТУРЫ ===
const sec7 = c.textBlock({ text: '\nКОСТНЫЕ СТРУКТУРЫ:', x: X, y });
c.edge({ from: a6norm, to: sec7 });
c.edge({ from: a6free, to: sec7 });
c.edge({ from: a6snip1, to: sec7 });
c.edge({ from: a6snip2, to: sec7 });
y += STEP;
const q7 = c.question({ text: 'КОСТНЫЕ СТРУКТУРЫ — норма?', x: X, y });
c.edge({ from: sec7, to: q7 });
y += STEP;
const a7norm = c.answer({
  text: 'Краниовертебральный переход без особенностей.\nСосцевидные отростки и пирамиды височных костей пневматизированы.\nКости свода и основания черепа без деструктивных, травматических изменений.',
  displayLabel: 'Норма', x: X_NORM, y, height: 180,
});
const a7free = c.answer({ text: '==напишу что не так с костями черепа==', displayLabel: 'Опишу вручную', x: X_FREE, y, height: 80 });
const a7snip = c.snippetFolder({ subfolderPath: 'КОСТИ', text: 'КОСТИ', snippetLabel: 'Выберу шаблон по костям', x: X_SNIP1, y, height: 80 });
c.edge({ from: q7, to: a7norm, label: 'Норма' });
c.edge({ from: q7, to: a7free, label: 'Опишу вручную' });
c.edge({ from: q7, to: a7snip, label: 'Выберу шаблон по костям' });
y += 280;

// === Terminal Заключение / Рекомендации ===
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаков патологических изменений в веществе головного мозга не выявлено.\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: X, y, height: 220,
});
c.edge({ from: a7norm, to: terminal });
c.edge({ from: a7free, to: terminal });
c.edge({ from: a7snip, to: terminal });

// === Verify ===
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'СРЕДИННЫЕ СТРУКТУРЫ:',
    'ВЕЩЕСТВО ГОЛОВНОГО МОЗГА:',
    'ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА:',
    'СЕЛЛЯРНАЯ ОБЛАСТЬ:',
    'ОКОЛОНОСОВЫЕ ПАЗУХИ:',
    'ОРБИТЫ:',
    'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаков патологических изменений в веществе головного мозга не выявлено.',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ГМ 1.0.0.canvas', findings);

// === Write to vault ===
const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ГМ 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}, loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}`);
process.exit(ok ? 0 : 1);
