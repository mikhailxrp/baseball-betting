import { supabase } from "@/lib/supabase.js";
import {
  getActiveRoster,
  getBatterStats,
  getPitcherStats,
  getTeamStats,
  GAME_PAGE_TOP_BATTER_LIMIT,
  GAME_PAGE_TOP_BATTER_SEASONS,
  TEAM_STATS_SEASON,
} from "@/lib/mlb.js";

const GAME_STATUS_SCHEDULED = "scheduled";
const PITCHER_STATS_FRESH_WINDOW_MS = 1 * 60 * 60 * 1000;

/** Параметр маршрута `/game/[id]` — числовой MLB game id. */
const MLB_GAME_ID_ROUTE_PATTERN = /^\d+$/;

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
 *   games_played, runs_per_game, ops, lob, whip, team_era, saves, blown_saves, updated_at
 * - batter_stats: (mlb_player_id, season) unique, player_name, team_id FK teams.id,
 *   games_played, avg, obp, slg, ops, home_runs, rbi, strikeouts, at_bats, hits, updated_at
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
        status: g.status ?? GAME_STATUS_SCHEDULED,
        game_time_utc: g.game_time_utc ?? null,
        venue_name: g.venue_name ?? null,
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
 * Собирает map MLB id питчера → имя из pitcher_stats (несколько сезонов → одно имя).
 *
 * @param {number[]} mlbPitcherIds
 * @returns {Promise<Map<number, string | null>>}
 */
async function pitcherNamesByMlbId(mlbPitcherIds) {
  const map = new Map();
  const unique = [...new Set(mlbPitcherIds)].filter(
    (id) => id != null && !Number.isNaN(Number(id)),
  );
  if (unique.length === 0) {
    return map;
  }

  const { data: rows, error } = await supabase
    .from("pitcher_stats")
    .select("mlb_pitcher_id, pitcher_name")
    .in("mlb_pitcher_id", unique);

  if (error) {
    throw error;
  }

  for (const row of rows ?? []) {
    const pid = row.mlb_pitcher_id;
    if (pid == null) {
      continue;
    }
    const n = Number(pid);
    if (Number.isNaN(n)) {
      continue;
    }
    const raw = row.pitcher_name;
    const name = raw != null && String(raw).trim() !== "" ? String(raw) : null;
    if (!map.has(n)) {
      map.set(n, name);
    } else if (map.get(n) == null && name != null) {
      map.set(n, name);
    }
  }

  return map;
}

/**
 * Матчи за дату с названиями команд (вложенные объекты home_team / away_team)
 * и именами питчеров из pitcher_stats (эквивалент LEFT JOIN; дедуп по сезонам в JS).
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

    const rows = data ?? [];
    const pitcherIds = [];
    for (const g of rows) {
      if (g.home_pitcher_id != null) {
        pitcherIds.push(Number(g.home_pitcher_id));
      }
      if (g.away_pitcher_id != null) {
        pitcherIds.push(Number(g.away_pitcher_id));
      }
    }

    const namesById = await pitcherNamesByMlbId(pitcherIds);

    return rows.map((g) => {
      const homeId =
        g.home_pitcher_id != null ? Number(g.home_pitcher_id) : null;
      const awayId =
        g.away_pitcher_id != null ? Number(g.away_pitcher_id) : null;
      const homePitcherName =
        homeId != null && !Number.isNaN(homeId)
          ? (namesById.get(homeId) ?? null)
          : null;
      const awayPitcherName =
        awayId != null && !Number.isNaN(awayId)
          ? (namesById.get(awayId) ?? null)
          : null;

      return {
        ...g,
        home_pitcher_name: homePitcherName,
        away_pitcher_name: awayPitcherName,
      };
    });
  } catch (err) {
    console.error("getGamesFromDB:", err);
    throw err;
  }
}

/**
 * Данные для страницы матча по `games.mlb_game_id`.
 *
 * @param {string} mlbGameIdRaw — сегмент URL
 * @returns {Promise<null | {
 *   mlb_game_id: number,
 *   game: object,
 *   awayTeamName: string,
 *   homeTeamName: string,
 *   awayPitcherStats: object[],
 *   homePitcherStats: object[],
 *   awayTeamStats: object | null,
 *   homeTeamStats: object | null,
 *   awayTopBatters: object[],
 *   homeTopBatters: object[],
 * }>}
 */
