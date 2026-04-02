'use client';

import { useCallback, useState } from 'react';

import { AppShell } from '@/components/layout/AppShell.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const INPUT_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs';

const DEFAULT_PROFIT_PERCENT = 50;
const MIN_PROFIT_PERCENT = 10;
const MAX_PROFIT_PERCENT = 100;
const COEFFICIENT_STEP = 0.01;
const MONEY_DECIMALS = 2;

const PLACEHOLDER_LOSS = '100';
const PLACEHOLDER_ODDS = '1.85';

function parsePositiveNumber(raw) {
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function parseCoefficient(raw) {
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 1) {
    return null;
  }
  return n;
}

function parseProfitPercent(raw) {
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) {
    return null;
  }
  if (n < MIN_PROFIT_PERCENT || n > MAX_PROFIT_PERCENT) {
    return null;
  }
  return n;
}

function formatMoney(value) {
  return Number(value).toFixed(MONEY_DECIMALS);
}

export default function CalculatorPage() {
  const [lossAmount, setLossAmount] = useState('');
  const [coefficient, setCoefficient] = useState('');
  const [profitPercent, setProfitPercent] = useState(String(DEFAULT_PROFIT_PERCENT));

  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setError(null);
      setResult(null);

      const loss = parsePositiveNumber(lossAmount);
      if (loss == null) {
        setError('Укажите положительную сумму проигрыша.');
        return;
      }

      const coef = parseCoefficient(coefficient);
      if (coef == null) {
        setError('Коэффициент должен быть числом больше 1.');
        return;
      }

      const pct = parseProfitPercent(profitPercent);
      if (pct == null) {
        setError(
          `Желаемая прибыль %: от ${MIN_PROFIT_PERCENT} до ${MAX_PROFIT_PERCENT}.`,
        );
        return;
      }

      const desiredProfit = loss * (pct / 100);
      const nextBet = (loss + desiredProfit) / (coef - 1);
      const totalIfLoseAgain = loss + nextBet;

      setResult({
        nextBet,
        netProfitIfWin: desiredProfit,
        totalLostIfLoseAgain: totalIfLoseAgain,
      });
    },
    [lossAmount, coefficient, profitPercent],
  );

  return (
    <AppShell>
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Калькулятор
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Расчёт догонной ставки</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="calc-loss" className="text-sm font-medium">
                  Сумма проигрыша
                </label>
                <input
                  id="calc-loss"
                  name="loss"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder={PLACEHOLDER_LOSS}
                  value={lossAmount}
                  onChange={(e) => setLossAmount(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="calc-odds" className="text-sm font-medium">
                  Коэффициент следующей ставки
                </label>
                <input
                  id="calc-odds"
                  name="odds"
                  type="number"
                  inputMode="decimal"
                  min="1.01"
                  step={COEFFICIENT_STEP}
                  placeholder={PLACEHOLDER_ODDS}
                  value={coefficient}
                  onChange={(e) => setCoefficient(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="calc-pct" className="text-sm font-medium">
                  Желаемая прибыль %
                </label>
                <input
                  id="calc-pct"
                  name="profitPercent"
                  type="number"
                  inputMode="decimal"
                  min={MIN_PROFIT_PERCENT}
                  max={MAX_PROFIT_PERCENT}
                  step="1"
                  value={profitPercent}
                  onChange={(e) => setProfitPercent(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <Button type="submit">Рассчитать</Button>
            </form>

            {error ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {result != null ? (
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                <li>
                  <span className="text-muted-foreground">
                    Следующая ставка:{' '}
                  </span>
                  <span className="font-medium">
                    {formatMoney(result.nextBet)}
                  </span>
                </li>
                <li>
                  <span className="text-muted-foreground">
                    Если выиграешь:{' '}
                  </span>
                  <span className="font-medium text-green-700 dark:text-green-400">
                    +{formatMoney(result.netProfitIfWin)} (чистая прибыль)
                  </span>
                </li>
                <li>
                  <span className="text-muted-foreground">
                    Если проиграешь снова: итого потеряно{' '}
                  </span>
                  <span className="font-medium">
                    {formatMoney(result.totalLostIfLoseAgain)}
                  </span>
                </li>
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
