import { supabase } from '@/lib/supabase.js';

const GAME_STATUS_FINAL = 'Final';
const BET_TYPE_TOTAL_OVER = 'total_over';
const BET_TYPE_TOTAL_UNDER = 'total_under';
const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const RESULT_PUSH = 'push';

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function calcBetResult(betType, line, totalRuns) {
  if (line == null || totalRuns == null) return null;

  if (betType === BET_TYPE_TOTAL_OVER) {
    if (totalRuns > line) return RESULT_WIN;
    if (totalRuns < line) return RESULT_LOSS;
    return RESULT_PUSH;
  }

  if (betType === BET_TYPE_TOTAL_UNDER) {
    if (totalRuns < line) return RESULT_WIN;
    if (totalRuns > line) return RESULT_LOSS;
    return RESULT_PUSH;
  }

  return null;
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

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_score, away_score')
      .eq('date', date)
      .eq('status', GAME_STATUS_FINAL)
      .not('home_score', 'is', null);

    if (gamesError) throw gamesError;

    const gamesList = Array.isArray(games) ? games : [];
    if (gamesList.length === 0) {
      return Response.json({ updated: 0 });
    }

    const gameIds = gamesList.map((g) => g.id);

    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('id, game_id, bet_type, line')
      .in('game_id', gameIds)
      .is('result', null)
      .in('bet_type', [BET_TYPE_TOTAL_OVER, BET_TYPE_TOTAL_UNDER]);

    if (betsError) throw betsError;

    const betsList = Array.isArray(bets) ? bets : [];
    const gameById = new Map(
      gamesList.map((g) => [
        g.id,
        {
          homeScore: toNumberOrNull(g.home_score),
          awayScore: toNumberOrNull(g.away_score),
        },
      ]),
    );

    let updated = 0;

    for (const bet of betsList) {
      const gameData = gameById.get(bet.game_id);
      if (gameData == null) continue;

      const totalRuns =
        gameData.homeScore != null && gameData.awayScore != null
          ? gameData.homeScore + gameData.awayScore
          : null;

      const line = toNumberOrNull(bet.line);
      const result = calcBetResult(bet.bet_type, line, totalRuns);

      if (result == null) continue;

      const { error: updateError } = await supabase
        .from('bets')
        .update({ result })
        .eq('id', bet.id);

      if (updateError) {
        console.error(`Ошибка обновления ставки ${bet.id}:`, updateError);
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