export async function getGamePageData(mlbGameIdRaw) {
  try {
    if (mlbGameIdRaw == null || typeof mlbGameIdRaw !== "string") {
      return null;
    }
    const trimmed = mlbGameIdRaw.trim();
    if (!MLB_GAME_ID_ROUTE_PATTERN.test(trimmed)) {
      return null;
    }
    const mlbGameId = Number(trimmed);

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select(
        "id, home_team_id, away_team_id, home_pitcher_id, away_pitcher_id, series_game_number, games_in_series",
      )
      .eq("mlb_game_id", mlbGameId)
      .maybeSingle();

    if (gameError) {
      throw gameError;
    }
    if (game == null) {
      return null;
    }

    const teamIds = [game.home_team_id, game.away_team_id].filter((tid) => {
      const n = Number(tid);
      return !Number.isNaN(n);
    });

    let teamsList = [];
    if (teamIds.length > 0) {
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      if (teamsError) {
        throw teamsError;
      }
      teamsList = teams ?? [];
    }

    const teamById = new Map(
      teamsList.map((t) => [
        Number(t.id),
        t.name != null ? String(t.name) : "",
      ]),
    );

    const awayTeamName = teamById.get(Number(game.away_team_id)) ?? "—";
    const homeTeamName = teamById.get(Number(game.home_team_id)) ?? "—";

    const pitcherIds = [game.away_pitcher_id, game.home_pitcher_id]
      .map((id) => (id == null ? null : Number(id)))
      .filter((id) => id != null && !Number.isNaN(id));

    let awayPitcherStats = [];
    let homePitcherStats = [];

    if (pitcherIds.length > 0) {
      const { data: pitcherRows, error: pitcherError } = await supabase
        .from("pitcher_stats")
        .select("mlb_pitcher_id, season, era, fip, whip, pitcher_name")
        .in("mlb_pitcher_id", pitcherIds);

      if (pitcherError) {
        throw pitcherError;
      }

      const rows = pitcherRows ?? [];

      const seasonSortKey = (season) => {
        const n = Number(season);
        return Number.isNaN(n) ? 0 : n;
      };

      const sortDesc = (a, b) =>
        seasonSortKey(b.season) - seasonSortKey(a.season);

      const awayId =
        game.away_pitcher_id != null ? Number(game.away_pitcher_id) : null;
      const homeId =
        game.home_pitcher_id != null ? Number(game.home_pitcher_id) : null;

      awayPitcherStats =
        awayId != null && !Number.isNaN(awayId)
          ? rows
              .filter((r) => Number(r.mlb_pitcher_id) === awayId)
              .sort(sortDesc)
          : [];
      homePitcherStats =
        homeId != null && !Number.isNaN(homeId)
          ? rows
              .filter((r) => Number(r.mlb_pitcher_id) === homeId)
              .sort(sortDesc)
          : [];
    }

    let awayTeamStats = null;
    let homeTeamStats = null;

    if (teamIds.length > 0) {
      const { data: teamStatRows, error: teamStatsError } = await supabase
        .from("team_stats")
        .select("team_id, season, ops, runs_per_game")
        .in("team_id", teamIds)
        .eq("season", TEAM_STATS_SEASON);

      if (teamStatsError) {
        throw teamStatsError;
      }

      const statsList = teamStatRows ?? [];
      const findStat = (tid) => {
        const n = Number(tid);
        return statsList.find((s) => Number(s.team_id) === n) ?? null;
      };

      awayTeamStats = findStat(game.away_team_id);
      homeTeamStats = findStat(game.home_team_id);
    }

    /**
     * Топ бэттеров по OPS для команды (сезоны из GAME_PAGE_TOP_BATTER_SEASONS).
     *
     * @param {unknown} teamId
     * @returns {Promise<object[]>}
     */
    const fetchTopBattersForTeam = async (teamId) => {
      const tid = Number(teamId);
      if (Number.isNaN(tid)) {
        return [];
      }
      const { data: batterRows, error: battersError } = await supabase
        .from("batter_stats")
        .select("player_name, ops, avg, home_runs, rbi, season")
        .eq("team_id", tid)
        .in("season", GAME_PAGE_TOP_BATTER_SEASONS)
        .order("ops", { ascending: false })
        .limit(GAME_PAGE_TOP_BATTER_LIMIT);

      if (battersError) {
        throw battersError;
      }
      return batterRows ?? [];
    };

    const [awayTopBatters, homeTopBatters] = await Promise.all([
      fetchTopBattersForTeam(game.away_team_id),
      fetchTopBattersForTeam(game.home_team_id),
    ]);

    return {
      mlb_game_id: mlbGameId,
      gameInternalId: game.id,
      game,
      awayTeamName,
      homeTeamName,
      awayPitcherStats,
      homePitcherStats,
      awayTeamStats,
      homeTeamStats,
      awayTopBatters,
      homeTopBatters,
    };
  } catch (err) {
    console.error("getGamePageData:", err);
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
 * Сохраняет hitting-статистику бэттера по сезонам (upsert в batter_stats).
 *
 * @param {unknown} playerId — MLB id игрока
 * @param {unknown} playerName
 * @param {unknown} teamId — внутренний id из teams
 * @param {unknown} statsArray — массив сезонов (как из getBatterStats)
 * @returns {Promise<number>} число строк upsert
 */
export async function upsertBatterStats(
  playerId,
  playerName,
  teamId,
  statsArray,
) {
  try {
    if (!Array.isArray(statsArray)) {
      throw new Error("upsertBatterStats: statsArray должен быть массивом");
    }

    const mlbPlayerId = Number(playerId);
    if (Number.isNaN(mlbPlayerId)) {
      throw new Error("upsertBatterStats: неверный playerId");
    }

    const internalTeamId = Number(teamId);
    if (Number.isNaN(internalTeamId)) {
      throw new Error("upsertBatterStats: неверный teamId");
    }

    const name =
      playerName != null && String(playerName).trim() !== ""
        ? String(playerName)
        : "";

    if (statsArray.length === 0) {
      return 0;
    }

    const updatedAt = new Date().toISOString();
    const rows = statsArray.map((s) => {
      if (s == null || typeof s !== "object") {
        throw new Error(
          "upsertBatterStats: элемент statsArray должен быть объектом",
        );
      }
      const row = s;
      const season =
        row.season != null && String(row.season).trim() !== ""
          ? String(row.season)
          : null;
      if (season == null) {
        throw new Error(
          "upsertBatterStats: у каждого сезона должно быть непустое поле season",
        );
      }
      return {
        mlb_player_id: mlbPlayerId,
        player_name: name,
        team_id: internalTeamId,
        season,
        games_played: row.games_played,
        avg: row.avg,
        obp: row.obp,
        slg: row.slg,
        ops: row.ops,
        home_runs: row.home_runs,
        rbi: row.rbi,
        strikeouts: row.strikeouts,
        at_bats: row.at_bats,
        hits: row.hits,
        updated_at: updatedAt,
      };
    });

    const deduped = Object.values(
      rows.reduce((acc, row) => {
        const key = `${row.mlb_player_id}_${row.season}`;
        acc[key] = row;
        return acc;
      }, {}),
    );

    const { error } = await supabase
      .from("batter_stats")
      .upsert(deduped, { onConflict: "mlb_player_id,season" });

    if (error) {
      throw error;
    }

    return deduped.length;
  } catch (err) {
    console.error("upsertBatterStats:", err);
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
      lob: s.lob ?? null,
      whip: s.whip ?? null,
      team_era: s.team_era ?? null,
      saves: s.saves ?? null,
      blown_saves: s.blown_saves ?? s.blownSaves ?? null,
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
 * Подтягивает статистику питчеров, команд и бэттеров за день: для матчей на дату
 * обновляет pitcher_stats, team_stats и batter_stats через MLB API.
 *
 * @param {string} date — 'YYYY-MM-DD'
 * @returns {Promise<{
 *   success: true,
 *   pitchers_processed: number,
 *   teams_processed: number,
 *   batters_processed: number,
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

    let pitchersProcessed = 0;

    for (const pitcherId of pitcherIds) {
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
    let battersProcessed = 0;

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

        const teamStats = await getTeamStats(mlbTeamId);
        await upsertTeamStats(internalId, teamStats);
        teamsProcessed += 1;
      }

      for (const teamRow of teamsList) {
        if (teamRow.mlb_id == null) {
          continue;
        }

        const mlbTeamIdBatters = Number(teamRow.mlb_id);
        if (Number.isNaN(mlbTeamIdBatters)) {
          continue;
        }

        const internalIdBatters = Number(teamRow.id);
        if (Number.isNaN(internalIdBatters)) {
          continue;
        }

        const roster = await getActiveRoster(mlbTeamIdBatters);

        for (const { playerId, playerName } of roster) {
          const seasons = await getBatterStats(playerId);
          await upsertBatterStats(
            playerId,
            playerName,
            internalIdBatters,
            seasons,
          );
        }

        battersProcessed += 1;
      }
    }

    return {
      success: true,
      pitchers_processed: pitchersProcessed,
      teams_processed: teamsProcessed,
      batters_processed: battersProcessed,
    };
  } catch (err) {
    console.error("collectDayStats:", err);
    throw err;
  }
}

/**
 * Получает рекомендации по ставкам для матча.
 *
 * @param {unknown} gameInternalId — внутренний id из таблицы games
 * @returns {Promise<object[]>}
 */
export async function getGameBets(gameInternalId) {
  const { data, error } = await supabase
    .from("bets")
    .select(
      "id, bet_type, team_id, line, confidence, reasoning, result, odds, amount, entry_mode, created_at, estimated_probability",
    )
    .eq("game_id", gameInternalId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
