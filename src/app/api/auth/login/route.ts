import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL || process.env.API_FROTA_URL || '';

    if (!API_URL) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_API_FROTA_URL não configurada no servidor', debug: { env_keys: Object.keys(process.env).filter(k => k.includes('API') || k.includes('FROTA') || k.includes('NEXT_PUBLIC')) } },
        { status: 503 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Body inválido', debug: String(e) }, { status: 400 });
    }

    const targetUrl = `${API_URL}/api/v1/auth/login`;

    let backendRes: Response;
    try {
      backendRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (fetchErr) {
      return NextResponse.json(
        { error: 'Falha ao conectar no backend', debug: { targetUrl, message: String(fetchErr) } },
        { status: 502 },
      );
    }

    let data: Record<string, unknown>;
    try {
      data = await backendRes.json();
    } catch {
      const text = await backendRes.text().catch(() => '');
      return NextResponse.json(
        { error: 'Backend retornou resposta não-JSON', debug: { status: backendRes.status, body: text.slice(0, 500) } },
        { status: 502 },
      );
    }

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: (data.error as string) ?? 'Erro no login', code: data.code },
        { status: backendRes.status },
      );
    }

    const response = NextResponse.json(data);

    const secure = API_URL.startsWith('https');
    const cookieOpts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

    if (data.access_token) {
      response.cookies.set('access_token', data.access_token as string, { ...cookieOpts, maxAge: (data.expires_in as number) ?? 3600 });
    }
    if (data.refresh_token) {
      response.cookies.set('refresh_token', data.refresh_token as string, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 });
    }

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro interno na API route /api/auth/login', debug: String(err) },
      { status: 500 },
    );
  }
}
