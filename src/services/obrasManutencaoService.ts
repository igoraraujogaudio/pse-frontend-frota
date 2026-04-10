import { supabase } from '@/lib/supabase';
import { 
  ObraManutencao, 
  CreateObraManutencaoDTO, 
  UpdateObraManutencaoDTO,
  StatusObra 
} from '@/types/obras-manutencao';

export class ObrasManutencaoService {
  private static readonly TABLE_NAME = 'obras_manutencao';

  static async getAll(contratoId?: string): Promise<ObraManutencao[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar obras:', error);
      throw error;
    }

    return (data || []).map(this.fromSnakeCase);
  }

  static async getById(id: string): Promise<ObraManutencao | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar obra:', error);
      throw error;
    }

    return data ? this.fromSnakeCase(data) : null;
  }

  private static fromSnakeCase(row: Record<string, unknown>): ObraManutencao {
    return {
      id: row.id as string | undefined,
      numeroProjeto: row.numero_projeto as string,
      valorProjetado: row.valor_projetado as number,
      setor: row.setor as string,
      base: row.base as string,
      quantidadePoste: row.quantidade_poste as number,
      metrosCondutor: row.metros_condutor as number,
      quantidadeTrafo: row.quantidade_trafo as number,
      dataInicio: row.data_inicio as string,
      dataFim: row.data_fim as string,
      status: row.status as StatusObra,
      regulatorio: row.regulatorio as boolean,
      projetoRevisado: row.projeto_revisado as boolean,
      enderecoObra: row.endereco_obra as string,
      bairro: (row.bairro as string) || '',
      municipio: (row.municipio as string) || '',
      latitude: (row.latitude as string) || '',
      longitude: (row.longitude as string) || '',
      observacoes: (row.observacoes as string) || '',
      createdAt: row.created_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    };
  }

  private static toSnakeCase(obra: CreateObraManutencaoDTO | Partial<CreateObraManutencaoDTO>) {
    return {
      numero_projeto: obra.numeroProjeto,
      valor_projetado: obra.valorProjetado,
      setor: obra.setor,
      base: obra.base,
      quantidade_poste: obra.quantidadePoste,
      metros_condutor: obra.metrosCondutor,
      quantidade_trafo: obra.quantidadeTrafo,
      data_inicio: obra.dataInicio,
      data_fim: obra.dataFim,
      status: obra.status,
      regulatorio: obra.regulatorio,
      projeto_revisado: obra.projetoRevisado,
      endereco_obra: obra.enderecoObra,
      bairro: obra.bairro,
      municipio: obra.municipio,
      latitude: obra.latitude,
      longitude: obra.longitude,
      observacoes: obra.observacoes,
    };
  }

  static async create(obra: CreateObraManutencaoDTO): Promise<ObraManutencao> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert([this.toSnakeCase(obra)])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar obra:', error);
      throw error;
    }

    return this.fromSnakeCase(data);
  }

  static async update(obra: UpdateObraManutencaoDTO): Promise<ObraManutencao> {
    const { id, ...updateData } = obra;

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(this.toSnakeCase(updateData))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar obra:', error);
      throw error;
    }

    return this.fromSnakeCase(data);
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar obra:', error);
      throw error;
    }
  }

  static async getByStatus(status: StatusObra, contratoId?: string): Promise<ObraManutencao[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar obras por status:', error);
      throw error;
    }

    return (data || []).map(this.fromSnakeCase);
  }

  static async getByDateRange(
    startDate: string, 
    endDate: string, 
    contratoId?: string
  ): Promise<ObraManutencao[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('data_inicio', startDate)
      .lte('data_fim', endDate)
      .order('data_inicio', { ascending: true });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar obras por período:', error);
      throw error;
    }

    return (data || []).map(this.fromSnakeCase);
  }
}
