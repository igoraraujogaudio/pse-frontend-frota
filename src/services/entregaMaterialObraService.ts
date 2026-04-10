import { supabase } from '@/lib/supabase';
import { EntregaMaterialObra, ProgramacaoComFluxo } from '@/types/entrega-material-obra';

export class EntregaMaterialObraService {
  private static readonly TABLE = 'obra_entrega_almoxarifado';

  /**
   * Lista programações com fluxo definido que têm materiais pendentes de entrega.
   * Agrupa por programacao_id e calcula quantos itens já foram entregues.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getProgramacoesPendentes(_baseId?: string): Promise<ProgramacaoComFluxo[]> {
    // Buscar programações com fluxo_definido = true
    const query = supabase
      .from('obra_programacao_equipe')
      .select(`
        id, obra_id, equipe_id, data, etapa, fluxo_definido, status_execucao,
        obra:obras_manutencao(id, numero_projeto, endereco_obra, municipio, setor),
        equipe:equipes(id, nome)
      `)
      .eq('fluxo_definido', true)
      .order('data', { ascending: false });

    const { data: progs, error } = await query;
    if (error) throw error;
    if (!progs?.length) return [];

    // Buscar fluxo de materiais para cada programação
    const progIds = progs.map((p: any) => p.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: fluxos } = await supabase
      .from('obra_programacao_fluxo_material')
      .select('id, programacao_id, descricao, numero_material, unidade, quantidade, material_id')
      .in('programacao_id', progIds);

    // Buscar entregas já feitas
    const { data: entregas } = await supabase
      .from(this.TABLE)
      .select('programacao_id, quantidade')
      .in('programacao_id', progIds)
      .in('status', ['entregue', 'aceito']);

    // Agrupar entregas por programacao_id
    const entregasMap = new Map<string, number>();
    for (const e of (entregas || [])) {
      entregasMap.set(e.programacao_id, (entregasMap.get(e.programacao_id) ?? 0) + 1);
    }

    // Agrupar fluxos por programacao_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fluxoMap = new Map<string, any[]>();
    for (const f of (fluxos || [])) {
      if (!fluxoMap.has(f.programacao_id)) fluxoMap.set(f.programacao_id, []);
      fluxoMap.get(f.programacao_id)!.push({
        id: f.id,
        descricao: f.descricao,
        numeroMaterial: f.numero_material,
        unidade: f.unidade,
        quantidade: Number(f.quantidade),
        materialId: f.material_id,
      });
    }

    return progs.map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: p.id,
      obraId: p.obra_id,
      equipeId: p.equipe_id,
      data: p.data,
      etapa: p.etapa,
      fluxoDefinido: p.fluxo_definido,
      statusExecucao: p.status_execucao,
      obra: p.obra ? {
        id: p.obra.id,
        numeroProjeto: p.obra.numero_projeto,
        enderecoObra: p.obra.endereco_obra,
        municipio: p.obra.municipio,
        setor: p.obra.setor,
      } : undefined,
      equipe: p.equipe ? { id: p.equipe.id, nome: p.equipe.nome } : undefined,
      materiaisFluxo: fluxoMap.get(p.id) || [],
      entregasRealizadas: entregasMap.get(p.id) ?? 0,
    }));
  }

  /**
   * Registra a entrega de materiais para uma programação.
   * Desconta do estoque da base.
   */
  static async registrarEntrega(input: {
    obraId: string;
    programacaoId: string;
    equipeId: string;
    baseId: string;
    entreguePor: string;
    recebidoPor?: string;
    recebidoPorNome?: string;
    itens: Array<{
      materialId?: string | null;
      descricao: string;
      numeroMaterial?: string;
      unidade: string;
      quantidade: number;
    }>;
    observacoes?: string;
  }): Promise<EntregaMaterialObra[]> {
    const now = new Date().toISOString().split('T')[0];
    const rows = input.itens.map(item => ({
      obra_id: input.obraId,
      programacao_id: input.programacaoId,
      equipe_id: input.equipeId,
      base_id: input.baseId,
      material_id: item.materialId ?? null,
      descricao: item.descricao,
      numero_material: item.numeroMaterial ?? null,
      unidade: item.unidade,
      quantidade: item.quantidade,
      data_entrega: now,
      entregue_por: input.entreguePor,
      recebido_por: input.recebidoPor ?? null,
      recebido_por_nome: input.recebidoPorNome ?? null,
      status: 'entregue',
      observacoes: input.observacoes ?? null,
    }));

    const { data, error } = await supabase
      .from(this.TABLE)
      .insert(rows)
      .select('*');
    if (error) throw error;

    // Descontar estoque da base
    for (const item of input.itens) {
      if (item.materialId) {
        await this.descontarEstoque(input.baseId, item.materialId, item.quantidade);
      }
    }

    return (data || []).map(this.fromRow);
  }

