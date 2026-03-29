const REGULAR_SEASON_GAME_TYPE = "R";

/**
 * @param {unknown} probablePitcher — teams.*.probablePitcher из MLB API
 * @returns {{ mlb_id: number, name: string } | null}
 */
function mapProbablePitcher(probablePitcher) {
  if (probablePitcher == null || typeof probablePitcher !== "object") {
    return null;
  }
  const id = probablePitcher.id;
  const name = probablePitcher.fullName;
  if (id == null || name == null) {
    return null;
  }
  return { mlb_id: id, name };
}

/**
 * @param {unknown} side — teams.home или teams.away
 */
function mapTeamSide(side) {
  const team = side?.team;
  const record = side?.leagueRecord;
  return {
    mlb_id: team?.id,
    name: team?.name,
    wins: record?.wins,
    losses: record?.losses,
    pitcher: mapProbablePitcher(side?.probablePitcher)
  };
}

/**
 * @param {string | undefined} gameDate — ISO из поля gameDate
 * @returns {string | null}
 */
function gameTimeUtcFromGameDate(gameDate) {
  if (gameDate == null || gameDate === "") {
    return null;
  }
  const ms = Date.parse(gameDate);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

/**
 * @param {Record<string, unknown>} game — элемент из dates[].games[]
 */
function mapGame(game) {
  return {
    mlb_game_id: game.gamePk,
    date: game.officialDate,
    series_game_number: game.seriesGameNumber,
    games_in_series: game.gamesInSeries,
    day_night: game.dayNight,
    venue_name: game.venue?.name,
    game_time_utc: gameTimeUtcFromGameDate(game.gameDate),
    home_team: mapTeamSide(game.teams?.home),
    away_team: mapTeamSide(game.teams?.away)
  };
}

/**
 * Нормализует ответ `/api/v1/schedule` MLB Stats API в плоский список матчей.
 * @param {unknown} mlbApiResponse — тело ответа schedule
 * @returns {object[]}
 */
export function transformSchedule(mlbApiResponse) {
  if (mlbApiResponse == null || typeof mlbApiResponse !== "object") {
    return [];
  }

  const dates = Array.isArray(mlbApiResponse.dates)
    ? mlbApiResponse.dates
    : [];

  const result = [];

  for (const day of dates) {
    const games = Array.isArray(day.games) ? day.games : [];
    for (const game of games) {
      if (game == null || typeof game !== "object") {
        continue;
      }
      if (game.gameType !== REGULAR_SEASON_GAME_TYPE) {
        continue;
      }
      result.push(mapGame(game));
    }
  }

  return result;
}
