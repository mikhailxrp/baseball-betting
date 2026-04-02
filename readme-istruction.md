# Baseball Betting App — описание системы

Документ описывает назначение приложения, бизнес-логику, используемые HTTP/API-запросы и структуру данных в Supabase (Postgres), как они следуют из кода репозитория.

---

## 1. Что это за система

**Next.js-приложение** для работы с **MLB (бейсбол)**: расписание матчей, кэш статистики питчеров и команд из официального MLB Stats API, **рекомендации по ставкам** (записываются в БД внешним сценарием **n8n**), учёт **результатов ставок**, **банка**, сравнение линий с **The Odds API** и вспомогательный **калькулятор догона** (чисто клиентская математика, без БД).

Логика «аналитики» ставок не зашита в этом репозитории: кнопка «Анализировать» дергает webhook n8n с `mlbGameId`; n8n должен записать строки в таблицу `bets`.

---

## 2. Поток данных (высокоуровнево)

1. **Расписание**: главная страница запрашивает `/api/schedule?date=YYYY-MM-DD&source=db`. Если в `games` на дату есть строки — показываются они. Иначе — `/api/schedule?date=...` без `source` → MLB Stats API → клиент вызывает `upsertTeamsAndGames()` (Server Action из `db.js`) и сохраняет `teams` + `games`.
2. **Статистика дня**: `/api/collect-stats?date=...` подтягивает из MLB данные по питчерам и командам за матчи этой даты (с кэшем ~1 час по `updated_at` в `pitcher_stats` / `team_stats`).
3. **Анализ матча**: POST `/api/analyze-game` с телом `{ "mlbGameId": number }` → POST на `N8N_WEBHOOK_URL` → n8n создаёт записи в `bets` (ожидаемое поведение).
4. **Закрытие ставок**: страница «Ставки» → PATCH `/api/bets/[id]` (результат, коэф., сумма, линия) → пересчёт банка (`bank`) и при наличии `team_id` вызов RPC `recalculate_team_stats`.
5. **Админ-пайплайн** (страница «Управление системой»): последовательно boxscore MLB → collect-stats → авто-результаты для тоталов → глобальный пересчёт полей команд в `teams`.

---

## 3. Внешние HTTP-запросы (не Next API)

| Источник | URL / назначение |
|----------|------------------|
| **MLB Stats API** | `GET https://statsapi.mlb.com/api/v1/schedule?...` — расписание (`transformSchedule`). |
| | `GET .../people/{id}/stats?stats=yearByYear&group=pitching` — питчер по сезонам. |
| | `GET .../teams/{id}/stats?stats=season&group=hitting&season=...` и `group=pitching` — команда. |
| | `GET .../game/{gamePk}/boxscore` — счёт и batting-статы для обновления `games`. |
| **The Odds API** | `GET .../v4/sports/baseball_mlb/odds?markets=totals&...` — список событий для матчинга. |
| | `GET .../events/{eventId}/odds?markets=team_totals&...` — инд. тоталы команд. |
| **n8n** | `POST N8N_WEBHOOK_URL` с JSON `{ "mlbGameId": number }`. |

Сезон командной статистики в коде: константа **`TEAM_STATS_SEASON`** в `src/lib/mlb.js` (сейчас **2026**).

---

## 4. Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (клиент Supabase в API routes). |
| `N8N_WEBHOOK_URL` | Webhook для запуска анализа матча (`/api/analyze-game`). |
| `ODDS_API_KEY` | Ключ The Odds API (`/api/fetch-odds`). |

Секреты не хранить в коде — только в `.env` / `.env.local`.

---

## 5. Схемы таблиц Supabase (по использованию в коде)

Ниже — поля, которые **реально читаются/пишутся** в приложении. Типы — логические (точные DDL могут быть в Supabase Dashboard).

### 5.1 `teams`

| Поле | Назначение |
|------|------------|
| `id` | PK, внутренний id (FK из `games`, `bets`, …). |
| `mlb_id` | Уникальный id команды MLB; `upsert` по конфликту `mlb_id`. |
| `name`, `wins`, `losses` | Из расписания MLB. |
| `updated_at` | Метка обновления. |
| `bets_count` | Число ставок с известным `result` по команде. |
| `win_rate` | Доля выигрышей среди исходов win/loss (push не входит в знаменатель). |
| `over_hit_rate` | `wins / bets_count` (в т.ч. с учётом всех исходов с результатом). |
| `selected_for_system` | Флаг «команда подходит под систему» (пороги см. ниже). |
| `attack_rating`, `defense_rating` | Строковые оценки `high` / `medium` / `low` из `team_stats` (только в `/api/admin/update-teams-stats`). |

### 5.2 `games`

