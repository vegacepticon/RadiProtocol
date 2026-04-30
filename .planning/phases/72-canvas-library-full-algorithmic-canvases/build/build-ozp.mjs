// Build ОЗП 1.0.0.canvas per 72-03-PLAN.md.
// Two parallel trunks — contrast and no-contrast — with 3 organ-discovery loops per trunk
// (НАДПОЧЕЧНИКИ + ПРАВАЯ ПОЧКА + ЛЕВАЯ ПОЧКА per D-08).

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from './canvas-builder.mjs';

const c = new Canvas('3'); // ОЗП → prefix '3'

const X_START = 0;
const X_C = -1500;
const X_NC = 1500;
const NORM_DX = -340;
const FREE_DX = 340;
const SNIP_DX = 720;
const LOOP_BODY_DX = 600;
const STEP = 160;

function section(c, { trunkX, headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу готовый шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: trunkX, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: trunkX, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: trunkX + NORM_DX, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: trunkX + FREE_DX, y: y + STEP * 2, height: 80 });
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

function loop(c, { trunkX, headerText, freetextText, snippetSubfolder, y }) {
  const lp = c.loop({ text: headerText, headerText, x: trunkX, y, height: 100 });
  const bNo = c.answer({ text: '', displayLabel: 'Нет', x: trunkX + LOOP_BODY_DX, y, height: 60 });
  const bSnip = c.snippetFolder({ subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel: 'Выберу готовый шаблон', x: trunkX + LOOP_BODY_DX, y: y + 120, height: 80 });
  const bFree = c.answer({ text: freetextText, displayLabel: 'Опишу вручную', x: trunkX + LOOP_BODY_DX, y: y + 240, height: 80 });
  c.edge({ from: lp, to: bNo, fromSide: 'right', toSide: 'left', label: 'Нет' });
  c.edge({ from: lp, to: bSnip, fromSide: 'right', toSide: 'left', label: 'Выберу готовый шаблон' });
  c.edge({ from: lp, to: bFree, fromSide: 'right', toSide: 'left', label: 'Опишу вручную' });
  c.edge({ from: bNo, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bSnip, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bFree, to: lp, fromSide: 'left', toSide: 'right' });
  return lp;
}

