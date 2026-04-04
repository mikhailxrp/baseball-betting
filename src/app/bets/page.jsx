'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const DATE_TIMEZONE = 'America/New_York';
/** Показ старта матча в карточках — по Москве. */
const GAME_TIME_DISPLAY_TIMEZONE = 'Europe/Moscow';
const ODDS_STEP = 0.01;
const STAKE_STEP = 0.01;
const LINE_STEP = 0.5;
const PROFIT_PRECISION = 100; // округление до 0.01

const BET_TYPE_LABELS = {
  total_over: 'Тотал больше',
  total_under: 'Тотал меньше',
  ind_total_over: 'Инд. тотал больше',
  max_inning: 'Макс. иннинг',
};

const BET_TYPE_COLORS = {
  max_inning: { bg: '#3D6FFF', text: '#FFFFFF' },
  total_over: { bg: '#00C48C', text: '#0F1624' },
  ind_total_over: { bg: '#F5A623', text: '#0F1624' },
  total_under: { bg: '#FF4D6A', text: '#FFFFFF' },
};

const CONFIDENCE_LABELS = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const RESULT_LABELS = {
  win: 'Выигрыш',
  loss: 'Проигрыш',
  push: 'Возврат',
};

function getTodayET() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: DATE_TIMEZONE,
  });
}

/**
 * @param {string | null | undefined} gameTimeUtc
 * @param {string | null | undefined} gameDateFallback YYYY-MM-DD из games.date
 */
function formatGameStartMsk(gameTimeUtc, gameDateFallback) {
  if (gameTimeUtc != null && String(gameTimeUtc).trim() !== '') {
    const d = new Date(gameTimeUtc);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: GAME_TIME_DISPLAY_TIMEZONE,
      });
      const timeStr = d.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: GAME_TIME_DISPLAY_TIMEZONE,
      });
      return `${dateStr}, ${timeStr} МСК`;
    }
  }
  if (gameDateFallback != null && String(gameDateFallback).trim() !== '') {
    return `${String(gameDateFallback)} (время не указано)`;
  }
  return '—';
}

function calcProfit(result, odds, stake) {
  if (!stake || !odds) return null;
  const s = parseFloat(stake);
  const o = parseFloat(odds);
  if (Number.isNaN(s) || Number.isNaN(o)) return null;
  if (result === 'win') {
    // Прибыль = stake * (коэф - 1)
    return (
      Math.round(((s * (o - 1)) * PROFIT_PRECISION)) / PROFIT_PRECISION
    );
  }
  if (result === 'loss') return -s;
  if (result === 'push') return 0;
  return null;
}

