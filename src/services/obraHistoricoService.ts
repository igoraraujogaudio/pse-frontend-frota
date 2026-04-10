import { supabase } from '@/lib/supabase';

export type TipoHistorico = 'criacao' | 'status' | 'programacao' | 'apontamento' | 'edicao' | 'observacao';

export interface ObraHistoricoEntry {
  id: string;
  obraId: string;
  tipo: TipoHistorico;
  descricao: string;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export class ObraHistoricoService {
  static async getByObra(obraId: string): Promise<ObraHistoricoEntry[]> {
    const { data, error } = await supabase
      .from('obra_historico')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  static async addLog(entry: Omit<ObraHistoricoEntry, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.from('obra_historico').insert({
      obra_id: entry.obraId,
      tipo: entry.tipo,
      descricao: entry.descricao,
      status_anterior: entry.statusAnterior ?? null,
      status_novo: entry.statusNovo ?? null,
      usuario_id: entry.usuarioId ?? null,
      usuario_nome: entry.usuarioNome ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) throw error;
  }

  private static fromRow(row: Record<string, unknown>): ObraHistoricoEntry {
    return {
      id: row.id as string,
      obraId: row.obra_id as string,
      tipo: row.tipo as TipoHistorico,
      descricao: row.descricao as string,
      statusAnterior: row.status_anterior as string | null,
      statusNovo: row.status_novo as string | null,
      usuarioId: row.usuario_id as string | null,
      usuarioNome: row.usuario_nome as string | null,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.created_at as string,
    };
  }
}
