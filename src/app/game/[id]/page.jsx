import Link from "next/link";
import { notFound } from "next/navigation";

import { GamePageClient } from "@/components/game/GamePageClient.jsx";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGamePageData } from "@/lib/db.js";
import { TEAM_STATS_SEASON } from "@/lib/mlb.js";

const PITCHING_STAT_DECIMALS = 3;
const OPS_DECIMALS = 3;
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
 * @param {{ season?: unknown; era?: unknown; fip?: unknown; whip?: unknown }} row
 */
function PitcherSeasonRow({ row }) {
  const seasonLabel =
    row.season != null && String(row.season).trim() !== ""
      ? String(row.season)
      : "—";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 py-2 last:border-b-0">
      <Badge variant="secondary">{seasonLabel}</Badge>
      <span className="text-muted-foreground">
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {name != null ? (
          <CardDescription>{name}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Нет данных по сезонам.</p>
        ) : (
          rows.map((row, index) => (
            <PitcherSeasonRow
              key={`${row.season ?? index}-${index}`}
              row={row}
            />
          ))
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Сезон {TEAM_STATS_SEASON} (команда)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">OPS: </span>
          {formatOptionalNumber(ops, OPS_DECIMALS)}
        </p>
        <p>
          <span className="text-muted-foreground">Runs/game: </span>
          {formatOptionalNumber(runsPerGame, RUNS_PER_GAME_DECIMALS)}
        </p>
      </CardContent>
    </Card>
  );
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
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Ошибка загрузки</CardTitle>
            <CardDescription>
              Не удалось загрузить данные матча. Попробуйте позже.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/"
              className="text-primary underline-offset-4 hover:underline"
            >
              На главную
            </Link>
          </CardContent>
        </Card>
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {data.awayTeamName} @ {data.homeTeamName}
        </h1>
        <p className="text-sm text-muted-foreground">
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

      <GamePageClient
        mlbGameId={data.mlb_game_id}
        gameInternalId={data.gameInternalId}
      />
    </div>
  );
}
