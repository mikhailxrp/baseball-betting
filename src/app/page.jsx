"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
import { upsertTeamsAndGames } from "@/lib/db.js";
import { cn, toMoscowTime } from "@/lib/utils";

const PITCHER_TBD = "TBD";

const SECTION_SCHEDULE = "schedule";
const SECTION_ANALYSIS = "analysis";
const SECTION_STATS = "stats";

const NAV_ITEMS = [
  { id: SECTION_SCHEDULE, label: "Расписание" },
  { id: SECTION_ANALYSIS, label: "Анализ" },
  { id: SECTION_STATS, label: "Статистика" },
];

const SECTION_TITLES = {
  [SECTION_SCHEDULE]: "Расписание",
  [SECTION_ANALYSIS]: "Анализ",
  [SECTION_STATS]: "Статистика",
};

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

export default function Home() {
  const [date, setDate] = useState(startOfToday);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTION_SCHEDULE);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = dateToScheduleParam(date);
      const res = await fetch(
        `/api/schedule?date=${encodeURIComponent(dateStr)}`,
      );
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

  return (
    <div className="flex h-screen min-h-0 w-full font-sans">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-white/15 bg-medium-slate transition-[width] duration-200 ease-out",
          sidebarCollapsed ? "w-14" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex items-center p-2",
            sidebarCollapsed ? "justify-center" : "justify-end",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={sidebarCollapsed ? "Развернуть панель" : "Свернуть панель"}
            className="text-white hover:bg-soft-periwinkle hover:text-white"
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-5" />
            ) : (
              <ChevronLeft className="size-5" />
            )}
          </Button>
        </div>

        {!sidebarCollapsed ? (
          <nav className="flex flex-col gap-1 px-2 pb-4">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-soft-periwinkle hover:text-white",
                  activeSection === item.id && "bg-soft-periwinkle text-white",
                )}
                onClick={() => setActiveSection(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        ) : null}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-muted">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
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
                  const awayPitcher = game.away_team?.pitcher?.name ?? PITCHER_TBD;
                  const homePitcher = game.home_team?.pitcher?.name ?? PITCHER_TBD;
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
                          {toMoscowTime(game.game_time_utc)}
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            console.log(game);
                          }}
                        >
                          Анализировать
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    console.log(games);
                  }}
                >
                  Анализировать все
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Раздел скоро будет доступен.</p>
          )}
        </div>
      </main>
    </div>
  );
}
