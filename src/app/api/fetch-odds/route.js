import { supabase } from '@/lib/supabase.js';

const ODDS_API_BASE =
  'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds';
const ODDS_REGIONS = 'us';
const ODDS_MARKETS = 'totals';
const ODDS_FORMAT = 'decimal';
/** Округление implied probability в процентах до 2 знаков после запятой */
const IMPLIED_PROB_PERCENT_SCALE = 100;

function buildOddsApiUrl(apiKey) {
  const params = new URLSearchParams({
    regions: ODDS_REGIONS,
    markets: ODDS_MARKETS,
    oddsFormat: ODDS_FORMAT,
    apiKey,
  });
  return `${ODDS_API_BASE}?${params.toString()}`;
}

function impliedProbPercent(decimalOdds) {
  return (
    Math.round(
      (1 / decimalOdds) *
        IMPLIED_PROB_PERCENT_SCALE *
        IMPLIED_PROB_PERCENT_SCALE,
    ) / IMPLIED_PROB_PERCENT_SCALE
  );
}

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Задайте ODDS_API_KEY в окружении.' },
        { status: 500 },
      );
    }

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, date, home_team_id, away_team_id')
      .neq('status', 'Final');

    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    const teamIds = [
      ...new Set([
        ...games.map((g) => g.home_team_id),
        ...games.map((g) => g.away_team_id),
      ]),
    ];

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    const teamById = new Map(teams.map((t) => [t.id, t.name]));

    const res = await fetch(buildOddsApiUrl(apiKey));
    if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
    const oddsData = await res.json();

    let updated = 0;

    for (const game of games) {
      const homeName = teamById.get(game.home_team_id);
      const awayName = teamById.get(game.away_team_id);
      if (!homeName || !awayName) continue;

      const gameDate = game.date;
      const oddsGame = oddsData.find((og) => {
        const oddsDate = og.commence_time.slice(0, 10);
        return (
          og.home_team === homeName &&
          og.away_team === awayName &&
          oddsDate === gameDate
        );
      });

      if (!oddsGame) continue;

      let bestOver = null;
      let bestOverBook = null;
      let bestUnder = null;
      let bestUnderBook = null;
      let overLine = null;
      let underLine = null;

      for (const bookmaker of oddsGame.bookmakers) {
        const totalsMarket = bookmaker.markets.find((m) => m.key === 'totals');
        if (!totalsMarket) continue;

        for (const outcome of totalsMarket.outcomes) {
          if (outcome.name === 'Over') {
            if (bestOver === null || outcome.price > bestOver) {
              bestOver = outcome.price;
              bestOverBook = bookmaker.title;
              overLine = outcome.point;
            }
          }
          if (outcome.name === 'Under') {
            if (bestUnder === null || outcome.price > bestUnder) {
              bestUnder = outcome.price;
              bestUnderBook = bookmaker.title;
              underLine = outcome.point;
            }
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('bookmaker_lines')
        .delete()
        .eq('game_id', game.id);
      if (deleteError) throw deleteError;

      const rows = [];

      if (bestOver !== null) {
        rows.push({
          game_id: game.id,
          market: 'total_over',
          outcome: 'Over',
          line: overLine,
          best_odds: bestOver,
          best_bookmaker: bestOverBook,
          implied_prob: impliedProbPercent(bestOver),
        });
      }

      if (bestUnder !== null) {
        rows.push({
          game_id: game.id,
          market: 'total_under',
          outcome: 'Under',
          line: underLine,
          best_odds: bestUnder,
          best_bookmaker: bestUnderBook,
          implied_prob: impliedProbPercent(bestUnder),
        });
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('bookmaker_lines')
          .insert(rows);
        if (insertError) throw insertError;
        updated += 1;
      }
    }

    return Response.json({ success: true, updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка';
    return Response.json({ error: message }, { status: 500 });
  }
}
