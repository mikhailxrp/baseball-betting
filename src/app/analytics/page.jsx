'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const BET_TYPE_LABELS = {
  total_over: 'Тотал больше',
  total_under: 'Тотал меньше',
  ind_total_over: 'Инд. тотал больше',
  max_inning: 'Макс. иннинг',
};

const CONFIDENCE_LABELS = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const WIN_RATE_GOOD_PCT = 60;
const WIN_RATE_BAD_PCT = 45;
const WIN_RATE_STABLE_PCT = 55;
const MIN_BETS_FOR_BAD_TYPE_WARNING = 10;

const WIN_RATE_DISPLAY_DECIMALS = 1;

function formatBetType(value) {
  if (value == null || String(value).trim() === '') {
    return '—';
  }
  return BET_TYPE_LABELS[value] ?? value;
}

function formatConfidence(value) {
  if (value == null || String(value).trim() === '') {
    return '—';
  }
  const key = String(value).toLowerCase();
  return CONFIDENCE_LABELS[key] ?? value;
}

function getWinRateBgColor(winRatePct) {
  if (winRatePct == null || Number.isNaN(Number(winRatePct))) {
    return 'transparent';
  }
  const n = Number(winRatePct);
  if (n >= WIN_RATE_GOOD_PCT) {
    return 'rgba(0, 196, 140, 0.1)';
  }
  if (n < WIN_RATE_BAD_PCT) {
    return 'rgba(255, 77, 106, 0.1)';
  }
  return 'transparent';
}

function formatWinRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(WIN_RATE_DISPLAY_DECIMALS)}%`;
}

/**
 * @param {{
 *   by_type: Array<{ bet_type: string | null; total: number; wins: number; win_rate_pct: number | null }>;
 *   by_confidence: Array<{ confidence: string | null; total: number; wins: number; win_rate_pct: number | null }>;
 * }} data
 */
function buildConclusions(data) {
  const lines = [];

  const byConf = Array.isArray(data.by_confidence) ? data.by_confidence : [];
  const highRow = byConf.find(
    (r) => String(r?.confidence ?? '').toLowerCase() === 'high',
  );
  const mediumRow = byConf.find(
    (r) => String(r?.confidence ?? '').toLowerCase() === 'medium',
  );
  const highRate = highRow?.win_rate_pct;
  const mediumRate = mediumRow?.win_rate_pct;
  if (
    highRate != null &&
    mediumRate != null &&
    !Number.isNaN(Number(highRate)) &&
    !Number.isNaN(Number(mediumRate)) &&
    Number(highRate) < Number(mediumRate)
  ) {
    lines.push(
      '⚠️ Агент переоценивает уверенность — high работает хуже medium',
    );
  }

  const byType = Array.isArray(data.by_type) ? data.by_type : [];
  for (const row of byType) {
    const total = Number(row?.total ?? 0);
    const wr = row?.win_rate_pct;
    if (
      total >= MIN_BETS_FOR_BAD_TYPE_WARNING &&
      wr != null &&
      !Number.isNaN(Number(wr)) &&
      Number(wr) < WIN_RATE_BAD_PCT
    ) {
      const label = formatBetType(row?.bet_type);
      lines.push(
        `⚠️ ${label} показывает плохой результат — рассмотреть изменение промпта`,
      );
    }
  }

  const settledRows = byType.filter((r) => {
    const total = Number(r?.total ?? 0);
    const pushes = Number(r?.pushes ?? 0);
    return total - pushes > 0;
  });
  const allStable =
    settledRows.length > 0 &&
    settledRows.every((r) => {
      const wr = r?.win_rate_pct;
      return wr != null && !Number.isNaN(Number(wr)) && Number(wr) >= WIN_RATE_STABLE_PCT;
    });

  if (allStable) {
    lines.push('✅ Система работает стабильно');
  }

  return lines;
}

export default function AnalyticsPage() {
  const [data, setData] = useState({ by_type: [], by_confidence: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Ошибка загрузки',
        );
      }
      setData({
        by_type: Array.isArray(json.by_type) ? json.by_type : [],
        by_confidence: Array.isArray(json.by_confidence)
          ? json.by_confidence
          : [],
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error(err);
      setError(message);
      setData({ by_type: [], by_confidence: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conclusions = useMemo(() => buildConclusions(data), [data]);

  return (
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
            Аналитика системы
          </h1>
          <p style={{ color: '#8B93A7' }}>
            Статистика эффективности ставок
          </p>
        </header>

        {error != null && (
          <p className="text-sm" style={{ color: '#FF4D6A' }} role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm" style={{ color: '#8B93A7' }}>
            Загрузка...
          </p>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h2 className="text-base font-medium mb-4" style={{ color: '#FFFFFF' }}>
                По типу ставки
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr
                      className="text-left"
                      style={{ color: '#8B93A7', borderBottom: '1px solid #2A3550' }}
                    >
                      <th className="px-3 py-2 font-medium">Тип</th>
                      <th className="px-3 py-2 font-medium">Ставок</th>
                      <th className="px-3 py-2 font-medium">Побед</th>
                      <th className="px-3 py-2 font-medium">Винрейт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_type.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4"
                          style={{ color: '#8B93A7' }}
                        >
                          Нет данных по закрытым ставкам.
                        </td>
                      </tr>
                    ) : (
                      data.by_type.map((row) => {
                        const bgColor = getWinRateBgColor(row.win_rate_pct);
                        return (
                          <tr
                            key={String(row.bet_type ?? 'empty')}
                            className="transition-all"
                            style={{
                              borderBottom: '1px solid #2A3550',
                              color: '#FFFFFF',
                              backgroundColor: bgColor,
                            }}
                          >
                            <td className="px-3 py-2">
                              {formatBetType(row.bet_type)}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.total}</td>
                            <td className="px-3 py-2 tabular-nums">{row.wins}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatWinRate(row.win_rate_pct)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h2 className="text-base font-medium mb-4" style={{ color: '#FFFFFF' }}>
                По уверенности агента
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr
                      className="text-left"
                      style={{ color: '#8B93A7', borderBottom: '1px solid #2A3550' }}
                    >
                      <th className="px-3 py-2 font-medium">Уверенность</th>
                      <th className="px-3 py-2 font-medium">Ставок</th>
                      <th className="px-3 py-2 font-medium">Побед</th>
                      <th className="px-3 py-2 font-medium">Винрейт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_confidence.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4"
                          style={{ color: '#8B93A7' }}
                        >
                          Нет данных по закрытым ставкам.
                        </td>
                      </tr>
                    ) : (
                      data.by_confidence.map((row) => {
                        const bgColor = getWinRateBgColor(row.win_rate_pct);
                        return (
                          <tr
                            key={String(row.confidence ?? 'empty')}
                            className="transition-all"
                            style={{
                              borderBottom: '1px solid #2A3550',
                              color: '#FFFFFF',
                              backgroundColor: bgColor,
                            }}
                          >
                            <td className="px-3 py-2">
                              {formatConfidence(row.confidence)}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.total}</td>
                            <td className="px-3 py-2 tabular-nums">{row.wins}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatWinRate(row.win_rate_pct)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Выводы
            </h2>
            {conclusions.length === 0 ? (
              <p className="text-sm" style={{ color: '#8B93A7' }}>
                Недостаточно данных для автоматических выводов.
              </p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-sm" style={{ color: '#FFFFFF' }}>
                {conclusions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
