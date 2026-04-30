// Build ОБП full 1.0.0.canvas per 72-02-PLAN.md.
// Two parallel trunks — contrast (Да болюсно + Да вручную) and no-contrast (Нет) —
// since norm-finding text per organ differs by contrast disposition (D-27).
// Source templates: Z:\projects\references\ОБП без контраста.md and ОБП с контрастом.md.

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from './canvas-builder.mjs';

const c = new Canvas('2'); // ОБП → prefix '2'

// ------ Layout constants ------
const X_START = 0;
const X_C = -1500;   // contrast trunk
const X_NC = 1500;   // no-contrast trunk
const NORM_DX = -340;
const FREE_DX = 340;
const SNIP_DX = 720;
const LOOP_BODY_DX = 600; // loop body to the right of trunk
const STEP = 160;
const SEC_GAP = 280;

// ------ Helpers ------
// Build a standard section: header → question → (norm, freetext, [snippet]) → returns IDs of branch terminals
function section(c, { trunkX, headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу готовый шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: trunkX, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: trunkX, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: trunkX + NORM_DX, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({
    text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`,
    displayLabel: 'Опишу вручную',
    x: trunkX + FREE_DX, y: y + STEP * 2, height: 80,
  });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: trunkX + SNIP_DX, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}

// Build a discovery loop: 3 body branches (Нет / snippet folder / opishu) + +exit
function loop(c, { trunkX, headerText, freetextText, snippetSubfolder, y }) {
  const lp = c.loop({ text: headerText, headerText, x: trunkX, y, height: 100 });
  const bNo = c.answer({ text: '', displayLabel: 'Нет', x: trunkX + LOOP_BODY_DX, y, height: 60 });
  const bSnip = c.snippetFolder({
    subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel: 'Выберу готовый шаблон',
    x: trunkX + LOOP_BODY_DX, y: y + 120, height: 80,
  });
  const bFree = c.answer({ text: freetextText, displayLabel: 'Опишу вручную', x: trunkX + LOOP_BODY_DX, y: y + 240, height: 60 });
  c.edge({ from: lp, to: bNo, fromSide: 'right', toSide: 'left', label: 'Нет' });
  c.edge({ from: lp, to: bSnip, fromSide: 'right', toSide: 'left', label: 'Выберу готовый шаблон' });
  c.edge({ from: lp, to: bFree, fromSide: 'right', toSide: 'left', label: 'Опишу вручную' });
  // returns
  c.edge({ from: bNo, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bSnip, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bFree, to: lp, fromSide: 'left', toSide: 'right' });
  return lp;
}

// Connect a list of branch IDs to a target node (convergence)
function converge(c, branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// === Start + Контраст question + 3 answers ===
const start = c.start({ x: X_START, y: -500 });
const qContrast = c.question({ text: 'Контраст вводился?', x: X_START, y: -340 });
c.edge({ from: start, to: qContrast });

// Answer A — Да, болюсно (contrast trunk)
const aBolus = c.answer({
  text: 'МСКТ-исследование органов брюшной полости выполнено по программе объемного сканирования с внутривенным болюсным контрастированием.',
  displayLabel: 'Да, болюсно',
  x: X_C, y: -180, height: 200,
});
// Answer B — Да, вручную (contrast trunk)
const aManual = c.answer({
  text: 'МСКТ-исследование органов брюшной полости выполнено по программе объемного сканирования с внутривенным контрастированием.',
  displayLabel: 'Да, вручную',
  x: X_C - 300, y: 60, height: 180,
});
// Answer C — Нет (no-contrast trunk)
const aNo = c.answer({
  text: 'МСКТ-исследование органов брюшной полости выполнено по программе объемного сканирования без внутривенного контрастирования с последующей мультипланарной реконструкцией.',
  displayLabel: 'Нет',
  x: X_NC, y: -180, height: 240,
});
c.edge({ from: qContrast, to: aBolus, label: 'Да, болюсно' });
c.edge({ from: qContrast, to: aManual, label: 'Да, вручную' });
c.edge({ from: qContrast, to: aNo, label: 'Нет' });

// Shared lines text-block (one per trunk — same content, separate nodes for routing)
const sharedText = '\nИсследование произведено в положении пациента лежа на спине.\n\nНаддиафрагмальные отделы легких не изменены.\n\nСвободной жидкости в брюшной полости не выявлено.';
const sharedC = c.textBlock({ text: sharedText, x: X_C, y: 240, height: 240 });
const sharedNC = c.textBlock({ text: sharedText, x: X_NC, y: 240, height: 240 });
c.edge({ from: aBolus, to: sharedC });
c.edge({ from: aManual, to: sharedC });
c.edge({ from: aNo, to: sharedNC });

// ============================================================
// CONTRAST TRUNK (sections inherit ОБП с контрастом.md text)
// ============================================================
let yC = 580;

// ПЕЧЕНЬ section + loop
const liverNormC = 'Не увеличена, кранио-каудальный размер правой доли по среднеключичной линии - ==размер правой доли мм== мм (норма меньше 150 мм), левой доли - ==размер левой доли мм== мм (норма меньше 100 мм), с четкими ровными контурами. Плотность паренхимы не снижена, среднее значение +==плотность HU== НU (норма +55...+65 HU). Структура однородная.\nВнутри- и внепечёночные протоки не расширены. Дополнительных образований и патологических фокусов накопления контрастного средства в печени не выявлено.';
const liverC = section(c, { trunkX: X_C, headerText: 'ПЕЧЕНЬ:', normText: liverNormC, normHeight: 280, sectionName: 'печенью', snippetSubfolder: 'ОБП/ПЕЧЕНЬ', y: yC });
c.edge({ from: sharedC, to: liverC.header });
yC += STEP * 2 + 320;
const liverLoopC = loop(c, { trunkX: X_C, headerText: 'Есть очаговые изменения в печени?', freetextText: '==опишу очаг печени==', snippetSubfolder: 'ОБП/ПЕЧЕНЬ', y: yC });
converge(c, liverC.branches, liverLoopC);
yC += 320;

// ЖЕЛЧНЫЙ ПУЗЫРЬ
const gallC = section(c, {
  trunkX: X_C, headerText: 'ЖЕЛЧНЫЙ ПУЗЫРЬ:',
  normText: 'Не увеличен, стенки его не утолщены; в просвете рентгенопозитивных конкрементов и патологических фокусов накопления контрастного средства не выявлено.\nОбщий желчный проток не расширен, без патологического содержимого.',
  normHeight: 200, sectionName: 'желчным пузырём', snippetSubfolder: 'ОБП/ЖЕЛЧНЫЙ ПУЗЫРЬ', y: yC,
});
c.edge({ from: liverLoopC, to: gallC.header, label: '+Все указано, продолжаем' });
yC += STEP * 2 + 240;

// ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА section + loop
const pancreasNormC = 'Не увеличена, размерами ==размер головки==-==размер тела==-==размер хвоста== мм (поперечный размер в норме: головки – до 30 мм, тела – до 25 мм, хвоста – до 20 мм), не деформирована, однородной дольчатой структуры. Плотностные показатели не изменены, среднее значение +==плотность ПЖ HU== НU (норма +30...+60 HU). Накопление контрастного препарата равномерное, Вирсунгов проток не расширен, парапанкреатическая клетчатка не изменена.';
const pancreasC = section(c, { trunkX: X_C, headerText: 'ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА:', normText: pancreasNormC, normHeight: 280, sectionName: 'поджелудочной железой', snippetSubfolder: 'ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА', y: yC });
converge(c, gallC.branches, pancreasC.header);
yC += STEP * 2 + 320;
const pancreasLoopC = loop(c, { trunkX: X_C, headerText: 'Есть образование/изменения поджелудочной железы?', freetextText: '==опишу изменение поджелудочной железы==', snippetSubfolder: 'ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА', y: yC });
converge(c, pancreasC.branches, pancreasLoopC);
yC += 320;

// СЕЛЕЗЕНКА
const spleenC = section(c, {
  trunkX: X_C, headerText: 'СЕЛЕЗЕНКА:',
  normText: 'Не увеличена (размеры: длина ==длина селезенки== мм, толщина ==толщина селезенки== мм, высота ==высота селезенки== мм; индекс селезенки ==индекс селезенки==, норма до 480 ), структура не изменена (плотность +40...+50 HU), накопление контрастного препарата равномерное (соответствует фазам контрастирования).',
  normHeight: 240, sectionName: 'селезёнкой', snippetSubfolder: 'ОБП/СЕЛЕЗЕНКА', y: yC,
});
c.edge({ from: pancreasLoopC, to: spleenC.header, label: '+Все указано, продолжаем' });
yC += STEP * 2 + 280;

// КИШЕЧНИК
const guttsC = section(c, {
  trunkX: X_C, headerText: 'КИШЕЧНИК:',
  normText: 'Положение петель кишечника обычное, патологическое утолщение стенки кишки и нарушение просвета не выявлено.',
  normHeight: 120, sectionName: 'кишечником', snippetSubfolder: 'ОБП/КИШЕЧНИК', y: yC,
});
converge(c, spleenC.branches, guttsC.header);
yC += STEP * 2 + 200;

// ЛИМФАТИЧЕСКИЕ УЗЛЫ (contrast: comes BEFORE СОСУДЫ)
const lyC = section(c, {
  trunkX: X_C, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:',
  normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОБП/ЛИМФАТИЧЕСКИЕ УЗЛЫ', y: yC,
});
converge(c, guttsC.branches, lyC.header);
yC += STEP * 2 + 200;

// СОСУДЫ (contrast only)
const sosudyC = section(c, {
  trunkX: X_C, headerText: 'СОСУДЫ:',
  normText: 'Визуализируются удовлетворительно, дефектов контрастирования не выявлено. Аорта в брюшном отделе не расширена. Стенка аорты не изменена.\nВоротная вена ==воротная вена мм== мм, селезёночная вена ==селезёночная вена мм== мм.',
  normHeight: 240, sectionName: 'сосудами', snippetSubfolder: 'ОБП/СОСУДЫ', y: yC,
});
converge(c, lyC.branches, sosudyC.header);
yC += STEP * 2 + 280;

// МЯГКИЕ ТКАНИ (contrast)
const softC = section(c, {
  trunkX: X_C, headerText: 'МЯГКИЕ ТКАНИ:',
  normText: 'Без патологических изменений.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОБП/МЯГКИЕ ТКАНИ', y: yC,
});
converge(c, sosudyC.branches, softC.header);
yC += STEP * 2 + 200;

// КОСТНЫЕ СТРУКТУРЫ (contrast)
const bonesC = section(c, {
  trunkX: X_C, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-деструктивные, костно-травматические изменения не определяются. Дегенеративно-дистрофические изменения позвоночника нерезко/умеренно выражены.',
  normHeight: 160, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yC,
});
converge(c, softC.branches, bonesC.header);
yC += STEP * 2 + 240;

// ============================================================
// NO-CONTRAST TRUNK
// ============================================================
let yNC = 580;

// ПЕЧЕНЬ section + loop (no-contrast norm)
const liverNormNC = 'Не увеличена, кранио-каудальный размер правой доли по среднеключичной линии - ==размер правой доли мм== мм (норма меньше 150 мм), левой доли - ==размер левой доли мм== мм (норма меньше 100 мм), с четкими ровными контурами. Плотность паренхимы не снижена, среднее значение +==плотность HU== НU (норма +55...+65 HU). Структура однородная.\nВнутри- и внепечёночные протоки не расширены.\nДополнительных образований в условиях нативного исследования не выявлено.';
const liverNC = section(c, { trunkX: X_NC, headerText: 'ПЕЧЕНЬ:', normText: liverNormNC, normHeight: 320, sectionName: 'печенью', snippetSubfolder: 'ОБП/ПЕЧЕНЬ', y: yNC });
c.edge({ from: sharedNC, to: liverNC.header });
yNC += STEP * 2 + 360;
const liverLoopNC = loop(c, { trunkX: X_NC, headerText: 'Есть очаговые изменения в печени?', freetextText: '==опишу очаг печени==', snippetSubfolder: 'ОБП/ПЕЧЕНЬ', y: yNC });
converge(c, liverNC.branches, liverLoopNC);
yNC += 320;

// ЖЕЛЧНЫЙ ПУЗЫРЬ (no-contrast norm)
const gallNC = section(c, {
  trunkX: X_NC, headerText: 'ЖЕЛЧНЫЙ ПУЗЫРЬ:',
  normText: 'Не увеличен, стенки его не утолщены; в просвете рентгенопозитивных конкрементов не выявлено.\nОбщий желчный проток не расширен, без патологического содержимого.',
  normHeight: 180, sectionName: 'желчным пузырём', snippetSubfolder: 'ОБП/ЖЕЛЧНЫЙ ПУЗЫРЬ', y: yNC,
});
c.edge({ from: liverLoopNC, to: gallNC.header, label: '+Все указано, продолжаем' });
yNC += STEP * 2 + 220;

// ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА section + loop (no-contrast norm)
const pancreasNormNC = 'Не увеличена, размерами ==размер головки==-==размер тела==-==размер хвоста== мм (поперечный размер в норме: головки – до 30 мм, тела – до 25 мм, хвоста – до 20 мм), не деформирована, однородной дольчатой структуры. Плотностные показатели не изменены, среднее значение +==плотность ПЖ HU== НU (норма +30...+60 HU). Вирсунгов проток не расширен, парапанкреатическая клетчатка не изменена.';
const pancreasNC = section(c, { trunkX: X_NC, headerText: 'ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА:', normText: pancreasNormNC, normHeight: 280, sectionName: 'поджелудочной железой', snippetSubfolder: 'ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА', y: yNC });
converge(c, gallNC.branches, pancreasNC.header);
yNC += STEP * 2 + 320;
const pancreasLoopNC = loop(c, { trunkX: X_NC, headerText: 'Есть образование/изменения поджелудочной железы?', freetextText: '==опишу изменение поджелудочной железы==', snippetSubfolder: 'ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА', y: yNC });
converge(c, pancreasNC.branches, pancreasLoopNC);
yNC += 320;

// СЕЛЕЗЕНКА (no-contrast)
const spleenNC = section(c, {
  trunkX: X_NC, headerText: 'СЕЛЕЗЕНКА:',
  normText: 'Не увеличена (размеры: длина ==длина селезенки== мм, толщина ==толщина селезенки== мм, высота ==высота селезенки== мм; индекс селезенки ==индекс селезенки==, норма до 480 ), структура не изменена (плотность +40...+50 HU).',
  normHeight: 200, sectionName: 'селезёнкой', snippetSubfolder: 'ОБП/СЕЛЕЗЕНКА', y: yNC,
});
c.edge({ from: pancreasLoopNC, to: spleenNC.header, label: '+Все указано, продолжаем' });
yNC += STEP * 2 + 240;

// КИШЕЧНИК (no-contrast — same text)
const guttsNC = section(c, {
  trunkX: X_NC, headerText: 'КИШЕЧНИК:',
  normText: 'Положение петель кишечника обычное, патологическое утолщение стенки кишки и нарушение просвета не выявлено.',
  normHeight: 120, sectionName: 'кишечником', snippetSubfolder: 'ОБП/КИШЕЧНИК', y: yNC,
});
converge(c, spleenNC.branches, guttsNC.header);
yNC += STEP * 2 + 200;

// (no-contrast only) "Аорта..." linear text-block (no header)
const aortaTB = c.textBlock({
  text: '\nАорта в брюшном отделе не расширена. Стенка аорты не изменена.',
  x: X_NC, y: yNC, height: 100,
});
converge(c, guttsNC.branches, aortaTB);
yNC += 180;

// ЛИМФАТИЧЕСКИЕ УЗЛЫ (no-contrast)
const lyNC = section(c, {
  trunkX: X_NC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:',
  normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОБП/ЛИМФАТИЧЕСКИЕ УЗЛЫ', y: yNC,
});
c.edge({ from: aortaTB, to: lyNC.header });
yNC += STEP * 2 + 200;

// МЯГКИЕ ТКАНИ (no-contrast: "Не изменены.")
const softNC = section(c, {
  trunkX: X_NC, headerText: 'МЯГКИЕ ТКАНИ:',
  normText: 'Не изменены.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОБП/МЯГКИЕ ТКАНИ', y: yNC,
});
converge(c, lyNC.branches, softNC.header);
yNC += STEP * 2 + 200;

// КОСТНЫЕ СТРУКТУРЫ (no-contrast)
const bonesNC = section(c, {
  trunkX: X_NC, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-деструктивные, костно-травматические изменения не определяются. Дегенеративно-дистрофические изменения позвоночника нерезко/умеренно выражены.',
  normHeight: 160, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yNC,
});
converge(c, softNC.branches, bonesNC.header);
yNC += STEP * 2 + 240;

// ============================================================
// Terminal — both trunks converge
// ============================================================
const yTerm = Math.max(yC, yNC) + 200;
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки патологических изменений органов брюшной полости не выявлены.\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: X_START, y: yTerm, height: 240,
});
converge(c, bonesC.branches, terminal);
converge(c, bonesNC.branches, terminal);

// ============================================================
// Verify + write
// ============================================================
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'ПЕЧЕНЬ:', 'ЖЕЛЧНЫЙ ПУЗЫРЬ:', 'ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА:', 'СЕЛЕЗЕНКА:', 'КИШЕЧНИК:',
    'СОСУДЫ:', 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', 'МЯГКИЕ ТКАНИ:', 'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаки патологических изменений органов брюшной полости не выявлены.',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОБП full 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП full 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
