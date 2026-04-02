'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DATE_TIMEZONE = 'America/New_York';
const ODDS_STEP = 0.01;
const STAKE_STEP = 0.01;
const PROFIT_PRECISION = 100; // округление до 0.01

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

    // Валидация на клиенте: если пользователь ввёл строку, приводим к числу.
    if (oddsValue !== null && Number.isNaN(oddsValue)) {
      setError('Коэффициент введён неверно');
      return;
    }
    if (stakeValue !== null && Number.isNaN(stakeValue)) {
      setError('Сумма ставки введена неверно');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = {
        result,
        odds: oddsValue,
        amount: stakeValue,
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
    <div className="mx-auto w-full max-w-4xl space-y-8 py-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Результаты ставок</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
        />
      </div>

      {error != null ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-muted-foreground">Загрузка...</p> : null}

      {/* Открытые ставки */}
      {openBets.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ожидают результата</h2>
          {openBets.map((bet) => (
            <Card key={bet.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {bet.away_team} @ {bet.home_team}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {BET_TYPE_LABELS[bet.bet_type] ?? bet.bet_type}
                    </Badge>
                    <Badge variant="secondary">
                      {CONFIDENCE_LABELS[bet.confidence] ??
                        bet.confidence}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  {bet.team_name ? (
                    <span>
                      <span className="text-muted-foreground">Команда: </span>
                      {bet.team_name}
                    </span>
                  ) : null}
                  <span>
                    <span className="text-muted-foreground">Линия: </span>
                    {bet.line ?? '—'}
                  </span>
                  <span>
                    <span className="text-muted-foreground">
                      Вероятность:{' '}
                    </span>
                    {bet.estimated_probability
                      ? `${bet.estimated_probability}%`
                      : '—'}
                  </span>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Коэффициент БК</p>
                    <input
                      type="number"
                      step={ODDS_STEP}
                      placeholder="1.85"
                      className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                      value={form[bet.id]?.odds ?? ''}
                      onChange={(e) =>
                        handleFormChange(bet.id, 'odds', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Сумма ставки
                    </p>
                    <input
                      type="number"
                      step={STAKE_STEP}
                      placeholder="100"
                      className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                      value={form[bet.id]?.stake ?? ''}
                      onChange={(e) =>
                        handleFormChange(bet.id, 'stake', e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleResult(bet.id, 'win')}
                      disabled={submitting}
                    >
                      WIN
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleResult(bet.id, 'loss')}
                      disabled={submitting}
                    >
                      LOSS
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleResult(bet.id, 'push')}
                      disabled={submitting}
                    >
                      PUSH
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Закрытые ставки */}
      {closedBets.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Закрытые ставки</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 text-left">Матч</th>
                  <th className="py-2 pr-4 text-left">Тип</th>
                  <th className="py-2 pr-4 text-left">Линия</th>
                  <th className="py-2 pr-4 text-left">Результат</th>
                  <th className="py-2 pr-4 text-left">Коэф.</th>
                  <th className="py-2 pr-4 text-left">Сумма</th>
                  <th className="py-2 text-left">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {closedBets.map((bet) => {
                  const profit = calcProfit(bet.result, bet.odds, bet.amount);
                  const profitColor =
                    profit == null
                      ? 'inherit'
                      : profit > 0
                        ? 'green'
                        : profit < 0
                          ? 'red'
                          : 'inherit';

                  return (
                    <tr key={bet.id} className="border-b">
                      <td className="py-2 pr-4">
                        {bet.away_team} @ {bet.home_team}
                      </td>
                      <td className="py-2 pr-4">
                        {BET_TYPE_LABELS[bet.bet_type] ?? bet.bet_type}
                      </td>
                      <td className="py-2 pr-4">{bet.line ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            bet.result === 'win'
                              ? 'default'
                              : bet.result === 'loss'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {RESULT_LABELS[bet.result] ?? bet.result}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{bet.odds ?? '—'}</td>
                      <td className="py-2 pr-4">{bet.amount ?? '—'}</td>
                      <td
                        className="py-2"
                        style={{
                          color: profitColor,
                        }}
                      >
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
      ) : null}

      {!loading && openBets.length === 0 && closedBets.length === 0 ? (
        <p className="text-muted-foreground">
          Ставок за выбранную дату не найдено.
        </p>
      ) : null}
    </div>
  );
}

