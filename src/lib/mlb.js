const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const PITCHER_STATS_QUERY = "stats=yearByYear&group=pitching";
const BATTER_HITTING_STATS_QUERY = "stats=yearByYear&group=hitting";
const TEAM_STATS_QUERY = "stats=season&group=hitting";

/** Сезоны для кэша hitting-статистики бэттеров (регулярка). */
const BATTER_STATS_SEASONS = new Set(["2024", "2025", "2026"]);

const MLB_GAME_TYPE_REGULAR = "R";

function buildTeamPitchingStatsQuery() {
  return `stats=season&group=pitching&season=${TEAM_STATS_SEASON}`;
}

/** Сезон для team hitting / pitching stats (MLB Stats API). */
export const TEAM_STATS_SEASON = 2026;

/** Сезоны для топа бэттеров на странице матча (таблица batter_stats). */
export const GAME_PAGE_TOP_BATTER_SEASONS = ["2025", "2026"];

/** Число бэттеров в топе на странице матча. */
export const GAME_PAGE_TOP_BATTER_LIMIT = 3;

const FIP_CONSTANT = 3.1;

/**
 * @param {object} st — pitching stat из MLB API
 * @returns {number | null}
 */
function computeFip(st) {
  const hr = Number(st.homeRuns);
  const bb = Number(st.baseOnBalls);
  const k = Number(st.strikeOuts);
  const ip = parseFloat(st.inningsPitched);

  if (
    !Number.isFinite(hr) ||
    !Number.isFinite(bb) ||
    !Number.isFinite(k) ||
    !Number.isFinite(ip) ||
    ip <= 0
  ) {
    return null;
  }

  const fip = (13 * hr + 3 * bb - 2 * k) / ip + FIP_CONSTANT;
  return Math.round(fip * 100) / 100;
}

/** @param {unknown} value */
function parseStatNumber(value) {
  if (value == null || value === "" || value === "-.--") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} split
 * @returns {{
 *   season: string,
 *   era: number | null,
 *   whip: number | null,
 *   wins: number | null,
 *   losses: number | null,
 *   games_started: number | null,
 *   innings_pitched: string,
 *   k_per9: number | null,
 *   bb_per9: number | null,
 *   hr_per9: number | null,
 *   team_id: number | null,
 *   team_name: string | null,
 *   fip: number | null,
 * } | null}
 */
function mapSplitToSeason(split) {
  if (split == null || typeof split !== "object") {
    return null;
  }
  const s = split;
  const stat = s.stat;
  if (stat == null || typeof stat !== "object") {
    return null;
  }
  const st = stat;

  if (s.season == null || String(s.season).trim() === "") {
    return null;
  }

  return {
    season: String(s.season),
    team_id: split.team?.id ?? null,
    team_name: split.team?.name ?? null,
    era: parseStatNumber(st.era),
    whip: parseStatNumber(st.whip),
    wins: st.wins != null ? Number(st.wins) : null,
    losses: st.losses != null ? Number(st.losses) : null,
    games_started:
      st.gamesStarted != null ? Number(st.gamesStarted) : null,
    innings_pitched:
      st.inningsPitched != null ? String(st.inningsPitched) : "",
    k_per9: parseStatNumber(st.strikeoutsPer9Inn),
    bb_per9: parseStatNumber(st.walksPer9Inn),
    hr_per9: parseStatNumber(st.homeRunsPer9),
    fip: computeFip(st),
  };
}

/**
 * Сезонная pitching-статистика питчера (yearByYear) из MLB Stats API.
 *
 * @param {unknown} pitcherId — MLB people id
 * @returns {Promise<{
 *   pitcherName: string,
 *   seasons: Array<{
 *     season: string,
 *     era: number | null,
 *     whip: number | null,
 *     wins: number | null,
 *     losses: number | null,
 *     games_started: number | null,
 *     innings_pitched: string,
 *     k_per9: number | null,
 *     bb_per9: number | null,
 *     hr_per9: number | null,
 *     team_id: number | null,
 *     team_name: string | null,
 *     fip: number | null,
 *   }>,
 * }>}
 */
