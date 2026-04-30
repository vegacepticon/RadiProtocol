// Build ОМТ full 1.0.0.canvas per 72-04-PLAN.md.
// Four parallel trunks (sex × contrast = 4 leaves per D-26):
//   Жен-Нет, Жен-Да, Муж-Нет, Муж-Да.
// Bolus-contrast and manual-contrast collapse into a single contrast-yes trunk per gender.
// 4 organ-discovery loops total (МАТКА + ЯИЧНИКИ × 2 жен trunks per D-09).

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from './canvas-builder.mjs';

const c = new Canvas('4'); // ОМТ → prefix '4'

const X_FNC = -3000;
const X_FC = -1000;
const X_MNC = 1000;
const X_MC = 3000;
const NORM_DX = -340;
const FREE_DX = 340;
const SNIP_DX = 720;
const LOOP_BODY_DX = 600;
const STEP = 160;

function section(c, { trunkX, headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
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
  const bSnip = c.snippetFolder({ subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel: 'Выберу шаблон', x: trunkX + LOOP_BODY_DX, y: y + 120, height: 80 });
  const bFree = c.answer({ text: freetextText, displayLabel: 'Опишу вручную', x: trunkX + LOOP_BODY_DX, y: y + 240, height: 80 });
  c.edge({ from: lp, to: bNo, fromSide: 'right', toSide: 'left', label: 'Нет' });
  c.edge({ from: lp, to: bSnip, fromSide: 'right', toSide: 'left', label: 'Выберу шаблон' });
  c.edge({ from: lp, to: bFree, fromSide: 'right', toSide: 'left', label: 'Опишу вручную' });
  c.edge({ from: bNo, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bSnip, to: lp, fromSide: 'left', toSide: 'right' });
  c.edge({ from: bFree, to: lp, fromSide: 'left', toSide: 'right' });
  return lp;
}

function converge(c, branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// ============================================================
// Pre-trunks: start, sex question, contrast questions per gender
// ============================================================
const start = c.start({ x: 0, y: -800 });
const qSex = c.question({ text: 'Пол пациента?', x: 0, y: -640 });
c.edge({ from: start, to: qSex });

const aFem = c.answer({ text: '', displayLabel: 'Жен', x: -2000, y: -480 });
const aMale = c.answer({ text: '', displayLabel: 'Муж', x: 2000, y: -480 });
c.edge({ from: qSex, to: aFem, label: 'Жен' });
c.edge({ from: qSex, to: aMale, label: 'Муж' });

// Per-gender Контраст question
const qContrastF = c.question({ text: 'Контраст вводился?', x: -2000, y: -340 });
c.edge({ from: aFem, to: qContrastF });
const qContrastM = c.question({ text: 'Контраст вводился?', x: 2000, y: -340 });
c.edge({ from: aMale, to: qContrastM });

// 6 contrast-disposition answers (3 per gender), each carrying its own procedure description
const aFBolus = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по программе объемного сканирования с внутривенным болюсным контрастированием.',
  displayLabel: 'Да, болюсно', x: X_FC, y: -180, height: 220,
});
const aFManual = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по программе объемного сканирования с внутривенным контрастированием.',
  displayLabel: 'Да, вручную', x: X_FC + 320, y: 60, height: 200,
});
const aFNo = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по программе объемного сканирования без внутривенного контрастирования.',
  displayLabel: 'Нет', x: X_FNC, y: -180, height: 220,
});
c.edge({ from: qContrastF, to: aFBolus, label: 'Да, болюсно' });
c.edge({ from: qContrastF, to: aFManual, label: 'Да, вручную' });
c.edge({ from: qContrastF, to: aFNo, label: 'Нет' });

const aMBolus = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по стандартному протоколу сканирования с внутривенным болюсным контрастированием.',
  displayLabel: 'Да, болюсно', x: X_MC, y: -180, height: 220,
});
const aMManual = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по стандартному протоколу сканирования с внутривенным контрастированием.',
  displayLabel: 'Да, вручную', x: X_MC + 320, y: 60, height: 200,
});
const aMNo = c.answer({
  text: 'МСКТ-исследование органов малого таза выполнено по программе объемного сканирования без введения контрастного препарата.',
  displayLabel: 'Нет', x: X_MNC, y: -180, height: 220,
});
c.edge({ from: qContrastM, to: aMBolus, label: 'Да, болюсно' });
c.edge({ from: qContrastM, to: aMManual, label: 'Да, вручную' });
c.edge({ from: qContrastM, to: aMNo, label: 'Нет' });

