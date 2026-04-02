function parseMlbGameId(body) {
  if (body == null || typeof body !== "object") {
    return null;
  }
  const raw = body.mlbGameId;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(request) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl == null || String(webhookUrl).trim() === "") {
      return Response.json(
        { error: "N8N_WEBHOOK_URL не задан в окружении" },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Неверный JSON тела запроса" },
        { status: 400 },
      );
    }

    const mlbGameId = parseMlbGameId(body);
    if (mlbGameId == null) {
      return Response.json(
        { error: "Ожидается числовой mlbGameId в теле запроса" },
        { status: 400 },
      );
    }

    const n8nRes = await fetch(String(webhookUrl).trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlbGameId }),
    });

    if (!n8nRes.ok) {
      const message = `Запрос к n8n неуспешен (${n8nRes.status})`;
      return Response.json({ ok: false, error: message }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
