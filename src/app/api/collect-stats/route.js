import { collectDayStats } from "@/lib/db.js";

const MLB_GAME_DAY_TIMEZONE = "America/New_York";

function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MLB_GAME_DAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request) {
  try {
    const param = request.nextUrl.searchParams.get("date");
    const date = param ?? getTodayDateString();

    const result = await collectDayStats(date);

    return Response.json({
      success: true,
      pitchers_processed: result.pitchers_processed,
      teams_processed: result.teams_processed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return Response.json({ error: message }, { status: 500 });
  }
}
