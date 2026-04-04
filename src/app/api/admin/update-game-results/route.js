import { supabase } from '@/lib/supabase.js';

const GAME_STATUS_FINAL = 'Final';
const MLB_API_BASE_URL = 'https://statsapi.mlb.com/api/v1';
const MLB_SPORT_ID = 1;

function buildScheduleUrl(date) {
  const params = new URLSearchParams({
    startDate: date,
    endDate: date,
    sportId: String(MLB_SPORT_ID),
  });
  return `${MLB_API_BASE_URL}/schedule?${params}`;
}

function buildBoxscoreUrl(mlbGameId) {
  return `${MLB_API_BASE_URL}/game/${mlbGameId}/boxscore`;
}

/**
 * @param {unknown} boxscoreData
 * @returns {Record<string, unknown> | null}
 */
function buildBoxscoreUpdatePayload(boxscoreData) {
  const home = boxscoreData?.teams?.home?.teamStats?.batting;
  const away = boxscoreData?.teams?.away?.teamStats?.batting;

  if (home == null || away == null) {
    return null;
  }

  return {
    home_score: home.runs,
    away_score: away.runs,
    total_runs: home.runs + away.runs,
    home_hits: home.hits,
    away_hits: away.hits,
    home_hr: home.homeRuns,
    away_hr: away.homeRuns,
    home_lob: home.leftOnBase,
    away_lob: away.leftOnBase,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date?.trim?.();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: 'Укажите дату в формате YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const scheduleRes = await fetch(buildScheduleUrl(date));
    if (!scheduleRes.ok) {
      return Response.json(
        { error: 'Не удалось загрузить расписание MLB' },
        { status: 502 },
      );
    }

    const scheduleData = await scheduleRes.json().catch(() => null);
    if (scheduleData == null) {
      return Response.json(
        { error: 'Не удалось разобрать ответ расписания MLB' },
        { status: 502 },
      );
    }

    const scheduleGames = scheduleData?.dates?.[0]?.games;
    const mlbGamesList = Array.isArray(scheduleGames) ? scheduleGames : [];

    for (const mlbGame of mlbGamesList) {
      const gamePk = mlbGame?.gamePk;
      const abstractGameState = mlbGame?.status?.abstractGameState;

      if (gamePk == null || abstractGameState == null) {
        continue;
      }

      const { error: statusUpdateError } = await supabase
        .from('games')
        .update({ status: abstractGameState })
        .eq('mlb_game_id', gamePk);

      if (statusUpdateError) {
        console.error(
          `Ошибка обновления статуса для mlb_game_id=${gamePk}:`,
          statusUpdateError,
        );
      }
    }

    const { data: finalWithoutScore, error: finalQueryError } = await supabase
      .from('games')
      .select('id, mlb_game_id')
      .eq('date', date)
      .eq('status', GAME_STATUS_FINAL)
      .is('home_score', null);

    if (finalQueryError) throw finalQueryError;

    const gamesNeedingBoxscore = Array.isArray(finalWithoutScore)
      ? finalWithoutScore
      : [];

    let updated = 0;

    for (const game of gamesNeedingBoxscore) {
      const mlbGameId = game.mlb_game_id;
      if (mlbGameId == null) continue;

      const boxscoreRes = await fetch(buildBoxscoreUrl(mlbGameId));
      if (!boxscoreRes.ok) {
        console.warn(`Boxscore для игры ${mlbGameId} недоступен`);
        continue;
      }

      const boxscoreData = await boxscoreRes.json().catch(() => null);
      if (boxscoreData == null) {
        console.warn(`Не удалось распарсить boxscore для игры ${mlbGameId}`);
        continue;
      }

      const updateData = buildBoxscoreUpdatePayload(boxscoreData);
      if (updateData == null) {
        console.warn(`Отсутствуют batting stats для игры ${mlbGameId}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', game.id);

      if (updateError) {
        console.error(`Ошибка обновления игры ${game.id}:`, updateError);
        continue;
      }

      updated += 1;
    }

    return Response.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
