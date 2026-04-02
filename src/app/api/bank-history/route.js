import { supabase } from '@/lib/supabase.js';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bank')
      .select(`
        id, date, balance, change, comment,
        bet:bets!bet_id(
          game:games(date)
        )
      `)
      .order('date', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const history = rows.map((row) => ({
      date: row?.bet?.game?.date ?? row?.date ?? null,
      balance: row?.balance ?? 0,
      change: row?.change ?? 0,
      comment: row?.comment ?? null,
    }));

    return Response.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
