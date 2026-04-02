import { supabase } from '@/lib/supabase.js';

const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const RESULT_PUSH = 'push';
const PERCENT_MULTIPLIER = 100;
const ROUND_PRECISION = 100;

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function roundToTwo(value) {
  return Math.round(value * ROUND_PRECISION) / ROUND_PRECISION;
}

function calcProfit(result, amountRaw, oddsRaw) {
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

function calcWinrate(wins, losses) {
  const settled = wins + losses;
  if (settled === 0) {
    return 0;
  }
  return (wins / settled) * PERCENT_MULTIPLIER;
}

function calcRoi(totalProfit, totalAmount) {
  if (totalAmount === 0) {
    return 0;
  }
  return (totalProfit / totalAmount) * PERCENT_MULTIPLIER;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bets')
      .select(`
        id, bet_type, result, odds, amount,
        game:games!inner(id, date),
        team:teams!team_id(name)
      `)
      .not('result', 'is', null)
      .not('odds', 'is', null);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];

    const summaryAcc = {
      total_profit: 0,
      total_amount: 0,
      total_bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
    };

    const byTeamAcc = new Map();

    for (const row of rows) {
      const result = row?.result;
      const amount = toNumberOrZero(row?.amount);
      const odds = toNumberOrZero(row?.odds);
      const profit = calcProfit(result, amount, odds);

      summaryAcc.total_profit += profit;
      summaryAcc.total_amount += amount;
      summaryAcc.total_bets += 1;
      if (result === RESULT_WIN) summaryAcc.wins += 1;
      if (result === RESULT_LOSS) summaryAcc.losses += 1;
      if (result === RESULT_PUSH) summaryAcc.pushes += 1;

      const teamNameRaw = row?.team?.name;
      const teamName =
        teamNameRaw != null && String(teamNameRaw).trim() !== ''
          ? String(teamNameRaw)
          : null;

      if (teamName == null) {
        continue;
      }

      const betTypeRaw = row?.bet_type;
      const betType =
        betTypeRaw != null && String(betTypeRaw).trim() !== ''
          ? String(betTypeRaw)
          : null;

      if (betType == null) {
        continue;
      }

      const teamBetTypeKey = `${teamName}__${betType}`;
      if (!byTeamAcc.has(teamBetTypeKey)) {
        byTeamAcc.set(teamBetTypeKey, {
          team_name: teamName,
          bet_type: betType,
          bets: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          profit: 0,
        });
      }

      const teamAgg = byTeamAcc.get(teamBetTypeKey);
      teamAgg.bets += 1;
      teamAgg.profit += profit;
      if (result === RESULT_WIN) teamAgg.wins += 1;
      if (result === RESULT_LOSS) teamAgg.losses += 1;
      if (result === RESULT_PUSH) teamAgg.pushes += 1;
    }

    const summary = {
      total_profit: roundToTwo(summaryAcc.total_profit),
      roi: roundToTwo(calcRoi(summaryAcc.total_profit, summaryAcc.total_amount)),
      total_bets: summaryAcc.total_bets,
      wins: summaryAcc.wins,
      losses: summaryAcc.losses,
      pushes: summaryAcc.pushes,
      winrate: roundToTwo(calcWinrate(summaryAcc.wins, summaryAcc.losses)),
    };

    const by_team = Array.from(byTeamAcc.values())
      .map((row) => ({
        ...row,
        profit: roundToTwo(row.profit),
        winrate: roundToTwo(calcWinrate(row.wins, row.losses)),
      }))
      .sort((a, b) => b.profit - a.profit);

    return Response.json({ summary, by_team });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
