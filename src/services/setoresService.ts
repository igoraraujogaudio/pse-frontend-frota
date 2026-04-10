import { supabase } from '@/lib/supabase';
import { SetorPadrao, SetorFormData, SetorFilter, OperacaoComSetores, SetorComOperacoes } from '@/types/setores';

export class SetoresService {
  // Buscar todos os setores
  static async getSetores(filter?: SetorFilter): Promise<SetorPadrao[]> {
    let query = supabase
      .from('setores_padrao')
      .select('*')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });

    if (filter?.ativo !== undefined) {
      query = query.eq('ativo', filter.ativo);
    }

    if (filter?.contratoId) {
      query = query.eq('contrato_id', filter.contratoId);
    }

    if (filter?.search) {
      query = query.or(`nome.ilike.%${filter.search}%,codigo.ilike.%${filter.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  // Buscar setor por ID
  static async getSetorById(id: string): Promise<SetorPadrao | null> {
    const { data, error } = await supabase
      .from('setores_padrao')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Não encontrado
      throw error;
    }

    return data;
  }

  // Criar novo setor
  static async createSetor(setorData: SetorFormData): Promise<SetorPadrao> {
    const { data, error } = await supabase
      .from('setores_padrao')
      .insert({
        codigo: setorData.codigo,
        nome: setorData.nome,
        descricao: setorData.descricao,
        ativo: setorData.ativo,
        contrato_id: setorData.contratoId,
        ordem: setorData.ordem
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Atualizar setor
  static async updateSetor(id: string, setorData: Partial<SetorFormData>): Promise<SetorPadrao> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (setorData.codigo !== undefined) updateData.codigo = setorData.codigo;
    if (setorData.nome !== undefined) updateData.nome = setorData.nome;
    if (setorData.descricao !== undefined) updateData.descricao = setorData.descricao;
    if (setorData.ativo !== undefined) updateData.ativo = setorData.ativo;
    if (setorData.contratoId !== undefined) updateData.contrato_id = setorData.contratoId;
    if (setorData.ordem !== undefined) updateData.ordem = setorData.ordem;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('setores_padrao')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar setor
  static async deleteSetor(id: string): Promise<void> {
    const { error } = await supabase
      .from('setores_padrao')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Buscar setores de uma operação específica
  static async getSetoresDaOperacao(operacaoId: string): Promise<SetorPadrao[]> {
    const { data, error } = await supabase
      .from('vw_operacao_setores')
      .select('setor_id, setor_codigo, setor_nome, setor_descricao')
      .eq('operacao_id', operacaoId)
      .eq('relacionamento_ativo', true);

    if (error) throw error;

    // Transformar para o formato SetorPadrao
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((item: any) => ({
      id: item.setor_id,
      codigo: item.setor_codigo,
      nome: item.setor_nome,
      descricao: item.setor_descricao,
      ativo: true,
      contratoId: undefined,
      ordem: 0,
      createdAt: '',
      updatedAt: ''
    }));
  }

  // Buscar operações com seus setores
  static async getOperacoesComSetores(contratoId?: string): Promise<OperacaoComSetores[]> {
    let query = supabase
      .from('operacoes_padrao')
      .select(`
        *,
        operacao_setor!inner(
          setor_id,
          setores_padrao!inner(*)
        )
      `)
      .eq('ativo', true);

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Processar os dados para estruturar corretamente
    const operacoesMap = new Map<string, OperacaoComSetores>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data || []).forEach((item: any) => {
      const operacaoId = item.id;
      
      if (!operacoesMap.has(operacaoId)) {
        operacoesMap.set(operacaoId, {
          id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          descricao: item.descricao,
          ativo: item.ativo,
          contratoId: item.contrato_id,
          ordem: item.ordem,
          requerEncarregado: item.requer_encarregado,
          setores: [],
          createdAt: item.created_at,
          updatedAt: item.updated_at
        });
      }

      const operacao = operacoesMap.get(operacaoId)!;
      
      if (item.operacao_setor && item.operacao_setor.setores_padrao) {
        const setor = item.operacao_setor.setores_padrao;
        operacao.setores.push({
          id: setor.id,
          codigo: setor.codigo,
          nome: setor.nome,
          descricao: setor.descricao,
          ativo: setor.ativo,
          contratoId: setor.contrato_id,
          ordem: setor.ordem,
          createdAt: setor.created_at,
          updatedAt: setor.updated_at
        });
      }
    });

    return Array.from(operacoesMap.values());
  }

  // Buscar setores com suas operações
  static async getSetoresComOperacoes(contratoId?: string): Promise<SetorComOperacoes[]> {
    let query = supabase
      .from('setores_padrao')
      .select(`
        *,
        operacao_setor!inner(
          operacao_id,
          operacoes_padrao!inner(*)
        )
      `)
      .eq('ativo', true);

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Processar os dados para estruturar corretamente
    const setoresMap = new Map<string, SetorComOperacoes>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data || []).forEach((item: any) => {
      const setorId = item.id;
      
      if (!setoresMap.has(setorId)) {
        setoresMap.set(setorId, {
          id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          descricao: item.descricao,
          ativo: item.ativo,
          contratoId: item.contrato_id,
          ordem: item.ordem,
          operacoes: [],
          createdAt: item.created_at,
          updatedAt: item.updated_at
        });
      }

      const setor = setoresMap.get(setorId)!;
      
      if (item.operacao_setor && item.operacao_setor.operacoes_padrao) {
        const operacao = item.operacao_setor.operacoes_padrao;
        setor.operacoes.push({
          id: operacao.id,
          codigo: operacao.codigo,
          nome: operacao.nome
        });
      }
    });

    return Array.from(setoresMap.values());
  }

  // Associar setor a operação
  static async associarSetorOperacao(operacaoId: string, setorId: string): Promise<void> {
    const { error } = await supabase
      .from('operacao_setor')
      .insert({
        operacao_id: operacaoId,
        setor_id: setorId,
        ativo: true
      });

    if (error) throw error;
  }

  // Desassociar setor de operação
  static async desassociarSetorOperacao(operacaoId: string, setorId: string): Promise<void> {
    const { error } = await supabase
      .from('operacao_setor')
      .delete()
      .eq('operacao_id', operacaoId)
      .eq('setor_id', setorId);

    if (error) throw error;
  }

  // Atualizar associações de setores de uma operação
  static async atualizarSetoresOperacao(operacaoId: string, setorIds: string[]): Promise<void> {
    // Primeiro, remover todas as associações existentes
    await supabase
      .from('operacao_setor')
      .delete()
      .eq('operacao_id', operacaoId);

    // Depois, inserir as novas associações
    if (setorIds.length > 0) {
      const associacoes = setorIds.map(setorId => ({
        operacao_id: operacaoId,
        setor_id: setorId,
        ativo: true
      }));

      const { error } = await supabase
        .from('operacao_setor')
        .insert(associacoes);

      if (error) throw error;
    }
  }
}
