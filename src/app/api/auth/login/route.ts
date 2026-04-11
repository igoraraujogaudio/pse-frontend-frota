// API Route: /api/auth/login
// Proxy login para o Backend Rust e seta cookies httpOnly com os tokens.
// Elimina CORS pois o frontend chama same-origin.

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias
const IS_PROD = process.env.NODE_ENV === 'production';
const USE_SECURE = IS_PROD && (API_URL.startsWith('https'));

function cookieOpts(maxAge: number) {
  return { httpOnly: true, secure: USE_SECURE, sameSite: 'lax' as const, path: '/', maxAge };
}

export async function POST(request: NextRequest) {
  if (!API_URL) {
    console.error('[auth/login] NEXT_PUBLIC_API_FROTA_URL não configurada');
    return NextResponse.json(
      { error: 'Servidor não configurado (API_URL vazia)' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const targetUrl = `${API_URL}/api/v1/auth/login`;

  try {
    console.log(`[auth/login] Proxy → ${targetUrl}`);

    const backendRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      console.log(`[auth/login] Backend retornou ${backendRes.status}: ${JSON.stringify(data)}`);
      return NextResponse.json(
        { error: data.error ?? 'Erro no login', code: data.code },
        { status: backendRes.status },
      );
    }

    // Set httpOnly cookies with tokens
    const response = NextResponse.json(data);

    if (data.access_token) {
      response.cookies.set('access_token', data.access_token, cookieOpts(data.expires_in ?? 3600));
    }

    if (data.refresh_token) {
      response.cookies.set('refresh_token', data.refresh_token, cookieOpts(REFRESH_TOKEN_MAX_AGE));
    }

    return response;
  } catch (err) {
    console.error(`[auth/login] Falha ao conectar em ${targetUrl}:`, err);
    return NextResponse.json(
      { error: `Não foi possível conectar ao servidor backend (${API_URL})` },
      { status: 502 },
    );
  }
}