| Поле | Назначение |
|------|------------|
| `id` | Внутренний PK (`game_id` в `bets`). |
| `mlb_game_id` | Уникальный `gamePk` MLB; `upsert` по конфликту. |
| `date` | Календарная дата матча `YYYY-MM-DD` (как в MLB `officialDate`). |
| `home_team_id`, `away_team_id` | FK → `teams.id`. |
| `home_pitcher_id`, `away_pitcher_id` | MLB id питчера (число, не FK). |
| `series_game_number`, `games_in_series` | Серия. |
| `status` | Например `Scheduled`, `Final` (фильтры в админке и odds). |
| `game_time_utc`, `venue_name` | Время и стадион. |
| `home_score`, `away_score`, `total_runs` | После boxscore-обновления. |
| `home_hits`, `away_hits`, `home_hr`, `away_hr`, `home_lob`, `away_lob` | Доп. поля из boxscore. |
| `odds_event_id` | Id события The Odds API (кэш для повторных запросов). |

**Важно:** маршрут `update-game-results` выбирает только строки с **`status = 'Final'`**. Перевод игры в `Final` в этом репозитории не выполняется — это должно приходить из другого процесса или быть выставлено вручную в БД.

### 5.3 `pitcher_stats`

Уникальность: **`(mlb_pitcher_id, season)`**.

| Поле | Назначение |
|------|------------|
| `mlb_pitcher_id`, `season` | Ключ. |
| `pitcher_name` | Имя. |
| `era`, `whip`, `wins`, `losses`, `games_started`, `innings_pitched` | Питчинг. |
| `k_per9`, `bb_per9`, `hr_per9`, `fip` | Расчётные/из API. |
| `updated_at` | Для кэша при `collect-stats` (~1 ч). |

### 5.4 `team_stats`

Уникальность: **`(team_id, season)`**; `team_id` → `teams.id`.

| Поле | Назначение |
|------|------------|
| `team_id`, `season` | Ключ. |
| `games_played`, `runs_per_game`, `ops`, `lob` | Hitting. |
| `whip`, `team_era`, `saves`, `blown_saves` | Pitching агрегаты команды. |
| `updated_at` | Кэш. |

### 5.5 `bets`

| Поле | Назначение |
|------|------------|
| `id` | PK. |
| `game_id` | FK → `games.id`. |
| `team_id` | FK → `teams.id` (для инд. тоталов и привязки статистики команды). |
| `bet_type` | `total_over`, `total_under`, `ind_total_over`, `ind_total_under`, `max_inning`, … |
| `line` | Линия тотала и т.п. |
| `confidence` | `high` / `medium` / `low`. |
| `reasoning` | Текст от агента/n8n. |
| `result` | `win` / `loss` / `push` / `null`. |
| `odds`, `amount` | Коэффициент букмекера и сумма (для банка и финансов). |
| `entry_mode` | Режим ввода (если задан сценарием). |
| `estimated_probability` | Оценка вероятности в %. |
| `created_at` | Сортировка рекомендаций. |

Авто-обновление `result` в коде только для **`total_over`** и **`total_under`**: сравнение суммы ранов (`home_score + away_score`) с `line`.

### 5.6 `bank`

Журнал операций; **текущий баланс** — последняя запись по `id`.

| Поле | Назначение |
|------|------------|
| `id` | Автоинкремент (порядок важен). |
| `date` | Дата операции / дата матча. |
| `balance` | Баланс после операции. |
| `change` | Изменение (выигрыш: `amount * (odds - 1)`, проигрыш: `-amount`, push: `0`). |
| `comment` | `win`/`loss`/`push` или `deposit`/`withdraw`. |
| `bet_id` | Ссылка на ставку или `null` для депозита/вывода. |

### 5.7 `bookmaker_lines`

Строки по рынку и команде для сравнения с оценкой агента.

| Поле | Назначение |
|------|------------|
| `game_id`, `team_id` | FK. |
| `market` | Например `ind_total_over` (пишется из `fetch-odds`). |
| `outcome` | Например `Over`. |
| `line`, `best_odds`, `best_bookmaker` | Лучшая линия среди БК. |
| `implied_prob` | `1/odds` в процентах (округление в коде). |
| `fetched_at` | Для сортировки на UI. |

---

## 6. RPC в Postgres (миграция в репозитории)

**`recalculate_team_stats(p_team_id bigint)`** (`supabase/migrations/20260402000000_recalculate_team_stats.sql`):

- Считает по `bets` для команды с `result IS NOT NULL`: всего, `win`, `push`.
- **`win_rate`** = `wins / (total - pushes)`.
- **`over_hit_rate`** = `wins / total`.
- **`selected_for_system`** = `total >= 10` и `win_rate >= 0.60`.
- Обновляет `teams`: `bets_count`, `win_rate`, `over_hit_rate`, `selected_for_system`, `updated_at`.

Вызывается из **PATCH `/api/bets/[id]`** после успешного обновления ставки и записи в `bank`.

**Расхождение с админкой:** POST `/api/admin/update-teams-stats` пересчитывает все команды с порогом **`bets_count >= 5`** и `win_rate >= 0.60`, плюс выставляет `attack_rating` / `defense_rating`. После ручного закрытия ставки метрики команды обновляются через RPC (**10** ставок). Имеет смысл со временем унифицировать пороги.

