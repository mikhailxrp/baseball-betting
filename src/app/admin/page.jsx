'use client';

import { useCallback, useState } from 'react';

const DATE_TIMEZONE = 'America/New_York';

function getYesterdayET() {
  const now = new Date();
  const etNow = new Date(
    now.toLocaleString('en-US', { timeZone: DATE_TIMEZONE }),
  );
  etNow.setDate(etNow.getDate() - 1);
  return etNow.toLocaleDateString('en-CA');
}

function DatePickerModal({ isOpen, onClose, onConfirm, defaultDate }) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{
          backgroundColor: '#1A2540',
          border: '1px solid #2A3550',
        }}
      >
        <h2 className="text-xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
          Выберите дату
        </h2>
        <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
          Дата в часовом поясе America/New_York (ET)
        </p>
        <div className="space-y-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
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
              onClick={() => {
                onConfirm(selectedDate);
                onClose();
              }}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: '#3D6FFF',
                color: '#FFFFFF',
              }}
            >
              Подтвердить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                border: '1px solid #3D6FFF',
                color: '#3D6FFF',
                backgroundColor: 'transparent',
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSection({
  stepNumber,
  title,
  description,
  onExecute,
  result,
  loading,
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: '#1A2540',
        border: '1px solid #2A3550',
      }}
    >
      <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>
        Шаг {stepNumber}: {title}
      </h3>
      <p className="text-sm mb-4" style={{ color: '#8B93A7' }}>
        {description}
      </p>
      <div className="space-y-3">
        <button
          type="button"
          disabled={loading}
          onClick={onExecute}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: '#3D6FFF',
            color: '#FFFFFF',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Выполняется...' : 'Выполнить'}
        </button>
        {result != null && (
          <div className="text-sm">
            {result.error != null ? (
              <p style={{ color: '#FF4D6A' }}>{result.error}</p>
            ) : (
              <div
                className="inline-block px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: 'rgba(0, 196, 140, 0.2)',
                  color: '#00C48C',
                }}
              >
                {result.message ?? 'Выполнено успешно'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCallback, setModalCallback] = useState(null);
  const [results, setResults] = useState({});
  const [loadingSteps, setLoadingSteps] = useState({});

  const openDateModal = useCallback((callback) => {
    setModalCallback(() => callback);
    setModalOpen(true);
  }, []);

  const executeStep1 = useCallback(
    async (date) => {
      setLoadingSteps((prev) => ({ ...prev, step1: true }));
      setResults((prev) => ({ ...prev, step1: null }));
      try {
        const res = await fetch('/api/admin/update-game-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'Ошибка обновления результатов матчей',
          );
        }
        setResults((prev) => ({
          ...prev,
          step1: { message: `Обновлено матчей: ${json.updated ?? 0}` },
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error(err);
        setResults((prev) => ({ ...prev, step1: { error: message } }));
      } finally {
        setLoadingSteps((prev) => ({ ...prev, step1: false }));
      }
    },
    [],
  );

  const executeStep2 = useCallback(
    async (date) => {
      setLoadingSteps((prev) => ({ ...prev, step2: true }));
      setResults((prev) => ({ ...prev, step2: null }));
      try {
        const res = await fetch(
          `/api/collect-stats?date=${encodeURIComponent(date)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'Ошибка сбора статистики',
          );
        }
        setResults((prev) => ({
          ...prev,
          step2: {
            message: `Питчеры: ${json.pitchers_processed ?? 0}, Команды: ${json.teams_processed ?? 0}, Бэттеры (команды): ${json.batters_processed ?? 0}`,
          },
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error(err);
        setResults((prev) => ({ ...prev, step2: { error: message } }));
      } finally {
        setLoadingSteps((prev) => ({ ...prev, step2: false }));
      }
    },
    [],
  );

  const executeStep3 = useCallback(
    async (date) => {
      setLoadingSteps((prev) => ({ ...prev, step3: true }));
      setResults((prev) => ({ ...prev, step3: null }));
      try {
        const res = await fetch('/api/admin/update-bet-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'Ошибка обновления результатов ставок',
          );
        }
        setResults((prev) => ({
          ...prev,
          step3: { message: `Обновлено ставок: ${json.updated ?? 0}` },
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error(err);
        setResults((prev) => ({ ...prev, step3: { error: message } }));
      } finally {
        setLoadingSteps((prev) => ({ ...prev, step3: false }));
      }
    },
    [],
  );

  const executeStep4 = useCallback(async () => {
    setLoadingSteps((prev) => ({ ...prev, step4: true }));
    setResults((prev) => ({ ...prev, step4: null }));
    try {
      const res = await fetch('/api/admin/update-teams-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string'
            ? json.error
            : 'Ошибка обновления статистики команд',
        );
      }
      setResults((prev) => ({
        ...prev,
        step4: { message: `Обновлено команд: ${json.updated ?? 0}` },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error(err);
      setResults((prev) => ({ ...prev, step4: { error: message } }));
    } finally {
      setLoadingSteps((prev) => ({ ...prev, step4: false }));
    }
  }, []);

  return (
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-medium mb-2" style={{ color: '#FFFFFF' }}>
            Управление системой
          </h1>
          <p style={{ color: '#8B93A7' }}>
            Последовательное обновление данных из MLB API и пересчёт метрик
          </p>
        </header>

        <div className="space-y-4">
          <AdminSection
            stepNumber={1}
            title="Статусы и счёт матчей"
            description="Обновляет таблицу games — статусы Final и счёт сыгранных матчей"
            onExecute={() => openDateModal(executeStep1)}
            result={results.step1}
            loading={loadingSteps.step1}
          />
          <AdminSection
            stepNumber={2}
            title="Статистика питчеров, команд и бэттеров"
            description="Обновляет таблицы pitcher_stats, team_stats и batter_stats из MLB API"
            onExecute={() => openDateModal(executeStep2)}
            result={results.step2}
            loading={loadingSteps.step2}
          />
          <AdminSection
            stepNumber={3}
            title="Результаты ставок"
            description="Обновляет таблицу bets — win/loss/push для total_over и total_under"
            onExecute={() => openDateModal(executeStep3)}
            result={results.step3}
            loading={loadingSteps.step3}
          />
          <AdminSection
            stepNumber={4}
            title="Статистика команд по ставкам"
            description="Пересчитывает bets_count, win_rate, selected_for_system в таблице teams"
            onExecute={executeStep4}
            result={results.step4}
            loading={loadingSteps.step4}
          />
        </div>
      </div>

      <DatePickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={(date) => {
          if (modalCallback != null) {
            void modalCallback(date);
          }
        }}
        defaultDate={getYesterdayET()}
      />
    </div>
  );
}
