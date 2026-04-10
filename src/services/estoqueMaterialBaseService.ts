import { supabase } from '@/lib/supabase';
import { EstoqueMaterialBase } from '@/types/entrega-material-obra';

export interface EstoqueMaterialBaseComDetalhes extends EstoqueMaterialBase {
  base?: { id: string; nome: string; codigo: string };
  material?: {
    id: string;
    numeroMaterial: string;
    descricaoMaterial: string;
    unidadeMedida: string;
  };
}

export interface MovimentacaoMaterialBase {
  id: string;
  estoqueId: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  quantidadeAnterior: number;
  quantidadeAtual: number;
  motivo?: string;
  usuarioId?: string;
  usuarioNome?: string;
  createdAt: string;
}

export class EstoqueMaterialBaseService {
  private static readonly TABLE = 'estoque_material_base';
  private static readonly MOV_TABLE = 'movimentacao_material_base';

  /**
   * Busca estoque de uma base específica
   */
  static async getByBase(baseId: string): Promise<EstoqueMaterialBaseComDetalhes[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        *,
        base:bases(id, nome, codigo),
        material:lista_materiais(id, numero_material, descricao_material, unidade_medida)
      `)
      .eq('base_id', baseId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      baseId: row.base_id,
      materialId: row.material_id,
      quantidade: Number(row.quantidade),
      quantidadeMinima: Number(row.quantidade_minima),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      base: row.base ? {
        id: row.base.id,
        nome: row.base.nome,
        codigo: row.base.codigo,
      } : undefined,
      material: row.material ? {
        id: row.material.id,
        numeroMaterial: row.material.numero_material,
        descricaoMaterial: row.material.descricao_material,
        unidadeMedida: row.material.unidade_medida,
      } : undefined,
    }));
  }

  /**
   * Dar entrada de material em uma base (incrementa quantidade e registra log)
   */
  static async darEntrada(params: {
    baseId: string;
    materialId: string;
    quantidade: number;
    motivo?: string;
    usuarioId?: string;
    usuarioNome?: string;
  }): Promise<void> {
    // Buscar registro atual (ou criar se não existe)
    const { data: existente } = await supabase
      .from(this.TABLE)
      .select('id, quantidade')
      .eq('base_id', params.baseId)
      .eq('material_id', params.materialId)
      .maybeSingle();

    const quantidadeAnterior = existente ? Number(existente.quantidade) : 0;
    const quantidadeNova = quantidadeAnterior + params.quantidade;

    if (existente) {
      // Atualizar quantidade
      const { error } = await supabase
        .from(this.TABLE)
        .update({ quantidade: quantidadeNova })
        .eq('id', existente.id);
      if (error) throw error;

      // Registrar movimentação
      await this.registrarMovimentacao({
        estoqueId: existente.id,
        tipo: 'entrada',
        quantidade: params.quantidade,
        quantidadeAnterior,
        quantidadeAtual: quantidadeNova,
        motivo: params.motivo,
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
      });
    } else {
      // Criar novo registro
      const { data: novo, error } = await supabase
        .from(this.TABLE)
        .insert({
          base_id: params.baseId,
          material_id: params.materialId,
          quantidade: params.quantidade,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Registrar movimentação
      await this.registrarMovimentacao({
        estoqueId: novo.id,
        tipo: 'entrada',
        quantidade: params.quantidade,
        quantidadeAnterior: 0,
        quantidadeAtual: params.quantidade,
        motivo: params.motivo,
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
      });
    }
  }

  /**
   * Registrar movimentação no log
   */
  private static async registrarMovimentacao(params: {
    estoqueId: string;
    tipo: 'entrada' | 'saida' | 'ajuste';
    quantidade: number;
    quantidadeAnterior: number;
    quantidadeAtual: number;
    motivo?: string;
    usuarioId?: string;
    usuarioNome?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from(this.MOV_TABLE)
      .insert({
        estoque_id: params.estoqueId,
        tipo: params.tipo,
        quantidade: params.quantidade,
        quantidade_anterior: params.quantidadeAnterior,
        quantidade_atual: params.quantidadeAtual,
        motivo: params.motivo ?? null,
        usuario_id: params.usuarioId ?? null,
        usuario_nome: params.usuarioNome ?? null,
      });
    if (error) throw error;
  }

  /**
   * Buscar movimentações de um item de estoque
   */
  static async getMovimentacoes(estoqueId: string): Promise<MovimentacaoMaterialBase[]> {
    const { data, error } = await supabase
      .from(this.MOV_TABLE)
      .select('*')
      .eq('estoque_id', estoqueId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      estoqueId: row.estoque_id,
      tipo: row.tipo,
      quantidade: Number(row.quantidade),
      quantidadeAnterior: Number(row.quantidade_anterior),
      quantidadeAtual: Number(row.quantidade_atual),
      motivo: row.motivo,
      usuarioId: row.usuario_id,
      usuarioNome: row.usuario_nome,
      createdAt: row.created_at,
    }));
  }

  /**
   * Atualizar estoque mínimo
   */
  static async atualizarEstoqueMinimo(estoqueId: string, quantidadeMinima: number): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({ quantidade_minima: quantidadeMinima })
      .eq('id', estoqueId);
    if (error) throw error;
  }

  /**
   * Retorna IDs dos materiais que já existem no estoque de uma base
   */
  static async getMateriaisIdsNaBase(baseId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('material_id')
      .eq('base_id', baseId);
    if (error) throw error;
    return new Set((data || []).map(r => r.material_id));
  }

  /**
   * Popular múltiplos materiais em uma base (cria registros com estoque 0)
   * Ignora materiais que já existem na base.
   */
  static async popularMateriaisNaBase(baseId: string, materialIds: string[]): Promise<number> {
    if (!materialIds.length) return 0;

    // Verificar quais já existem
    const existentes = await this.getMateriaisIdsNaBase(baseId);
    const novos = materialIds.filter(id => !existentes.has(id));
    if (!novos.length) return 0;

    const rows = novos.map(materialId => ({
      base_id: baseId,
      material_id: materialId,
      quantidade: 0,
      quantidade_minima: 0,
    }));

    const { error } = await supabase
      .from(this.TABLE)
      .insert(rows);
    if (error) throw error;

    return novos.length;
  }

  /**
   * Popular TODOS os materiais de um contrato em uma base
   */
  static async popularTodosMateriaisDoContrato(baseId: string, contratoId: string): Promise<number> {
    // Buscar todos os materiais do contrato
    const { data: materiais, error } = await supabase
      .from('lista_materiais')
      .select('id')
      .eq('contrato_id', contratoId);
    if (error) throw error;
    if (!materiais?.length) return 0;

    return this.popularMateriaisNaBase(baseId, materiais.map(m => m.id));
  }

  /**
   * Remover material do estoque de uma base (só se quantidade = 0)
   */
  static async removerDaBase(estoqueId: string): Promise<void> {
    const { data, error: fetchErr } = await supabase
      .from(this.TABLE)
      .select('quantidade')
      .eq('id', estoqueId)
      .single();
    if (fetchErr) throw fetchErr;
    if (Number(data.quantidade) > 0) {
      throw new Error('Não é possível remover material com estoque > 0');
    }
    const { error } = await supabase
      .from(this.TABLE)
      .delete()
      .eq('id', estoqueId);
    if (error) throw error;
  }
}
