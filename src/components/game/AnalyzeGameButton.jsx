"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

const BUTTON_LABEL_IDLE = "Анализировать";
const BUTTON_LABEL_LOADING = "Анализ...";

/**
 * @param {{ mlbGameId: number; onAnalyzed?: () => void }} props
 */
export function AnalyzeGameButton({ mlbGameId, onAnalyzed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlbGameId }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        setError("Не удалось разобрать ответ сервера");
        return;
      }

      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Ошибка запроса";
        setError(message);
        return;
      }

      if (data.ok === true && onAnalyzed) {
        onAnalyzed();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        disabled={loading}
        aria-busy={loading}
        onClick={() => void handleAnalyze()}
      >
        {loading ? BUTTON_LABEL_LOADING : BUTTON_LABEL_IDLE}
      </Button>
      {error != null && error !== "" ? (
        <p className="max-w-md text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
