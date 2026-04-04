import { supabase } from '@/lib/supabase.js';

export async function GET(request) {
  try {
    const date = (request.nextUrl.searchParams.get('date') ?? '').trim();
    if (!date) return Response.json({ open: [], closed: [] });

    const { data, error } = await supabase
      .from('bets')
      .select(`
        id, bet_type, line, confidence, result, odds, amount,
        estimated_probability, entry_mode, created_at,
        game:games!inner(
          id, date, status, game_time_utc,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name)
        ),
        team:teams!team_id(name)
      `)
      .eq('game.date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bets = (data ?? []).map((b) => ({
      id: b.id,
      bet_type: b.bet_type,
      line: b.line,
      confidence: b.confidence,
      result: b.result,
      odds: b.odds,
      amount: b.amount,
      estimated_probability: b.estimated_probability,
      home_team: b.game?.home_team?.name ?? '—',
      away_team: b.game?.away_team?.name ?? '—',
      team_name: b.team?.name ?? null,
      game_time_utc: b.game?.game_time_utc ?? null,
      game_date: b.game?.date ?? null,
    }));

    return Response.json({
      open: bets.filter((b) => b.result === null),
      closed: bets.filter((b) => b.result !== null && b.odds !== null),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

