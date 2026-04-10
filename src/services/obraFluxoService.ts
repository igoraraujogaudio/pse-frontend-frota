import { supabase } from '@/lib/supabase';

export interface FluxoMaterial {
  id?: string;
  programacaoId: string;
  materialId?: string | null;
  descricao: string;
  numeroMaterial?: string;
  unidade: string;
  quantidade: number;
  fonte: 'corrigido' | 'original';
}

export interface FluxoMO {
  id?: string;
  programacaoId: string;
  maoDeObraId?: string | null;
  descricao: string;
  codigo?: string;
  up?: string;
  quantidade: number;
  fonte: 'corrigido' | 'original';
}

export interface EntregaAlmoxarifado {
  id?: string;
  obraId: string;
  programacaoId?: string | null;
  equipeId?: string | null;
  materialId?: string | null;
  descricao: string;
  numeroMaterial?: string;
  unidade: string;
  quantidade: number;
  saidaId?: string | null;
  dataEntrega: string;
  observacoes?: string;
}

export interface SaldoItem {
  descricao: string;
  numeroMaterial?: string;
  unidade: string;
  saldo: number;       // corrigido ou original
  entregue: number;    // total entregue pelo almoxarifado (toda a obra)
  solicitado: number;  // definido no fluxo desta programação
  foraDeReserva: boolean;
  fonte: 'corrigido' | 'original';
  materialId?: string | null;
}

export class ObraFluxoService {

  // ===== FLUXO MATERIAL =====

  static async getFluxoMaterial(programacaoId: string): Promise<FluxoMaterial[]> {
    const { data, error } = await supabase
      .from('obra_programacao_fluxo_material')
      .select('*')
      .eq('programacao_id', programacaoId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      programacaoId: r.programacao_id,
      materialId: r.material_id,
      descricao: r.descricao,
      numeroMaterial: r.numero_material,
      unidade: r.unidade,
      quantidade: Number(r.quantidade),
      fonte: r.fonte as 'corrigido' | 'original',
    }));
  }

  static async saveFluxoMaterial(programacaoId: string, items: Omit<FluxoMaterial, 'id' | 'programacaoId'>[]): Promise<void> {
    await supabase.from('obra_programacao_fluxo_material').delete().eq('programacao_id', programacaoId);
    if (!items.length) return;
    const { error } = await supabase.from('obra_programacao_fluxo_material').insert(
      items.map(i => ({
        programacao_id: programacaoId,
        material_id: i.materialId ?? null,
        descricao: i.descricao,
        numero_material: i.numeroMaterial ?? null,
        unidade: i.unidade,
        quantidade: i.quantidade,
        fonte: i.fonte,
      }))
    );
    if (error) throw error;
  }

  // ===== FLUXO MO =====

  static async getFluxoMO(programacaoId: string): Promise<FluxoMO[]> {
    const { data, error } = await supabase
      .from('obra_programacao_fluxo_mo')
      .select('*')
      .eq('programacao_id', programacaoId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      programacaoId: r.programacao_id,
      maoDeObraId: r.mao_de_obra_id,
      descricao: r.descricao,
      codigo: r.codigo,
      up: r.up,
      quantidade: Number(r.quantidade),
      fonte: r.fonte as 'corrigido' | 'original',
    }));
  }

  static async saveFluxoMO(programacaoId: string, items: Omit<FluxoMO, 'id' | 'programacaoId'>[]): Promise<void> {
    await supabase.from('obra_programacao_fluxo_mo').delete().eq('programacao_id', programacaoId);
    if (!items.length) return;
    const { error } = await supabase.from('obra_programacao_fluxo_mo').insert(
      items.map(i => ({
        programacao_id: programacaoId,
        mao_de_obra_id: i.maoDeObraId ?? null,
        descricao: i.descricao,
        codigo: i.codigo ?? null,
        up: i.up ?? null,
        quantidade: i.quantidade,
        fonte: i.fonte,
      }))
    );
    if (error) throw error;
  }

  // ===== MARCAR FLUXO DEFINIDO =====

  static async marcarFluxoDefinido(programacaoId: string, definido: boolean): Promise<void> {
    const { error } = await supabase
      .from('obra_programacao_equipe')
      .update({ fluxo_definido: definido })
      .eq('id', programacaoId);
    if (error) throw error;
  }

  // ===== ENTREGAS DO ALMOXARIFADO =====

  static async getEntregasByObra(obraId: string): Promise<EntregaAlmoxarifado[]> {
    const { data, error } = await supabase
      .from('obra_entrega_almoxarifado')
      .select('*')
      .eq('obra_id', obraId)
      .order('data_entrega');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      obraId: r.obra_id,
      programacaoId: r.programacao_id,
      equipeId: r.equipe_id,
      materialId: r.material_id,
      descricao: r.descricao,
      numeroMaterial: r.numero_material,
      unidade: r.unidade,
      quantidade: Number(r.quantidade),
      saidaId: r.saida_id,
      dataEntrega: r.data_entrega,
      observacoes: r.observacoes,
    }));
  }

  // ===== CÁLCULO SALDO =====
  /**
   * Para cada item do fluxo desta programação:
   * - saldo     = quantidade do recurso corrigido ou original da obra (total)
   * - entregue  = total já entregue pelo almoxarifado para esta obra (qualquer equipe)
   * - solicitado = quantidade definida no fluxo desta programação
   * - foraDeReserva = solicitado > (saldo - entregue)
   */
  static async calcularSaldo(
    programacaoId: string,
    obraId: string,
    fluxoMat: FluxoMaterial[],
    entregasObra: EntregaAlmoxarifado[],
    corrigidosMat: Array<{ descricao: string; quantidade: number; materialId?: string | null }>,
    originaisMat: Array<{ descricao: string; quantidade: number; materialId?: string | null }>,
  ): Promise<SaldoItem[]> {
    // Total já entregue agrupado por materialId (ou descricao)
    const entregueMap = new Map<string, number>();
    for (const e of entregasObra) {
      const key = e.materialId ?? `__desc__${e.descricao.toLowerCase()}`;
      entregueMap.set(key, (entregueMap.get(key) ?? 0) + e.quantidade);
    }

    return fluxoMat.map(item => {
      const key = item.materialId ?? `__desc__${item.descricao.toLowerCase()}`;
      const entregue = entregueMap.get(key) ?? 0;

      // Usar corrigido se existir, senão original
      const fonteList = corrigidosMat.length > 0 ? corrigidosMat : originaisMat;
      const recurso = fonteList.find(r =>
        (item.materialId && r.materialId === item.materialId) ||
        r.descricao?.toLowerCase() === item.descricao.toLowerCase()
      );
      const saldo = recurso?.quantidade ?? 0;
      const solicitado = item.quantidade;
      const disponivel = saldo - entregue;
      const foraDeReserva = solicitado > disponivel;

      return {
        descricao: item.descricao,
        numeroMaterial: item.numeroMaterial,
        unidade: item.unidade,
        saldo,
        entregue,
        solicitado,
        foraDeReserva,
        fonte: corrigidosMat.length > 0 ? 'corrigido' : 'original',
        materialId: item.materialId,
      };
    });
  }
}
