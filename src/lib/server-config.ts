// Server-only config — usado apenas nas API routes.
// Em standalone mode, NEXT_PUBLIC_* pode não estar disponível no runtime.
// Prioriza API_FROTA_URL (server-only), fallback pra NEXT_PUBLIC_API_FROTA_URL.

export function getBackendUrl(): string {
  return process.env.API_FROTA_URL
    || process.env.NEXT_PUBLIC_API_FROTA_URL
    || '';
}
