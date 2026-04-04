import { supabase } from '@/lib/supabase.js';

const BET_TYPES_FILTER = ['ind_total_over', 'max_inning'];

const RESULT_WIN = 'win';
const RESULT_PUSH = 'push';

const WIN_RATE_DECIMAL_PLACES = 2;
const WIN_RATE_ROUND_FACTOR = 10 ** WIN_RATE_DECIMAL_PLACES;

const GRADE_HOT = 'HOT';
const GRADE_STABLE = 'STABLE';
const GRADE_COLD = 'COLD';
const GRADE_AVOID = 'AVOID';
const GRADE_NEW = 'NEW';

const GRADE_SORT_ORDER = {
  [GRADE_HOT]: 0,
  [GRADE_STABLE]: 1,
  [GRADE_COLD]: 2,
  [GRADE_AVOID]: 3,
  [GRADE_NEW]: 4,
};

const MIN_GROUP_TOTAL = 2;
const LAST5_WINDOW_MAX = 5;

/**
 * @param {number} wins
 * @param {number} total
 * @param {number} pushes
 * @returns {number | null}
 */
function calcWinRate(wins, total, pushes) {
  const settled = total - pushes;
  if (settled <= 0) {
    return null;
  }
  const raw = wins / settled;
  return Math.round(raw * WIN_RATE_ROUND_FACTOR) / WIN_RATE_ROUND_FACTOR;
}

/**
 * @param {number} last5Wins
 * @param {number} last5Len
 * @returns {number | null}
 */
function calcLast5Rate(last5Wins, last5Len) {
  if (last5Len <= 0) {
    return null;
  }
  const raw = last5Wins / last5Len;
  return Math.round(raw * WIN_RATE_ROUND_FACTOR) / WIN_RATE_ROUND_FACTOR;
}

/**
 * @param {Array<{ line?: unknown }>} rows
 * @returns {string | number | null}
 */
function mostCommonLine(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key =
      row.line === null || row.line === undefined
        ? '__null__'
        : String(row.line);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    } else if (count === bestCount && bestKey !== null && key < bestKey) {
      bestKey = key;
    }
  }
  if (bestKey === null || bestKey === '__null__') {
    return null;
  }
  const numeric = Number(bestKey);
  return Number.isNaN(numeric) ? bestKey : numeric;
}

/**
 * @param {number} total
 * @param {number} last5Wins
 * @returns {string}
 */
function gradeForGroup(total, last5Wins) {
  if (total < 3) {
    return GRADE_NEW;
  }
  if (last5Wins >= 4) {
    return GRADE_HOT;
  }
  if (last5Wins === 3) {
    return GRADE_STABLE;
  }
  if (last5Wins >= 1) {
    return GRADE_COLD;
  }
  return GRADE_AVOID;
}

/**
 * @param {Array<{
 *   id: unknown,
 *   team_id: unknown,
 *   bet_type: unknown,
 *   line: unknown,
 *   result: unknown,
 *   created_at: unknown,
 *   team?: { name?: string | null } | null
 * }>} rows
 */
function buildTeamBetStats(rows) {
  /** @type {Map<string, typeof rows>} */
  const groups = new Map();

  for (const row of rows) {
    const teamId = row.team_id;
    const betType = row.bet_type;
    if (teamId == null || betType == null) {
      continue;
    }
    const key = `${teamId}::${betType}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  /** @type {Array<Record<string, unknown>>} */
  const out = [];

  for (const groupRows of groups.values()) {
    const total = groupRows.length;
    if (total < MIN_GROUP_TOTAL) {
      continue;
    }

    let wins = 0;
    let pushes = 0;
    for (const r of groupRows) {
      if (r.result === RESULT_WIN) wins += 1;
      else if (r.result === RESULT_PUSH) pushes += 1;
    }

    const sortedDesc = [...groupRows].sort((a, b) => {
      const ta = new Date(String(a.created_at)).getTime();
      const tb = new Date(String(b.created_at)).getTime();
      return tb - ta;
    });
    const last5Take = Math.min(LAST5_WINDOW_MAX, total);
    const last5Slice = sortedDesc.slice(0, last5Take);
    const last5Asc = [...last5Slice].sort((a, b) => {
      const ta = new Date(String(a.created_at)).getTime();
      const tb = new Date(String(b.created_at)).getTime();
      return ta - tb;
    });

    let last5Wins = 0;
    for (const r of last5Slice) {
      if (r.result === RESULT_WIN) last5Wins += 1;
    }

    const last5Len = last5Slice.length;
    const winRate = calcWinRate(wins, total, pushes);
    const last5Rate = calcLast5Rate(last5Wins, last5Len);
    const grade = gradeForGroup(total, last5Wins);
    const first = groupRows[0];
    const teamName = first.team?.name ?? '';

    out.push({
      team_name: teamName,
      team_id: first.team_id,
      bet_type: first.bet_type,
      total,
      wins,
      last5_wins: last5Wins,
      last5_rate: last5Rate,
      win_rate: winRate,
      most_common_line: mostCommonLine(groupRows),
      grade,
      last5: last5Asc.map((r) => r.result),
    });
  }

  out.sort((a, b) => {
    const ga = GRADE_SORT_ORDER[String(a.grade)] ?? 99;
    const gb = GRADE_SORT_ORDER[String(b.grade)] ?? 99;
    if (ga !== gb) return ga - gb;
    const lwA = Number(a.last5_wins);
    const lwB = Number(b.last5_wins);
    if (lwB !== lwA) return lwB - lwA;
    const wrA = a.win_rate == null ? -1 : Number(a.win_rate);
    const wrB = b.win_rate == null ? -1 : Number(b.win_rate);
    return wrB - wrA;
  });

  return out;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select(
        `
        id,
        team_id,
        bet_type,
        line,
        result,
        created_at,
        team:teams!team_id(name)
      `,
      )
      .not('result', 'is', null)
      .not('team_id', 'is', null)
      .in('bet_type', BET_TYPES_FILTER)
      .order('team_id', { ascending: true })
      .order('bet_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const stats = buildTeamBetStats(rows);

    return Response.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