export async function getPitcherStats(pitcherId) {
  try {
    const id = Number(pitcherId);
    if (Number.isNaN(id)) {
      throw new Error("getPitcherStats: pitcherId должен быть числом");
    }

    const url = `${MLB_STATS_API_BASE}/people/${id}/stats?${PITCHER_STATS_QUERY}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`getPitcherStats: HTTP ${res.status}`);
    }

    const json = await res.json();
    const statsEntry = json?.stats?.[0];
    const splits = statsEntry?.splits;

    if (!Array.isArray(splits)) {
      return { pitcherName: "", seasons: [] };
    }

    const pitcherName =
      splits[0]?.person?.fullName ?? splits[0]?.player?.fullName ?? "";

    const out = [];
    for (const split of splits) {
      const row = mapSplitToSeason(split);
      if (row != null) {
        out.push(row);
      }
    }
    return { pitcherName, seasons: out };
  } catch (err) {
    console.error("getPitcherStats:", err);
    throw err;
  }
}

/**
 * Сезонная hitting- и pitching-статистика команды из MLB Stats API.
 *
 * @param {unknown} teamId — MLB team id (как в /teams/{id})
 * @returns {Promise<{
 *   season: number,
 *   games_played: number | null,
 *   runs_per_game: number | null,
 *   ops: number | null,
 *   lob: number | null,
 *   whip: number | null,
 *   team_era: number | null,
 *   saves: number | null,
 *   blown_saves: number | null,
 * }>}
 */
/**
 * Активный ростер команды (без питчеров).
 *
 * @param {unknown} mlbTeamId — MLB team id
 * @returns {Promise<Array<{ playerId: number, playerName: string }>>}
 */
export async function getActiveRoster(mlbTeamId) {
  try {
    const id = Number(mlbTeamId);
    if (Number.isNaN(id)) {
      throw new Error("getActiveRoster: mlbTeamId должен быть числом");
    }

    const url = `${MLB_STATS_API_BASE}/teams/${id}/roster/active`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`getActiveRoster: HTTP ${res.status}`);
    }

    const json = await res.json();
    const roster = json?.roster;

    if (!Array.isArray(roster)) {
      return [];
    }

    const out = [];
    for (const entry of roster) {
      if (entry == null || typeof entry !== "object") {
        continue;
      }
      const posType = entry.position?.type;
      if (posType === "Pitcher") {
        continue;
      }
      const person = entry.person;
      if (person == null || typeof person !== "object") {
        continue;
      }
      const pid = Number(person.id);
      if (Number.isNaN(pid)) {
        continue;
      }
      const playerName =
        person.fullName != null ? String(person.fullName) : "";
      out.push({ playerId: pid, playerName });
    }

    return out;
  } catch (err) {
    console.error("getActiveRoster:", err);
    throw err;
  }
}

/**
 * @param {unknown} split
 * @returns {{
 *   season: string,
 *   games_played: number | null,
 *   avg: number | null,
 *   obp: number | null,
 *   slg: number | null,
 *   ops: number | null,
 *   home_runs: number | null,
 *   rbi: number | null,
 *   strikeouts: number | null,
 *   at_bats: number | null,
 *   hits: number | null,
 * } | null}
 */
function mapHittingSplitToSeason(split) {
  if (split == null || typeof split !== "object") {
    return null;
  }
  if (split.gameType !== MLB_GAME_TYPE_REGULAR) {
    return null;
  }

  const seasonStr =
    split.season != null ? String(split.season).trim() : "";
  if (seasonStr === "" || !BATTER_STATS_SEASONS.has(seasonStr)) {
    return null;
  }

  const st = split.stat;
  if (st == null || typeof st !== "object") {
    return null;
  }

  return {
    season: seasonStr,
    games_played:
      st.gamesPlayed != null ? Number(st.gamesPlayed) : null,
    avg: parseStatNumber(st.avg),
    obp: parseStatNumber(st.obp),
    slg: parseStatNumber(st.slg),
    ops: parseStatNumber(st.ops),
    home_runs: st.homeRuns != null ? Number(st.homeRuns) : null,
    rbi: st.rbi != null ? Number(st.rbi) : null,
    strikeouts: st.strikeOuts != null ? Number(st.strikeOuts) : null,
    at_bats: st.atBats != null ? Number(st.atBats) : null,
    hits: st.hits != null ? Number(st.hits) : null,
  };
}

/**
 * Сезонная hitting-статистика бэттера (yearByYear, регулярка, сезоны 2024–2026).
 *
 * @param {unknown} playerId — MLB people id
 * @returns {Promise<Array<{
 *   season: string,
 *   games_played: number | null,
 *   avg: number | null,
 *   obp: number | null,
 *   slg: number | null,
 *   ops: number | null,
 *   home_runs: number | null,
 *   rbi: number | null,
 *   strikeouts: number | null,
 *   at_bats: number | null,
 *   hits: number | null,
 * }>>}
 */
export async function getBatterStats(playerId) {
  try {
    const id = Number(playerId);
    if (Number.isNaN(id)) {
      throw new Error("getBatterStats: playerId должен быть числом");
    }

    const url = `${MLB_STATS_API_BASE}/people/${id}/stats?${BATTER_HITTING_STATS_QUERY}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`getBatterStats: HTTP ${res.status}`);
    }

    const json = await res.json();
    const statsEntry = json?.stats?.[0];
    const splits = statsEntry?.splits;

    if (!Array.isArray(splits)) {
      return [];
    }

    const out = [];
    for (const split of splits) {
      const row = mapHittingSplitToSeason(split);
      if (row != null) {
        out.push(row);
      }
    }

    return out;
  } catch (err) {
    console.error("getBatterStats:", err);
    throw err;
  }
}

