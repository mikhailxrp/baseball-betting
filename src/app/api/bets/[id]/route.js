import { supabase } from '@/lib/supabase.js';

const ALLOWED_RESULTS = new Set(['win', 'loss', 'push']);
const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const RESULT_PUSH = 'push';
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

    if (body.line !== undefined && body.line !== null) {
      update.line = parseOptionalNumber(body.line);
    }

    const { data: updatedBet, error } = await supabase
      .from('bets')
      .update(update)
      .eq('id', id)
      .select('id, game_id, result, odds, amount, team_id, line')
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

    const teamId = updatedBet?.team_id ?? null;
    if (teamId != null) {
      const { error: teamStatsRpcError } = await supabase.rpc(
        'recalculate_team_stats',
        { p_team_id: teamId },
      );
      if (teamStatsRpcError) throw teamStatsRpcError;
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    const status = err instanceof Error && typeof err.status === 'number' ? err.status : 500;
    console.error(err);
    return Response.json({ error: message }, { status });
  }
}