// ============================================================
// FEM-NO-CONTRAST trunk (X_FNC)
// ============================================================
let yFNC = 380;
const fnc_mp = section(c, {
  trunkX: X_FNC, headerText: 'МОЧЕВОЙ ПУЗЫРЬ:',
  normText: 'Хорошо наполнен, не деформирован. Стенки его не утолщены. Устья мочеточников без особенностей.\nСодержимое однородное жидкостное.\nТазовые сегменты мочеточников не расширены.',
  normHeight: 220, sectionName: 'мочевым пузырём', snippetSubfolder: 'ОМТ', y: yFNC,
});
c.edge({ from: aFNo, to: fnc_mp.header });
yFNC += STEP * 2 + 280;

const fnc_uterus = section(c, {
  trunkX: X_FNC, headerText: 'МАТКА:',
  normText: 'В положении anteflexio/retroflexio, не смещена, размеры тела матки ==размер матки мм== мм, контуры четкие, ровные.\nПлотность не изменена. Полость матки не расширена. Шейка матки не деформирована, плотность не изменена.',
  normHeight: 200, sectionName: 'маткой', y: yFNC,
});
converge(c, fnc_mp.branches, fnc_uterus.header);
yFNC += STEP * 2 + 260;
const fnc_uterusLoop = loop(c, { trunkX: X_FNC, headerText: 'Есть миома или другие изменения матки?', freetextText: '==опишу изменение матки==', snippetSubfolder: 'ОМТ', y: yFNC });
converge(c, fnc_uterus.branches, fnc_uterusLoop);
yFNC += 360;

const fnc_ovary = section(c, {
  trunkX: X_FNC, headerText: 'ЯИЧНИКИ:',
  normText: 'В типичном месте на фоне петель кишечника не визуализируются.\nПравый яичник размерами ==размер правого яичника мм== мм, контуры четкие, ровные, плотность не изменена.\nЛевый яичник размерами ==размер левого яичника мм== мм, контуры четкие, ровные, плотность не изменена.',
  normHeight: 220, sectionName: 'яичниками', y: yFNC,
});
c.edge({ from: fnc_uterusLoop, to: fnc_ovary.header, label: '+Все указано, продолжаем' });
yFNC += STEP * 2 + 280;
const fnc_ovaryLoop = loop(c, { trunkX: X_FNC, headerText: 'Есть киста или другое образование яичника?', freetextText: '==опишу изменение яичника==', snippetSubfolder: 'ОМТ', y: yFNC });
converge(c, fnc_ovary.branches, fnc_ovaryLoop);
yFNC += 360;

const fnc_gut = section(c, {
  trunkX: X_FNC, headerText: 'КИШЕЧНИК:',
  normText: 'Прямая кишка обычного диаметра и просвета, стенка не утолщена. Сигмовидная кишка не удлинена, стенка не утолщена.\n\nПараректальная клетчатка обычной плотности.\nСедалищно-прямокишечная ямка симметрична с обеих сторон, без патологических включений.\nТазовая брюшина не утолщена.\nСкопления жидкости не выявлены.',
  normHeight: 320, sectionName: 'кишечником', snippetSubfolder: 'ОМТ', y: yFNC,
});
c.edge({ from: fnc_ovaryLoop, to: fnc_gut.header, label: '+Все указано, продолжаем' });
yFNC += STEP * 2 + 380;

const fnc_lu = section(c, {
  trunkX: X_FNC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОМТ', y: yFNC,
});
converge(c, fnc_gut.branches, fnc_lu.header);
yFNC += STEP * 2 + 200;

const fnc_soft = section(c, {
  trunkX: X_FNC, headerText: 'МЯГКИЕ ТКАНИ:', normText: 'Не изменены.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОМТ', y: yFNC,
});
converge(c, fnc_lu.branches, fnc_soft.header);
yFNC += STEP * 2 + 200;

const fnc_bones = section(c, {
  trunkX: X_FNC, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-травматических и костно-деструктивных изменений не выявлено.',
  normHeight: 100, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yFNC,
});
converge(c, fnc_soft.branches, fnc_bones.header);
yFNC += STEP * 2 + 200;

