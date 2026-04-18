# Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `43-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 43-unified-loop-graph-model-parser-validator-migration-errors
**Areas discussed:** Migration error (detect + text), LoopNode + LoopContext fields, Validator «выход» + cycle detection, Broken-code scope in Phase 43

---

## Migration error — detect + text

### Q1: Где детектим legacy 'loop-start'/'loop-end' и производим MIGRATE-01 error?

| Option | Description | Selected |
|---|---|---|
| В validator | Parser продолжает распознавать loop-start/loop-end как legacy-варианты; validator выдаёт migration-error. Совместимо с RunnerView error-panel без изменений. | ✓ |
| В parser (specific parseError) | Parser возвращает parseError → ParseResult success:false → граф не строится → другие ошибки канваса пользователь не увидит. | |
| Оба слоя | Максимум покрытия, но усложняет downstream. | |

**User's choice:** В validator (recommended)

### Q2: На каком языке выдавать migration-error?

| Option | Description | Selected |
|---|---|---|
| По-русски | UI-метка «выход» уже русская, авторы плагина (радиологи) русскоязычные. | ✓ |
| English | Стиль 1-в-1 с остальными GraphValidator-ошибками. | |
| Двуязычный (RU + EN) | Две строки — удобно при community-релизе, но зашумляет. | |

**User's choice:** По-русски (recommended)

### Q3: Гранулярность migration-ошибки: одна на канвас или по одной на узел?

| Option | Description | Selected |
|---|---|---|
| Одна на канвас | Сводная строка с перечислением всех legacy-узлов. | ✓ |
| По одной на узел | Стиль Check 6 (orphaned loop-end). Может завалить panel. | |

**User's choice:** Одна на канвас (recommended)

### Q4: Должен ли текст ошибки называть конкретные узлы или только общий тип?

| Option | Description | Selected |
|---|---|---|
| Да, с ID/label узлов | Через nodeLabel() pattern: loopLabel если есть, иначе ID. | ✓ |
| Только общий текст | «Канвас использует устаревшие loop-start/loop-end. Пересоберите цикл.» Проще, но автор сам ищет узлы. | |

**User's choice:** Да, с ID/label узлов (recommended)

---

## LoopNode + LoopContext fields

### Q1: Состав полей LoopNode в graph-model.ts?

| Option | Description | Selected |
|---|---|---|
| Минимум: kind + headerText | `kind: 'loop'` + `headerText: string`. exitLabel не нужен — метка «выход» на ребре. loopLabel не нужен — в едином picker'е автор показывает выбор под headerText. maxIterations удалён. | ✓ |
| + legacy loopLabel/exitLabel | Дополнительные поля на всякий случай для Phase 44 picker UX. YAGNI. | |
| + canvas node.text как fallback для headerText | Fallback на raw.text симметрично question/answer/text-block. | |

**User's choice:** Минимум: kind + headerText (recommended)

### Q2: `LoopContext.loopStartId` — как называется теперь?

| Option | Description | Selected |
|---|---|---|
| loopNodeId | Чёткий rename: в модели больше нет loop-start. | ✓ |
| Оставить loopStartId | Терминологически путает, но сохраняет PersistedSession-формат. | |

**User's choice:** loopNodeId (recommended)

### Q3: Нормализация пустого/whitespace `headerText` на стадии парсинга?

| Option | Description | Selected |
|---|---|---|
| string всегда, '' если нет | Симметрия с questionText / text-block.content. | ✓ |
| string \| undefined | Паттерн SnippetNode.snippetLabel. Разрывает симметрию. | |
| string с trim | Убирает мусор, но нет аналога в других узлах. | |

**User's choice:** string всегда, '' если нет (recommended)

### Q4: PersistedSession (session-model.ts) — обратная совместимость сессий?

| Option | Description | Selected |
|---|---|---|
| Break-compat: отбрасываем старые сессии | validateSessionNodeIds gracefully отбрасывает session с loopStartId-полем. Canvas-сессия уже сломана (canvas фейлит validator). | ✓ |
| Поддерживать оба поля при load | session-service распознаёт loopStartId → бусит loopNodeId. Долг в коде. | |

**User's choice:** Break-compat: отбрасываем старые сессии (recommended)

---

## Validator «выход» + cycle detection

### Q1: Как валидатор опознаёт «выход»-метку на ребре?

| Option | Description | Selected |
|---|---|---|
| exact match «выход» | `edge.label === 'выход'`. Часть контракта — автор пишет ровно «выход». | ✓ |
| trim + exact case | Спасает от случайных пробелов. | |
| trim + case-insensitive | Наиболее терпимый; но label — осознанный ввод автора. | |

**User's choice:** exact match «выход» (recommended)

