// =============================================================================
// STUB TEMPORÁRIO — NÃO USAR EM CÓDIGO NOVO
// =============================================================================
// Este arquivo existe apenas para que os módulos ainda não migrados (admin,
// almoxarifado, obras, etc.) continuem compilando. Todos os services de FROTA
// já foram migrados para usar apiClient via proxy.
//
// TODO: Migrar os módulos restantes para apiClient e deletar este arquivo.
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

const STUB_WARNING = '[supabase-stub] Este módulo ainda não foi migrado para apiClient. Chamada ignorada.'

function warn() { if (typeof console !== 'undefined') console.warn(STUB_WARNING) }

// Chainable query builder that warns and returns empty data
function queryBuilder(): any {
  const chain: any = {
    select: () => chain, from: () => chain, insert: () => chain,
    update: () => chain, delete: () => chain, upsert: () => chain,
    eq: () => chain, neq: () => chain, gt: () => chain, gte: () => chain,
    lt: () => chain, lte: () => chain, like: () => chain, ilike: () => chain,
    is: () => chain, in: () => chain, not: () => chain, or: () => chain,
    contains: () => chain, filter: () => chain, match: () => chain,
    order: () => chain, limit: () => chain, range: () => chain,
    single: () => chain, maybeSingle: () => chain,
    then: (resolve: any) => { warn(); resolve({ data: null, error: { message: STUB_WARNING, code: 'STUB' } }) },
    // Make it thenable so await works
  }
  // Add Promise-like behavior
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

function storageStub(): any {
  return {
    from: () => ({
      upload: async () => { warn(); return { data: null, error: { message: STUB_WARNING } } },
      download: async () => { warn(); return { data: null, error: { message: STUB_WARNING } } },
      remove: async () => { warn(); return { data: null, error: { message: STUB_WARNING } } },
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      createSignedUrl: async () => { warn(); return { data: null, error: { message: STUB_WARNING } } },
    })
  }
}

export const supabase = {
  from: (_table: string) => queryBuilder(),
  rpc: (_fn: string, _params?: any) => queryBuilder(),
  auth: {
    getUser: async () => { warn(); return { data: { user: null }, error: null } },
    getSession: async () => { warn(); return { data: { session: null }, error: null } },
    signInWithPassword: async () => { warn(); return { data: null, error: { message: STUB_WARNING } } },
    signOut: async () => { warn(); return { error: null } },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: storageStub(),
}
