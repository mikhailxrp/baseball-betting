import { transformSchedule } from "@/lib/transformSchedule";

const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_SPORT_ID = 1;
const MLB_GAME_DAY_TIMEZONE = "America/New_York";
const DATE_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Кэш ответа маршрута (секунды). Расписание меняется не каждую секунду. */
export const revalidate = 60;

function getDefaultScheduleDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MLB_GAME_DAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildScheduleUrl(date) {
  const params = new URLSearchParams({
    sportId: String(MLB_SPORT_ID),
    date,
    hydrate: "probablePitcher,linescore,team",
  });
  return `${MLB_STATS_API_BASE}/schedule?${params.toString()}`;
}

export async function GET(request) {
  try {
    const date =
      request.nextUrl.searchParams.get("date") ?? getDefaultScheduleDate();

    if (!DATE_QUERY_PATTERN.test(date)) {
      return Response.json(
        { error: "Неверный формат date. Используйте YYYY-MM-DD." },
        { status: 400 },
      );
    }

    const url = buildScheduleUrl(date);
    const res = await fetch(url);

    if (!res.ok) {
      return Response.json(
        {
          error: "Ответ MLB Stats API неуспешен",
          status: res.status,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    const games = transformSchedule(data);

    const now = new Date();
    const upcoming = games.filter((game) => {
      if (!game.game_time_utc) return true;
      return new Date(game.game_time_utc) > now;
    });

    return Response.json({ games: upcoming });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return Response.json({ error: message }, { status: 500 });
  }
}
