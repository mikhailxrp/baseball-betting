'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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
      <div
        className="inline-block px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(0, 196, 140, 0.2)',
          color: '#00C48C',
        }}
      >
        {edgeBadgeLabel(edge)}
      </div>
    );
  }
  if (edge >= 0) {
    return (
      <div
        className="inline-block px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(139, 147, 167, 0.2)',
          color: '#8B93A7',
        }}
      >
        {edgeBadgeLabel(edge)}
      </div>
    );
  }
  return (
    <div
      className="inline-block px-2 py-1 rounded text-xs"
      style={{
        backgroundColor: 'rgba(255, 77, 106, 0.2)',
        color: '#FF4D6A',
      }}
    >
      {edgeBadgeLabel(edge)}
    </div>
  );
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
    <tr
      className="transition-all last:border-b-0"
      style={{
        borderBottom: '1px solid #2A3550',
        color: '#FFFFFF',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(61, 111, 255, 0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <td className="px-3 py-2 align-top">
        {matchLabel(game)}
        <div className="text-xs mt-1" style={{ color: '#8B93A7' }}>
          Ставка:{' '}
          {line.game?.bets?.find((b) => b.bet_type === line.market)?.team
            ?.name ?? line.bet_team_name ?? line.team?.name ?? '—'}
        </div>
      </td>
      <td className="px-3 py-2 align-top" style={{ color: '#8B93A7' }}>
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
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
              {PAGE_TITLE}
            </h1>
            <p style={{ color: '#8B93A7' }}>
              Тоталы MLB и сравнение с нашей оценкой из анализа
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={pageLoading}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: '#3D6FFF',
                color: '#FFFFFF',
                opacity: pageLoading ? 0.6 : 1,
                cursor: pageLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Обновить коэффициенты
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                border: '1px solid #3D6FFF',
                color: '#3D6FFF',
                backgroundColor: 'transparent',
              }}
            >
              На главную
            </Link>
          </div>
        </header>

        {error != null && (
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: '#1A2540',
              border: '1px solid #FF4D6A',
            }}
          >
            <h3 className="text-base font-medium mb-2" style={{ color: '#FF4D6A' }}>
              Ошибка
            </h3>
            <p style={{ color: '#8B93A7' }}>{error}</p>
          </div>
        )}

        <div
          className="rounded-xl"
          style={{
            backgroundColor: '#1A2540',
            border: '1px solid #2A3550',
          }}
        >
          <div className="p-6 pb-4">
            <h2 className="text-base font-medium mb-2" style={{ color: '#FFFFFF' }}>
              Линии
            </h2>
            <p style={{ color: '#8B93A7' }}>
              {pageLoading
                ? 'Загрузка и синхронизация с The Odds API…'
                : `Записей: ${lines.length}`}
            </p>
          </div>
          <div className="overflow-x-auto">
            {pageLoading && lines.length === 0 ? (
              <p className="px-6 pb-6 text-sm" style={{ color: '#8B93A7' }}>
                Загрузка…
              </p>
            ) : lines.length === 0 ? (
              <p className="px-6 pb-6 text-sm" style={{ color: '#8B93A7' }}>
                Нет данных в bookmaker_lines. Проверьте синхронизацию и ключ
                ODDS_API_KEY.
              </p>
            ) : (
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr
                    className="text-left"
                    style={{ color: '#8B93A7', borderBottom: '1px solid #2A3550' }}
                  >
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
          </div>
        </div>
      </div>
    </div>
  );
}
