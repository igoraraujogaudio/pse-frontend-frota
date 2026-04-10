import { supabase } from '@/lib/supabase';
import { DevolucaoMaterialObra, DevolucaoMaterialObraItem } from '@/types/entrega-material-obra';
import { EntregaMaterialObraService } from './entregaMaterialObraService';

export class DevolucaoMaterialObraService {
  private static readonly TABLE = 'devolucao_material_obra';
  private static readonly ITENS_TABLE = 'devolucao_material_obra_itens';

  /**
   * Criar devolução com itens (almoxarifado inicia)
   */
  static async criar(input: {
    obraId: string;
    programacaoId?: string;
    equipeId: string;
    baseId: string;
    etapa?: string;
    devolvidoPara?: string;
    observacoes?: string;
    itens: Array<{
      materialId?: string | null;
      descricao: string;
      numeroMaterial?: string;
      unidade: string;
      quantidade: number;
      condicao: 'bom' | 'danificado' | 'sucata';
      observacoes?: string;
    }>;
  }): Promise<DevolucaoMaterialObra> {
    // 1. Criar registro de devolução
    const { data: dev, error: devErr } = await supabase
      .from(this.TABLE)
      .insert({
        obra_id: input.obraId,
        programacao_id: input.programacaoId ?? null,
        equipe_id: input.equipeId,
        base_id: input.baseId,
        etapa: input.etapa ?? null,
        data_devolucao: new Date().toISOString().split('T')[0],
        devolvido_para: input.devolvidoPara ?? null,
        status: 'devolvido',
        observacoes: input.observacoes ?? null,
      })
      .select('*')
      .single();
    if (devErr) throw devErr;

    // 2. Inserir itens
    if (input.itens.length > 0) {
      const { error: itensErr } = await supabase
        .from(this.ITENS_TABLE)
        .insert(input.itens.map(i => ({
          devolucao_id: dev.id,
          material_id: i.materialId ?? null,
          descricao: i.descricao,
          numero_material: i.numeroMaterial ?? null,
          unidade: i.unidade,
          quantidade: i.quantidade,
          condicao: i.condicao,
          observacoes: i.observacoes ?? null,
        })));
      if (itensErr) throw itensErr;
    }

    // 3. Retornar ao estoque imediatamente os materiais em bom estado
    for (const item of input.itens) {
      if (item.condicao === 'bom' && item.materialId) {
        try {
          await EntregaMaterialObraService.adicionarEstoque(input.baseId, item.materialId, item.quantidade);
        } catch (err) {
          console.error('Erro ao retornar material ao estoque:', err);
        }
      }
    }

    return this.fromRow(dev);
  }

  /**
   * Lista devoluções com filtros
   */
  static async listar(filtros?: {
    baseId?: string;
    obraId?: string;
    equipeId?: string;
    status?: string;
  }): Promise<DevolucaoMaterialObra[]> {
    let query = supabase
      .from(this.TABLE)
      .select(`
        *,
        equipe:equipes(id, nome),
        obra:obras_manutencao(id, numero_projeto, endereco_obra, municipio),
        base:bases(id, nome, codigo),
        recebedor:usuarios!devolucao_material_obra_devolvido_para_fkey(id, nome)
      `)
      .order('data_devolucao', { ascending: false });

    if (filtros?.baseId) query = query.eq('base_id', filtros.baseId);
    if (filtros?.obraId) query = query.eq('obra_id', filtros.obraId);
    if (filtros?.equipeId) query = query.eq('equipe_id', filtros.equipeId);
    if (filtros?.status) query = query.eq('status', filtros.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  /**
   * Busca devolução por ID com itens
   */
  static async getById(id: string): Promise<DevolucaoMaterialObra | null> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        *,
        equipe:equipes(id, nome),
        obra:obras_manutencao(id, numero_projeto, endereco_obra, municipio),
        base:bases(id, nome, codigo),
        recebedor:usuarios!devolucao_material_obra_devolvido_para_fkey(id, nome)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    // Buscar itens
    const { data: itens } = await supabase
      .from(this.ITENS_TABLE)
      .select('*')
      .eq('devolucao_id', id)
      .order('created_at');

    const dev = this.fromRow(data);
    dev.itens = (itens || []).map(this.itemFromRow);
    return dev;
  }

  /**
   * Aceite do encarregado na devolução
   */
  static async aceiteEncarregado(devolucaoId: string, userId: string, aceito: boolean): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({
        aceite_encarregado: aceito,
        aceite_encarregado_em: new Date().toISOString(),
        aceite_encarregado_por: userId,
        status: aceito ? 'aceito' : 'recusado',
      })
      .eq('id', devolucaoId);
    if (error) throw error;

    // Se aceito, retornar materiais em bom estado ao estoque
    if (aceito) {
      const dev = await this.getById(devolucaoId);
      if (dev?.itens) {
        for (const item of dev.itens) {
          if (item.condicao === 'bom' && item.materialId) {
            await EntregaMaterialObraService.adicionarEstoque(dev.baseId, item.materialId, item.quantidade);
          }
        }
      }
    }
  }

  /**
   * Cancelar devolução
   */
  static async cancelar(devolucaoId: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({ status: 'cancelado' })
      .eq('id', devolucaoId);
    if (error) throw error;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static fromRow(r: any): DevolucaoMaterialObra {
    return {
      id: r.id,
      obraId: r.obra_id,
      programacaoId: r.programacao_id,
      equipeId: r.equipe_id,
      baseId: r.base_id,
      etapa: r.etapa,
      dataDevolucao: r.data_devolucao,
      devolvidoPara: r.devolvido_para,
      aceiteEncarregado: r.aceite_encarregado ?? false,
      aceiteEncarregadoEm: r.aceite_encarregado_em,
      aceiteEncarregadoPor: r.aceite_encarregado_por,
      status: r.status ?? 'pendente',
      observacoes: r.observacoes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      equipe: r.equipe ? { id: r.equipe.id, nome: r.equipe.nome } : undefined,
      obra: r.obra ? {
        id: r.obra.id,
        numeroProjeto: r.obra.numero_projeto,
        enderecoObra: r.obra.endereco_obra,
        municipio: r.obra.municipio,
      } : undefined,
      base: r.base ? { id: r.base.id, nome: r.base.nome, codigo: r.base.codigo } : undefined,
      recebedor: r.recebedor ? { id: r.recebedor.id, nome: r.recebedor.nome } : undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static itemFromRow(r: any): DevolucaoMaterialObraItem {
    return {
      id: r.id,
      devolucaoId: r.devolucao_id,
      materialId: r.material_id,
      descricao: r.descricao,
      numeroMaterial: r.numero_material,
      unidade: r.unidade,
      quantidade: Number(r.quantidade),
      condicao: r.condicao ?? 'bom',
      observacoes: r.observacoes,
      createdAt: r.created_at,
    };
  }
}
