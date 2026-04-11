// API Route: /api/auth/reset-password
// Caso especial: usuário vem de link de email com access_token na URL.
// Recebe o token no body (não tem cookie) e chama o backend.

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';

export async function POST(request: NextRequest) {
  let body: { access_token?: string; new_password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { access_token, new_password } = body;

  if (!access_token || !new_password) {
    return NextResponse.json(
      { error: 'access_token e new_password são obrigatórios' },
      { status: 400 },
    );
  }

  try {
    const backendRes = await fetch(`${API_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ new_password }),
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor' },
      { status: 503 },
    );
  }
}
