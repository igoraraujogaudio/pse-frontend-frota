import { supabase } from '@/lib/supabase';
import { ViabilidadeChecklist, CreateViabilidadeChecklistDTO } from '@/types/viabilidade-checklist';

export class ViabilidadeChecklistService {
  private static readonly TABLE_NAME = 'viabilidade_checklist';

  static async getByObraId(obraId: string): Promise<ViabilidadeChecklist | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('obra_id', obraId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar checklist de viabilidade:', error);
      throw error;
    }

    if (!data) return null;
    return this.mapToChecklist(data);
  }

  static async create(dto: CreateViabilidadeChecklistDTO): Promise<ViabilidadeChecklist> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert([{
        obra_id: dto.obraId,
        projeto: dto.projeto,
        data: dto.data,
        cidade: dto.cidade,
        quantidade_postes: dto.quantidadePostes,
        tensao_rede: dto.tensaoRede,
        necessario_lv: dto.necessarioLV,
        sinal_telefone: dto.sinalTelefone,
        desligamento_necessario: dto.desligamentoNecessario,
        numero_chave_equipamento: dto.numeroChaveEquipamento,
        viabilidade: dto.viabilidade,
        condicao_tracado: dto.condicaoTracado,
        autorizacao_passagem: dto.autorizacaoPassagem,
        poda_arvores: dto.podaArvores,
        interferencias_identificadas: dto.interferenciasIdentificadas,
        interferencias_descricao: dto.interferenciasDescricao,
        resumo_tecnico: dto.resumoTecnico,
        alerta_seguranca: dto.alertaSeguranca,
        alerta_seguranca_obs: dto.alertaSegurancaObs,
        fotos_postes: dto.fotosPostes || [],
        fotos_alerta_seguranca: dto.fotosAlertaSeguranca || [],
        criado_por: dto.criadoPor,
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar checklist de viabilidade:', error);
      throw error;
    }

    return this.mapToChecklist(data);
  }

  static async update(id: string, dto: Partial<CreateViabilidadeChecklistDTO>): Promise<ViabilidadeChecklist> {
    const updateData: Record<string, unknown> = {};

    if (dto.projeto !== undefined) updateData.projeto = dto.projeto;
    if (dto.data !== undefined) updateData.data = dto.data;
    if (dto.cidade !== undefined) updateData.cidade = dto.cidade;
    if (dto.quantidadePostes !== undefined) updateData.quantidade_postes = dto.quantidadePostes;
    if (dto.tensaoRede !== undefined) updateData.tensao_rede = dto.tensaoRede;
    if (dto.necessarioLV !== undefined) updateData.necessario_lv = dto.necessarioLV;
    if (dto.sinalTelefone !== undefined) updateData.sinal_telefone = dto.sinalTelefone;
    if (dto.desligamentoNecessario !== undefined) updateData.desligamento_necessario = dto.desligamentoNecessario;
    if (dto.numeroChaveEquipamento !== undefined) updateData.numero_chave_equipamento = dto.numeroChaveEquipamento;
    if (dto.viabilidade !== undefined) updateData.viabilidade = dto.viabilidade;
    if (dto.condicaoTracado !== undefined) updateData.condicao_tracado = dto.condicaoTracado;
    if (dto.autorizacaoPassagem !== undefined) updateData.autorizacao_passagem = dto.autorizacaoPassagem;
    if (dto.podaArvores !== undefined) updateData.poda_arvores = dto.podaArvores;
    if (dto.interferenciasIdentificadas !== undefined) updateData.interferencias_identificadas = dto.interferenciasIdentificadas;
    if (dto.interferenciasDescricao !== undefined) updateData.interferencias_descricao = dto.interferenciasDescricao;
    if (dto.resumoTecnico !== undefined) updateData.resumo_tecnico = dto.resumoTecnico;
    if (dto.alertaSeguranca !== undefined) updateData.alerta_seguranca = dto.alertaSeguranca;
    if (dto.alertaSegurancaObs !== undefined) updateData.alerta_seguranca_obs = dto.alertaSegurancaObs;
    if (dto.fotosPostes !== undefined) updateData.fotos_postes = dto.fotosPostes;
    if (dto.fotosAlertaSeguranca !== undefined) updateData.fotos_alerta_seguranca = dto.fotosAlertaSeguranca;

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar checklist de viabilidade:', error);
      throw error;
    }

    return this.mapToChecklist(data);
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar checklist de viabilidade:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapToChecklist(item: any): ViabilidadeChecklist {
    return {
      id: item.id,
      obraId: item.obra_id,
      projeto: item.projeto,
      data: item.data,
      cidade: item.cidade,
      quantidadePostes: item.quantidade_postes,
      tensaoRede: item.tensao_rede,
      necessarioLV: item.necessario_lv,
      sinalTelefone: item.sinal_telefone,
      desligamentoNecessario: item.desligamento_necessario,
      numeroChaveEquipamento: item.numero_chave_equipamento,
      viabilidade: item.viabilidade,
      condicaoTracado: item.condicao_tracado,
      autorizacaoPassagem: item.autorizacao_passagem,
      podaArvores: item.poda_arvores,
      interferenciasIdentificadas: item.interferencias_identificadas,
      interferenciasDescricao: item.interferencias_descricao,
      resumoTecnico: item.resumo_tecnico,
      alertaSeguranca: item.alerta_seguranca,
      alertaSegurancaObs: item.alerta_seguranca_obs,
      fotosPostes: item.fotos_postes || [],
      fotosAlertaSeguranca: item.fotos_alerta_seguranca || [],
      criadoPor: item.criado_por,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }
}
