// API Route: /api/auth/refresh
// Lê refresh_token do cookie httpOnly, chama o backend, atualiza cookies.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias
const IS_PROD = process.env.NODE_ENV === 'production';
const USE_SECURE = IS_PROD && (process.env.NEXT_PUBLIC_API_FROTA_URL?.startsWith('https') ?? false);

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: USE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!backendRes.ok) {
      const response = NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
      response.cookies.set('access_token', '', cookieOptions(0));
      response.cookies.set('refresh_token', '', cookieOptions(0));
      return response;
    }

    const data = await backendRes.json();
    const { access_token, refresh_token, expires_in } = data;

    const response = NextResponse.json({ ok: true, expires_in });
    response.cookies.set('access_token', access_token, cookieOptions(expires_in));
    response.cookies.set('refresh_token', refresh_token, cookieOptions(REFRESH_TOKEN_MAX_AGE));
    return response;
  } catch {
    return NextResponse.json({ error: 'Refresh request failed' }, { status: 503 });
  }
}
