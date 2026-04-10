import { supabase } from '@/lib/supabase';
import { ObraMaterialCorrigido, ObraMaoDeObraCorrigida } from '@/types/obra-recursos-corrigidos';

export class ObraRecursosCorrigidosService {

  // ===== MATERIAIS CORRIGIDOS =====

  static async getMateriaisByObra(obraId: string): Promise<ObraMaterialCorrigido[]> {
    const { data, error } = await supabase
      .from('obra_material_corrigido')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      obraId: r.obra_id,
      materialId: r.material_id,
      descricaoMaterial: r.descricao_material,
      numeroMaterial: r.numero_material,
      unidadeMedida: r.unidade_medida,
      quantidade: r.quantidade,
      valorUnitario: r.valor_unitario,
      valorTotal: r.valor_total,
      observacoes: r.observacoes,
      createdAt: r.created_at,
    }));
  }

  static async upsertMaterial(obraId: string, items: Omit<ObraMaterialCorrigido, 'id' | 'obraId' | 'createdAt'>[]): Promise<void> {
    // Apaga tudo e reinseresa (replace completo)
    await supabase.from('obra_material_corrigido').delete().eq('obra_id', obraId);
    if (items.length === 0) return;
    const { error } = await supabase.from('obra_material_corrigido').insert(
      items.map(i => ({
        obra_id: obraId,
        material_id: i.materialId || null,
        descricao_material: i.descricaoMaterial,
        numero_material: i.numeroMaterial,
        unidade_medida: i.unidadeMedida || 'UN',
        quantidade: i.quantidade,
        valor_unitario: i.valorUnitario || null,
        observacoes: i.observacoes || null,
      }))
    );
    if (error) throw error;
  }

  static async addMaterial(item: ObraMaterialCorrigido): Promise<ObraMaterialCorrigido> {
    const { data, error } = await supabase.from('obra_material_corrigido').insert({
      obra_id: item.obraId,
      material_id: item.materialId || null,
      descricao_material: item.descricaoMaterial,
      numero_material: item.numeroMaterial,
      unidade_medida: item.unidadeMedida || 'UN',
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario || null,
      observacoes: item.observacoes || null,
    }).select().single();
    if (error) throw error;
    return { ...item, id: data.id, valorTotal: data.valor_total };
  }

  static async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase.from('obra_material_corrigido').delete().eq('id', id);
    if (error) throw error;
  }

  // ===== MÃO DE OBRA CORRIGIDA =====

  static async getMaoDeObraByObra(obraId: string): Promise<ObraMaoDeObraCorrigida[]> {
    const { data, error } = await supabase
      .from('obra_mao_de_obra_corrigida')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      obraId: r.obra_id,
      maoDeObraId: r.mao_de_obra_id,
      descricao: r.descricao,
      codigo: r.codigo,
      up: r.up,
      quantidade: r.quantidade,
      valorUnitario: r.valor_unitario,
      valorTotal: r.valor_total,
      observacoes: r.observacoes,
      createdAt: r.created_at,
    }));
  }

  static async upsertMaoDeObra(obraId: string, items: Omit<ObraMaoDeObraCorrigida, 'id' | 'obraId' | 'createdAt'>[]): Promise<void> {
    await supabase.from('obra_mao_de_obra_corrigida').delete().eq('obra_id', obraId);
    if (items.length === 0) return;
    const { error } = await supabase.from('obra_mao_de_obra_corrigida').insert(
      items.map(i => ({
        obra_id: obraId,
        mao_de_obra_id: i.maoDeObraId || null,
        descricao: i.descricao,
        codigo: i.codigo,
        up: i.up,
        quantidade: i.quantidade,
        valor_unitario: i.valorUnitario || null,
        observacoes: i.observacoes || null,
      }))
    );
    if (error) throw error;
  }

  static async addMaoDeObra(item: ObraMaoDeObraCorrigida): Promise<ObraMaoDeObraCorrigida> {
    const { data, error } = await supabase.from('obra_mao_de_obra_corrigida').insert({
      obra_id: item.obraId,
      mao_de_obra_id: item.maoDeObraId || null,
      descricao: item.descricao,
      codigo: item.codigo,
      up: item.up,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario || null,
      observacoes: item.observacoes || null,
    }).select().single();
    if (error) throw error;
    return { ...item, id: data.id, valorTotal: data.valor_total };
  }

  static async deleteMaoDeObra(id: string): Promise<void> {
    const { error } = await supabase.from('obra_mao_de_obra_corrigida').delete().eq('id', id);
    if (error) throw error;
  }
}
