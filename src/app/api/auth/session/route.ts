// API Route: /api/auth/session
// POST: recebe tokens do login e seta cookies httpOnly
// GET: verifica se sessão existe (retorna authenticated + access_token)
// DELETE: limpa cookies de sessão

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
  response.cookies.set('access_token', access_token, cookieOptions(expires_in));
  response.cookies.set('refresh_token', refresh_token, cookieOptions(REFRESH_TOKEN_MAX_AGE));
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
  response.cookies.set('access_token', '', cookieOptions(0));
  response.cookies.set('refresh_token', '', cookieOptions(0));
  return response;
}
