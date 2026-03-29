import { createClient } from "@supabase/supabase-js";

function createSupabaseOrThrow() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в окружении.",
    );
  }
  return createClient(url, anonKey);
}

let _client;

/**
 * Ленивая инициализация: ошибка env только при первом обращении к API, не при импорте модуля.
 * @type {import("@supabase/supabase-js").SupabaseClient}
 */
export const supabase = new Proxy(
  {},
  {
    get(_, prop) {
      _client ??= createSupabaseOrThrow();
      const value = _client[prop];
      return typeof value === "function" ? value.bind(_client) : value;
    },
  },
);
