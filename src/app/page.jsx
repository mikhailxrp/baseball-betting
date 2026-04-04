'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { upsertTeamsAndGames } from '@/lib/db.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PITCHER_TBD = 'TBD';

function cardPitcherLabel(dbName, mlbNestedName) {
  const candidates = [dbName, mlbNestedName];
  for (const n of candidates) {
    if (n != null && String(n).trim() !== '') {
      return String(n);
    }
  }
  return PITCHER_TBD;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToScheduleParam(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getShortDayName(date) {
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return days[date.getDay()];
}

function getTeamAbbr(teamName) {
  if (!teamName) return '—';
  const words = teamName.split(' ');
  const lastWord = words[words.length - 1];
  return lastWord.substring(0, 3).toUpperCase();
}

export default function Home() {
  const router = useRouter();
  const today = startOfToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsSuccess, setStatsSuccess] = useState(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePrevWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = dateToScheduleParam(selectedDate);
      const dbRes = await fetch(
        `/api/schedule?date=${encodeURIComponent(dateStr)}&source=db`,
      );

      let dbData = {};
      if (dbRes.ok) {
        try {
          dbData = await dbRes.json();
        } catch {
          dbData = {};
        }
      } else {
        console.warn('schedule source=db error:', dbRes.status);
      }

      const dbGames = Array.isArray(dbData.games) ? dbData.games : [];
      if (dbGames.length > 0) {
        setGames(dbGames);
        return;
      }

      const res = await fetch(
        `/api/schedule?date=${encodeURIComponent(dateStr)}`,
      );
      let data = {};
      try {
        data = await res.json();
      } catch {
        setError('Не удалось разобрать ответ сервера');
        setGames([]);
        return;
      }

      if (!res.ok) {
        const message =
          typeof data.error === 'string' ? data.error : 'Ошибка загрузки';
        setError(message);
        setGames([]);
        return;
      }

      const gamesList = Array.isArray(data.games) ? data.games : [];
      try {
        await upsertTeamsAndGames(gamesList);
      } catch (upsertErr) {
        console.error(upsertErr);
      }
      setGames(gamesList);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const refreshGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = dateToScheduleParam(selectedDate);
      const res = await fetch(
        `/api/schedule?date=${encodeURIComponent(dateStr)}`,
      );
      if (!res.ok) throw new Error('Ошибка MLB API');

      const data = await res.json();
      const gamesList = Array.isArray(data.games) ? data.games : [];

      await upsertTeamsAndGames(gamesList);
      setGames(gamesList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const loadGamesFromDB = async () => {
      setLoading(true);
      try {
        const dateStr = dateToScheduleParam(selectedDate);
        const dbRes = await fetch(
          `/api/schedule?date=${encodeURIComponent(dateStr)}&source=db`,
        );
        const data = await dbRes.json();
        const games = Array.isArray(data.games) ? data.games : [];
        setGames(games);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadGamesFromDB();
  }, [selectedDate]);

  const collectStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    setStatsSuccess(null);
    try {
      const dateStr = dateToScheduleParam(selectedDate);
      const res = await fetch(
        `/api/collect-stats?date=${encodeURIComponent(dateStr)}`,
      );
      let data = {};
      try {
        data = await res.json();
      } catch {
        setStatsError('Не удалось разобрать ответ сервера');
        return;
      }

      if (!res.ok) {
        const message =
          typeof data.error === 'string'
            ? data.error
            : 'Ошибка загрузки статистики';
        setStatsError(message);
        return;
      }

      const { pitchers_processed, teams_processed, batters_processed } = data;
      setStatsSuccess(
        `Загружено: питчеров ${pitchers_processed}, команд ${teams_processed}, бэттеров ${batters_processed}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Неизвестная ошибка';
      setStatsError(message);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedDate]);

  return (
    <div
      style={{ backgroundColor: '#0F1624', minHeight: '100vh', padding: '32px' }}
    >
      <div className="mb-8">
        <h1
          className="text-2xl font-medium mb-2"
          style={{ color: '#FFFFFF' }}
        >
          Расписание матчей
        </h1>
        <p style={{ color: '#8B93A7' }}>
          Просмотр предстоящих игр MLB
        </p>
      </div>

      <div
        className="flex items-center gap-4 p-4 mb-8 rounded-xl"
        style={{ backgroundColor: '#1A2540' }}
      >
        <button
          onClick={handlePrevWeek}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
          style={{ color: '#8B93A7' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(61, 111, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex gap-2">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className="flex-1 py-3 px-4 rounded-lg transition-all"
                style={{
                  backgroundColor: isSelected ? '#3D6FFF' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#8B93A7',
                  border:
                    isToday && !isSelected
                      ? '1px solid #3D6FFF'
                      : '1px solid transparent',
                }}
              >
                <div className="text-xs mb-1">{getShortDayName(day)}</div>
                <div className="font-semibold">{day.getDate()}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNextWeek}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
          style={{ color: '#8B93A7' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(61, 111, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={fetchGames}
          disabled={loading}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            border: '1px solid #3D6FFF',
            color: '#3D6FFF',
            backgroundColor: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Загрузка...' : 'Получить матчи'}
        </button>
        <button
          onClick={refreshGames}
          disabled={loading}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            border: '1px solid #8B93A7',
            color: '#8B93A7',
            backgroundColor: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Загрузка...' : 'Обновить матчи'}
        </button>
        <button
          onClick={collectStats}
          disabled={statsLoading}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: '#3D6FFF',
            color: '#FFFFFF',
            opacity: statsLoading ? 0.6 : 1,
            cursor: statsLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {statsLoading ? 'Загрузка...' : 'Загрузить статистику'}
        </button>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: '#FF4D6A' }} role="alert">
          {error}
        </p>
      )}

      {statsError && (
        <p className="text-sm mb-4" style={{ color: '#FF4D6A' }} role="alert">
          {statsError}
        </p>
      )}

      {statsSuccess && (
        <p
          className="text-sm mb-4"
          style={{ color: '#00C48C' }}
          role="status"
        >
          {statsSuccess}
        </p>
      )}

      <div className="grid grid-cols-2 gap-6">
        {games.map((game) => {
          const awayName = game.away_team?.name ?? '—';
          const homeName = game.home_team?.name ?? '—';
          const awayPitcher = cardPitcherLabel(
            game.away_pitcher_name,
            game.away_team?.pitcher?.name,
          );
          const homePitcher = cardPitcherLabel(
            game.home_pitcher_name,
            game.home_team?.pitcher?.name,
          );
          const seriesNum = game.series_game_number;
          const seriesTotal = game.games_in_series;
          const showSeriesBadge =
            seriesNum != null &&
            seriesTotal != null &&
            !Number.isNaN(Number(seriesNum)) &&
            !Number.isNaN(Number(seriesTotal));

          const isFinal = game.status === 'Final';
          const hasScore =
            game.away_score != null && game.home_score != null;

          return (
            <div
              key={String(game.mlb_game_id)}
              className="relative p-6 rounded-xl transition-all cursor-pointer group"
              style={{
                backgroundColor: '#1A2540',
                border: '1px solid #2A3550',
                opacity: isFinal ? 0.6 : 1,
              }}
              onClick={() => router.push(`/game/${game.mlb_game_id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  '0 0 20px rgba(61, 111, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {!isFinal && (
                <button
                  className="absolute top-4 right-4 px-3 py-1 rounded-md text-xs transition-all"
                  style={{
                    color: '#3D6FFF',
                    border: '1px solid #3D6FFF',
                    backgroundColor: 'transparent',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/game/${game.mlb_game_id}`);
                  }}
                >
                  Посмотреть матч
                </button>
              )}

              {isFinal && (
                <div
                  className="absolute top-4 right-4 px-3 py-1 rounded-md text-xs"
                  style={{
                    color: '#8B93A7',
                    border: '1px solid #8B93A7',
                    backgroundColor: 'transparent',
                  }}
                >
                  Завершён
                </div>
              )}

              {showSeriesBadge && (
                <div
                  className="inline-block px-2 py-1 rounded text-xs mb-4"
                  style={{
                    backgroundColor: '#F5A623',
                    color: '#0F1624',
                  }}
                >
                  Матч {seriesNum} из {seriesTotal}
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{ backgroundColor: '#2A3550' }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: '#8B93A7' }}
                  >
                    {getTeamAbbr(awayName)}
                  </span>
                </div>
                <div>
                  <div
                    className="font-semibold"
                    style={{ color: '#FFFFFF' }}
                  >
                    {awayName}
                  </div>
                  <div className="text-sm" style={{ color: '#8B93A7' }}>
                    {awayPitcher}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: '#2A3550' }}
                ></div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: '#8B93A7' }}
                >
                  VS
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: '#2A3550' }}
                ></div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{ backgroundColor: '#2A3550' }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: '#8B93A7' }}
                  >
                    {getTeamAbbr(homeName)}
                  </span>
                </div>
                <div>
                  <div
                    className="font-semibold"
                    style={{ color: '#FFFFFF' }}
                  >
                    {homeName}
                  </div>
                  <div className="text-sm" style={{ color: '#8B93A7' }}>
                    {homePitcher}
                  </div>
                </div>
              </div>

              {isFinal && hasScore ? (
                <div
                  className="text-center py-2 rounded-lg font-bold"
                  style={{
                    backgroundColor: '#0F1624',
                    color: '#FFFFFF',
                  }}
                >
                  {game.away_score} : {game.home_score}
                </div>
              ) : (
                <div
                  className="text-center py-2 rounded-lg"
                  style={{
                    backgroundColor: '#0F1624',
                    color: '#8B93A7',
                  }}
                >
                  {game.game_time_utc
                    ? (() => {
                        const d = new Date(game.game_time_utc);
                        const date = d.toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'Europe/Moscow',
                        });
                        const time = d.toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Moscow',
                        });
                        return `${date} ${time} МСК`;
                      })()
                    : dateToScheduleParam(selectedDate)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {games.length === 0 && !loading && (
        <div className="col-span-2 text-center py-12">
          <p style={{ color: '#8B93A7' }}>
            Нет матчей на выбранную дату
          </p>
        </div>
      )}
    </div>
  );
}

