'use client';

import { useCallback, useEffect, useState } from 'react';
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
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
      }}
    >
      <p className="text-sm mb-2" style={{ color: '#8B93A7' }}>
        {title}
      </p>
      <p className="text-2xl font-semibold" style={{ color: '#FFFFFF' }}>
        {value}
      </p>
    </div>
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
    <div
      className="rounded-lg p-3 text-sm shadow-md"
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
        color: '#FFFFFF',
      }}
    >
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
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
            Финансы
          </h1>
          <p style={{ color: '#8B93A7' }}>
            Общий банк и результаты по командам на основе закрытых ставок
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
          <section className="space-y-3">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Текущий банк
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <StatCard
                title="Текущий банк"
                value={formatMoney(currentBank)}
              />
              <div
                className="rounded-xl p-6"
                style={{
                  backgroundColor: '#1A2540',
                  border: '1px solid #2A3550',
                }}
              >
                <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
                  Пополнение / вывод
                </p>
                <div className="space-y-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="Введите сумму"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      backgroundColor: '#2A3550',
                      border: '1px solid #2A3550',
                      color: '#FFFFFF',
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={bankSubmitting}
                      onClick={() => void submitBankAction('deposit')}
                      className="px-4 py-2 rounded-lg transition-all"
                      style={{
                        backgroundColor: '#3D6FFF',
                        color: '#FFFFFF',
                        opacity: bankSubmitting ? 0.6 : 1,
                        cursor: bankSubmitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Пополнить
                    </button>
                    <button
                      type="button"
                      disabled={bankSubmitting}
                      onClick={() => void submitBankAction('withdraw')}
                      className="px-4 py-2 rounded-lg transition-all"
                      style={{
                        border: '1px solid #3D6FFF',
                        color: '#3D6FFF',
                        backgroundColor: 'transparent',
                        opacity: bankSubmitting ? 0.6 : 1,
                        cursor: bankSubmitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Вывести
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && summary != null && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Дашборд банка
            </h2>
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
        )}

        {!loading && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Рост банка
            </h2>
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
              }}
            >
              {bankHistory.length === 0 ? (
                <p className="text-sm" style={{ color: '#8B93A7' }}>
                  Нет данных для графика.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bankHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A3550" />
                      <XAxis dataKey="dateLabel" stroke="#8B93A7" />
                      <YAxis stroke="#8B93A7" />
                      <Tooltip content={<BankHistoryTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="positiveBalance"
                        stroke="#00C48C"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="negativeBalance"
                        stroke="#FF4D6A"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium" style={{ color: '#FFFFFF' }}>
              Статистика по командам
            </h2>
            <div
              className="rounded-xl overflow-x-auto"
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
              }}
            >
              {byTeam.length === 0 ? (
                <p className="p-6 text-sm" style={{ color: '#8B93A7' }}>
                  Нет закрытых ставок для отображения.
                </p>
              ) : (
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr
                      className="text-left"
                      style={{ color: '#8B93A7', borderBottom: '1px solid #2A3550' }}
                    >
                      <th className="px-4 py-3 font-medium">Команда</th>
                      <th className="px-4 py-3 font-medium">Тип ставки</th>
                      <th className="px-4 py-3 font-medium">Ставок</th>
                      <th className="px-4 py-3 font-medium">WIN</th>
                      <th className="px-4 py-3 font-medium">LOSS</th>
                      <th className="px-4 py-3 font-medium">PUSH</th>
                      <th className="px-4 py-3 font-medium">Винрейт</th>
                      <th className="px-4 py-3 font-medium">Прибыль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTeam.map((row) => (
                      <tr
                        key={`${row.team_name}_${row.bet_type}`}
                        className="transition-all last:border-b-0"
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
                          className="px-4 py-3"
                          style={{
                            color:
                              Number(row.profit) > 0
                                ? '#00C48C'
                                : Number(row.profit) < 0
                                  ? '#FF4D6A'
                                  : '#FFFFFF',
                          }}
                        >
                          {formatMoney(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
