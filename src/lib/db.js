import { supabase } from "@/lib/supabase.js";
import { getPitcherStats, getTeamStats, TEAM_STATS_SEASON } from "@/lib/mlb.js";

const GAME_STATUS_SCHEDULED = "scheduled";
const PITCHER_STATS_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Ожидаемая схема (Supabase / Postgres):
 * - teams: id, mlb_id (unique), name, wins, losses, updated_at
 * - games: mlb_game_id (unique), date, home_team_id, away_team_id,
 *   home_pitcher_id, away_pitcher_id (числовой MLB ID питчера, не FK),
 *   series_game_number, games_in_series, status
 * - pitcher_stats: (mlb_pitcher_id, season) unique, pitcher_name,
 *   era, whip, wins, losses, games_started, innings_pitched,
 *   k_per9, bb_per9, hr_per9, fip, updated_at
 * - team_stats: (team_id, season) unique — team_id FK teams.id,
 *   games_played, runs_per_game, ops, updated_at
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
    if (
      date == null ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
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

/**
 * Сохраняет статистику питчера по сезонам (upsert в pitcher_stats).
 *
 * @param {unknown} pitcherId — MLB id питчера
 * @param {unknown} pitcherName
 * @param {unknown} statsArray — массив сезонов (как из getPitcherStats)
 * @returns {Promise<number>} число строк upsert
 */
export async function upsertPitcherStats(pitcherId, pitcherName, statsArray) {
  try {
    if (!Array.isArray(statsArray)) {
      throw new Error("upsertPitcherStats: statsArray должен быть массивом");
    }

    const mlbPitcherId = Number(pitcherId);
    if (Number.isNaN(mlbPitcherId)) {
      throw new Error("upsertPitcherStats: неверный pitcherId");
    }

    const name =
      pitcherName != null && String(pitcherName).trim() !== ""
        ? String(pitcherName)
        : "";

    if (statsArray.length === 0) {
      return 0;
    }

    const updatedAt = new Date().toISOString();
    const rows = statsArray.map((s) => {
      if (s == null || typeof s !== "object") {
        throw new Error(
          "upsertPitcherStats: элемент statsArray должен быть объектом",
        );
      }
      const row = s;
      const season =
        row.season != null && String(row.season).trim() !== ""
          ? String(row.season)
          : null;
      if (season == null) {
        throw new Error(
          "upsertPitcherStats: у каждого сезона должно быть непустое поле season",
        );
      }
      return {
        mlb_pitcher_id: mlbPitcherId,
        pitcher_name: name,
        season,
        era: row.era,
        whip: row.whip,
        wins: row.wins,
        losses: row.losses,
        games_started: row.games_started,
        innings_pitched: row.innings_pitched,
        k_per9: row.k_per9,
        bb_per9: row.bb_per9,
        hr_per9: row.hr_per9,
        fip: row.fip ?? null,
        updated_at: updatedAt,
      };
    });

    const deduped = Object.values(
      rows.reduce((acc, row) => {
        const key = `${row.mlb_pitcher_id}_${row.season}`;
        acc[key] = row;
        return acc;
      }, {}),
    );

    const { error } = await supabase
      .from("pitcher_stats")
      .upsert(deduped, { onConflict: "mlb_pitcher_id,season" });

    if (error) {
      throw error;
    }

    return deduped.length;
  } catch (err) {
    console.error("upsertPitcherStats:", err);
    throw err;
  }
}

/**
 * Сохраняет статистику команды по сезону (upsert в team_stats).
 * teamId — внутренний id из таблицы teams (не mlb_id).
 *
 * @param {unknown} teamId
 * @param {unknown} statsObj — как из getTeamStats
 * @returns {Promise<number>} число записей (1)
 */
export async function upsertTeamStats(teamId, statsObj) {
  try {
    const internalTeamId = Number(teamId);
    if (Number.isNaN(internalTeamId)) {
      throw new Error("upsertTeamStats: неверный teamId");
    }

    if (statsObj == null || typeof statsObj !== "object") {
      throw new Error("upsertTeamStats: statsObj должен быть объектом");
    }

    const s = statsObj;
    const seasonNum = s.season != null ? Number(s.season) : NaN;
    if (Number.isNaN(seasonNum)) {
      throw new Error("upsertTeamStats: в statsObj нужен числовой season");
    }

    const updatedAt = new Date().toISOString();
    const row = {
      team_id: internalTeamId,
      season: seasonNum,
      games_played: s.games_played,
      runs_per_game: s.runs_per_game,
      ops: s.ops,
      updated_at: updatedAt,
    };

    const { error } = await supabase
      .from("team_stats")
      .upsert(row, { onConflict: "team_id,season" });

    if (error) {
      throw error;
    }

    return 1;
  } catch (err) {
    console.error("upsertTeamStats:", err);
    throw err;
  }
}

/**
 * Подтягивает статистику питчеров и команд за день: для матчей на дату
 * обновляет pitcher_stats и team_stats через MLB API при устаревшем кэше (24 ч).
 *
 * @param {string} date — 'YYYY-MM-DD'
 * @returns {Promise<{
 *   success: true,
 *   pitchers_processed: number,
 *   teams_processed: number,
 * }>}
 */
export async function collectDayStats(date) {
  try {
    if (
      date == null ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      throw new Error("collectDayStats: ожидается date в формате YYYY-MM-DD");
    }

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select(
        "id, mlb_game_id, home_pitcher_id, away_pitcher_id, home_team_id, away_team_id",
      )
      .eq("date", date);

    if (gamesError) {
      throw gamesError;
    }

    const gameList = games ?? [];
    const pitcherIds = new Set();

    for (const g of gameList) {
      if (g.home_pitcher_id != null) {
        const n = Number(g.home_pitcher_id);
        if (!Number.isNaN(n)) {
          pitcherIds.add(n);
        }
      }
      if (g.away_pitcher_id != null) {
        const n = Number(g.away_pitcher_id);
        if (!Number.isNaN(n)) {
          pitcherIds.add(n);
        }
      }
    }

    const cutoffIso = new Date(
      Date.now() - PITCHER_STATS_FRESH_WINDOW_MS,
    ).toISOString();

    let pitchersProcessed = 0;

    for (const pitcherId of pitcherIds) {
      const { data: freshRow, error: freshError } = await supabase
        .from("pitcher_stats")
        .select("id")
        .eq("mlb_pitcher_id", pitcherId)
        .gt("updated_at", cutoffIso)
        .limit(1)
        .maybeSingle();

      if (freshError) {
        throw freshError;
      }

      if (freshRow != null) {
        continue;
      }

      const { pitcherName, seasons } = await getPitcherStats(pitcherId);
      await upsertPitcherStats(pitcherId, pitcherName, seasons);
      pitchersProcessed += 1;
    }

    const teamIds = new Set();
    for (const g of gameList) {
      if (g.home_team_id != null) {
        const n = Number(g.home_team_id);
        if (!Number.isNaN(n)) {
          teamIds.add(n);
        }
      }
      if (g.away_team_id != null) {
        const n = Number(g.away_team_id);
        if (!Number.isNaN(n)) {
          teamIds.add(n);
        }
      }
    }

    let teamsProcessed = 0;

    if (teamIds.size > 0) {
      const teamIdList = Array.from(teamIds);
      const { data: teamRows, error: teamsLookupError } = await supabase
        .from("teams")
        .select("id, mlb_id")
        .in("id", teamIdList);

      if (teamsLookupError) {
        throw teamsLookupError;
      }

      const teamsList = teamRows ?? [];

      for (const teamRow of teamsList) {
        if (teamRow.mlb_id == null) {
          continue;
        }

        const mlbTeamId = Number(teamRow.mlb_id);
        if (Number.isNaN(mlbTeamId)) {
          continue;
        }

        const internalId = Number(teamRow.id);
        if (Number.isNaN(internalId)) {
          continue;
        }

        const { data: freshTeamRow, error: freshTeamError } = await supabase
          .from("team_stats")
          .select("id")
          .eq("team_id", internalId)
          .eq("season", TEAM_STATS_SEASON)
          .gt("updated_at", cutoffIso)
          .limit(1)
          .maybeSingle();

        if (freshTeamError) {
          throw freshTeamError;
        }

        if (freshTeamRow != null) {
          continue;
        }

        console.log("getTeamStats: mlbTeamId =", mlbTeamId);
        const teamStats = await getTeamStats(mlbTeamId);
        console.log("getTeamStats result:", teamStats);
        await upsertTeamStats(internalId, teamStats);
        teamsProcessed += 1;
      }
    }

    return {
      success: true,
      pitchers_processed: pitchersProcessed,
      teams_processed: teamsProcessed,
    };
  } catch (err) {
    console.error("collectDayStats:", err);
    throw err;
  }
}
