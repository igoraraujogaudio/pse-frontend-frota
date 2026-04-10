import { supabase } from '@/lib/supabase';
import { MaoDeObra, CreateMaoDeObraDTO, BulkMaoDeObraImport, ObraMaoDeObra, CreateObraMaoDeObraDTO } from '@/types/mao-de-obra';

export class MaoDeObraService {
  private static readonly TABLE_NAME = 'lista_mao_de_obra';
  private static readonly OBRA_MO_TABLE = 'obra_mao_de_obra';

  // ========== CRUD Mão de Obra ==========

  static async getAll(contratoId?: string): Promise<MaoDeObra[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .order('descricao');

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar mão de obra:', error);
      throw error;
    }

    return (data || []).map(item => this.mapToMaoDeObra(item));
  }

  static async getById(id: string): Promise<MaoDeObra | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar mão de obra:', error);
      throw error;
    }

    if (!data) return null;
    return this.mapToMaoDeObra(data);
  }

  static async create(mo: CreateMaoDeObraDTO): Promise<MaoDeObra> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert([{
        up: mo.up,
        descricao_up: mo.descricaoUp,
        codigo_novo: mo.codigoNovo,
        descricao: mo.descricao,
        descricao_completa: mo.descricaoCompleta,
        valor_unitario: mo.valorUnitario,
        contrato_id: mo.contratoId
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar mão de obra:', error);
      throw error;
    }

    return this.mapToMaoDeObra(data);
  }

  static async bulkCreate(items: BulkMaoDeObraImport[]): Promise<{ success: number; errors: number }> {
    const formatted = items.map(m => ({
      up: m.up,
      descricao_up: m.descricaoUp,
      codigo_novo: m.codigoNovo,
      descricao: m.descricao,
      descricao_completa: m.descricaoCompleta,
      valor_unitario: m.valorUnitario,
      contrato_id: m.contratoId
    }));

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(formatted)
      .select();

    if (error) {
      console.error('Erro ao importar mão de obra em massa:', error);
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
      console.error('Erro ao deletar mão de obra:', error);
      throw error;
    }
  }

  static async search(query: string, contratoId?: string): Promise<MaoDeObra[]> {
    let q = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .or(`descricao.ilike.%${query}%,codigo_novo.ilike.%${query}%,up.ilike.%${query}%,descricao_up.ilike.%${query}%`)
      .order('descricao')
      .limit(50);

    if (contratoId) {
      q = q.eq('contrato_id', contratoId);
    }

    const { data, error } = await q;

    if (error) {
      console.error('Erro ao buscar mão de obra:', error);
      throw error;
    }

    return (data || []).map(item => this.mapToMaoDeObra(item));
  }

  // ========== CRUD Obra Mão de Obra ==========

  static async getObraMaoDeObra(obraId: string): Promise<ObraMaoDeObra[]> {
    const { data, error } = await supabase
      .from(this.OBRA_MO_TABLE)
      .select(`
        *,
        mao_de_obra:lista_mao_de_obra(*)
      `)
      .eq('obra_id', obraId)
      .order('created_at');

    if (error) {
      console.error('Erro ao buscar mão de obra da obra:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      obraId: item.obra_id,
      maoDeObraId: item.mao_de_obra_id,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_total,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      maoDeObra: item.mao_de_obra ? this.mapToMaoDeObra(item.mao_de_obra) : undefined
    }));
  }

  static async addMaoDeObraToObra(obraMO: CreateObraMaoDeObraDTO): Promise<ObraMaoDeObra> {
    const valorTotal = obraMO.quantidade * (obraMO.valorUnitario || 0);

    const { data, error } = await supabase
      .from(this.OBRA_MO_TABLE)
      .insert([{
        obra_id: obraMO.obraId,
        mao_de_obra_id: obraMO.maoDeObraId,
        quantidade: obraMO.quantidade,
        valor_unitario: obraMO.valorUnitario,
        valor_total: valorTotal
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar mão de obra à obra:', error);
      throw error;
    }

    return {
      id: data.id,
      obraId: data.obra_id,
      maoDeObraId: data.mao_de_obra_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async updateObraMaoDeObra(
    id: string,
    quantidade: number,
    valorUnitario?: number
  ): Promise<ObraMaoDeObra> {
    const valorTotal = quantidade * (valorUnitario || 0);

    const { data, error } = await supabase
      .from(this.OBRA_MO_TABLE)
      .update({
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: valorTotal
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar mão de obra da obra:', error);
      throw error;
    }

    return {
      id: data.id,
      obraId: data.obra_id,
      maoDeObraId: data.mao_de_obra_id,
      quantidade: data.quantidade,
      valorUnitario: data.valor_unitario,
      valorTotal: data.valor_total,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  static async removeObraMaoDeObra(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.OBRA_MO_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover mão de obra da obra:', error);
      throw error;
    }
  }

  // ========== Helpers ==========

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapToMaoDeObra(item: any): MaoDeObra {
    return {
      id: item.id,
      up: item.up || '',
      descricaoUp: item.descricao_up || '',
      codigoNovo: item.codigo_novo || '',
      descricao: item.descricao || '',
      descricaoCompleta: item.descricao_completa || '',
      valorUnitario: item.valor_unitario,
      contratoId: item.contrato_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  }
}