function converge(c, branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// === Start + Контраст fan-out ===
const start = c.start({ x: X_START, y: -500 });
const qContrast = c.question({ text: 'Контраст вводился?', x: X_START, y: -340 });
c.edge({ from: start, to: qContrast });

const aBolus = c.answer({
  text: 'МСКТ-исследование органов забрюшинного пространства выполнено по программе объемного сканирования с внутривенным болюсным контрастированием.',
  displayLabel: 'Да, болюсно', x: X_C, y: -180, height: 220,
});
const aManual = c.answer({
  text: 'МСКТ-исследование органов забрюшинного пространства выполнено по программе объемного сканирования с внутривенным контрастированием.',
  displayLabel: 'Да, вручную', x: X_C - 300, y: 80, height: 200,
});
const aNo = c.answer({
  text: 'МСКТ-исследование органов забрюшинного пространства выполнено по программе объемного сканирования с последующей мультипланарной реконструкцией.',
  displayLabel: 'Нет', x: X_NC, y: -180, height: 220,
});
c.edge({ from: qContrast, to: aBolus, label: 'Да, болюсно' });
c.edge({ from: qContrast, to: aManual, label: 'Да, вручную' });
c.edge({ from: qContrast, to: aNo, label: 'Нет' });

// Position text-block on contrast trunk only (per .md: line 5 of contrast template; absent in no-contrast)
const positionC = c.textBlock({ text: '\nИсследование произведено в положении пациента лежа на спине.', x: X_C, y: 320, height: 100 });
c.edge({ from: aBolus, to: positionC });
c.edge({ from: aManual, to: positionC });

// ============================================================
// CONTRAST TRUNK
// ============================================================
let yC = 480;

// НАДПОЧЕЧНИКИ section + loop
const adrenalC = section(c, {
  trunkX: X_C, headerText: 'НАДПОЧЕЧНИКИ:',
  normText: 'Расположены обычно, типичной инвертированной Y-образной формы, не увеличены. Контуры ровные, чёткие. Дополнительных образований и патологических фокусов накопления контрастного средства в обоих надпочечниках не выявлено. Окружающая жировая клетчатка не изменена.',
  normHeight: 220, sectionName: 'надпочечниками', y: yC,
});
c.edge({ from: positionC, to: adrenalC.header });
yC += STEP * 2 + 280;
const adrenalLoopC = loop(c, { trunkX: X_C, headerText: 'Есть образование надпочечника?', freetextText: '==опишу образование надпочечника==', snippetSubfolder: 'ОЗП', y: yC });
converge(c, adrenalC.branches, adrenalLoopC);
yC += 360;

// ПРАВАЯ ПОЧКА section + loop
const rightKidneyNormC = 'Положение, форма и размеры почки обычные, до ==размер правой почки мм== мм. Контуры ровные, чёткие. Паренхима не истончена. Структура почки однородная, без дополнительных патологических фокусов накопления контрастного средства. Чашечно-лоханочная система почки не расширена, не деформирована. В почке рентгенопозитивных конкрементов не выявлено. Околопочечная клетчатка не изменена/тяжиста. Функция почки не нарушена.';
const rkC = section(c, { trunkX: X_C, headerText: 'ПРАВАЯ ПОЧКА:', normText: rightKidneyNormC, normHeight: 320, sectionName: 'правой почкой', y: yC });
c.edge({ from: adrenalLoopC, to: rkC.header, label: '+Все указано, продолжаем' });
yC += STEP * 2 + 360;
const rkLoopC = loop(c, { trunkX: X_C, headerText: 'Есть образование/конкремент в правой почке?', freetextText: '==опишу изменение правой почки==', snippetSubfolder: 'ОЗП', y: yC });
converge(c, rkC.branches, rkLoopC);
yC += 360;

// ЛЕВАЯ ПОЧКА section + loop
const leftKidneyNormC = 'Положение, форма и размеры почки обычные, до ==размер левой почки мм== мм. Контуры ровные, чёткие. Паренхима не истончена. Структура почки однородная, без дополнительных патологических фокусов накопления контрастного средства. Чашечно-лоханочная система почки не расширена, не деформирована. В почке рентгенопозитивных конкрементов не выявлено. Околопочечная клетчатка не изменена/тяжиста. Функция почки не нарушена.';
const lkC = section(c, { trunkX: X_C, headerText: 'ЛЕВАЯ ПОЧКА:', normText: leftKidneyNormC, normHeight: 320, sectionName: 'левой почкой', y: yC });
c.edge({ from: rkLoopC, to: lkC.header, label: '+Все указано, продолжаем' });
yC += STEP * 2 + 360;
const lkLoopC = loop(c, { trunkX: X_C, headerText: 'Есть образование/конкремент в левой почке?', freetextText: '==опишу изменение левой почки==', snippetSubfolder: 'ОЗП', y: yC });
converge(c, lkC.branches, lkLoopC);
yC += 360;

// МОЧЕТОЧНИКИ
const ureterC = section(c, {
  trunkX: X_C, headerText: 'МОЧЕТОЧНИКИ:',
  normText: 'Прослеживаются на всем протяжении, не расширены, без патологического содержимого.',
  normHeight: 100, sectionName: 'мочеточниками', snippetSubfolder: 'ОЗП', y: yC,
});
c.edge({ from: lkLoopC, to: ureterC.header, label: '+Все указано, продолжаем' });
yC += STEP * 2 + 200;

// МОЧЕВОЙ ПУЗЫРЬ (contrast only)
const bladderC = section(c, {
  trunkX: X_C, headerText: 'МОЧЕВОЙ ПУЗЫРЬ:',
  normText: 'Обычного наполнения, с четкими ровными контурами, стенка не изменена; без патологического рентгенопозитивного содержимого; без патологических фокусов накопления контрастного средства.',
  normHeight: 220, sectionName: 'мочевым пузырём', snippetSubfolder: 'ОЗП', y: yC,
});
converge(c, ureterC.branches, bladderC.header);
yC += STEP * 2 + 280;

// СОСУДЫ (contrast only)
const sosudyC = section(c, {
  trunkX: X_C, headerText: 'СОСУДЫ:',
  normText: 'Визуализируются удовлетворительно, дефектов контрастирования не выявлено. Аорта в брюшном отделе не расширена. Стенка аорты не изменена.\nЖидкости в забрюшинном пространстве не выявлено.',
  normHeight: 220, sectionName: 'сосудами', snippetSubfolder: 'ОЗП', y: yC,
});
converge(c, bladderC.branches, sosudyC.header);
yC += STEP * 2 + 280;

// ЛИМФАТИЧЕСКИЕ УЗЛЫ
const lyC = section(c, {
  trunkX: X_C, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:',
  normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОЗП', y: yC,
});
converge(c, sosudyC.branches, lyC.header);
yC += STEP * 2 + 200;

// МЯГКИЕ ТКАНИ
const softC = section(c, {
  trunkX: X_C, headerText: 'МЯГКИЕ ТКАНИ:',
  normText: 'Без патологических изменений.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОЗП', y: yC,
});
converge(c, lyC.branches, softC.header);
yC += STEP * 2 + 200;

// КОСТНЫЕ СТРУКТУРЫ
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
let yNC = 480;

// (no position text-block — no-contrast .md doesn't have line 5)
// Direct edge: aNo → НАДПОЧЕЧНИКИ header (set up below)

// НАДПОЧЕЧНИКИ section + loop (no-contrast norm)
const adrenalNC = section(c, {
  trunkX: X_NC, headerText: 'НАДПОЧЕЧНИКИ:',
  normText: 'Расположены обычно, типичной инвертированной Y-образной формы, не увеличены. Контуры ровные, чёткие. Дополнительных образований в надпочечниках не выявлено. Окружающая жировая клетчатка не изменена.',
  normHeight: 200, sectionName: 'надпочечниками', y: yNC,
});
c.edge({ from: aNo, to: adrenalNC.header });
yNC += STEP * 2 + 260;
const adrenalLoopNC = loop(c, { trunkX: X_NC, headerText: 'Есть образование надпочечника?', freetextText: '==опишу образование надпочечника==', snippetSubfolder: 'ОЗП', y: yNC });
converge(c, adrenalNC.branches, adrenalLoopNC);
yNC += 360;

// ПРАВАЯ ПОЧКА section + loop (no-contrast norm)
const rightKidneyNormNC = 'Положение, форма и размеры почки обычные, до ==размер правой почки мм== мм. Контуры ровные, чёткие. Паренхима не истончена. Структура почки однородная. Чашечно-лоханочная система почки не расширена, не деформирована. В почке рентгенопозитивных конкрементов не выявлено. Околопочечная клетчатка не изменена/тяжиста.';
const rkNC = section(c, { trunkX: X_NC, headerText: 'ПРАВАЯ ПОЧКА:', normText: rightKidneyNormNC, normHeight: 280, sectionName: 'правой почкой', y: yNC });
c.edge({ from: adrenalLoopNC, to: rkNC.header, label: '+Все указано, продолжаем' });
yNC += STEP * 2 + 320;
const rkLoopNC = loop(c, { trunkX: X_NC, headerText: 'Есть образование/конкремент в правой почке?', freetextText: '==опишу изменение правой почки==', snippetSubfolder: 'ОЗП', y: yNC });
converge(c, rkNC.branches, rkLoopNC);
yNC += 360;

// ЛЕВАЯ ПОЧКА section + loop (no-contrast norm)
const leftKidneyNormNC = 'Положение, форма и размеры почки обычные, до ==размер левой почки мм== мм. Контуры ровные, чёткие. Паренхима не истончена. Структура почки однородная. Чашечно-лоханочная система почки не расширена, не деформирована. В почке рентгенопозитивных конкрементов не выявлено. Околопочечная клетчатка не изменена/тяжиста.';
const lkNC = section(c, { trunkX: X_NC, headerText: 'ЛЕВАЯ ПОЧКА:', normText: leftKidneyNormNC, normHeight: 280, sectionName: 'левой почкой', y: yNC });
c.edge({ from: rkLoopNC, to: lkNC.header, label: '+Все указано, продолжаем' });
yNC += STEP * 2 + 320;
const lkLoopNC = loop(c, { trunkX: X_NC, headerText: 'Есть образование/конкремент в левой почке?', freetextText: '==опишу изменение левой почки==', snippetSubfolder: 'ОЗП', y: yNC });
converge(c, lkNC.branches, lkLoopNC);
yNC += 360;

// МОЧЕТОЧНИКИ (no-contrast text)
const ureterNC = section(c, {
  trunkX: X_NC, headerText: 'МОЧЕТОЧНИКИ:',
  normText: 'На видимом уровне без нарушения просвета, без патологического содержимого.',
  normHeight: 100, sectionName: 'мочеточниками', snippetSubfolder: 'ОЗП', y: yNC,
});
c.edge({ from: lkLoopNC, to: ureterNC.header, label: '+Все указано, продолжаем' });
yNC += STEP * 2 + 200;

// (no-contrast only) "Жидкости в забрюшинном..." linear text-block
const fluidNC = c.textBlock({
  text: '\nЖидкости в забрюшинном пространстве не выявлено.',
  x: X_NC, y: yNC, height: 100,
});
converge(c, ureterNC.branches, fluidNC);
yNC += 180;

// ЛИМФАТИЧЕСКИЕ УЗЛЫ (no-contrast)
const lyNC = section(c, {
  trunkX: X_NC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:',
  normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОЗП', y: yNC,
});
c.edge({ from: fluidNC, to: lyNC.header });
yNC += STEP * 2 + 200;

// МЯГКИЕ ТКАНИ (no-contrast)
const softNC = section(c, {
  trunkX: X_NC, headerText: 'МЯГКИЕ ТКАНИ:',
  normText: 'Без патологических изменений.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОЗП', y: yNC,
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
  text: '\n## Заключение\nРКТ-признаков патологических изменений органов забрюшинного пространства не выявлено.\n\n## Рекомендации\nКонсультация направившего специалиста.',
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
    'НАДПОЧЕЧНИКИ:', 'ПРАВАЯ ПОЧКА:', 'ЛЕВАЯ ПОЧКА:', 'МОЧЕТОЧНИКИ:',
    'МОЧЕВОЙ ПУЗЫРЬ:', 'СОСУДЫ:',
    'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', 'МЯГКИЕ ТКАНИ:', 'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаков патологических изменений органов забрюшинного пространства не выявлено.',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОЗП 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОЗП 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