export async function getTeamStats(teamId) {
  try {
    const id = Number(teamId);
    if (Number.isNaN(id)) {
      throw new Error("getTeamStats: teamId должен быть числом");
    }

    const hittingUrl = `${MLB_STATS_API_BASE}/teams/${id}/stats?${TEAM_STATS_QUERY}&season=${TEAM_STATS_SEASON}`;
    const pitchingUrl = `${MLB_STATS_API_BASE}/teams/${id}/stats?${buildTeamPitchingStatsQuery()}`;

    const [hitRes, pitchRes] = await Promise.all([
      fetch(hittingUrl),
      fetch(pitchingUrl),
    ]);

    if (!hitRes.ok) {
      throw new Error(`getTeamStats (hitting): HTTP ${hitRes.status}`);
    }

    const hitJson = await hitRes.json();
    const stat = hitJson?.stats?.[0]?.splits?.[0]?.stat;

    if (stat == null || typeof stat !== "object") {
      throw new Error("getTeamStats: нет hitting stat в ответе API");
    }

    const st = stat;

    let whip = null;
    let team_era = null;
    let saves = null;
    let blown_saves = null;

    if (pitchRes.ok) {
      try {
        const pitchJson = await pitchRes.json();
        const pst = pitchJson?.stats?.[0]?.splits?.[0]?.stat;
        if (pst != null && typeof pst === "object") {
          whip = parseStatNumber(pst.whip);
          team_era = parseStatNumber(pst.era);
          saves = parseStatNumber(pst.saves);
          blown_saves = parseStatNumber(pst.blownSaves);
        }
      } catch (pitchParseErr) {
        console.error("getTeamStats (pitching parse):", pitchParseErr);
      }
    } else {
      console.warn(
        "getTeamStats (pitching): HTTP",
        pitchRes.status,
        "для team",
        id,
      );
    }

    return {
      season: TEAM_STATS_SEASON,
      games_played: parseStatNumber(st.gamesPlayed),
      runs_per_game:
        st.runs != null && st.gamesPlayed != null && Number(st.gamesPlayed) > 0
          ? Math.round((Number(st.runs) / Number(st.gamesPlayed)) * 100) / 100
          : null,
      ops: parseStatNumber(st.ops ?? null),
      lob: parseStatNumber(st.leftOnBase),
      whip,
      team_era,
      saves,
      blown_saves,
    };
  } catch (err) {
    console.error("getTeamStats:", err);
    throw err;
  }
}
