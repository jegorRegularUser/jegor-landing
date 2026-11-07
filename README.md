# jegor-landing

Личный сайт-лендинг Егора Двойнякова — комплект рабочих чертежей «2026-Ф1».
Дизайн по спеке `docs/design-spec.md` (концепция «Чертёж», победила на
дизайн-воркфлоу из трёх концепций с независимой критикой).

**Стек:** Vite + React + TypeScript, rough.js + rough-notation (обводки «от руки»
с фиксированными seed), GSAP 3 (ScrollTrigger, SplitText, MorphSVG, DrawSVG),
raw WebGL fullscreen-quad (порт GLSL-ядра shadergradient, 1.9KB вместо 352KB).
Тёмная тема — синька, светлая — ватман. RU/EN.

**Команды:**

```bash
npm ci            # установка
npm run dev       # дев-сервер
npm run assets    # webp/avif из assets-src (sharp)
npm test          # vitest: seed-детерминизм rough, карантин rough в scroll
npm run lint      # eslint
npm run build     # tsc + vite build → dist/
```

**Деплой:** GitHub Actions (`.github/workflows/deploy.yml`) на push в `main`.
Один раз вручную: Settings → Pages → Source → «GitHub Actions».

**Данные с пометкой TODO(owner)** в `src/i18n/ru.ts` — название компании
стажировки и перечень хакатонов; закрыть перед деплоем.
