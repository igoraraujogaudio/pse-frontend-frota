// ⚠️ ATENÇÃO: Este módulo usa service_role e NUNCA deve ser importado no frontend/client-side.
// A service_role ignora todas as políticas RLS — uso exclusivo em API Routes e Server Components.
// Requisitos: 5.1, 5.2, 5.3

import { createClient } from '@supabase/supabase-js';

// Runtime check: impedir importação no client-side
if (typeof window !== 'undefined') {
  throw new Error(
    'supabase-admin.ts não pode ser importado no client-side. ' +
    'Este módulo usa service_role que ignora RLS. ' +
    'Use lib/supabase.ts (anon key) para o frontend.'
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
