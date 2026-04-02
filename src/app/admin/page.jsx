'use client';

import { useCallback, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Выберите дату</CardTitle>
          <CardDescription>
            Дата в часовом поясе America/New_York (ET)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                onConfirm(selectedDate);
                onClose();
              }}
            >
              Подтвердить
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>
          Шаг {stepNumber}: {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" disabled={loading} onClick={onExecute}>
          {loading ? 'Выполняется...' : 'Выполнить'}
        </Button>
        {result != null ? (
          <div className="text-sm">
            {result.error != null ? (
              <p className="text-destructive">{result.error}</p>
            ) : (
              <Badge variant="secondary">
                {result.message ?? 'Выполнено успешно'}
              </Badge>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
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
            message: `Питчеры: ${json.pitchers_processed ?? 0}, Команды: ${json.teams_processed ?? 0}`,
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
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">
            Управление системой
          </h1>
          <p className="text-sm text-muted-foreground">
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
            title="Статистика питчеров и команд"
            description="Обновляет таблицы pitcher_stats и team_stats из MLB API"
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
    </AppShell>
  );
}
