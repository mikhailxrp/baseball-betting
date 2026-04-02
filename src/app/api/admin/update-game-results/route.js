import { supabase } from '@/lib/supabase.js';

const GAME_STATUS_FINAL = 'Final';
const MLB_BOXSCORE_BASE_URL = 'https://statsapi.mlb.com/api/v1/game';

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

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, mlb_game_id')
      .eq('date', date)
      .eq('status', GAME_STATUS_FINAL);

    if (gamesError) throw gamesError;

    const gamesList = Array.isArray(games) ? games : [];
    let updated = 0;

    for (const game of gamesList) {
      const mlbGameId = game.mlb_game_id;
      if (mlbGameId == null) continue;

      const boxscoreUrl = `${MLB_BOXSCORE_BASE_URL}/${mlbGameId}/boxscore`;
      const boxscoreRes = await fetch(boxscoreUrl);
      if (!boxscoreRes.ok) {
        console.warn(`Boxscore для игры ${mlbGameId} недоступен`);
        continue;
      }

      const boxscoreData = await boxscoreRes.json().catch(() => null);
      if (boxscoreData == null) {
        console.warn(`Не удалось распарсить boxscore для игры ${mlbGameId}`);
        continue;
      }

      const home = boxscoreData?.teams?.home?.teamStats?.batting;
      const away = boxscoreData?.teams?.away?.teamStats?.batting;

      if (home == null || away == null) {
        console.warn(`Отсутствуют batting stats для игры ${mlbGameId}`);
        continue;
      }

      const updateData = {
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
