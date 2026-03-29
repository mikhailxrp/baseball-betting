import { supabase } from "@/lib/supabase.js";

const GAME_STATUS_SCHEDULED = "scheduled";

/**
 * Ожидаемая схема (Supabase / Postgres):
 * - teams: id, mlb_id (unique), name, wins, losses, updated_at
 * - games: mlb_game_id (unique), date, home_team_id, away_team_id,
 *   home_pitcher_id, away_pitcher_id (числовой MLB ID питчера, не FK),
 *   series_game_number, games_in_series, status
 */

/**
 * @param {{ mlb_id?: unknown, name?: unknown, wins?: unknown, losses?: unknown }} team
 */
async function upsertTeamRow(team) {
  if (team == null || team.mlb_id == null) {
    throw new Error("upsertTeamRow: у команды должен быть mlb_id");
  }

  const row = {
    mlb_id: Number(team.mlb_id),
    name: team.name != null ? String(team.name) : "",
    wins: team.wins != null ? Number(team.wins) : null,
    losses: team.losses != null ? Number(team.losses) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("teams")
    .upsert(row, { onConflict: "mlb_id" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  if (data == null || data.id == null) {
    throw new Error("upsertTeamRow: не получен id команды после upsert");
  }
  return data.id;
}

/**
 * MLB API id питчера для колонок games.home_pitcher_id / away_pitcher_id.
 * @param {{ mlb_id?: unknown } | null | undefined} pitcher
 * @returns {number | null}
 */
function mlbPitcherIdOrNull(pitcher) {
  if (pitcher == null || pitcher.mlb_id == null) {
    return null;
  }
  const n = Number(pitcher.mlb_id);
  return Number.isNaN(n) ? null : n;
}

/**
 * Сохраняет команды и матчи из результата transformSchedule.
 *
 * @param {unknown} games
 * @returns {Promise<number>}
 */
export async function upsertTeamsAndGames(games) {
  try {
    if (!Array.isArray(games)) {
      return 0;
    }

    let recorded = 0;

    for (const game of games) {
      if (game == null || typeof game !== "object") {
        continue;
      }

      const g = game;
      const mlbGameId = g.mlb_game_id;
      const date = g.date;

      if (mlbGameId == null || date == null || String(date).trim() === "") {
        throw new Error(
          "upsertTeamsAndGames: у матча должны быть mlb_game_id и date",
        );
      }

      const homeTeam = g.home_team;
      const awayTeam = g.away_team;

      const homeTeamId = await upsertTeamRow(homeTeam);
      const awayTeamId = await upsertTeamRow(awayTeam);

      const homePitcherId = mlbPitcherIdOrNull(homeTeam?.pitcher);
      const awayPitcherId = mlbPitcherIdOrNull(awayTeam?.pitcher);

      const seriesNum = g.series_game_number;
      const seriesTotal = g.games_in_series;

      const gameRow = {
        mlb_game_id: Number(mlbGameId),
        date: String(date),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_pitcher_id: homePitcherId,
        away_pitcher_id: awayPitcherId,
        series_game_number:
          seriesNum != null && !Number.isNaN(Number(seriesNum))
            ? Number(seriesNum)
            : null,
        games_in_series:
          seriesTotal != null && !Number.isNaN(Number(seriesTotal))
            ? Number(seriesTotal)
            : null,
        status: GAME_STATUS_SCHEDULED,
      };

      const { error: gameError } = await supabase
        .from("games")
        .upsert(gameRow, { onConflict: "mlb_game_id" });

      if (gameError) {
        throw gameError;
      }

      recorded += 1;
    }

    return recorded;
  } catch (err) {
    console.error("upsertTeamsAndGames:", err);
    throw err;
  }
}

/**
 * Матчи за дату с названиями команд (вложенные объекты home_team / away_team).
 *
 * @param {string} date — 'YYYY-MM-DD'
 * @returns {Promise<object[]>}
 */
export async function getGamesFromDB(date) {
  try {
    if (date == null || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("getGamesFromDB: ожидается date в формате YYYY-MM-DD");
    }

    const { data, error } = await supabase
      .from("games")
      .select(
        `
        *,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name)
      `,
      )
      .eq("date", date);

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch (err) {
    console.error("getGamesFromDB:", err);
    throw err;
  }
}
