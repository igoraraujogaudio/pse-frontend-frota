import { supabase } from '@/lib/supabase';

export interface QuilometragemUpload {
  placa: string;
  quilometragem: number;
}

export interface UploadResult {
  placa: string;
  quilometragem: number;
  sucesso: boolean;
  erro?: string;
  veiculo_id?: string;
}

export const QuilometragemBulkService = {
  /**
   * Processa upload em lote de quilometragem
   */
  processarUploadBulk: async (dados: QuilometragemUpload[]): Promise<UploadResult[]> => {
    const resultados: UploadResult[] = [];

    for (const dado of dados) {
      try {
        const resultado = await QuilometragemBulkService.atualizarQuilometragemVeiculo(dado.placa, dado.quilometragem);
        resultados.push(resultado);
      } catch (error) {
        resultados.push({
          placa: dado.placa,
          quilometragem: dado.quilometragem,
          sucesso: false,
          erro: (error as Error).message
        });
      }
    }

    return resultados;
  },

  /**
   * Atualiza quilometragem de um veículo específico
   */
  atualizarQuilometragemVeiculo: async (placa: string, quilometragem: number): Promise<UploadResult> => {
    try {
      // Normalizar placa removendo hífens e convertendo para maiúscula
      const placaNormalizada = placa.replace(/-/g, '').toUpperCase();
      
      // Buscar veículo pela placa (tanto com quanto sem hífen)
      const { data: veiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .select('id, placa, quilometragem_atual')
        .or(`placa.eq.${placaNormalizada},placa.eq.${placa.toUpperCase()}`)
        .single();

      if (veiculoError || !veiculo) {
        return {
          placa,
          quilometragem,
          sucesso: false,
          erro: `Veículo com placa ${placa} não encontrado`
        };
      }

      // Validar quilometragem
      if (quilometragem < 0) {
        return {
          placa,
          quilometragem,
          sucesso: false,
          erro: 'Quilometragem não pode ser negativa'
        };
      }

      if (quilometragem < veiculo.quilometragem_atual) {
        return {
          placa,
          quilometragem,
          sucesso: false,
          erro: `Quilometragem (${quilometragem.toLocaleString()}) menor que a atual (${veiculo.quilometragem_atual.toLocaleString()})`
        };
      }

      // Atualizar quilometragem usando função RPC para garantir log correto
      const { data: usuario } = await supabase.auth.getUser();
      const usuarioId = usuario?.user?.id || null;
      
      const { error: updateError } = await supabase
        .rpc('atualizar_quilometragem_veiculo', {
          p_veiculo_id: veiculo.id,
          p_quilometragem: quilometragem,
          p_origem: 'upload_bulk',
          p_usuario_id: usuarioId,
          p_movimentacao_id: null,
          p_detalhes: {
            placa: veiculo.placa,
            metodo: 'bulk_upload',
            arquivo: 'excel'
          }
        });

      if (updateError) {
        return {
          placa,
          quilometragem,
          sucesso: false,
          erro: `Erro ao atualizar quilometragem: ${updateError.message}`
        };
      }

      // ✅ NÃO precisa mais atualizar próxima preventiva aqui
      // A próxima preventiva só muda quando o gestor edita quilometragem_preventiva
      // await QuilometragemBulkService.verificarPreventivaProxima(veiculo.id, quilometragem); // REMOVIDO

      return {
        placa,
        quilometragem,
        sucesso: true,
        veiculo_id: veiculo.id
      };

    } catch (error) {
      return {
        placa,
        quilometragem,
        sucesso: false,
        erro: (error as Error).message
      };
    }
  },

  /**
   * Calcula a próxima preventiva baseada na ÚLTIMA PREVENTIVA REALIZADA
   * Lógica: próxima = última preventiva + intervalo
   * 
   * Exemplos:
   * - Última preventiva aos 97 km → próxima em 10.097 km (97 + 10.000)
   * - Última preventiva aos 5.000 km → próxima em 15.000 km (5.000 + 10.000)
   * - Sem última preventiva → usa km atual como fallback
   */
  calcularProximaPreventiva: (
    ultimaPreventiva: number | null, 
    quilometragemAtual: number, 
    intervaloPreventiva: number = 10000
  ): number => {
    // Se tem última preventiva definida, usar ela como base
    if (ultimaPreventiva !== null && ultimaPreventiva !== undefined) {
      return ultimaPreventiva + intervaloPreventiva;
    }
    
    // Fallback: se não tem última preventiva, usar km atual como base
    return Math.ceil(quilometragemAtual / intervaloPreventiva) * intervaloPreventiva;
  },

  /**
   * Verifica e atualiza próxima preventiva baseada na última preventiva realizada
   * Lógica: próxima = última preventiva + intervalo
   */
  verificarPreventivaProxima: async (veiculoId: string, quilometragemAtual: number): Promise<void> => {
    try {
      // Buscar dados do veículo incluindo a última preventiva
      const { data: veiculo, error } = await supabase
        .from('veiculos')
        .select('intervalo_preventiva, quilometragem_preventiva')
        .eq('id', veiculoId)
        .single();

      if (error || !veiculo) return;

      const intervaloPreventiva = veiculo.intervalo_preventiva || 10000;
      const ultimaPreventiva = veiculo.quilometragem_preventiva;
      
      // Calcular próxima preventiva usando a função auxiliar (agora com 3 parâmetros)
      const proximaPreventivaFinal = QuilometragemBulkService.calcularProximaPreventiva(
        ultimaPreventiva, 
        quilometragemAtual, 
        intervaloPreventiva
      );
      
      await supabase
        .from('veiculos')
        .update({
          proxima_preventiva_km: proximaPreventivaFinal
        })
        .eq('id', veiculoId);
    } catch (error) {
      console.error('Erro ao verificar preventiva próxima:', error);
    }
  },

  /**
   * Valida dados de upload antes do processamento
   */
  validarDadosUpload: (dados: QuilometragemUpload[]): { validos: QuilometragemUpload[], invalidos: {dado: QuilometragemUpload, erro: string}[] } => {
    const validos: QuilometragemUpload[] = [];
    const invalidos: {dado: QuilometragemUpload, erro: string}[] = [];

    for (const dado of dados) {
      const erros: string[] = [];

      // Validar placa
      if (!dado.placa || dado.placa.trim().length === 0) {
        erros.push('Placa é obrigatória');
      } else {
        // Normalizar placa removendo hífens para validação
        const placaNormalizada = dado.placa.replace(/-/g, '');
        if (placaNormalizada.length < 7 || placaNormalizada.length > 8) {
          erros.push('Placa deve ter entre 7 e 8 caracteres (com ou sem hífen)');
        }
      }

      // Validar quilometragem
      if (dado.quilometragem < 0) {
        erros.push('Quilometragem não pode ser negativa');
      }

      if (dado.quilometragem > 9999999) {
        erros.push('Quilometragem muito alta (máximo 9.999.999)');
      }

      if (erros.length > 0) {
        invalidos.push({
          dado,
          erro: erros.join(', ')
        });
      } else {
        validos.push({
          placa: dado.placa.trim().toUpperCase(),
          quilometragem: dado.quilometragem
        });
      }
    }

    return { validos, invalidos };
  },

  /**
   * Busca veículos por placas para validação
   */
  buscarVeiculosPorPlacas: async (placas: string[]): Promise<{placa: string, existe: boolean, veiculo_id?: string}[]> => {
    try {
      // Normalizar placas removendo hífens e convertendo para maiúscula
      const placasNormalizadas = placas.map(p => p.replace(/-/g, '').toUpperCase());
      const placasOriginais = placas.map(p => p.toUpperCase());
      
      const { data: veiculos, error } = await supabase
        .from('veiculos')
        .select('id, placa')
        .in('placa', [...placasNormalizadas, ...placasOriginais]);

      if (error) {
        throw new Error(`Erro ao buscar veículos: ${error.message}`);
      }

      const veiculosMap = new Map(veiculos?.map(v => [v.placa, v.id]) || []);

      return placas.map(placa => ({
        placa: placa.toUpperCase(),
        existe: veiculosMap.has(placa.toUpperCase()),
        veiculo_id: veiculosMap.get(placa.toUpperCase())
      }));
    } catch (error) {
      throw new Error(`Erro ao buscar veículos: ${(error as Error).message}`);
    }
  },

  /**
   * Gera relatório de upload
   */
  gerarRelatorioUpload: (resultados: UploadResult[]): {
    total: number;
    sucessos: number;
    erros: number;
    taxaSucesso: number;
    detalhes: UploadResult[];
  } => {
    const total = resultados.length;
    const sucessos = resultados.filter(r => r.sucesso).length;
    const erros = resultados.filter(r => !r.sucesso).length;
    const taxaSucesso = total > 0 ? (sucessos / total) * 100 : 0;

    return {
      total,
      sucessos,
      erros,
      taxaSucesso: Math.round(taxaSucesso * 100) / 100,
      detalhes: resultados
    };
  }
};