// ============================================================
// FEM-CONTRAST trunk (X_FC)
// ============================================================
let yFC = 380;
const fc_mp = section(c, {
  trunkX: X_FC, headerText: 'МОЧЕВОЙ ПУЗЫРЬ:',
  normText: 'Хорошо наполнен, не деформирован. Стенки его не утолщены, без патологического накопления контрастного препарата. Содержимое однородное жидкостное. Устья мочеточников без особенностей.\nТазовые сегменты мочеточников не расширены.',
  normHeight: 240, sectionName: 'мочевым пузырём', snippetSubfolder: 'ОМТ', y: yFC,
});
c.edge({ from: aFBolus, to: fc_mp.header });
c.edge({ from: aFManual, to: fc_mp.header });
yFC += STEP * 2 + 300;

const fc_uterus = section(c, {
  trunkX: X_FC, headerText: 'МАТКА:',
  normText: 'В положении anteflexio/retroflexio, не смещена, размеры тела матки ==размер матки мм== мм, контуры четкие, ровные. Плотность не изменена, без участков патологического накопления контрастного препарата. Полость матки не расширена. Шейка матки не деформирована, плотность не изменена.',
  normHeight: 240, sectionName: 'маткой', y: yFC,
});
converge(c, fc_mp.branches, fc_uterus.header);
yFC += STEP * 2 + 300;
const fc_uterusLoop = loop(c, { trunkX: X_FC, headerText: 'Есть миома или другие изменения матки?', freetextText: '==опишу изменение матки==', snippetSubfolder: 'ОМТ', y: yFC });
converge(c, fc_uterus.branches, fc_uterusLoop);
yFC += 360;

const fc_ovary = section(c, {
  trunkX: X_FC, headerText: 'ЯИЧНИКИ:',
  normText: 'В типичном месте на фоне петель кишечника не визуализируются.\nПравый яичник размерами ==размер правого яичника мм== мм, контуры четкие, ровные, плотность не изменена.\nЛевый яичник размерами ==размер левого яичника мм== мм, контуры четкие, ровные, плотность не изменена.',
  normHeight: 220, sectionName: 'яичниками', y: yFC,
});
c.edge({ from: fc_uterusLoop, to: fc_ovary.header, label: '+Все указано, продолжаем' });
yFC += STEP * 2 + 280;
const fc_ovaryLoop = loop(c, { trunkX: X_FC, headerText: 'Есть киста или другое образование яичника?', freetextText: '==опишу изменение яичника==', snippetSubfolder: 'ОМТ', y: yFC });
converge(c, fc_ovary.branches, fc_ovaryLoop);
yFC += 360;

const fc_gut = section(c, {
  trunkX: X_FC, headerText: 'КИШЕЧНИК:',
  normText: 'Прямая кишка обычного диаметра и просвета, стенка не утолщена, без патологического накопления контрастного препарата. Сигмовидная кишка не удлинена, стенка не утолщена, без патологического накопления контрастного препарата.\nПараректальная клетчатка обычной плотности.\nСедалищно-прямокишечная ямка симметрична с обеих сторон, без патологических включений.\nТазовая брюшина не утолщена.\nСкопления жидкости не выявлены.',
  normHeight: 360, sectionName: 'кишечником', snippetSubfolder: 'ОМТ', y: yFC,
});
c.edge({ from: fc_ovaryLoop, to: fc_gut.header, label: '+Все указано, продолжаем' });
yFC += STEP * 2 + 420;

const fc_sosudy = section(c, {
  trunkX: X_FC, headerText: 'СОСУДЫ:', normText: 'Контрастированы удовлетворительно, без дефектов.',
  normHeight: 80, sectionName: 'сосудами', snippetSubfolder: 'ОМТ', y: yFC,
});
converge(c, fc_gut.branches, fc_sosudy.header);
yFC += STEP * 2 + 200;

const fc_lu = section(c, {
  trunkX: X_FC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОМТ', y: yFC,
});
converge(c, fc_sosudy.branches, fc_lu.header);
yFC += STEP * 2 + 200;

