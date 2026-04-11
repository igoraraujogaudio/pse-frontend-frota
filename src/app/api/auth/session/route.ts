// API Route: /api/auth/session
// Requisitos: 4.5, 5.1, 5.3, 5.5
//
// POST: recebe tokens do login e seta cookies httpOnly
// GET: verifica se sessão existe (retorna authenticated + access_token)
// DELETE: limpa cookies de sessão

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias em segundos

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { access_token, refresh_token, expires_in } = body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!access_token || !refresh_token || !expires_in) {
    return NextResponse.json(
      { error: 'access_token, refresh_token e expires_in são obrigatórios' },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });

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
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    access_token: accessToken,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

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
