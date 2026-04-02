import { supabase } from '@/lib/supabase.js';

const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const SYSTEM_MIN_BETS = 5;
const SYSTEM_MIN_WIN_RATE = 0.6;
const CURRENT_SEASON = 2026;

function calculateAttackRating(ops, runsPerGame) {
  if (ops == null || runsPerGame == null) return null;
  if (ops >= 0.75 && runsPerGame >= 5.0) return 'high';
  if (ops >= 0.65 && runsPerGame >= 3.5) return 'medium';
  return 'low';
}

function calculateDefenseRating(teamEra, whip) {
  if (teamEra == null || whip == null) return null;
  if (teamEra <= 3.5 && whip <= 1.15) return 'high';
  if (teamEra <= 4.5 && whip <= 1.4) return 'medium';
  return 'low';
}

export async function POST() {
  try {
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('team_id, result')
      .not('result', 'is', null)
      .not('team_id', 'is', null);

    if (betsError) throw betsError;

    const betsList = Array.isArray(bets) ? bets : [];

    const teamAgg = new Map();

    for (const bet of betsList) {
      const teamId = bet.team_id;
      if (teamId == null) continue;

      if (!teamAgg.has(teamId)) {
        teamAgg.set(teamId, { betsCount: 0, wins: 0, losses: 0 });
      }

      const agg = teamAgg.get(teamId);
      agg.betsCount += 1;
      if (bet.result === RESULT_WIN) agg.wins += 1;
      if (bet.result === RESULT_LOSS) agg.losses += 1;
    }

    const { data: allTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id');

    if (teamsError) throw teamsError;

    let updated = 0;

    for (const team of allTeams || []) {
      const teamId = team.id;
      const agg = teamAgg.get(teamId) || {
        betsCount: 0,
        wins: 0,
        losses: 0,
      };

      const settledWinLoss = agg.wins + agg.losses;
      const winRate = settledWinLoss > 0 ? agg.wins / settledWinLoss : null;
      const overHitRate = agg.betsCount > 0 ? agg.wins / agg.betsCount : 0;
      const selectedForSystem =
        agg.betsCount >= SYSTEM_MIN_BETS &&
        winRate != null &&
        winRate >= SYSTEM_MIN_WIN_RATE;

      const { data: teamStats, error: statsError } = await supabase
        .from('team_stats')
        .select('ops, runs_per_game, team_era, whip')
        .eq('team_id', teamId)
        .eq('season', CURRENT_SEASON)
        .maybeSingle();

      if (statsError) {
        console.error(`Ошибка получения статистики команды ${teamId}:`, statsError);
      }

      const attackRating = teamStats
        ? calculateAttackRating(teamStats.ops, teamStats.runs_per_game)
        : null;
      const defenseRating = teamStats
        ? calculateDefenseRating(teamStats.team_era, teamStats.whip)
        : null;

      const { error: updateError } = await supabase
        .from('teams')
        .update({
          bets_count: agg.betsCount,
          win_rate: winRate,
          over_hit_rate: overHitRate,
          selected_for_system: selectedForSystem,
          attack_rating: attackRating,
          defense_rating: defenseRating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId);

      if (updateError) {
        console.error(`Ошибка обновления команды ${teamId}:`, updateError);
        continue;
      }

      updated += 1;
    }

    return Response.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
