"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  AppShell,
  useAppShell,
  SECTION_TITLES,
  SECTION_SCHEDULE,
} from "@/components/layout/AppShell.jsx";
import { upsertTeamsAndGames } from "@/lib/db.js";
import { toMoscowTime } from "@/lib/utils";
import Link from "next/link";

const PITCHER_TBD = "TBD";

/** Имя для карточки: сначала из БД (pitcher_stats), иначе из MLB schedule. */
function cardPitcherLabel(dbName, mlbNestedName) {
  const candidates = [dbName, mlbNestedName];
  for (const n of candidates) {
    if (n != null && String(n).trim() !== "") {
      return String(n);
    }
  }
  return PITCHER_TBD;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD для query к API из выбранного дня календаря (локальный календарный день). */
function dateToScheduleParam(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function HomeContent() {
  const { activeSection } = useAppShell();

  const [date, setDate] = useState(startOfToday);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsResult, setStatsResult] = useState(null);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = dateToScheduleParam(date);
      // Шаг 1: пробуем БД
      const dbRes = await fetch(
        `/api/schedule?date=${encodeURIComponent(dateStr)}&source=db`,
      );

      let dbData = {};
      if (dbRes.ok) {
        try {
          dbData = await dbRes.json();
        } catch {
          dbData = {};
        }
      } else {
        // Если БД недоступна/невалидна — не блокируем UI, идем в MLB
        console.warn("schedule source=db error:", dbRes.status);
      }

      const dbGames = Array.isArray(dbData.games) ? dbData.games : [];
      if (dbGames.length > 0) {
        setGames(dbGames);
        return;
      }

      // Шаг 2: БД пустая — идём в MLB API (текущее поведение)
      const res = await fetch(`/api/schedule?date=${encodeURIComponent(dateStr)}`);
      let data = {};
      try {
        data = await res.json();
      } catch {
        setError("Не удалось разобрать ответ сервера");
        setGames([]);
        return;
      }

      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Ошибка загрузки";
        setError(message);
        setGames([]);
        return;
      }

      const gamesList = Array.isArray(data.games) ? data.games : [];
      try {
        await upsertTeamsAndGames(gamesList);
      } catch (upsertErr) {
        console.error(upsertErr);
      }
      setGames(gamesList);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const dateStr = dateToScheduleParam(date);
      const res = await fetch(
        `/api/collect-stats?date=${encodeURIComponent(dateStr)}`,
      );
      let data = {};
      try {
        data = await res.json();
      } catch {
        setStatsResult(null);
        console.error("collect-stats: не удалось разобрать ответ сервера");
        return;
      }

      if (!res.ok) {
        setStatsResult(null);
        const message =
          typeof data.error === "string" ? data.error : "Ошибка загрузки";
        console.error("collect-stats:", message);
        return;
      }

      setStatsResult({
        pitchers_processed: data.pitchers_processed,
        teams_processed: data.teams_processed,
      });
    } catch (err) {
      setStatsResult(null);
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  }, [date]);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {SECTION_TITLES[activeSection] ?? activeSection}
      </h1>

      {activeSection === SECTION_SCHEDULE ? (
        <>
          <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (d) {
                  setDate(d);
                  setStatsResult(null);
                }
              }}
              className="rounded-lg border border-border bg-background shadow-xs"
            />
            <Button type="button" onClick={() => void fetchGames()}>
              Получить матчи
            </Button>
          </section>

          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {games.map((game) => {
              const awayName = game.away_team?.name ?? "—";
              const homeName = game.home_team?.name ?? "—";
              const awayPitcher = cardPitcherLabel(
                game.away_pitcher_name,
                game.away_team?.pitcher?.name,
              );
              const homePitcher = cardPitcherLabel(
                game.home_pitcher_name,
                game.home_team?.pitcher?.name,
              );
              const seriesNum = game.series_game_number;
              const seriesTotal = game.games_in_series;
              const showSeriesBadge =
                seriesNum != null &&
                seriesTotal != null &&
                !Number.isNaN(Number(seriesNum)) &&
                !Number.isNaN(Number(seriesTotal));

              return (
                <Card
                  key={String(game.mlb_game_id)}
                  size="sm"
                  className="bg-white shadow-sm ring-1 ring-black/5"
                >
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-base font-bold">
                      {awayName} @ {homeName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {game.game_time_utc
                        ? (() => {
                            const d = new Date(game.game_time_utc);
                            const date = d.toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              timeZone: 'Europe/Moscow',
                            });
                            const time = d.toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Europe/Moscow',
                            });
                            return `${date} ${time} МСК`;
                          })()
                        : '—'}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 pt-4">
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        Питчер away:{" "}
                      </span>
                      {awayPitcher}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        Питчер home:{" "}
                      </span>
                      {homePitcher}
                    </p>
                    {showSeriesBadge ? (
                      <Badge variant="secondary" className="w-fit">
                        Матч {seriesNum} из {seriesTotal}
                      </Badge>
                    ) : null}
                  </CardContent>
                  <CardFooter className="border-t border-border pt-4">
                    <Link href={`/game/${game.mlb_game_id}`}>
                      <Button type="button" variant="outline">
                        Посмотреть матч
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              disabled={games.length === 0 || statsLoading}
              onClick={() => void fetchStats()}
            >
              {statsLoading ? "Загрузка..." : "Получить статистику"}
            </Button>
            {statsResult != null ? (
              <Badge variant="secondary">
                Питчеры: {statsResult.pitchers_processed} | Команды:{" "}
                {statsResult.teams_processed}
              </Badge>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Раздел скоро будет доступен.</p>
      )}
    </>
  );
}

export default function Home() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}
