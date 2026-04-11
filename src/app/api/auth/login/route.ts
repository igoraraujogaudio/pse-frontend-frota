import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL || process.env.API_FROTA_URL || '';

    if (!API_URL) {
      return NextResponse.json({ error: 'API_URL vazia' }, { status: 503 });
    }

    const body = await request.json();
    const targetUrl = `${API_URL}/api/v1/auth/login`;

    const backendRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const response = NextResponse.json(data);
    const secure = API_URL.startsWith('https');
    const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

    if (data.access_token) {
      response.cookies.set('access_token', data.access_token, { ...opts, maxAge: data.expires_in ?? 3600 });
    }
    if (data.refresh_token) {
      response.cookies.set('refresh_token', data.refresh_token, { ...opts, maxAge: 604800 });
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Erro no proxy login', detail: String(err) }, { status: 500 });
  }
}
