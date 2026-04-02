import { NextResponse } from 'next/server';

import { getGameBets } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    }

    const bets = await getGameBets(Number(gameId));
    return NextResponse.json({ bets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
