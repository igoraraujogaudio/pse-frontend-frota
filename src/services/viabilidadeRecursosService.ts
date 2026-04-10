import { supabase } from '@/lib/supabase';
import {
  ViabilidadeMaterial,
  ViabilidadeMaoDeObra,
  CreateViabilidadeMaterialDTO,
  CreateViabilidadeMaoDeObraDTO,
  DecisaoRecurso,
} from '@/types/viabilidade-recursos';

export class ViabilidadeRecursosService {

  // ===== MATERIAIS =====

  static async getMateriaisByObra(obraId: string): Promise<ViabilidadeMaterial[]> {
    const { data, error } = await supabase
      .from('viabilidade_materiais')
      .select(`*, material:lista_materiais(*)`)
      .eq('obra_id', obraId)
      .order('created_at');

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      obraId: item.obra_id,
      materialId: item.material_id,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_total,
      decisao: item.decisao,
      observacoes: item.observacoes,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      material: item.material ? {
        id: item.material.id,
        numeroMaterial: item.material.numero_material,
        descricaoMaterial: item.material.descricao_material,
        unidadeMedida: item.material.unidade_medida,
        numeroMaterialAntigo: item.material.numero_material_antigo,
      } : undefined,
    }));
  }

  static async upsertMaterial(dto: CreateViabilidadeMaterialDTO): Promise<ViabilidadeMaterial> {
    const { data, error } = await supabase
      .from('viabilidade_materiais')
      .upsert({
        obra_id: dto.obraId,
        material_id: dto.materialId,
        quantidade: dto.quantidade,
        valor_unitario: dto.valorUnitario,
        decisao: dto.decisao || 'pendente',
        observacoes: dto.observacoes,
      }, { onConflict: 'obra_id,material_id' })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      obraId: data.obra_id,
      materialId: data.material_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      decisao: data.decisao,
      observacoes: data.observacoes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  static async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase.from('viabilidade_materiais').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateDecisaoMaterial(id: string, decisao: DecisaoRecurso): Promise<void> {
    const { error } = await supabase
      .from('viabilidade_materiais')
      .update({ decisao })
      .eq('id', id);
    if (error) throw error;
  }

  // ===== MÃO DE OBRA =====

  static async getMaoDeObraByObra(obraId: string): Promise<ViabilidadeMaoDeObra[]> {
    const { data, error } = await supabase
      .from('viabilidade_mao_de_obra')
      .select(`*, mao_de_obra:lista_mao_de_obra(*)`)
      .eq('obra_id', obraId)
      .order('created_at');

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      obraId: item.obra_id,
      maoDeObraId: item.mao_de_obra_id,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_total,
      decisao: item.decisao,
      observacoes: item.observacoes,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      maoDeObra: item.mao_de_obra ? {
        id: item.mao_de_obra.id,
        up: item.mao_de_obra.up,
        descricaoUp: item.mao_de_obra.descricao_up,
        codigoNovo: item.mao_de_obra.codigo_novo,
        descricao: item.mao_de_obra.descricao,
        descricaoCompleta: item.mao_de_obra.descricao_completa,
        valorUnitario: item.mao_de_obra.valor_unitario,
      } : undefined,
    }));
  }

  static async upsertMaoDeObra(dto: CreateViabilidadeMaoDeObraDTO): Promise<ViabilidadeMaoDeObra> {
    const { data, error } = await supabase
      .from('viabilidade_mao_de_obra')
      .upsert({
        obra_id: dto.obraId,
        mao_de_obra_id: dto.maoDeObraId,
        quantidade: dto.quantidade,
        valor_unitario: dto.valorUnitario,
        decisao: dto.decisao || 'pendente',
        observacoes: dto.observacoes,
      }, { onConflict: 'obra_id,mao_de_obra_id' })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      obraId: data.obra_id,
      maoDeObraId: data.mao_de_obra_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      decisao: data.decisao,
      observacoes: data.observacoes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  static async deleteMaoDeObra(id: string): Promise<void> {
    const { error } = await supabase.from('viabilidade_mao_de_obra').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateDecisaoMaoDeObra(id: string, decisao: DecisaoRecurso): Promise<void> {
    const { error } = await supabase
      .from('viabilidade_mao_de_obra')
      .update({ decisao })
      .eq('id', id);
    if (error) throw error;
  }

  // ===== Aplicar decisões: copia viabilidade → obra_materiais/obra_mao_de_obra =====

  static async aplicarDecisoes(obraId: string): Promise<{ materiaisAtualizados: number; moAtualizados: number }> {
    let materiaisAtualizados = 0;
    let moAtualizados = 0;

    // Materiais com decisao = 'usar_viabilidade'
    const { data: viabMat } = await supabase
      .from('viabilidade_materiais')
      .select('*')
      .eq('obra_id', obraId)
      .eq('decisao', 'usar_viabilidade');

    for (const vm of viabMat || []) {
      // Verificar se existe em obra_materiais
      const { data: existing } = await supabase
        .from('obra_materiais')
        .select('id')
        .eq('obra_id', obraId)
        .eq('material_id', vm.material_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('obra_materiais')
          .update({ quantidade: vm.quantidade, valor_unitario: vm.valor_unitario })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('obra_materiais')
          .insert({ obra_id: obraId, material_id: vm.material_id, quantidade: vm.quantidade, valor_unitario: vm.valor_unitario });
      }
      materiaisAtualizados++;
    }

    // Mão de obra com decisao = 'usar_viabilidade'
    const { data: viabMO } = await supabase
      .from('viabilidade_mao_de_obra')
      .select('*')
      .eq('obra_id', obraId)
      .eq('decisao', 'usar_viabilidade');

    for (const vm of viabMO || []) {
      const { data: existing } = await supabase
        .from('obra_mao_de_obra')
        .select('id')
        .eq('obra_id', obraId)
        .eq('mao_de_obra_id', vm.mao_de_obra_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('obra_mao_de_obra')
          .update({ quantidade: vm.quantidade, valor_unitario: vm.valor_unitario })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('obra_mao_de_obra')
          .insert({ obra_id: obraId, mao_de_obra_id: vm.mao_de_obra_id, quantidade: vm.quantidade, valor_unitario: vm.valor_unitario });
      }
      moAtualizados++;
    }

    return { materiaisAtualizados, moAtualizados };
  }
}
