// API Route Proxy: /api/proxy/[...path]
// Requisitos: 5.2, 5.4, 4.6, 4.7
//
// Lê JWT do cookie httpOnly e repassa ao Backend Rust.
// Se 401: tenta refresh automático, atualiza cookies, retenta request.
// Se refresh falha: limpa cookies e retorna 401.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function setCookiesOnResponse(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: expiresIn,
  });
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearCookiesOnResponse(response: NextResponse) {
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
}

// ---------------------------------------------------------------------------
// Refresh helper
// ---------------------------------------------------------------------------

async function tryRefresh(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forward request to Backend Rust
// ---------------------------------------------------------------------------

async function forwardRequest(
  request: NextRequest,
  path: string,
  accessToken: string,
): Promise<Response> {
  const targetUrl = new URL(`${API_URL}/api/v1/${path}`);

  // Preserve query params from original request
  request.nextUrl.searchParams.forEach((value: string, key: string) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);

  // Forward content-type if present
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  // Forward accept header if present
  const accept = request.headers.get('accept');
  if (accept) {
    headers.set('Accept', accept);
  }

  // Read body for non-GET/HEAD methods
  let body: BodyInit | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer().then((buf: ArrayBuffer) =>
      buf.byteLength > 0 ? buf : null,
    );
  }

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body,
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 },
    );
  }

  // First attempt
  let backendResponse = await forwardRequest(request, path, accessToken);

  // If 401, try refresh
  if (backendResponse.status === 401) {
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (refreshToken) {
      const refreshResult = await tryRefresh(refreshToken);

      if (refreshResult) {
        // Retry with new token
        backendResponse = await forwardRequest(request, path, refreshResult.access_token);

        // Build response and update cookies
        const responseBody = backendResponse.status === 204
          ? null
          : await backendResponse.arrayBuffer();

        const proxyResponse = new NextResponse(responseBody, {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
        });

        // Copy relevant headers from backend
        backendResponse.headers.forEach((value, key) => {
          const lower = key.toLowerCase();
          if (lower !== 'transfer-encoding' && lower !== 'connection') {
            proxyResponse.headers.set(key, value);
          }
        });

        // Set updated cookies
        setCookiesOnResponse(
          proxyResponse,
          refreshResult.access_token,
          refreshResult.refresh_token,
          refreshResult.expires_in,
        );

        return proxyResponse;
      }
    }

    // Refresh failed or no refresh token — clear cookies and return 401
    const unauthorizedResponse = NextResponse.json(
      { error: 'Sessão expirada' },
      { status: 401 },
    );
    clearCookiesOnResponse(unauthorizedResponse);
    return unauthorizedResponse;
  }

  // Non-401 response — pass through
  const responseBody = backendResponse.status === 204
    ? null
    : await backendResponse.arrayBuffer();

  const proxyResponse = new NextResponse(responseBody, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
  });

  // Copy relevant headers from backend
  backendResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== 'transfer-encoding' && lower !== 'connection') {
      proxyResponse.headers.set(key, value);
    }
  });

  return proxyResponse;
}

// Export all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
