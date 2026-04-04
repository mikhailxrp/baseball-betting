'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_BG = '#0F1624';
const PAGE_PADDING_PX = 32;
const MUTED = '#8B93A7';
const ACTIVE_BTN_BG = '#3D6FFF';
const INACTIVE_BORDER = '#2A3550';

const FILTER_ALL = 'all';
const FILTER_IND_TOTAL = 'ind_total_over';
const FILTER_MAX_INNING = 'max_inning';

const GRADE_BORDER = {
  HOT: '1px solid rgba(0,196,140,0.5)',
  STABLE: '1px solid rgba(61,111,255,0.5)',
  COLD: '1px solid rgba(245,166,35,0.5)',
  AVOID: '1px solid rgba(255,77,106,0.5)',
  NEW: '1px solid #2A3550',
};

const CARD_BG = '#1A2540';
const DOT_WIN = '#00C48C';
const DOT_LOSS = '#FF4D6A';
const DOT_PUSH = '#8B93A7';

const PROGRESS_DOT_SIZE_PX = 10;

/**
 * @param {unknown} v
 * @returns {string}
 */
function formatLineValue(v) {
  if (v === null || v === undefined) return '—';
  return String(v);
}

export default function TeamsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(FILTER_ALL);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team-stats-by-bet');
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          body && typeof body.error === 'string'
            ? body.error
            : `Ошибка ${res.status}`;
        throw new Error(msg);
      }
      if (!Array.isArray(body)) {
        throw new Error('Некорректный ответ сервера');
      }
      setItems(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return items;
    return items.filter((row) => row.bet_type === filter);
  }, [items, filter]);

  const showGlobalEmpty = !loading && !error && items.length === 0;
  const showFilterEmpty =
    !loading && !error && items.length > 0 && filtered.length === 0;

  return (
    <div
      style={{
        backgroundColor: PAGE_BG,
        padding: PAGE_PADDING_PX,
        minHeight: '100vh',
      }}
    >
      <h1 className="text-white text-2xl font-semibold mb-1">
        Статистика команд
      </h1>
      <p className="text-sm mb-6" style={{ color: MUTED }}>
        Команды отсортированы по форме последних 5 ставок
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { id: FILTER_ALL, label: 'Все' },
          { id: FILTER_IND_TOTAL, label: 'Инд. тотал' },
          { id: FILTER_MAX_INNING, label: 'Макс. иннинг' },
        ].map((btn) => {
          const isActive = filter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={
                isActive
                  ? { backgroundColor: ACTIVE_BTN_BG, color: '#fff' }
                  : {
                      border: `1px solid ${INACTIVE_BORDER}`,
                      color: MUTED,
                      backgroundColor: 'transparent',
                    }
              }
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-center" style={{ color: MUTED }}>
          Загрузка…
        </p>
      )}

      {error && (
        <p className="text-center text-red-400" role="alert">
          {error}
        </p>
      )}

      {showGlobalEmpty && (
        <p className="text-center max-w-lg mx-auto" style={{ color: MUTED }}>
          Недостаточно данных. Вводите результаты ставок — статистика появится
          после 2+ закрытых ставок на команду.
        </p>
      )}

      {showFilterEmpty && (
        <p className="text-center" style={{ color: MUTED }}>
          Нет команд для выбранного типа ставки.
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((row) => {
            const grade = String(row.grade ?? 'NEW');
            const border = GRADE_BORDER[grade] ?? GRADE_BORDER.NEW;
            const isInd = row.bet_type === FILTER_IND_TOTAL;
            const last5 = Array.isArray(row.last5) ? row.last5 : [];
            const last5Len = last5.length;

            return (
              <article
                key={`${row.team_id}-${row.bet_type}`}
                className="rounded-xl"
                style={{
                  backgroundColor: CARD_BG,
                  border,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <div className="text-white font-semibold text-lg">
                      {row.team_name ?? '—'}
                    </div>
                    <div className="mt-1">
                      {isInd ? (
                        <span
                          className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(245,166,35,0.2)',
                            color: '#F5A623',
                          }}
                        >
                          Инд. тотал больше
                        </span>
                      ) : (
                        <span
                          className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(61,111,255,0.2)',
                            color: '#3D6FFF',
                          }}
                        >
                          Макс. иннинг
                        </span>
                      )}
                    </div>
                  </div>
                  <GradeBadge grade={grade} />
                </div>

                <div
                  className="mt-3 mb-3"
                  style={{ borderTop: '1px solid #2A3550' }}
                />

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-white font-bold text-xl">
                      {row.last5_wins}/{last5Len}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      {last5Len > 0 ? `побед из ${last5Len}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-xl">
                      {row.wins}/{row.total}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      побед всего
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-xl">
                      {formatLineValue(row.most_common_line)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      типичная линия
                    </div>
                  </div>
                </div>

                {last5Len > 0 && (
                  <div className="flex gap-1 mt-3 justify-center items-center">
                    {last5.map((r, i) => {
                      let bg = DOT_PUSH;
                      if (r === 'win') bg = DOT_WIN;
                      else if (r === 'loss') bg = DOT_LOSS;
                      else if (r !== 'push') bg = INACTIVE_BORDER;
                      return (
                        <div
                          key={i}
                          className="rounded-full shrink-0"
                          style={{
                            width: PROGRESS_DOT_SIZE_PX,
                            height: PROGRESS_DOT_SIZE_PX,
                            backgroundColor: bg,
                          }}
                          title={r ? String(r) : ''}
                        />
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ grade: string }} props
 */
function GradeBadge({ grade }) {
  const map = {
    HOT: {
      text: '🔥 Горячая',
      bg: 'rgba(0,196,140,0.2)',
      color: '#00C48C',
    },
    STABLE: {
      text: '✅ Стабильна',
      bg: 'rgba(61,111,255,0.2)',
      color: '#3D6FFF',
    },
    COLD: {
      text: '⚠️ Холодная',
      bg: 'rgba(245,166,35,0.2)',
      color: '#F5A623',
    },
    AVOID: {
      text: '❌ Избегать',
      bg: 'rgba(255,77,106,0.2)',
      color: '#FF4D6A',
    },
    NEW: {
      text: '🆕 Мало данных',
      bg: 'rgba(139,147,167,0.2)',
      color: '#8B93A7',
    },
  };
  const cfg = map[grade] ?? map.NEW;
  return (
    <span
      className="text-xs font-medium px-2 py-1 rounded whitespace-nowrap shrink-0"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.text}
    </span>
  );
}
