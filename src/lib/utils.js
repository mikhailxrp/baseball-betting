import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** IANA-идентификатор часового пояса для отображения расписания пользователю. */
export const MOSCOW_TIMEZONE = "Europe/Moscow";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Преобразует ISO-время матча (UTC) в строку времени в часовом поясе Москвы.
 * @param {string | null | undefined} isoUtc
 * @returns {string}
 */
export function toMoscowTime(isoUtc) {
  if (isoUtc == null || isoUtc === "") {
    return "—";
  }
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Дата календаря в формате dd.MM.yyyy в часовом поясе Москвы.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateMoscow(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
