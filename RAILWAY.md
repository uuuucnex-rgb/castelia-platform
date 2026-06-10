# Деплой CASTELIA PLATFORM на Railway.app

Приложение уже готово к Railway:
- `server.js` слушает `process.env.PORT` → Railway сам подставит свой порт;
- `.env` в `.gitignore` (ключи в гит не уедут) → переменные задаём в дашборде Railway;
- демо «до/после» (`public/demo/*.png`) коммитятся и работают в проде;
- в проекте есть `Dockerfile` — Railway соберёт по нему автоматически.

Есть два пути. **Путь A (через GitHub) — рекомендую.**

---

## Путь A — через GitHub (проще и правильнее)

### 1. Залить проект на GitHub
```bash
cd /Users/evgenijvoronov/Desktop/CASTELIA_PLATFORM
git init
git add .
git commit -m "Castelia platform v2"
# создать пустой репозиторий на github.com (например castelia-platform), затем:
git remote add origin https://github.com/ВАШ_ЛОГИН/castelia-platform.git
git branch -M main
git push -u origin main
```
> `.env` и `node_modules` НЕ попадут в репозиторий — так и нужно (ключ остаётся только у вас).

### 2. Создать сервис на Railway
1. Зайти на **railway.app** → войти через GitHub.
2. **New Project → Deploy from GitHub repo** → выбрать репозиторий `castelia-platform`.
3. Railway увидит `Dockerfile` и начнёт сборку автоматически.

### 3. Прописать переменные окружения
Открыть сервис → вкладка **Variables** → добавить (значения скопировать из вашего локального `.env`):

| Переменная | Значение |
|---|---|
| `GEMINI_API_KEY` | ваш ключ Gemini (`AQ.…`) |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image` |
| `AI_TEXT_PROVIDER` | `gemini` |
| `GEMINI_TEXT_MODEL` | `gemini-2.5-flash` |

Опционально (если переключаете чат на OpenAI):
| `OPENAI_API_KEY` | `sk-…` |
| `OPENAI_CHAT_MODEL` | `gpt-4o` |
и `AI_TEXT_PROVIDER` = `openai`.

> ⚠️ **PORT задавать НЕ нужно.** Railway подставляет его сам, приложение его подхватит.
> Если задать `PORT` вручную — сломается маршрутизация и healthcheck.

После добавления переменных Railway пересоберёт сервис.

### 4. Открыть наружу (публичный домен)
Сервис → **Settings → Networking → Generate Domain**.
Появится адрес вида `https://castelia-platform-production.up.railway.app` — это и есть готовое приложение, можно давать клиенту.

Проверка: открыть `https://<домен>/health` — должно вернуть `{"ok":true, ...}`.

### 5. Обновления
Любой `git push` в `main` → Railway автоматически пересоберёт и задеплоит новую версию.

---

## Путь B — через Railway CLI (без GitHub)

```bash
npm i -g @railway/cli
railway login
cd /Users/evgenijvoronov/Desktop/CASTELIA_PLATFORM
railway init           # создать новый проект
railway up             # залить и собрать текущую папку
# переменные:
railway variables --set GEMINI_API_KEY=AQ... \
                  --set GEMINI_IMAGE_MODEL=gemini-3-pro-image \
                  --set AI_TEXT_PROVIDER=gemini \
                  --set GEMINI_TEXT_MODEL=gemini-2.5-flash
railway domain         # сгенерировать публичный домен
```

---

## Полезное

- **Логи:** дашборд → сервис → вкладка **Deployments / Logs** (или `railway logs`).
- **Healthcheck (необязательно):** Settings → Healthcheck Path = `/health`.
- **Сборка через Nixpacks вместо Dockerfile:** если хотите, удалите `Dockerfile` —
  Railway сам определит Node-проект и запустит `npm start` (в `package.json` уже есть
  `"start": "node server.js"`). Оба варианта рабочие.
- **Деньги:** Railway тарифицируется по потреблению (CPU/RAM/сеть). Плюс отдельно идут
  расходы на ИИ — каждая генерация картинки тратит кредиты Gemini на **вашем** ключе.
  Убедитесь, что ключ в Variables — клиентский, а не ваш личный.
- **Размер запросов:** фото отправляются как data URL; сервер уже поднимает лимит
  тела до 100 МБ (`express.json({ limit: '100mb' })`) — для Railway ок.
```