const fc_soft = section(c, {
  trunkX: X_FC, headerText: 'МЯГКИЕ ТКАНИ:', normText: 'Не изменены.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОМТ', y: yFC,
});
converge(c, fc_lu.branches, fc_soft.header);
yFC += STEP * 2 + 200;

const fc_inguinal = c.textBlock({
  text: '\nПаховые каналы не расширены.',
  x: X_FC, y: yFC, height: 80,
});
converge(c, fc_soft.branches, fc_inguinal);
yFC += 160;

const fc_bones = section(c, {
  trunkX: X_FC, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-травматических и костно-деструктивных изменений не выявлено.',
  normHeight: 100, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yFC,
});
c.edge({ from: fc_inguinal, to: fc_bones.header });
yFC += STEP * 2 + 200;

// ============================================================
// MUZH-NO-CONTRAST trunk (X_MNC)
// ============================================================
let yMNC = 380;
const mnc_mp = section(c, {
  trunkX: X_MNC, headerText: 'МОЧЕВОЙ ПУЗЫРЬ:',
  normText: 'Достаточно наполнен, не деформирован. Стенки его не утолщены. Содержимое однородное жидкостное. Устья мочеточников без особенностей.\nТазовые сегменты мочеточников не расширены.',
  normHeight: 220, sectionName: 'мочевым пузырём', snippetSubfolder: 'ОМТ', y: yMNC,
});
c.edge({ from: aMNo, to: mnc_mp.header });
yMNC += STEP * 2 + 280;

const mnc_prost = section(c, {
  trunkX: X_MNC, headerText: 'ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА:',
  normText: 'Не увеличена, размерами ==размер простаты мм== мм. Контуры ее ровные и четкие. Структура однородная.',
  normHeight: 140, sectionName: 'простатой', snippetSubfolder: 'ОМТ', y: yMNC,
});
converge(c, mnc_mp.branches, mnc_prost.header);
yMNC += STEP * 2 + 220;

const mnc_sem = section(c, {
  trunkX: X_MNC, headerText: 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
  normText: 'Нормальных размеров, симметричны. Угол между мочевым пузырем и семенными пузырьками четко выражен.',
  normHeight: 140, sectionName: 'семенными пузырьками', snippetSubfolder: 'ОМТ', y: yMNC,
});
converge(c, mnc_prost.branches, mnc_sem.header);
yMNC += STEP * 2 + 220;

const mnc_gut = section(c, {
  trunkX: X_MNC, headerText: 'КИШЕЧНИК:',
  normText: 'Прямая кишка обычного диаметра и просвета, стенка не утолщена. Сигмовидная кишка не удлинена, стенка не утолщена.\nПараректальная клетчатка обычной плотности.\nСедалищно-прямокишечная ямка симметрична с обеих сторон, без патологических включений.\nТазовая брюшина не утолщена.\nСкопления жидкости не выявлены.',
  normHeight: 280, sectionName: 'кишечником', snippetSubfolder: 'ОМТ', y: yMNC,
});
converge(c, mnc_sem.branches, mnc_gut.header);
yMNC += STEP * 2 + 340;

const mnc_lu = section(c, {
  trunkX: X_MNC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОМТ', y: yMNC,
});
converge(c, mnc_gut.branches, mnc_lu.header);
yMNC += STEP * 2 + 200;

const mnc_soft = section(c, {
  trunkX: X_MNC, headerText: 'МЯГКИЕ ТКАНИ:', normText: 'Не изменены.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОМТ', y: yMNC,
});
converge(c, mnc_lu.branches, mnc_soft.header);
yMNC += STEP * 2 + 200;

const mnc_inguinal = c.textBlock({
  text: '\nПаховые каналы не расширены.',
  x: X_MNC, y: yMNC, height: 80,
});
converge(c, mnc_soft.branches, mnc_inguinal);
yMNC += 160;

const mnc_bones = section(c, {
  trunkX: X_MNC, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-травматических и костно-деструктивных изменений не выявлено.',
  normHeight: 100, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yMNC,
});
c.edge({ from: mnc_inguinal, to: mnc_bones.header });
yMNC += STEP * 2 + 200;

