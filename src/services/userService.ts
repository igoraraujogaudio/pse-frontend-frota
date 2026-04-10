import { supabase } from '@/lib/supabase'
import { User, UsuarioContrato, UsuarioBase } from '@/types'
// import type { Contrato, Base } from '@/types' // TODO: Implement contract and base filtering

export const userService = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome')

    if (error) throw error
    return data
  },

  async getUsuariosAtivos(): Promise<User[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .neq('status', 'demitido')
      .neq('status', 'inativo')
      .neq('status', 'suspenso')
      .order('nome')

    if (error) throw error
    return data || []
  },

  // Método paginado para melhor performance
  async getPaginated(page: number = 1, limit: number = 20, filters?: {
    search?: string;
    accessLevel?: string;
    operacao?: string;
    status?: string;
  }): Promise<{ users: User[]; total: number; totalPages: number }> {
    let query = supabase
      .from('usuarios')
      .select('*', { count: 'exact' })
      .order('nome');

    // Aplicar filtros
    if (filters?.search) {
      query = query.or(`nome.ilike.%${filters.search}%,email.ilike.%${filters.search}%,departamento.ilike.%${filters.search}%,cargo.ilike.%${filters.search}%,matricula.ilike.%${filters.search}%`);
    }
    if (filters?.accessLevel) {
      query = query.eq('nivel_acesso', filters.accessLevel);
    }
    if (filters?.operacao) {
      query = query.eq('operacao', filters.operacao);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      users: data || [],
      total,
      totalPages
    };
  },

  // Método para obter contadores totais (sem paginação)
  async getCounts(filters?: {
    search?: string;
    accessLevel?: string;
    operacao?: string;
    status?: string;
  }): Promise<{ total: number; ativo: number; pendente: number; inativo: number }> {
    let query = supabase
      .from('usuarios')
      .select('status', { count: 'exact' });

    // Aplicar os mesmos filtros da paginação
    if (filters?.search) {
      query = query.or(`nome.ilike.%${filters.search}%,email.ilike.%${filters.search}%,departamento.ilike.%${filters.search}%,cargo.ilike.%${filters.search}%,matricula.ilike.%${filters.search}%`);
    }
    if (filters?.accessLevel) {
      query = query.eq('nivel_acesso', filters.accessLevel);
    }
    if (filters?.operacao) {
      query = query.eq('operacao', filters.operacao);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;
    const statusCounts = (data || []).reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      ativo: statusCounts.ativo || 0,
      pendente: statusCounts.pendente || 0,
      inativo: statusCounts.inativo || 0
    };
  },

  async getById(id: string): Promise<User> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async getByMatricula(matricula: string): Promise<{ data: User | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('matricula', matricula)
      .single()

    return { data, error }
  },

  async getUserLocations(userId: string): Promise<string[]> {
    // Método de compatibilidade - retorna IDs dos contratos como locais
    return this.getUserContratoIds(userId);
  },

  async create(user: Omit<User, 'id' | 'criado_em' | 'atualizado_em'>): Promise<User> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([user])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('usuarios')
      .update(user)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ============================================================================
  // MÉTODOS PARA CONTRATOS E BASES - NOVA ESTRUTURA
  // ============================================================================

  // Contratos do usuário
  async getUserContratos(userId: string): Promise<UsuarioContrato[]> {
    const { data, error } = await supabase
      .from('usuario_contratos')
      .select(`
        *,
        contrato:contratos (*)
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateUserContratos(userId: string, contratoIds: string[]): Promise<void> {
    // Primeiro, desativa todos os contratos existentes
    await supabase
      .from('usuario_contratos')
      .update({ ativo: false })
      .eq('usuario_id', userId);

    // Depois, insere/ativa os novos contratos
    if (contratoIds.length > 0) {
      const userContratos = contratoIds.map(contratoId => ({
        usuario_id: userId,
        contrato_id: contratoId,
        perfil_contrato: 'operador', // Padrão
        data_inicio: new Date().toISOString().split('T')[0],
        ativo: true
      }));

      const { error: insertError } = await supabase
        .from('usuario_contratos')
        .upsert(userContratos, { 
          onConflict: 'usuario_id,contrato_id',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;
    }
  },

  // Bases do usuário
  async getUserBases(userId: string): Promise<UsuarioBase[]> {
    const { data, error } = await supabase
      .from('usuario_bases')
      .select(`
        *,
        base:bases (*)
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateUserBases(userId: string, baseIds: string[]): Promise<void> {
    // Primeiro, desativa todas as bases existentes
    await supabase
      .from('usuario_bases')
      .update({ ativo: false })
      .eq('usuario_id', userId);

    // Depois, insere/ativa as novas bases
    if (baseIds.length > 0) {
      const userBases = baseIds.map(baseId => ({
        usuario_id: userId,
        base_id: baseId,
        tipo_acesso: 'total' as const, // Padrão
        data_inicio: new Date().toISOString().split('T')[0],
        ativo: true
      }));

      const { error: insertError } = await supabase
        .from('usuario_bases')
        .upsert(userBases, { 
          onConflict: 'usuario_id,base_id',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;
    }
  },

  // Métodos batch para múltiplos usuários
  async getBatchUserContratos(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('usuario_contratos')
      .select('usuario_id, contrato_id')
      .in('usuario_id', userIds)
      .eq('ativo', true);

    if (error) throw error;

    const userContratosMap: Record<string, string[]> = {};
    
    data?.forEach(item => {
      if (!userContratosMap[item.usuario_id]) {
        userContratosMap[item.usuario_id] = [];
      }
      userContratosMap[item.usuario_id].push(item.contrato_id);
    });

    return userContratosMap;
  },

  async getBatchUserBases(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('usuario_bases')
      .select('usuario_id, base_id')
      .in('usuario_id', userIds)
      .eq('ativo', true);

    if (error) throw error;

    const userBasesMap: Record<string, string[]> = {};
    
    data?.forEach(item => {
      if (!userBasesMap[item.usuario_id]) {
        userBasesMap[item.usuario_id] = [];
      }
      userBasesMap[item.usuario_id].push(item.base_id);
    });

    return userBasesMap;
  },

  // Método simplificado para retornar apenas IDs dos contratos
  async getUserContratoIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('usuario_contratos')
      .select('contrato_id')
      .eq('usuario_id', userId)
      .eq('ativo', true);

    if (error) throw error;
    return data.map(item => item.contrato_id);
  },

  // Métodos de compatibilidade - mapeiam contratos para locais durante migração
  async getUserLocationsFromContratos(userId: string): Promise<string[]> {
    const contratos = await this.getUserContratos(userId);
    // Por enquanto, retorna IDs dos contratos como se fossem locais
    return contratos.map(uc => uc.contrato_id);
  },

  async updateUserLocationsAsContratos(userId: string, contratoIds: string[]): Promise<void> {
    return this.updateUserContratos(userId, contratoIds);
  },

  // Métodos para obter contratos e bases de múltiplos usuários
  async getAllUsersContratos(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('usuario_contratos')
      .select('usuario_id, contrato_id')
      .in('usuario_id', userIds)
      .eq('ativo', true);

    if (error) throw error;

    const userContratosMap: Record<string, string[]> = {};
    
    data?.forEach(item => {
      if (!userContratosMap[item.usuario_id]) {
        userContratosMap[item.usuario_id] = [];
      }
      userContratosMap[item.usuario_id].push(item.contrato_id);
    });

    return userContratosMap;
  },

  async getAllUsersBases(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('usuario_bases')
      .select('usuario_id, base_id')
      .in('usuario_id', userIds)
      .eq('ativo', true);

    if (error) throw error;

    const userBasesMap: Record<string, string[]> = {};
    
    data?.forEach(item => {
      if (!userBasesMap[item.usuario_id]) {
        userBasesMap[item.usuario_id] = [];
      }
      userBasesMap[item.usuario_id].push(item.base_id);
    });

    return userBasesMap;
  },

  // Método para criar usuário com nova estrutura de contratos/bases
  async createWithMatricula(userData: {
    name: string;
    department: string;
    role: string;
    position: string;
    employee_id: string;
    cpf?: string;
    cnh?: string;
    validade_cnh?: string;
    cnh_categoria?: string;
    email: string;
    phone: string;
    password: string;
    access_level: string;
    operacao?: string;
    contratos?: { contrato_id: string; perfil_contrato?: string }[];
    bases?: { base_id: string; tipo_acesso?: string }[];
  }) {
    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar usuário');
    }

    return response.json();
  },
} 