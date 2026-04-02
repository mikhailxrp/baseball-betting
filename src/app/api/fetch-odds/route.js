import { supabase } from '@/lib/supabase.js';

const ODDS_API_BASE =
  'https://api.the-odds-api.com/v4/sports/baseball_mlb';

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Задайте ODDS_API_KEY в окружении.' },
        { status: 500 },
      );
    }

    // 1. Берём ставки агента на ind_total_over без результата
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(
        'id, game_id, team_id, bet_type, line, estimated_probability, confidence',
      )
      .eq('bet_type', 'ind_total_over')
      .is('result', null);

    if (betsError) throw betsError;
    if (!bets || bets.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // 2. Берём уникальные game_id
    const gameIds = [...new Set(bets.map((b) => b.game_id))];

    // 3. Берём данные матчей
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, date, game_time_utc, odds_event_id, home_team_id, away_team_id')
      .in('id', gameIds)
      .neq('status', 'Final');

    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // 4. Берём названия команд
    const teamIds = [
      ...new Set([
        ...games.map((g) => g.home_team_id),
        ...games.map((g) => g.away_team_id),
        ...bets.map((b) => b.team_id).filter(Boolean),
      ]),
    ];

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    const teamById = new Map(teams.map((t) => [t.id, t.name]));

    // 5. Получаем список всех матчей от the-odds-api для матчинга event_id
    const oddsListRes = await fetch(
      `${ODDS_API_BASE}/odds?regions=us&markets=totals&oddsFormat=decimal&apiKey=${apiKey}`,
    );
    if (!oddsListRes.ok) {
      throw new Error(`Odds API error: ${oddsListRes.status}`);
    }
    const oddsList = await oddsListRes.json();

    // 6. Обновляем odds_event_id для каждого матча и запрашиваем team_totals
    let updated = 0;

    for (const game of games) {
      const homeName = teamById.get(game.home_team_id);
      const awayName = teamById.get(game.away_team_id);
      if (!homeName || !awayName) continue;

      // Матчим по названию команды и дате
      let eventId = game.odds_event_id;

      if (!eventId) {
        const oddsGame = oddsList.find((og) => {
          const oddsDateET = new Date(og.commence_time).toLocaleDateString(
            'en-CA',
            { timeZone: 'America/New_York' },
          );
          return (
            og.home_team === homeName &&
            og.away_team === awayName &&
            oddsDateET === game.date
          );
        });

        if (!oddsGame) continue;

        eventId = oddsGame.id;

        // Сохраняем odds_event_id в games
        await supabase
          .from('games')
          .update({ odds_event_id: eventId })
          .eq('id', game.id);
      }

      // 7. Запрашиваем team_totals для этого матча
      const teamTotalsRes = await fetch(
        `${ODDS_API_BASE}/events/${eventId}/odds?regions=us&markets=team_totals&oddsFormat=decimal&apiKey=${apiKey}`,
      );
      if (!teamTotalsRes.ok) continue;
      const teamTotalsData = await teamTotalsRes.json();

      // 8. Находим ставки агента для этого матча
      const gameBets = bets.filter((b) => b.game_id === game.id);

      for (const bet of gameBets) {
        const teamName = teamById.get(bet.team_id);
        if (!teamName) continue;

        // Ищем best odds для Over этой команды
        let bestOdds = null;
        let bestBookmaker = null;
        let bestLine = null;

        for (const bookmaker of teamTotalsData.bookmakers ?? []) {
          const market = bookmaker.markets.find((m) => m.key === 'team_totals');
          if (!market) continue;

          for (const outcome of market.outcomes) {
            if (
              outcome.name === 'Over' &&
              outcome.description === teamName
            ) {
              if (bestOdds === null || outcome.price > bestOdds) {
                bestOdds = outcome.price;
                bestBookmaker = bookmaker.title;
                bestLine = outcome.point;
              }
            }
          }
        }

        if (bestOdds === null) continue;

        // 9. Удаляем старую линию для этой ставки
        await supabase
          .from('bookmaker_lines')
          .delete()
          .eq('game_id', game.id)
          .eq('market', 'ind_total_over')
          .eq('team_id', bet.team_id);

        // 10. Сохраняем новую линию
        await supabase.from('bookmaker_lines').insert({
          game_id: game.id,
          team_id: bet.team_id,
          market: 'ind_total_over',
          outcome: 'Over',
          line: bestLine,
          best_odds: bestOdds,
          best_bookmaker: bestBookmaker,
          implied_prob:
            Math.round((1 / bestOdds) * 100 * 100) / 100,
        });

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
