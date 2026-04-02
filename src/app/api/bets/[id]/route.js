import { supabase } from '@/lib/supabase.js';

const ALLOWED_RESULTS = new Set(['win', 'loss', 'push']);
const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const RESULT_PUSH = 'push';
const SYSTEM_MIN_BETS = 5;
const SYSTEM_MIN_WIN_RATE = 0.6;

function parseOptionalNumber(value) {
  if (value === null || value === undefined) return value;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(Number(n))) {
    const err = new Error('Неверный числовой формат');
    err.status = 400;
    throw err;
  }
  return Number(n);
}

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function calcBankChange(result, amountRaw, oddsRaw) {
  const amount = toNumberOrZero(amountRaw);
  const odds = toNumberOrZero(oddsRaw);

  if (result === RESULT_WIN) {
    return amount * (odds - 1);
  }
  if (result === RESULT_LOSS) {
    return -amount;
  }
  if (result === RESULT_PUSH) {
    return 0;
  }
  return 0;
}

export async function PATCH(request, { params }) {
  try {
    // В Next.js динамические `params` могут приходить как Promise.
    // Делаем await, чтобы надёжно получить `id`.
    const resolvedParams = await params;
    const { id } = resolvedParams ?? {};
    if (!id) {
      return Response.json({ error: 'Не указан id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const update = {};

    if (body.result !== undefined) {
      if (body.result === null) {
        update.result = null;
      } else if (ALLOWED_RESULTS.has(body.result)) {
        update.result = body.result;
      } else {
        return Response.json(
          { error: 'Неверный результат' },
          { status: 400 },
        );
      }
    }

    if (body.odds !== undefined) {
      update.odds = parseOptionalNumber(body.odds);
    }

    if (body.amount !== undefined) {
      update.amount = parseOptionalNumber(body.amount);
    }

    const { data: updatedBet, error } = await supabase
      .from('bets')
      .update(update)
      .eq('id', id)
      .select('id, game_id, result, odds, amount')
      .single();
    if (error) throw error;

    const { data: gameRow, error: gameError } = await supabase
      .from('games')
      .select('date')
      .eq('id', updatedBet.game_id)
      .single();
    if (gameError) throw gameError;

    const { data: lastBankRows, error: lastBankError } = await supabase
      .from('bank')
      .select('balance')
      .order('id', { ascending: false })
      .limit(1);
    if (lastBankError) throw lastBankError;

    const currentBalance = toNumberOrZero(lastBankRows?.[0]?.balance);
    const change = calcBankChange(
      updatedBet.result,
      updatedBet.amount,
      updatedBet.odds,
    );
    const newBalance = currentBalance + change;

    const { error: bankInsertError } = await supabase.from('bank').insert({
      date: gameRow?.date ?? null,
      balance: newBalance,
      bet_id: updatedBet.id,
      change,
      comment: updatedBet.result ?? null,
    });
    if (bankInsertError) throw bankInsertError;

    const { data: betTeamRow, error: betTeamError } = await supabase
      .from('bets')
      .select('team_id')
      .eq('id', updatedBet.id)
      .single();
    if (betTeamError) throw betTeamError;

    const teamId = betTeamRow?.team_id ?? null;
    if (teamId != null) {
      const { data: teamBets, error: teamBetsError } = await supabase
        .from('bets')
        .select('result')
        .eq('team_id', teamId)
        .not('result', 'is', null);
      if (teamBetsError) throw teamBetsError;

      const rows = Array.isArray(teamBets) ? teamBets : [];
      const betsCount = rows.length;
      const wins = rows.filter((row) => row.result === RESULT_WIN).length;
      const losses = rows.filter((row) => row.result === RESULT_LOSS).length;
      const settledWinLoss = wins + losses;
      const winRate = settledWinLoss > 0 ? wins / settledWinLoss : null;
      const overHitRate = betsCount > 0 ? wins / betsCount : 0;
      const selectedForSystem =
        betsCount >= SYSTEM_MIN_BETS &&
        winRate != null &&
        winRate >= SYSTEM_MIN_WIN_RATE;

      const { error: teamUpdateError } = await supabase
        .from('teams')
        .update({
          bets_count: betsCount,
          win_rate: winRate,
          over_hit_rate: overHitRate,
          selected_for_system: selectedForSystem,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId);
      if (teamUpdateError) throw teamUpdateError;
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    const status = err instanceof Error && typeof err.status === 'number' ? err.status : 500;
    console.error(err);
    return Response.json({ error: message }, { status });
  }
}