  /**
   * Busca entregas por programação
   */
  static async getByProgramacao(programacaoId: string): Promise<EntregaMaterialObra[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        *,
        obra:obras_manutencao(id, numero_projeto, endereco_obra, municipio),
        base:bases(id, nome, codigo)
      `)
      .eq('programacao_id', programacaoId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  /**
   * Busca entregas por obra
   */
  static async getByObra(obraId: string): Promise<EntregaMaterialObra[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        *,
        base:bases(id, nome, codigo)
      `)
      .eq('obra_id', obraId)
      .order('data_entrega', { ascending: false });
    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  /**
   * Aceite do encarregado
   */
  static async aceiteEncarregado(entregaId: string, userId: string, aceito: boolean): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({
        aceite_encarregado: aceito,
        aceite_encarregado_em: new Date().toISOString(),
        aceite_encarregado_por: userId,
        status: aceito ? 'aceito' : 'recusado',
      })
      .eq('id', entregaId);
    if (error) throw error;
  }

  /**
   * Cancelar entrega (retorna ao estoque)
   */
  static async cancelarEntrega(entregaId: string): Promise<void> {
    // Buscar dados da entrega
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('id', entregaId)
      .single();
    if (error) throw error;

    // Retornar ao estoque
    if (data.material_id && data.base_id) {
      await this.adicionarEstoque(data.base_id, data.material_id, Number(data.quantidade));
    }

    // Marcar como cancelado
    await supabase.from(this.TABLE).update({ status: 'cancelado' }).eq('id', entregaId);
  }

  // ===== ESTOQUE HELPERS =====

  private static async descontarEstoque(baseId: string, materialId: string, quantidade: number): Promise<void> {
    // Buscar estoque atual
    const { data: estoque } = await supabase
      .from('estoque_material_base')
      .select('id, quantidade')
      .eq('base_id', baseId)
      .eq('material_id', materialId)
      .maybeSingle();

    if (estoque) {
      await supabase
        .from('estoque_material_base')
        .update({ quantidade: Math.max(0, Number(estoque.quantidade) - quantidade) })
        .eq('id', estoque.id);
    }
  }

  static async adicionarEstoque(baseId: string, materialId: string, quantidade: number): Promise<void> {
    const { data: estoque } = await supabase
      .from('estoque_material_base')
      .select('id, quantidade')
      .eq('base_id', baseId)
      .eq('material_id', materialId)
      .maybeSingle();

    if (estoque) {
      await supabase
        .from('estoque_material_base')
        .update({ quantidade: Number(estoque.quantidade) + quantidade })
        .eq('id', estoque.id);
    } else {
      await supabase
        .from('estoque_material_base')
        .insert({ base_id: baseId, material_id: materialId, quantidade });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static fromRow(r: any): EntregaMaterialObra {
    return {
      id: r.id,
      obraId: r.obra_id,
      programacaoId: r.programacao_id,
      equipeId: r.equipe_id,
      baseId: r.base_id,
      materialId: r.material_id,
      descricao: r.descricao,
      numeroMaterial: r.numero_material,
      unidade: r.unidade,
      quantidade: Number(r.quantidade),
      saidaId: r.saida_id,
      dataEntrega: r.data_entrega,
      entreguePor: r.entregue_por,
      aceiteEncarregado: r.aceite_encarregado ?? false,
      aceiteEncarregadoEm: r.aceite_encarregado_em,
      aceiteEncarregadoPor: r.aceite_encarregado_por,
      status: r.status ?? 'pendente',
      observacoes: r.observacoes,
      createdAt: r.created_at,
      equipe: r.equipe ? { id: r.equipe.id, nome: r.equipe.nome } : undefined,
      obra: r.obra ? {
        id: r.obra.id,
        numeroProjeto: r.obra.numero_projeto,
        enderecoObra: r.obra.endereco_obra,
        municipio: r.obra.municipio,
      } : undefined,
      base: r.base ? { id: r.base.id, nome: r.base.nome, codigo: r.base.codigo } : undefined,
    };
  }
}
