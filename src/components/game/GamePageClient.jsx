'use client';

import { useCallback, useEffect, useState } from 'react';

import { AnalyzeGameButton } from '@/components/game/AnalyzeGameButton.jsx';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Цвет заголовка карточки для типа ставки max_inning (violet-600). */
const MAX_INNING_TITLE_COLOR = '#7c3aed';

const BET_TYPE_LABELS = {
  total_over: 'Тотал больше',
  total_under: 'Тотал меньше',
  ind_total_over: 'Инд. тотал больше',
  ind_total_under: 'Инд. тотал меньше',
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

/**
 * @param {{ bets: object[]; loading: boolean }} props
 */
function BetsBlock({ bets, loading }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Рекомендации по ставкам</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Анализ выполняется...</p>
        </CardContent>
      </Card>
    );
  }

  if (bets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Рекомендации по ставкам</h2>
      <div className="space-y-3">
        {bets.map((bet) => {
          const betTypeLabel =
            BET_TYPE_LABELS[bet.bet_type] ?? bet.bet_type ?? '—';
          const confidenceLabel =
            CONFIDENCE_LABELS[bet.confidence] ?? bet.confidence ?? '—';
          const resultLabel =
            bet.result != null ? RESULT_LABELS[bet.result] ?? bet.result : null;

          return (
            <Card key={bet.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle
                    className="text-base"
                    style={
                      bet.bet_type === 'max_inning'
                        ? { color: MAX_INNING_TITLE_COLOR }
                        : {}
                    }
                  >
                    {betTypeLabel}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{confidenceLabel}</Badge>
                    {resultLabel != null ? (
                      <Badge
                        variant={
                          bet.result === 'win'
                            ? 'default'
                            : bet.result === 'loss'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {resultLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(bet.bet_type === 'ind_total_over' ||
                  bet.bet_type === 'max_inning') &&
                bet.team != null ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Команда: </span>
                    {bet.team}
                  </p>
                ) : null}
                <p className="text-sm">
                  <span className="text-muted-foreground">Линия: </span>
                  {bet.line ?? '—'}
                </p>
                {bet.estimated_probability != null ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Вероятность: </span>
                    {bet.estimated_probability}%
                  </p>
                ) : null}
                {bet.reasoning != null && String(bet.reasoning).trim() !== '' ? (
                  <p className="text-sm text-muted-foreground">
                    {String(bet.reasoning)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {{ mlbGameId: number; gameInternalId: number }} props
 */
export function GamePageClient({ mlbGameId, gameInternalId }) {
  const [bets, setBets] = useState([]);
  const [betsLoading, setBetsLoading] = useState(false);

  const fetchBets = useCallback(async () => {
    setBetsLoading(true);
    try {
      const res = await fetch(`/api/game-bets?gameId=${gameInternalId}`);
      const data = await res.json();
      setBets(data.bets ?? []);
    } catch (err) {
      console.error('fetchBets error:', err);
      setBets([]);
    } finally {
      setBetsLoading(false);
    }
  }, [gameInternalId]);

  useEffect(() => {
    if (gameInternalId) {
      void fetchBets();
    }
  }, [gameInternalId, fetchBets]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AnalyzeGameButton mlbGameId={mlbGameId} onAnalyzed={fetchBets} />
      </div>

      <BetsBlock bets={bets} loading={betsLoading} />
    </div>
  );
}