export default function BetsPage() {
  const [date, setDate] = useState(getTodayET());
  const [openBets, setOpenBets] = useState([]);
  const [closedBets, setClosedBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});

  const dateParam = useMemo(() => date?.trim?.() ?? '', [date]);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bets-by-date?date=${encodeURIComponent(dateParam)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка загрузки');
      }
      setOpenBets(Array.isArray(data.open) ? data.open : []);
      setClosedBets(Array.isArray(data.closed) ? data.closed : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  useEffect(() => {
    void fetchBets();
  }, [fetchBets]);

  function handleFormChange(betId, field, value) {
    setForm((prev) => ({ ...prev, [betId]: { ...prev[betId], [field]: value } }));
  }

  async function handleResult(betId, result) {
    const f = form[betId] ?? {};
    const oddsValue = f.odds ? parseFloat(f.odds) : null;
    const stakeValue = f.stake ? parseFloat(f.stake) : null;
    const lineStr =
      typeof f.line === 'string' ? f.line.trim() : f.line != null ? String(f.line) : '';
    const lineValue = lineStr === '' ? null : parseFloat(lineStr);

    // Валидация на клиенте: если пользователь ввёл строку, приводим к числу.
    if (oddsValue !== null && Number.isNaN(oddsValue)) {
      setError('Коэффициент введён неверно');
      return;
    }
    if (stakeValue !== null && Number.isNaN(stakeValue)) {
      setError('Сумма ставки введена неверно');
      return;
    }
    if (lineStr !== '' && Number.isNaN(lineValue)) {
      setError('Линия введена неверно');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = {
        result,
        odds: oddsValue,
        amount: stakeValue,
        line: lineValue,
      };

      const res = await fetch(`/api/bets/${betId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Не удалось сохранить результат',
        );
      }

      await fetchBets();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
              Результаты ставок
            </h1>
            <p style={{ color: '#8B93A7' }}>
              Управление открытыми и закрытыми ставками
            </p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: '#2A3550',
              border: '1px solid #2A3550',
              color: '#FFFFFF',
            }}
          />
        </div>

        {error != null && (
          <p className="text-sm" style={{ color: '#FF4D6A' }} role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p style={{ color: '#8B93A7' }}>Загрузка...</p>
        )}

        {openBets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Ожидают результата
            </h2>
            {openBets.map((bet) => {
              const betTypeColor = BET_TYPE_COLORS[bet.bet_type] ?? {
                bg: 'rgba(61, 111, 255, 0.2)',
                text: '#3D6FFF',
              };

              return (
                <div
                  key={bet.id}
                  style={{
                    backgroundColor: '#1A2540',
                    border: '1px solid #2A3550',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '12px',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-base font-medium" style={{ color: '#FFFFFF' }}>
                      {bet.away_team} @ {bet.home_team}
                    </h3>
                    <div className="flex gap-2">
                      <div
                        className="inline-block px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: betTypeColor.bg,
                          color: betTypeColor.text,
                        }}
                      >
                        {BET_TYPE_LABELS[bet.bet_type] ?? bet.bet_type}
                      </div>
                      <div
                        className="inline-block px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'rgba(139, 147, 167, 0.2)',
                          color: '#8B93A7',
                        }}
                      >
                        {CONFIDENCE_LABELS[bet.confidence] ?? bet.confidence}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm mb-4" style={{ color: '#FFFFFF' }}>
                    <span>
                      <span style={{ color: '#8B93A7' }}>Старт: </span>
                      {formatGameStartMsk(bet.game_time_utc, bet.game_date)}
                    </span>
                    {bet.team_name && (
                      <span>
                        <span style={{ color: '#8B93A7' }}>Команда: </span>
                        {bet.team_name}
                      </span>
                    )}
                    <span>
                      <span style={{ color: '#8B93A7' }}>Линия: </span>
                      {bet.line ?? '—'}
                    </span>
                    <span>
                      <span style={{ color: '#8B93A7' }}>Вероятность: </span>
                      {bet.estimated_probability
                        ? `${bet.estimated_probability}%`
                        : '—'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: '#8B93A7' }}>
                        Коэффициент БК
                      </p>
                      <input
                        type="number"
                        step={ODDS_STEP}
                        placeholder="1.85"
                        style={{
                          backgroundColor: '#0F1624',
                          border: '1px solid #2A3550',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          width: '112px',
                        }}
                        value={form[bet.id]?.odds ?? ''}
                        onChange={(e) =>
                          handleFormChange(bet.id, 'odds', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: '#8B93A7' }}>
                        Сумма ставки
                      </p>
                      <input
                        type="number"
                        step={STAKE_STEP}
                        placeholder="100"
                        style={{
                          backgroundColor: '#0F1624',
                          border: '1px solid #2A3550',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          width: '112px',
                        }}
                        value={form[bet.id]?.stake ?? ''}
                        onChange={(e) =>
                          handleFormChange(bet.id, 'stake', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: '#8B93A7' }}>
                        Линия
                      </p>
                      <input
                        type="number"
                        step={LINE_STEP}
                        placeholder={
                          bet.line != null && bet.line !== ''
                            ? String(bet.line)
                            : '4.5'
                        }
                        style={{
                          backgroundColor: '#0F1624',
                          border: '1px solid #2A3550',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          width: '112px',
                        }}
                        value={form[bet.id]?.line ?? ''}
                        onChange={(e) =>
                          handleFormChange(bet.id, 'line', e.target.value)
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                        style={{
                          backgroundColor: 'rgba(0, 196, 140, 0.2)',
                          color: '#00C48C',
                          border: '1px solid #00C48C',
                          opacity: submitting ? 0.6 : 1,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleResult(bet.id, 'win')}
                        disabled={submitting}
                      >
                        WIN
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                        style={{
                          backgroundColor: 'rgba(255, 77, 106, 0.2)',
                          color: '#FF4D6A',
                          border: '1px solid #FF4D6A',
                          opacity: submitting ? 0.6 : 1,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleResult(bet.id, 'loss')}
                        disabled={submitting}
                      >
                        LOSS
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                        style={{
                          backgroundColor: 'rgba(139, 147, 167, 0.2)',
                          color: '#8B93A7',
                          border: '1px solid #8B93A7',
                          opacity: submitting ? 0.6 : 1,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleResult(bet.id, 'push')}
                        disabled={submitting}
                      >
                        PUSH
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {closedBets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Закрытые ставки
            </h2>
            <div
              className="rounded-xl overflow-x-auto"
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left"
                    style={{ color: '#8B93A7', borderBottom: '1px solid #2A3550' }}
                  >
                    <th className="py-2 pr-4 pl-4 font-medium">Матч</th>
                    <th className="py-2 pr-4 font-medium">Тип</th>
                    <th className="py-2 pr-4 font-medium">Линия</th>
                    <th className="py-2 pr-4 font-medium">Результат</th>
                    <th className="py-2 pr-4 font-medium">Коэф.</th>
                    <th className="py-2 pr-4 font-medium">Сумма</th>
                    <th className="py-2 pr-4 font-medium">Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {closedBets.map((bet) => {
                    const profit = calcProfit(bet.result, bet.odds, bet.amount);
                    const profitColor =
                      profit == null
                        ? '#FFFFFF'
                        : profit > 0
                          ? '#00C48C'
                          : profit < 0
                            ? '#FF4D6A'
                            : '#FFFFFF';

                    return (
                      <tr
                        key={bet.id}
                        className="transition-all"
                        style={{
                          borderBottom: '1px solid #2A3550',
                          color: '#FFFFFF',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            'rgba(61, 111, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td className="py-2 pr-4 pl-4">
                          {bet.away_team} @ {bet.home_team}
                        </td>
                        <td className="py-2 pr-4">
                          {BET_TYPE_LABELS[bet.bet_type] ?? bet.bet_type}
                        </td>
                        <td className="py-2 pr-4">{bet.line ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <div
                            className="inline-block px-2 py-1 rounded text-xs"
                            style={{
                              backgroundColor:
                                bet.result === 'win'
                                  ? 'rgba(0, 196, 140, 0.2)'
                                  : bet.result === 'loss'
                                    ? 'rgba(255, 77, 106, 0.2)'
                                    : 'rgba(139, 147, 167, 0.2)',
                              color:
                                bet.result === 'win'
                                  ? '#00C48C'
                                  : bet.result === 'loss'
                                    ? '#FF4D6A'
                                    : '#8B93A7',
                            }}
                          >
                            {RESULT_LABELS[bet.result] ?? bet.result}
                          </div>
                        </td>
                        <td className="py-2 pr-4">{bet.odds ?? '—'}</td>
                        <td className="py-2 pr-4">{bet.amount ?? '—'}</td>
                        <td className="py-2 pr-4" style={{ color: profitColor }}>
                          {profit != null
                            ? profit > 0
                              ? `+${profit}`
                              : profit
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && openBets.length === 0 && closedBets.length === 0 && (
          <p style={{ color: '#8B93A7' }}>
            Ставок за выбранную дату не найдено.
          </p>
        )}
      </div>
    </div>
  );
}

