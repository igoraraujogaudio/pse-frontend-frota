import { supabase } from '@/lib/supabase';
import { Material, CreateMaterialDTO, BulkMaterialImport, ObraMaterial, CreateObraMaterialDTO } from '@/types/materiais';

export class MateriaisService {
  private static readonly TABLE_NAME = 'lista_materiais';
  private static readonly OBRA_MATERIAIS_TABLE = 'obra_materiais';

  // ========== CRUD Materiais ==========
  
  static async getAll(contratoId?: string): Promise<Material[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .order('descricao_material');

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar materiais:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      numeroMaterial: item.numero_material,
      descricaoMaterial: item.descricao_material,
      unidadeMedida: item.unidade_medida,
      numeroMaterialAntigo: item.numero_material_antigo,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  }

  static async getById(id: string): Promise<Material | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar material:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      numeroMaterial: data.numero_material,
      descricaoMaterial: data.descricao_material,
      unidadeMedida: data.unidade_medida,
      numeroMaterialAntigo: data.numero_material_antigo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async create(material: CreateMaterialDTO): Promise<Material> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert([{
        numero_material: material.numeroMaterial,
        descricao_material: material.descricaoMaterial,
        unidade_medida: material.unidadeMedida,
        numero_material_antigo: material.numeroMaterialAntigo
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar material:', error);
      throw error;
    }

    return {
      id: data.id,
      numeroMaterial: data.numero_material,
      descricaoMaterial: data.descricao_material,
      unidadeMedida: data.unidade_medida,
      numeroMaterialAntigo: data.numero_material_antigo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async bulkCreate(materiais: BulkMaterialImport[]): Promise<{ success: number; errors: number }> {
    const materiaisFormatted = materiais.map(m => ({
      numero_material: m.numeroMaterial,
      descricao_material: m.descricaoMaterial,
      unidade_medida: m.unidadeMedida,
      numero_material_antigo: m.numeroMaterialAntigo
    }));

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(materiaisFormatted)
      .select();

    if (error) {
      console.error('Erro ao importar materiais em massa:', error);
      throw error;
    }

    return {
      success: data?.length || 0,
      errors: 0
    };
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar material:', error);
      throw error;
    }
  }

  static async search(query: string, contratoId?: string): Promise<Material[]> {
    let q = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .or(`descricao_material.ilike.%${query}%,numero_material.ilike.%${query}%`)
      .order('descricao_material')
      .limit(50);

    if (contratoId) {
      q = q.eq('contrato_id', contratoId);
    }

    const { data, error } = await q;

    if (error) {
      console.error('Erro ao buscar materiais:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      numeroMaterial: item.numero_material,
      descricaoMaterial: item.descricao_material,
      unidadeMedida: item.unidade_medida,
      numeroMaterialAntigo: item.numero_material_antigo,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  }

  // ========== CRUD Obra Materiais ==========

  static async getObraMateriais(obraId: string): Promise<ObraMaterial[]> {
    const { data, error } = await supabase
      .from(this.OBRA_MATERIAIS_TABLE)
      .select(`
        *,
        material:lista_materiais(*)
      `)
      .eq('obra_id', obraId)
      .order('created_at');

    if (error) {
      console.error('Erro ao buscar materiais da obra:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      obraId: item.obra_id,
      materialId: item.material_id,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_total,
      observacoes: item.observacoes,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      material: item.material ? {
        id: item.material.id,
        numeroMaterial: item.material.numero_material,
        descricaoMaterial: item.material.descricao_material,
        unidadeMedida: item.material.unidade_medida,
        numeroMaterialAntigo: item.material.numero_material_antigo,
        createdAt: item.material.created_at,
        updatedAt: item.material.updated_at
      } : undefined
    }));
  }

  static async addMaterialToObra(obraMaterial: CreateObraMaterialDTO): Promise<ObraMaterial> {
    const valorTotal = obraMaterial.quantidade * (obraMaterial.valorUnitario || 0);

    const { data, error } = await supabase
      .from(this.OBRA_MATERIAIS_TABLE)
      .insert([{
        obra_id: obraMaterial.obraId,
        material_id: obraMaterial.materialId,
        quantidade: obraMaterial.quantidade,
        valor_unitario: obraMaterial.valorUnitario,
        valor_total: valorTotal,
        observacoes: obraMaterial.observacoes
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar material à obra:', error);
      throw error;
    }

    return {
      id: data.id,
      obraId: data.obra_id,
      materialId: data.material_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      observacoes: data.observacoes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async updateObraMaterial(
    id: string, 
    quantidade: number, 
    valorUnitario?: number
  ): Promise<ObraMaterial> {
    const valorTotal = quantidade * (valorUnitario || 0);

    const { data, error } = await supabase
      .from(this.OBRA_MATERIAIS_TABLE)
      .update({
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: valorTotal
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar material da obra:', error);
      throw error;
    }

    return {
      id: data.id,
      obraId: data.obra_id,
      materialId: data.material_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      observacoes: data.observacoes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async removeObraMaterial(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.OBRA_MATERIAIS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover material da obra:', error);
      throw error;
    }
  }
}
