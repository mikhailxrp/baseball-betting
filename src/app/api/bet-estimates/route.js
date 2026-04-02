import { supabase } from '@/lib/supabase.js';

const TOTAL_MARKET_BET_TYPES = ['total_over', 'total_under'];

/**
 * Последняя по времени оценка вероятности для пары (game_id, bet_type).
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select('game_id, bet_type, estimated_probability, created_at')
      .in('bet_type', TOTAL_MARKET_BET_TYPES)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const byKey = new Map();
    for (const row of data ?? []) {
      const key = `${row.game_id}|${row.bet_type}`;
      if (!byKey.has(key)) {
        byKey.set(key, row.estimated_probability);
      }
    }

    return Response.json({
      estimates: Object.fromEntries(byKey),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка';
    return Response.json({ error: message }, { status: 500 });
  }
}