### Q2: Несколько рёбер с меткой «выход» из одного loop — как обрабатываем?

| Option | Description | Selected |
|---|---|---|
| Ошибка | LOOP-04: «exactly one outgoing edge labelled «выход»». 2+ — явная ошибка автора. | ✓ |
| Безмолвно берём первое | Тихая толерантность; пользователь не поймёт почему одна ветвь не работает. | |

**User's choice:** Ошибка (recommended)

### Q3: loop имеет «выход»-ребро, но 0 body-ветвей — ошибка?

| Option | Description | Selected |
|---|---|---|
| Да, ошибка | LOOP-04 требует body + «выход». Loop без body ≡ passthrough — бессмысленный. | ✓ |
| Проходной законен, ошибки нет | Противоречит LOOP-04. | |

**User's choice:** Да, ошибка (recommended)

### Q4: `detectUnintentionalCycles` — чем помечаем намеренный цикл теперь?

| Option | Description | Selected |
|---|---|---|
| Цикл через kind==='loop' | Симметрия со старой loop-end логикой. Правило: «cycles must pass through a loop node». | ✓ |
| Любое ребро со «выход» не в цикле | Более semantic, но сложнее и пересекается с LOOP-04. | |
| Убрать cycle-detection для loops совсем | Pure-negative: если цикл не через loop — пропустим. Не recommend. | |

**User's choice:** Цикл через kind==='loop' (recommended)

---

## Broken-code scope in Phase 43

### Q1: Стратегия: `RPNodeKind` union и runner в Phase 43?

| Option | Description | Selected |
|---|---|---|
| Удалить loop-start/loop-end, runner-stub | `RPNodeKind` теряет loop-start/loop-end, получает 'loop'. В advanceThrough()` для `case 'loop':` throw stub Phase 44. Старые loop-тесты → it.skip. | ✓ |
| Держать оба set'а типов параллельно | RPNodeKind добавляет 'loop' БЕЗ удаления loop-start/loop-end. 0 касаний runner'а в 43, но мёртвые типы переедут в 44. | |
| Полный runner support loop в 43 | Противоречит цели фазы. | |

**User's choice:** Удалить loop-start/loop-end, runner-stub (recommended)

### Q2: NODE_COLOR_MAP — когда заводим 'цвет для loop'?

| Option | Description | Selected |
|---|---|---|
| В Phase 43 | `Record<RPNodeKind, string>` форсит. 'loop': '1' (red). loop-start/loop-end удаляются. | ✓ |
| Отложить в Phase 45 | Не работает без «держать оба set'а». | |

**User's choice:** В Phase 43 (recommended)

### Q3: `settings.ts` поле `maxLoopIterations` + UI-toggle — удаляем когда?

| Option | Description | Selected |
|---|---|---|
| В Phase 44 (где RUN-07) | `LoopStartNode.maxIterations` исчезает автоматически в 43. Глобальная настройка + её use-site в runner — runtime-поведение → Phase 44. | ✓ |
| В Phase 43 | С runner-stub'ом settings.maxLoopIterations становится dead-конфигом — правильно удалить, но разрывает грань RUN-07. | |

**User's choice:** В Phase 44 (где RUN-07 recommended)

### Q4: Старые loop фикстуры и юнит-тесты?

| Option | Description | Selected |
|---|---|---|
| Legacy-канвасы сохранить как migration-кейсы + новые unified фикстуры | Сохранить loop-start.canvas/loop-body.canvas для MIGRATE-01 теста; создать unified-loop-* для LOOP-01..04. Runner-тесты → it.skip с TODO. | ✓ |
| Удалить legacy-fixtures, новые + migration-тест генерится программно | Физические файлы удаляем; migration-тест строит вход инлайн. | |
| Удалить все старые fixtures и тесты сразу | Потеря тестового покрытия на время Phase 43. | |

**User's choice:** Legacy-канвасы сохранить как migration-кейсы + новые unified фикстуры (recommended)

---

## Claude's Discretion (переносим в CONTEXT.md)

- Точная формулировка migration-error и LOOP-04 строк (при сохранении обязательных элементов)
- Порядок Check'ов в `validate()` (с условием: migration-check идёт перед LOOP-04)
- Имена новых fixture-файлов в kebab-case
- Реализация stub-throw (явный throw vs assertNever)
- Имя placeholder-типа для legacy loop-start/loop-end при парсинге

## Deferred Ideas

- Phase 44: runtime unified loop + удаление settings.maxLoopIterations
- Phase 45: Node Editor form + NodePickerModal entry для loop
- Phase 46: free-text-input excision
- Post-v1.7: i18n validator-ошибок (разнотон RU/EN)
