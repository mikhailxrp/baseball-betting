import { supabase } from '@/lib/supabase.js';

const BANK_TYPE_DEPOSIT = 'deposit';
const BANK_TYPE_WITHDRAW = 'withdraw';
const ALLOWED_BANK_TYPES = new Set([BANK_TYPE_DEPOSIT, BANK_TYPE_WITHDRAW]);

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bank')
      .select('id, date, balance, change, comment, bet_id')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const last = data?.[0] ?? null;
    return Response.json({
      current: {
        id: last?.id ?? null,
        date: last?.date ?? null,
        balance: toNumberOrZero(last?.balance),
        change: last?.change ?? null,
        comment: last?.comment ?? null,
        bet_id: last?.bet_id ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    const type = body.type;

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: 'amount должен быть положительным числом' },
        { status: 400 },
      );
    }

    if (!ALLOWED_BANK_TYPES.has(type)) {
      return Response.json(
        { error: 'type должен быть deposit или withdraw' },
        { status: 400 },
      );
    }

    const { data: lastRows, error: lastError } = await supabase
      .from('bank')
      .select('balance')
      .order('id', { ascending: false })
      .limit(1);
    if (lastError) throw lastError;

    const currentBalance = toNumberOrZero(lastRows?.[0]?.balance);
    const change = type === BANK_TYPE_DEPOSIT ? amount : -amount;
    const newBalance = currentBalance + change;

    const { data: inserted, error: insertError } = await supabase
      .from('bank')
      .insert({
        date: new Date().toISOString().slice(0, 10),
        balance: newBalance,
        bet_id: null,
        change,
        comment: type,
      })
      .select('id, date, balance, change, comment, bet_id')
      .single();
    if (insertError) throw insertError;

    return Response.json({
      success: true,
      entry: inserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
