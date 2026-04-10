import { supabase } from '@/lib/supabase';
import { ObraMaterialRetirado, CreateObraMaterialRetiradoDTO } from '@/types/obra-material-retirado';

export class ObraMaterialRetiradoService {

  static async getByObra(obraId: string): Promise<ObraMaterialRetirado[]> {
    const { data, error } = await supabase
      .from('obra_material_retirado')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      obraId: r.obra_id,
      materialId: r.material_id,
      descricaoMaterial: r.descricao_material,
      numeroMaterial: r.numero_material,
      unidadeMedida: r.unidade_medida,
      quantidade: r.quantidade,
      destino: r.destino,
      observacoes: r.observacoes,
      registradoPor: r.registrado_por,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  static async getAll(): Promise<ObraMaterialRetirado[]> {
    const { data, error } = await supabase
      .from('obra_material_retirado')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      obraId: r.obra_id,
      materialId: r.material_id,
      descricaoMaterial: r.descricao_material,
      numeroMaterial: r.numero_material,
      unidadeMedida: r.unidade_medida,
      quantidade: r.quantidade,
      destino: r.destino,
      observacoes: r.observacoes,
      registradoPor: r.registrado_por,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  static async create(dto: CreateObraMaterialRetiradoDTO): Promise<ObraMaterialRetirado> {
    const { data, error } = await supabase
      .from('obra_material_retirado')
      .insert({
        obra_id: dto.obraId,
        material_id: dto.materialId || null,
        descricao_material: dto.descricaoMaterial,
        numero_material: dto.numeroMaterial,
        unidade_medida: dto.unidadeMedida || 'UN',
        quantidade: dto.quantidade,
        destino: dto.destino,
        observacoes: dto.observacoes,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      obraId: data.obra_id,
      materialId: data.material_id,
      descricaoMaterial: data.descricao_material,
      numeroMaterial: data.numero_material,
      unidadeMedida: data.unidade_medida,
      quantidade: data.quantidade,
      destino: data.destino,
      observacoes: data.observacoes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from('obra_material_retirado').delete().eq('id', id);
    if (error) throw error;
  }
}
