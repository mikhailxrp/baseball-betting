'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PAGE_TITLE = 'Коэффициенты букмекеров';
const EDGE_STRONG_THRESHOLD = 7;
/** Время старта в колонке «Дата» — по Москве. */
const GAME_TIME_DISPLAY_TIMEZONE = 'Europe/Moscow';

const MARKET_LABELS = {
  total_over: 'Тотал больше',
  total_under: 'Тотал меньше',
};

/**
 * @param {unknown} rel
 */
function unwrapRelation(rel) {
  if (rel == null) {
    return null;
  }
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

/**
 * @param {object | null | undefined} game
 */
function matchLabel(game) {
  if (game == null) {
    return '—';
  }
  const away = unwrapRelation(game.away_team)?.name ?? '—';
  const home = unwrapRelation(game.home_team)?.name ?? '—';
  return `${away} @ ${home}`;
}

/**
 * @param {unknown} value
 * @param {number} fractionDigits
 */
function formatPercent(value, fractionDigits) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(fractionDigits)}%`;
}

/**
 * @param {number} edge
 */
function formatEdgeNumber(edge) {
  const n = Number(edge);
  if (Number.isInteger(n)) {
    return String(n);
  }
  return n.toFixed(1);
}

/**
 * @param {number} edge
 */
function edgeBadgeLabel(edge) {
  if (edge >= EDGE_STRONG_THRESHOLD) {
    return `Перевес +${formatEdgeNumber(edge)}%`;
  }
  if (edge >= 0) {
    return `Мало +${formatEdgeNumber(edge)}%`;
  }
  return `Нет ${formatEdgeNumber(edge)}%`;
}

/**
 * @param {{ edge: number }} props
 */
function EdgeBadge({ edge }) {
  if (edge >= EDGE_STRONG_THRESHOLD) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      >
        {edgeBadgeLabel(edge)}
      </Badge>
    );
  }
  if (edge >= 0) {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        {edgeBadgeLabel(edge)}
      </Badge>
    );
  }
  return <Badge variant="destructive">{edgeBadgeLabel(edge)}</Badge>;
}

/**
 * @param {{ line: object }} props
 */
function OddsTableRow({ line }) {
  const game = unwrapRelation(line.game);
  const ourEstimate =
    line.agent_probability != null &&
    !Number.isNaN(Number(line.agent_probability))
      ? Number(line.agent_probability)
      : null;
  const implied =
    line.implied_prob != null && !Number.isNaN(Number(line.implied_prob))
      ? Number(line.implied_prob)
      : null;

  const edge =
    ourEstimate != null && implied != null ? ourEstimate - implied : null;

  const typeLabel = MARKET_LABELS[line.market] ?? line.market ?? '—';

  return (
    <tr className="border-b border-border/60 last:border-b-0">
      <td className="px-3 py-2 align-top">{matchLabel(game)}</td>
      <td className="px-3 py-2 align-top text-muted-foreground">
        {line.game?.date}
        {line.game?.game_time_utc
          ? ' ' +
            new Date(line.game.game_time_utc).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: GAME_TIME_DISPLAY_TIMEZONE,
            }) +
            ' МСК'
          : ''}
      </td>
      <td className="px-3 py-2 align-top">{typeLabel}</td>
      <td className="px-3 py-2 align-top">{line.line ?? '—'}</td>
      <td className="px-3 py-2 align-top">
        {line.agent_line != null ? line.agent_line : '—'}
      </td>
      <td className="px-3 py-2 align-top">{line.best_odds ?? '—'}</td>
      <td className="px-3 py-2 align-top">{line.best_bookmaker ?? '—'}</td>
      <td className="px-3 py-2 align-top">{formatPercent(implied, 2)}</td>
      <td className="px-3 py-2 align-top">
        {ourEstimate != null ? formatPercent(ourEstimate, 1) : '—'}
      </td>
      <td className="px-3 py-2 align-top">
        {edge != null ? <EdgeBadge edge={edge} /> : '—'}
      </td>
    </tr>
  );
}

export default function OddsPage() {
  const [lines, setLines] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLines = useCallback(async () => {
    const linesRes = await fetch('/api/bookmaker-lines');
    const linesJson = await linesRes.json().catch(() => ({}));
    if (!linesRes.ok) {
      throw new Error(
        typeof linesJson.error === 'string'
          ? linesJson.error
          : 'Не удалось загрузить линии букмекеров',
      );
    }

    setLines(Array.isArray(linesJson.lines) ? linesJson.lines : []);
  }, []);

  const refreshAll = useCallback(async () => {
    setPageLoading(true);
    setError(null);
    try {
      const oddsRes = await fetch('/api/fetch-odds');
      const oddsJson = await oddsRes.json().catch(() => ({}));
      if (!oddsRes.ok) {
        setError(
          typeof oddsJson.error === 'string'
            ? oddsJson.error
            : `Ошибка обновления коэффициентов (${oddsRes.status})`,
        );
      }
      await loadLines();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setPageLoading(false);
    }
  }, [loadLines]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {PAGE_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            Тоталы MLB и сравнение с нашей оценкой из анализа
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void refreshAll()}
            disabled={pageLoading}
          >
            Обновить коэффициенты
          </Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            На главную
          </Link>
        </div>
      </header>

      {error != null ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Линии</CardTitle>
          <CardDescription>
            {pageLoading
              ? 'Загрузка и синхронизация с The Odds API…'
              : `Записей: ${lines.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:px-6">
          {pageLoading && lines.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Загрузка…
            </p>
          ) : lines.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Нет данных в bookmaker_lines. Проверьте синхронизацию и ключ
              ODDS_API_KEY.
            </p>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Матч</th>
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium">Линия</th>
                  <th className="px-3 py-2 font-medium">Линия агента</th>
                  <th className="px-3 py-2 font-medium">
                    Лучший коэффициент
                  </th>
                  <th className="px-3 py-2 font-medium">Букмекер</th>
                  <th className="px-3 py-2 font-medium">Implied%</th>
                  <th className="px-3 py-2 font-medium">Наша оценка%</th>
                  <th className="px-3 py-2 font-medium">Перевес</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <OddsTableRow key={line.id} line={line} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
