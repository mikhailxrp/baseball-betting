const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const PITCHER_STATS_QUERY = "stats=yearByYear&group=pitching";
const TEAM_STATS_QUERY = "stats=season&group=hitting";

/** Сезон для team hitting stats (MLB Stats API). */
export const TEAM_STATS_SEASON = 2026;

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
 * Сезонная hitting-статистика команды из MLB Stats API.
 *
 * @param {unknown} teamId — MLB team id (как в /teams/{id})
 * @returns {Promise<{
 *   season: number,
 *   games_played: number | null,
 *   runs_per_game: number | null,
 *   ops: number | null,
 * }>}
 */
export async function getTeamStats(teamId) {
  try {
    const id = Number(teamId);
    if (Number.isNaN(id)) {
      throw new Error("getTeamStats: teamId должен быть числом");
    }

    const url = `${MLB_STATS_API_BASE}/teams/${id}/stats?${TEAM_STATS_QUERY}&season=${TEAM_STATS_SEASON}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`getTeamStats: HTTP ${res.status}`);
    }

    const json = await res.json();
    const stat = json?.stats?.[0]?.splits?.[0]?.stat;

    if (stat == null || typeof stat !== "object") {
      throw new Error("getTeamStats: нет stat в ответе API");
    }

    const st = stat;

    return {
      season: TEAM_STATS_SEASON,
      games_played: parseStatNumber(st.gamesPlayed),
      runs_per_game:
        st.runs != null && st.gamesPlayed != null && Number(st.gamesPlayed) > 0
          ? Math.round((Number(st.runs) / Number(st.gamesPlayed)) * 100) / 100
          : null,
      ops: parseStatNumber(st.ops ?? null),
    };
  } catch (err) {
    console.error("getTeamStats:", err);
    throw err;
  }
}
