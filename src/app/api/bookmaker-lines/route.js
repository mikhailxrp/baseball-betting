import { supabase } from '@/lib/supabase.js';

export async function GET() {
  try {
    const { data: lines, error } = await supabase
      .from('bookmaker_lines')
      .select(
        `
        id, market, line, best_odds, best_bookmaker, implied_prob, fetched_at, team_id,
        team:teams(name),
        game:games!inner(id, date, status, game_time_utc,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          bets(
            bet_type,
            line,
            estimated_probability,
            confidence,
            team:teams!team_id(name)
          )
        )
      `,
      )
      .neq('game.status', 'Final')
      .not('team_id', 'is', null)
      .order('fetched_at', { ascending: false });

    if (error) throw error;

    const enriched = (lines ?? []).map((l) => {
      const bets = l.game?.bets ?? [];
      const matchingBet = bets.find((b) => b.bet_type === l.market);
      return {
        ...l,
        agent_line: matchingBet?.line ?? null,
        agent_probability: matchingBet?.estimated_probability ?? null,
        agent_confidence: matchingBet?.confidence ?? null,
      };
    });

    return Response.json({ lines: enriched });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка';
    return Response.json({ error: message }, { status: 500 });
  }
}