// ============================================================
// MUZH-CONTRAST trunk (X_MC)
// ============================================================
let yMC = 380;
const mc_mp = section(c, {
  trunkX: X_MC, headerText: 'МОЧЕВОЙ ПУЗЫРЬ:',
  normText: 'Достаточно наполнен, не деформирован. Стенки его не утолщены, без патологического накопления контрастного препарата. Содержимое однородное жидкостное. Устья мочеточников без особенностей.\nТазовые сегменты мочеточников не расширены.',
  normHeight: 240, sectionName: 'мочевым пузырём', snippetSubfolder: 'ОМТ', y: yMC,
});
c.edge({ from: aMBolus, to: mc_mp.header });
c.edge({ from: aMManual, to: mc_mp.header });
yMC += STEP * 2 + 300;

const mc_prost = section(c, {
  trunkX: X_MC, headerText: 'ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА:',
  normText: 'Не увеличена, размерами ==размер простаты мм== мм. Контуры ее ровные и четкие. Структура однородная.',
  normHeight: 140, sectionName: 'простатой', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_mp.branches, mc_prost.header);
yMC += STEP * 2 + 220;

const mc_sem = section(c, {
  trunkX: X_MC, headerText: 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
  normText: 'Нормальных размеров, симметричны. Угол между мочевым пузырем и семенными пузырьками четко выражен.',
  normHeight: 140, sectionName: 'семенными пузырьками', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_prost.branches, mc_sem.header);
yMC += STEP * 2 + 220;

const mc_gut = section(c, {
  trunkX: X_MC, headerText: 'КИШЕЧНИК:',
  normText: 'Прямая кишка обычного диаметра и просвета, стенка не утолщена. Сигмовидная кишка не удлинена, стенка не утолщена.\nПараректальная клетчатка обычной плотности.\nСедалищно-прямокишечная ямка симметрична с обеих сторон, без патологических включений.\nТазовая брюшина не утолщена.\nСкопления жидкости не выявлены.',
  normHeight: 280, sectionName: 'кишечником', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_sem.branches, mc_gut.header);
yMC += STEP * 2 + 340;

const mc_sosudy = section(c, {
  trunkX: X_MC, headerText: 'СОСУДЫ:', normText: 'Контрастированы удовлетворительно, без дефектов.',
  normHeight: 80, sectionName: 'сосудами', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_gut.branches, mc_sosudy.header);
yMC += STEP * 2 + 200;

const mc_lu = section(c, {
  trunkX: X_MC, headerText: 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', normText: 'Не увеличены.',
  sectionName: 'лимфоузлами', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_sosudy.branches, mc_lu.header);
yMC += STEP * 2 + 200;

const mc_soft = section(c, {
  trunkX: X_MC, headerText: 'МЯГКИЕ ТКАНИ:', normText: 'Не изменены.',
  sectionName: 'мягкими тканями', snippetSubfolder: 'ОМТ', y: yMC,
});
converge(c, mc_lu.branches, mc_soft.header);
yMC += STEP * 2 + 200;

const mc_inguinal = c.textBlock({
  text: '\nПаховые каналы не расширены.',
  x: X_MC, y: yMC, height: 80,
});
converge(c, mc_soft.branches, mc_inguinal);
yMC += 160;

const mc_bones = section(c, {
  trunkX: X_MC, headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-травматических и костно-деструктивных изменений не выявлено.',
  normHeight: 100, sectionName: 'костями', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y: yMC,
});
c.edge({ from: mc_inguinal, to: mc_bones.header });
yMC += STEP * 2 + 200;

// ============================================================
// Terminal — all 4 trunks converge (Заключение normalized per RESEARCH §4 recommendation)
// ============================================================
const yTerm = Math.max(yFNC, yFC, yMNC, yMC) + 200;
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаков патологических изменений органов малого таза не выявлено.\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: 0, y: yTerm, height: 240,
});
converge(c, fnc_bones.branches, terminal);
converge(c, fc_bones.branches, terminal);
converge(c, mnc_bones.branches, terminal);
converge(c, mc_bones.branches, terminal);

// ============================================================
// Verify + write
// ============================================================
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'МОЧЕВОЙ ПУЗЫРЬ:', 'МАТКА:', 'ЯИЧНИКИ:',
    'ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА:', 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
    'КИШЕЧНИК:', 'СОСУДЫ:', 'ЛИМФАТИЧЕСКИЕ УЗЛЫ:', 'МЯГКИЕ ТКАНИ:', 'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаков патологических изменений органов малого таза не выявлено.',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОМТ full 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ full 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
