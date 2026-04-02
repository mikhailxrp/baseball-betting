'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PERCENT_PRECISION = 2;
const MONEY_PRECISION = 2;
const BET_TYPE_LABELS = {
  total_over: 'Тотал больше',
  total_under: 'Тотал меньше',
  ind_total_over: 'Инд. тотал',
  max_inning: 'Макс. иннинг',
};

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(PERCENT_PRECISION)}%`;
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  const amount = Number(value).toFixed(MONEY_PRECISION);
  return Number(value) > 0 ? `+${amount}` : amount;
}

function StatCard({ title, value, className = '' }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BankHistoryTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload;
  if (point == null) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm shadow-md">
      <p className="font-medium">{point.dateLabel ?? '—'}</p>
      <p>Баланс: {formatMoney(point.balance)}</p>
      <p>Изменение: {formatMoney(point.change)}</p>
    </div>
  );
}

export default function FinancePage() {
  const [summary, setSummary] = useState(null);
  const [byTeam, setByTeam] = useState([]);
  const [bankHistory, setBankHistory] = useState([]);
  const [currentBank, setCurrentBank] = useState(0);
  const [bankAmount, setBankAmount] = useState('');
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCurrentBank = useCallback(async () => {
    const res = await fetch('/api/bank');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof json.error === 'string' ? json.error : 'Ошибка загрузки банка',
      );
    }
    setCurrentBank(Number(json.current?.balance ?? 0));
  }, []);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [financeRes, bankRes, bankHistoryRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/bank'),
        fetch('/api/bank-history'),
      ]);

      const financeJson = await financeRes.json().catch(() => ({}));
      const bankJson = await bankRes.json().catch(() => ({}));
      const bankHistoryJson = await bankHistoryRes.json().catch(() => ({}));
      if (!financeRes.ok) {
        throw new Error(
          typeof financeJson.error === 'string'
            ? financeJson.error
            : 'Ошибка загрузки финансов',
        );
      }
      if (!bankRes.ok) {
        throw new Error(
          typeof bankJson.error === 'string'
            ? bankJson.error
            : 'Ошибка загрузки банка',
        );
      }
      if (!bankHistoryRes.ok) {
        const errMsg =
          typeof bankHistoryJson?.error === 'string'
            ? bankHistoryJson.error
            : 'Ошибка загрузки истории банка';
        throw new Error(errMsg);
      }

      setSummary(financeJson.summary ?? null);
      setByTeam(Array.isArray(financeJson.by_team) ? financeJson.by_team : []);
      setCurrentBank(Number(bankJson.current?.balance ?? 0));
      const normalizedHistory = Array.isArray(bankHistoryJson.history)
        ? bankHistoryJson.history.map((row) => {
            const balance = Number(row.balance ?? 0);
            const change = Number(row.change ?? 0);
            const dateStr = row.date != null ? String(row.date) : '';
            const dateLabel = dateStr || '—';
            return {
              date: dateStr,
              dateLabel,
              balance,
              change,
              positiveBalance: balance >= 0 ? balance : null,
              negativeBalance: balance < 0 ? balance : null,
            };
          })
        : [];
      setBankHistory(normalizedHistory);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error(err);
      setError(message);
      setSummary(null);
      setByTeam([]);
      setBankHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const submitBankAction = useCallback(
    async (type) => {
      const amount = Number(bankAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError('Введите корректную сумму пополнения/вывода');
        return;
      }

      setBankSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, type }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string' ? json.error : 'Ошибка операции банка',
          );
        }

        setBankAmount('');
        await loadFinance();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error(err);
        setError(message);
      } finally {
        setBankSubmitting(false);
      }
    },
    [bankAmount, loadFinance],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Финансы</h1>
          <p className="text-sm text-muted-foreground">
            Общий банк и результаты по командам на основе закрытых ставок
          </p>
        </header>

        {error != null ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : null}

        {!loading ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Текущий банк</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <StatCard
                title="Текущий банк"
                value={formatMoney(currentBank)}
                className={
                  currentBank > 0
                    ? 'border-green-600/30'
                    : currentBank < 0
                      ? 'border-red-600/30'
                      : ''
                }
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Пополнение / вывод
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="Введите сумму"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={bankSubmitting}
                      onClick={() => void submitBankAction('deposit')}
                    >
                      Пополнить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={bankSubmitting}
                      onClick={() => void submitBankAction('withdraw')}
                    >
                      Вывести
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : null}

        {!loading && summary != null ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Дашборд банка</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Общая прибыль/убыток"
                value={formatMoney(summary.total_profit)}
              />
              <StatCard title="ROI" value={formatPercent(summary.roi)} />
              <StatCard
                title="Всего / WIN / LOSS / PUSH"
                value={`${summary.total_bets} / ${summary.wins} / ${summary.losses} / ${summary.pushes}`}
              />
              <StatCard
                title="Винрейт"
                value={formatPercent(summary.winrate)}
              />
            </div>
          </section>
        ) : null}

        {!loading ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Рост банка</h2>
            <Card>
              <CardContent className="p-4 sm:p-6">
                {bankHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Нет данных для графика.
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bankHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dateLabel" />
                        <YAxis />
                        <Tooltip content={<BankHistoryTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="positiveBalance"
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="negativeBalance"
                          stroke="#dc2626"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {!loading ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Статистика по командам</h2>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                {byTeam.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    Нет закрытых ставок для отображения.
                  </p>
                ) : (
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Команда</th>
                        <th className="px-4 py-3 text-left font-medium">Тип ставки</th>
                        <th className="px-4 py-3 text-left font-medium">Ставок</th>
                        <th className="px-4 py-3 text-left font-medium">WIN</th>
                        <th className="px-4 py-3 text-left font-medium">LOSS</th>
                        <th className="px-4 py-3 text-left font-medium">PUSH</th>
                        <th className="px-4 py-3 text-left font-medium">Винрейт</th>
                        <th className="px-4 py-3 text-left font-medium">Прибыль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byTeam.map((row) => (
                        <tr
                          key={`${row.team_name}_${row.bet_type}`}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-4 py-3">{row.team_name}</td>
                          <td className="px-4 py-3">
                            {BET_TYPE_LABELS[row.bet_type] ?? row.bet_type ?? '—'}
                          </td>
                          <td className="px-4 py-3">{row.bets}</td>
                          <td className="px-4 py-3">{row.wins}</td>
                          <td className="px-4 py-3">{row.losses}</td>
                          <td className="px-4 py-3">{row.pushes}</td>
                          <td className="px-4 py-3">{formatPercent(row.winrate)}</td>
                          <td
                            className={`px-4 py-3 ${
                              Number(row.profit) > 0
                                ? 'text-green-600'
                                : Number(row.profit) < 0
                                  ? 'text-red-600'
                                  : ''
                            }`}
                          >
                            {formatMoney(row.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
