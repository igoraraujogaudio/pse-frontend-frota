// API Route: /api/auth/refresh
// Proactive token refresh — reads refresh_token from httpOnly cookie,
// calls the backend, and updates cookies with new tokens.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

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
      // Refresh failed — clear cookies
      const response = NextResponse.json(
        { error: 'Refresh failed' },
        { status: 401 },
      );
      response.cookies.set('access_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
      response.cookies.set('refresh_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    const data = await backendRes.json();
    const { access_token, refresh_token, expires_in } = data;

    const response = NextResponse.json({
      ok: true,
      expires_in,
    });

    response.cookies.set('access_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: expires_in,
    });

    response.cookies.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Refresh request failed' },
      { status: 503 },
    );
  }
}
