# Phase 77-08 Summary

## Изменения

- `src/views/inline-runner-modal.ts`:
  - в `applyPosition` оставлены без изменений template-literal assignments:
    - `style.left = `${Math.round(...)}px``
    - `style.top = `${Math.round(...)}px``
  - 4 literal clear assignments (`right`, `bottom`, `maxWidth`, `transform`) заменены на:
    ```ts
    this.containerEl.toggleClass('rp-inline-runner-applied-position', true);
    ```
  - в `applyLayout` удалён дополнительный `style.maxWidth = ''`; class toggle выполняется через `applyPosition(...)`.
- `src/styles/inline-runner.css`:
  - в конец файла append-only добавлен Phase 77 block:
    ```css
    .rp-inline-runner-container.rp-inline-runner-applied-position {
      right: auto;
      bottom: auto;
      max-width: none;
      transform: none;
    }
    ```
- `src/__tests__/views/inline-runner-position.test.ts`:
  - fixture `FakeElement` получил `toggleClass`, чтобы тестовый DOM поддерживал новый production path;
  - fixture writes `style.left = '920px'` и `style.top = '740px'` обёрнуты per-line `eslint-disable-next-line obsidianmd/no-static-styles-assignment` с Phase 77 rationale;
  - assertions для сброса right/bottom/transform переведены на проверку класса `rp-inline-runner-applied-position`; read-side assertions для `left/top` сохранены.

## Инварианты

- Pitfall 7 соблюдён: template literal строки `style.left/top = `${...}px`` в production не мигрировались.
- Phase 67 block в `inline-runner.css` не редактировался; Phase 77 CSS добавлен после него.
- CSS rule покрывает `right`, `bottom`, `max-width`, `transform`; `width/height` template-literal assignments в `applyLayout` не тронуты.

## Lint delta

- До плана: 5 production `obsidianmd/no-static-styles-assignment` в `inline-runner-modal.ts` + 2 test fixture literal writes.
- После плана: `obsidianmd/no-static-styles-assignment` для изменённых TS-файлов = 0.
- Остаток по `npx eslint src/views/inline-runner-modal.ts src/__tests__/views/inline-runner-position.test.ts --format json`:
  - `@typescript-eslint/no-unused-vars`: 2
  - `obsidianmd/no-tfile-tfolder-cast`: 1

## Команды

- `npm run build` — OK.
- `npm test -- src/__tests__/views/inline-runner-modal*.test.ts src/__tests__/views/inline-runner-position.test.ts` — OK (26 tests).
- `npx eslint src/views/inline-runner-modal.ts src/__tests__/views/inline-runner-position.test.ts --format json` — static-styles count: 0.
