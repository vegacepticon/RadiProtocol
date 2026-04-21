# Phase 57: REQUIREMENTS Traceability Refresh - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 57-requirements-traceability-refresh
**Areas discussed:** INLINE wording style, Plan decomposition, EDGE-01 annotation + coverage summary
**Language:** Russian (per user memory `feedback_language`)

---

## INLINE wording style

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim из Phase 54 SC + Source/Signal | Каждый INLINE-0N — дословно текст соответствующего Success Criterion из ROADMAP §Phase 54 (строки 365–369), плюс Source и Signal блоки как у других REQ-ID. SC §Phase 57 прямо требует «mapped verbatim». | ✓ |
| Paraphrase в формате других REQ | Переписать в компактном REQUIREMENTS-стиле (как RUNFIX-01). Теоретически читабельнее, но нарушает SC-1 фразу «mapped verbatim». | |
| Гибрид: дословный SC как Signal | Каждый INLINE: короткий paraphrase-headline + дословный SC в «Signal:». Технически «verbatim» присутствует, но сложнее поддерживать. | |

**User's choice:** Verbatim из Phase 54 SC + Source/Signal (Recommended)
**Notes:** Matches Phase 57 SC-1 explicit requirement. Also avoids paraphrase-drift risk for auditability.

---

## Plan decomposition

| Option | Description | Selected |
|--------|-------------|----------|
| Один plan — atomic REQUIREMENTS commit | 57-01: все изменения REQUIREMENTS.md в одном commit — INLINE секция, 11 checkbox flips, traceability table, EDGE-01 annotation. Phase 57 общая SC-5 прямо говорит «single rewrite+rollup commit». | ✓ |
| Два plans: INLINE promotion + checkbox flips | 57-01 — создать INLINE-01..05 секцию + traceability rows. 57-02 — флипнуть 11 старых checkbox + EDGE-01 annotation. Затрудняет atomic property но упрощает review. | |
| Три plans: INLINE + flips + table refresh | Все три блока раздельные. Самый гранулярный, но overkill — все три блока редактируют один и тот же файл. | |

**User's choice:** Один plan — atomic REQUIREMENTS commit (Recommended)
**Notes:** Satisfies SC-5 atomicity requirement directly. Same-file conflict risk on multi-plan split outweighs review granularity gain.

---

## EDGE-01 annotation + coverage summary

| Option | Description | Selected |
|--------|-------------|----------|
| Оставить EDGE-01 как есть, добавить summary вверху | EDGE-01 traceability row и body уже проаннотированы (lines 55, 145) — достаточно. Phase 57 SC-3 просит clarify, не переписывать. Добавить краткий «Coverage:» summary вверху как требует SC-4. | ✓ |
| Удалить EDGE-01 checkbox в traceability | Флипнуть EDGE-01 row на — (dash) или «⚠ historical only» без ✓. Убирает double-checkbox confusion, но противоречит «EDGE-01 closure стает валидным historical milestone» в REQUIREMENTS line 55. | |
| Coverage summary пропустить | Phase 57 SC-4 написан через «if present» — возможно не обязателен. Но без summary непонятно куда смотреть после флипа. | |

**User's choice:** Оставить EDGE-01 как есть, добавить summary вверху (Recommended)
**Notes:** Existing annotations at lines 55 + 145 are accurate. Adding a short Coverage Summary block at file top satisfies SC-4 without restructuring EDGE-01 semantics.

---

## Claude's Discretion

- Exact phrasing of the Coverage Summary block (length, bullet vs. table).
- Positional placement of INLINE section within REQUIREMENTS.md (after RUNNER, before BRAT — chronological phase order).
- Whether completion-date annotations use "Phase X Plan NN (YYYY-MM-DD)" or shorter "Phase X (YYYY-MM-DD)" — standardize on shorter form for the 11 flips.

## Deferred Ideas

- Phase 56 dedicated REQ-ID (PICKER-01R) — rejected per D-09 / audit line 145.
- Restructuring EDGE-01 / EDGE-03 into a single `EDGE` contract row — out of Phase 57 scope.
- Auto-derived coverage counts via script — future milestone hygiene, not Phase 57.