---

## 7. Маршруты Next.js App Router (`/api/*`)

| Метод и путь | Query / тело | Действие |
|--------------|--------------|----------|
| **GET** `/api/schedule` | `date=YYYY-MM-DD`, опционально `source=db` | `source=db`: матчи из БД с именами питчеров. Иначе: MLB schedule → JSON `games`. |
| **GET** `/api/collect-stats` | `date` | `collectDayStats` → MLB → `pitcher_stats`, `team_stats`. |
| **POST** `/api/analyze-game` | `{ "mlbGameId": number }` | Прокси на n8n webhook. |
| **GET** `/api/game-bets` | `gameId` = внутренний `games.id` | Список `bets` по матчу. |
| **GET** `/api/bets-by-date` | `date` | Ставки на дату: `open` (нет результата), `closed` (есть результат и odds). |
| **PATCH** `/api/bets/[id]` | `result`, `odds`, `amount`, `line` | Обновление ставки, запись в `bank`, RPC `recalculate_team_stats`. |
| **GET** `/api/finance` | — | Агрегаты по всем закрытым ставкам с `odds`: прибыль, ROI, винрейт, разрез по команде+типу. |
| **GET** `/api/bank` | — | Последняя запись `bank` (текущий баланс). |
| **POST** `/api/bank` | `{ "amount", "type": "deposit"|"withdraw" }` | Новая запись банка. |
| **GET** `/api/bank-history` | — | Вся история `bank` с датой из связанного матча где возможно. |
| **GET** `/api/bookmaker-lines` | — | Актуальные линии (игры не `Final`) + обогащение данными ставок. |
| **GET** `/api/fetch-odds` | — | Тянет коэффициенты The Odds API для открытых `ind_total_over`, пишет `bookmaker_lines`, обновляет `odds_event_id`. |
| **GET** `/api/bet-estimates` | — | Последние `estimated_probability` по парам `(game_id, bet_type)` для `total_over` / `total_under` (API есть; UI в репозитории не подключён). |
| **POST** `/api/admin/update-game-results` | `{ "date" }` | Для игр с `status=Final` на дату — boxscore → обновление счёта и статов в `games`. |
| **POST** `/api/admin/update-bet-results` | `{ "date" }` | Для финальных игр с счётом — авто `result` для `total_over` / `total_under`. |
| **POST** `/api/admin/update-teams-stats` | — | Пересчёт полей `teams` по всем ставкам + рейтинги атаки/защиты из `team_stats`. |

Кэш: у `/api/schedule` задан **`revalidate = 60`** (ISR-подсказка Next).

---

## 8. Страницы UI (навигация)

- **`/`** — расписание, загрузка матчей, переход на `/game/[mlb_game_id]`, кнопка сбора статистики.
- **`/game/[id]`** — `id` = **MLB gamePk**; статистика питчеров/команд из БД + рекомендации + «Анализировать».
- **`/bets`** — ставки по дате, ввод коэф./суммы/линии, WIN/LOSS/PUSH.
- **`/finance`** — дашборд, банк, график истории, таблица по командам.
- **`/calculator`** — догон (без сервера).
- **`/odds`** — синхронизация с The Odds API и таблица перевеса (оценка агента vs implied).
- **`/admin`** — четыре шага пайплайна (см. раздел 2).

---

## 9. Заложенная логика «системы отбора» и финансов

- **Отбор команд для системы** (два механизма, см. RPC vs admin): ставок достаточно много и стабильный `win_rate` по закрытым исходам (без push в знаменателе для win_rate).
- **Рейтинги атаки/защиты** (только admin): пороги по `ops`, `runs_per_game`, `team_era`, `whip` из `team_stats` за текущий сезон в коде.
- **Банк**: каждое закрытие ставки через PATCH добавляет **одну** строку в `bank` с новым балансом; депозит/вывод — отдельные операции без `bet_id`.
- **Сравнение с букмекером**: для открытых `ind_total_over` подтягиваются `team_totals`, лучший Over по команде; **edge** на странице odds = `estimated_probability - implied_prob`.

---

## 10. Как проверить себя после изменений

1. Расписание: открыть `/`, выбрать дату, «Получить матчи» — в Supabase появляются/обновляются `teams`, `games`.
2. Статистика: «Получить статистику» или GET `/api/collect-stats?date=...` — растут `pitcher_stats`, `team_stats`.
3. Анализ: при настроенном n8n и таблице `bets` — POST `/api/analyze-game` и обновление страницы матча.
4. Финансы: закрыть ставку на `/bets` — изменяются `bets`, `bank`, при `team_id` — поля команды через RPC.

---

*Файл сгенерирован по состоянию кода репозитория; при изменении схемы Supabase сверяйте с Dashboard и миграциями.*
