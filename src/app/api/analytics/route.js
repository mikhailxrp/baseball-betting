import { supabase } from '@/lib/supabase.js';

const RESULT_WIN = 'win';
const RESULT_PUSH = 'push';
const PERCENT_MULTIPLIER = 100;
const WIN_RATE_DECIMAL_PLACES = 1;
const WIN_RATE_ROUND_FACTOR = 10 ** WIN_RATE_DECIMAL_PLACES;

const CONFIDENCE_SORT_ORDER = ['high', 'medium', 'low'];

/**
 * Эквивалент SQL:
 * ROUND(wins / NULLIF(total - pushes, 0) * 100, 1)
 */
function calcWinRatePct(total, wins, pushes) {
  const settled = total - pushes;
  if (settled <= 0) {
    return null;
  }
  const rawPct = (wins / settled) * PERCENT_MULTIPLIER;
  return (
    Math.round(rawPct * WIN_RATE_ROUND_FACTOR) / WIN_RATE_ROUND_FACTOR
  );
}

/**
 * @param {Array<{ result?: string | null }>} rows
 * @param {string} field
 * @returns {Map<string, { total: number; wins: number; pushes: number }>}
 */
function aggregateByField(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const raw = row[field];
    const key =
      raw != null && String(raw).trim() !== '' ? String(raw) : '__empty__';
    if (!map.has(key)) {
      map.set(key, { total: 0, wins: 0, pushes: 0 });
    }
    const acc = map.get(key);
    acc.total += 1;
    if (row.result === RESULT_WIN) acc.wins += 1;
    if (row.result === RESULT_PUSH) acc.pushes += 1;
  }
  return map;
}

function mapToBetTypeRows(map) {
  const rows = [];
  for (const [key, acc] of map) {
    const betType = key === '__empty__' ? null : key;
    rows.push({
      bet_type: betType,
      total: acc.total,
      wins: acc.wins,
      pushes: acc.pushes,
      win_rate_pct: calcWinRatePct(acc.total, acc.wins, acc.pushes),
    });
  }
  rows.sort((a, b) => {
    const ar = a.win_rate_pct;
    const br = b.win_rate_pct;
    if (ar == null && br == null) return 0;
    if (ar == null) return 1;
    if (br == null) return -1;
    return br - ar;
  });
  return rows;
}

function mapToConfidenceRows(map) {
  const rows = [];
  for (const [key, acc] of map) {
    const confidence = key === '__empty__' ? null : key;
    rows.push({
      confidence,
      total: acc.total,
      wins: acc.wins,
      pushes: acc.pushes,
      win_rate_pct: calcWinRatePct(acc.total, acc.wins, acc.pushes),
    });
  }
  rows.sort((a, b) => {
    const ca = a.confidence != null ? String(a.confidence).toLowerCase() : '';
    const cb = b.confidence != null ? String(b.confidence).toLowerCase() : '';
    const ia = CONFIDENCE_SORT_ORDER.indexOf(ca);
    const ib = CONFIDENCE_SORT_ORDER.indexOf(cb);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return ca.localeCompare(cb, 'ru');
  });
  return rows;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select('bet_type, confidence, result')
      .not('result', 'is', null);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];

    const byTypeMap = aggregateByField(rows, 'bet_type');
    const byConfMap = aggregateByField(rows, 'confidence');

    const by_type = mapToBetTypeRows(byTypeMap);
    const by_confidence = mapToConfidenceRows(byConfMap);

    return Response.json({ by_type, by_confidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
