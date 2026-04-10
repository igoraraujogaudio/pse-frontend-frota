import { supabase } from '@/lib/supabase';

export type EtapaObra = string; // '1', '2', '3', '4', 'FINAL', 'UNICA' ou qualquer valor livre
export type StatusExecucao = 'PROG' | 'EXEC' | 'CANC' | 'PARP' | 'PANP';

export const STATUS_EXECUCAO_LABELS: Record<StatusExecucao, string> = {
  PROG: 'Programada',
  EXEC: 'Executada',
  CANC: 'Cancelada',
  PARP: 'Parcial Planejada',
  PANP: 'Parcial Não Planejada',
};

export const STATUS_EXECUCAO_COLORS: Record<StatusExecucao, string> = {
  PROG: 'bg-blue-100 text-blue-800',
  EXEC: 'bg-green-100 text-green-800',
  CANC: 'bg-red-100 text-red-800',
  PARP: 'bg-yellow-100 text-yellow-800',
  PANP: 'bg-orange-100 text-orange-800',
};

export interface ObraProgramacaoEquipe {
  id?: string;
  obraId: string;
  equipeId: string;
  data: string; // YYYY-MM-DD
  etapa?: EtapaObra;
  observacoes?: string;
  fluxoDefinido?: boolean;
  statusExecucao?: StatusExecucao;
  motivoStatus?: string;
  statusExecucaoUpdatedAt?: string;
  statusExecucaoUpdatedBy?: string;
  createdAt?: string;
  // joins
  equipe?: {
    id: string;
    nome: string;
  };
  obra?: {
    id: string;
    numeroProjeto: string;
    enderecoObra?: string;
    bairro?: string;
    municipio?: string;
    setor?: string;
    valorProjetado?: number;
  };
}

export class ObraProgramacaoEquipeService {
  private static readonly TABLE = 'obra_programacao_equipe';

  static async getByWeek(startDate: string, endDate: string): Promise<ObraProgramacaoEquipe[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        id, obra_id, equipe_id, data, etapa, observacoes, fluxo_definido, status_execucao, motivo_status, status_execucao_updated_at, status_execucao_updated_by, created_at,
        obra:obras_manutencao(id, numero_projeto, endereco_obra, bairro, municipio, setor, valor_projetado)
      `)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data');

    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  static async add(input: Omit<ObraProgramacaoEquipe, 'id' | 'createdAt'>): Promise<ObraProgramacaoEquipe> {
    // Validação prévia: mesma equipe não pode ter a mesma obra duplicada no dia
    const existentes = await this.getByObraEData(input.obraId, input.data);

    const equipeJaExiste = existentes.some(p => p.equipeId === input.equipeId);
    if (equipeJaExiste) {
      throw new Error(`Esta equipe já está programada para esta obra no dia ${input.data}.`);
    }

    const etapaInput = input.etapa ?? 'FINAL';

    const { data, error } = await supabase
      .from(this.TABLE)
      .insert({
        obra_id: input.obraId,
        equipe_id: input.equipeId,
        data: input.data,
        etapa: etapaInput,
        observacoes: input.observacoes,
      })
      .select(`
        id, obra_id, equipe_id, data, etapa, observacoes, fluxo_definido, status_execucao, motivo_status, created_at,
        obra:obras_manutencao(id, numero_projeto, endereco_obra, bairro, municipio, setor, valor_projetado)
      `)
      .single();

    if (error) {
      // Traduzir erros de constraint do banco
      if (error.code === '23505') throw new Error(`Esta equipe já está programada para esta obra no dia ${input.data}.`);
      if (error.message?.includes('etapa')) throw new Error(error.message.replace(/^.*EXCEPTION: /, ''));
      throw error;
    }
    return this.fromRow(data);
  }

  static async getByObraId(obraId: string, startDate: string, endDate: string): Promise<ObraProgramacaoEquipe[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select(`
        id, obra_id, equipe_id, data, etapa, observacoes, fluxo_definido, status_execucao, motivo_status, status_execucao_updated_at, status_execucao_updated_by, created_at,
        obra:obras_manutencao(id, numero_projeto, endereco_obra, bairro, municipio, setor, valor_projetado),
        equipe:equipes(id, nome)
      `)
      .eq('obra_id', obraId)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data');
    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  /**
   * Retorna todas as programações de uma obra num determinado dia.
   * Usado para validar etapa única e equipe duplicada antes de salvar.
   */
  static async getByObraEData(obraId: string, data: string): Promise<ObraProgramacaoEquipe[]> {
    const { data: rows, error } = await supabase
      .from(this.TABLE)
      .select('id, obra_id, equipe_id, data, etapa, fluxo_definido, status_execucao, motivo_status')
      .eq('obra_id', obraId)
      .eq('data', data);
    if (error) throw error;
    return (rows || []).map(this.fromRow);
  }

  static async remove(id: string): Promise<void> {
    const { error } = await supabase.from(this.TABLE).delete().eq('id', id);
    if (error) throw error;
  }

  static async atualizarStatusExecucao(
    id: string,
    statusExecucao: StatusExecucao,
    motivoStatus: string | null,
    userId?: string
  ): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({
        status_execucao: statusExecucao,
        motivo_status: motivoStatus,
        status_execucao_updated_at: new Date().toISOString(),
        status_execucao_updated_by: userId || null,
      })
      .eq('id', id);
    if (error) throw error;
  }

  private static fromRow(row: Record<string, unknown>): ObraProgramacaoEquipe {
    const obraRaw = row.obra;
    const obra = Array.isArray(obraRaw)
      ? (obraRaw[0] as Record<string, unknown> | undefined) ?? null
      : (obraRaw as Record<string, unknown> | null);

    const equipeRaw = row.equipe;
    const equipe = Array.isArray(equipeRaw)
      ? (equipeRaw[0] as Record<string, unknown> | undefined) ?? null
      : (equipeRaw as Record<string, unknown> | null);

    return {
      id: row.id as string,
      obraId: row.obra_id as string,
      equipeId: row.equipe_id as string,
      data: row.data as string,
      etapa: (row.etapa as string) || 'FINAL',
      observacoes: row.observacoes as string | undefined,
      fluxoDefinido: (row.fluxo_definido as boolean) ?? false,
      statusExecucao: (row.status_execucao as StatusExecucao) ?? 'PROG',
      motivoStatus: row.motivo_status as string | undefined,
      statusExecucaoUpdatedAt: row.status_execucao_updated_at as string | undefined,
      statusExecucaoUpdatedBy: row.status_execucao_updated_by as string | undefined,
      createdAt: row.created_at as string | undefined,
      equipe: equipe ? {
        id: equipe.id as string,
        nome: equipe.nome as string,
      } : undefined,
      obra: obra ? {
        id: obra.id as string,
        numeroProjeto: (obra.numero_projeto as string) || (row.obra_id as string),
        enderecoObra: obra.endereco_obra as string | undefined,
        bairro: obra.bairro as string | undefined,
        municipio: obra.municipio as string | undefined,
        setor: obra.setor as string | undefined,
        valorProjetado: obra.valor_projetado as number | undefined,
      } : undefined,
    };
  }
}
