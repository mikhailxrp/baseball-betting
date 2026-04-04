import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GamePageClient } from '@/components/game/GamePageClient.jsx';
import { getGamePageData } from '@/lib/db.js';
import { TEAM_STATS_SEASON } from '@/lib/mlb.js';

const PITCHING_STAT_DECIMALS = 3;
const OPS_DECIMALS = 3;
const AVG_DECIMALS = 3;
const RUNS_PER_GAME_DECIMALS = 2;

/**
 * @param {unknown} value
 * @param {number} fractionDigits
 */
function formatOptionalNumber(value, fractionDigits) {
  if (value == null || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toFixed(fractionDigits);
}

/**
 * @param {unknown} value
 */
function formatOptionalInt(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "—";
  }
  return String(Math.round(Number(value)));
}

/**
 * @param {{ season?: unknown; era?: unknown; fip?: unknown; whip?: unknown }} row
 */
function PitcherSeasonRow({ row }) {
  const seasonLabel =
    row.season != null && String(row.season).trim() !== ""
      ? String(row.season)
      : "—";

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2 last:border-b-0"
      style={{ borderBottom: '1px solid #2A3550' }}
    >
      <div
        className="inline-block px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(61, 111, 255, 0.2)',
          color: '#3D6FFF',
        }}
      >
        {seasonLabel}
      </div>
      <span style={{ color: '#8B93A7' }}>
        ERA {formatOptionalNumber(row.era, PITCHING_STAT_DECIMALS)} · FIP{" "}
        {formatOptionalNumber(row.fip, PITCHING_STAT_DECIMALS)} · WHIP{" "}
        {formatOptionalNumber(row.whip, PITCHING_STAT_DECIMALS)}
      </span>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   pitcherName?: string | null;
 *   rows: object[];
 * }} props
 */
function PitcherStatsBlock({ title, pitcherName, rows }) {
  const name =
    pitcherName != null && String(pitcherName).trim() !== ""
      ? String(pitcherName)
      : null;

  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
      }}
    >
      <h3 className="text-base font-medium mb-2" style={{ color: '#FFFFFF' }}>
        {title}
      </h3>
      {name != null && (
        <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
          {name}
        </p>
      )}
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: '#8B93A7' }}>
            Нет данных по сезонам.
          </p>
        ) : (
          rows.map((row, index) => (
            <PitcherSeasonRow
              key={`${row.season ?? index}-${index}`}
              row={row}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   ops?: unknown;
 *   runsPerGame?: unknown;
 * }} props
 */
function TeamStatsBlock({ title, ops, runsPerGame }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
      }}
    >
      <h3 className="text-base font-medium mb-2" style={{ color: '#FFFFFF' }}>
        {title}
      </h3>
      <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
        Сезон {TEAM_STATS_SEASON} (команда)
      </p>
      <div className="space-y-2 text-sm" style={{ color: '#FFFFFF' }}>
        <p>
          <span style={{ color: '#8B93A7' }}>OPS: </span>
          {formatOptionalNumber(ops, OPS_DECIMALS)}
        </p>
        <p>
          <span style={{ color: '#8B93A7' }}>Runs/game: </span>
          {formatOptionalNumber(runsPerGame, RUNS_PER_GAME_DECIMALS)}
        </p>
      </div>
    </div>
  );
}

/**
 * @param {{ player_name?: unknown; ops?: unknown; avg?: unknown; home_runs?: unknown; season?: unknown }} row
 */
function BatterTopRow({ row }) {
  const name =
    row.player_name != null && String(row.player_name).trim() !== ""
      ? String(row.player_name)
      : "—";
  const seasonLabel =
    row.season != null && String(row.season).trim() !== ""
      ? String(row.season)
      : "—";

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2 last:border-b-0"
      style={{ borderBottom: '1px solid #2A3550' }}
    >
      <span className="min-w-0 shrink font-medium" style={{ color: '#FFFFFF' }}>
        {name}
      </span>
      <span style={{ color: '#8B93A7' }}>
        OPS {formatOptionalNumber(row.ops, OPS_DECIMALS)} · AVG{" "}
        {formatOptionalNumber(row.avg, AVG_DECIMALS)} · HR{" "}
        {formatOptionalInt(row.home_runs)}
      </span>
      <div
        className="inline-block px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(61, 111, 255, 0.2)',
          color: '#3D6FFF',
        }}
      >
        {seasonLabel}
      </div>
    </div>
  );
}

/**
 * @param {{ title: string; rows: object[] }} props
 */
function BatterTopBlock({ title, rows }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
      }}
    >
      <h3 className="text-base font-medium mb-4" style={{ color: '#FFFFFF' }}>
        {title}
      </h3>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: '#8B93A7' }}>
            Нет данных по бэттерам.
          </p>
        ) : (
          rows.map((row, index) => (
            <BatterTopRow
              key={`${nameKey(row)}-${row.season ?? index}-${index}`}
              row={row}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * @param {object} row
 */
function nameKey(row) {
  const n = row?.player_name;
  return n != null && String(n).trim() !== "" ? String(n) : "unknown";
}

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function GamePage({ params }) {
  const { id } = await params;

  let data;
  try {
    data = await getGamePageData(id);
  } catch {
    return (
      <div
        style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: '#1A2540',
              border: '1px solid #2A3550',
            }}
          >
            <h2 className="text-xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
              Ошибка загрузки
            </h2>
            <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
              Не удалось загрузить данные матча. Попробуйте позже.
            </p>
            <Link
              href="/"
              className="underline-offset-4 hover:underline"
              style={{ color: '#3D6FFF' }}
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data == null) {
    notFound();
  }

  const awayPitcherName =
    data.awayPitcherStats[0]?.pitcher_name != null
      ? String(data.awayPitcherStats[0].pitcher_name)
      : null;
  const homePitcherName =
    data.homePitcherStats[0]?.pitcher_name != null
      ? String(data.homePitcherStats[0].pitcher_name)
      : null;

  return (
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium" style={{ color: '#FFFFFF' }}>
            {data.awayTeamName} @ {data.homeTeamName}
          </h1>
          <p className="text-sm" style={{ color: '#8B93A7' }}>
            MLB game id: {data.mlb_game_id}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <PitcherStatsBlock
            title={`Питчер (away): ${data.awayTeamName}`}
            pitcherName={awayPitcherName}
            rows={data.awayPitcherStats}
          />
          <PitcherStatsBlock
            title={`Питчер (home): ${data.homeTeamName}`}
            pitcherName={homePitcherName}
            rows={data.homePitcherStats}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TeamStatsBlock
            title={`Команда (away): ${data.awayTeamName}`}
            ops={data.awayTeamStats?.ops}
            runsPerGame={data.awayTeamStats?.runs_per_game}
          />
          <TeamStatsBlock
            title={`Команда (home): ${data.homeTeamName}`}
            ops={data.homeTeamStats?.ops}
            runsPerGame={data.homeTeamStats?.runs_per_game}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BatterTopBlock
            title={`Топ бэттеры: ${data.awayTeamName}`}
            rows={data.awayTopBatters}
          />
          <BatterTopBlock
            title={`Топ бэттеры: ${data.homeTeamName}`}
            rows={data.homeTopBatters}
          />
        </div>

        <GamePageClient
          mlbGameId={data.mlb_game_id}
          gameInternalId={data.gameInternalId}
        />
      </div>
    </div>
  );
}
