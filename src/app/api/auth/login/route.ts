// API Route: /api/auth/login
// Proxy login para o Backend Rust e seta cookies httpOnly com os tokens.
// Elimina CORS pois o frontend chama same-origin.

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.error ?? 'Erro no login', code: data.code },
        { status: backendRes.status },
      );
    }

    // Set httpOnly cookies with tokens
    const response = NextResponse.json(data);

    if (data.access_token) {
      response.cookies.set('access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: data.expires_in ?? 3600,
      });
    }

    if (data.refresh_token) {
      response.cookies.set('refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor' },
      { status: 503 },
    );
  }
}
