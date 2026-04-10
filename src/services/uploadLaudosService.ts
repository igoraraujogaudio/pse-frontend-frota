// import { supabase } from '@/lib/supabase'; // TODO: Implement database operations

export interface ProcessedLaudo {
  id: string;
  placa: string;
  tipoLaudo: string;
  subtipoLaudo?: string; // Novo campo para subtipo
  dataValidade: string;
  nomeArquivo: string;
  status: 'success' | 'error';
  message: string;
  veiculoId?: string;
}

export interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  currentFile: string;
}

export class UploadLaudosService {
  /**
   * Processa um arquivo PDF de laudo usando a API route
   */
  async processarLaudo(
    file: File,
    _tipoLaudo: string,
    _subtipoLaudo?: string, // Novo parâmetro para subtipo
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onProgress?: (progress: UploadProgress) => void
  ): Promise<ProcessedLaudo> {
    try {
      // 1. Extrai informações do nome do arquivo
      const { placa, dataValidade } = this.extrairInformacoesDoNome(file.name, _tipoLaudo);
      
      if (!placa || !dataValidade) {
        throw new Error(`Não foi possível extrair placa ou data de validade do arquivo ${file.name}`);
      }

      console.log(`🔄 Processando ${file.name} - Placa: ${placa} - Tipo: ${_tipoLaudo}${_subtipoLaudo ? ` - Subtipo: ${_subtipoLaudo}` : ''}`);

      // 2. Usar a API route para fazer o upload com service role key
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipoLaudo', _tipoLaudo);
      if (_subtipoLaudo) {
        formData.append('subtipoLaudo', _subtipoLaudo);
      }
      formData.append('placa', placa);
      formData.append('dataValidade', dataValidade);

      const response = await fetch('/api/upload-laudos', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro no upload');
      }

      if (result.success && result.data) {
        return {
          id: result.data.id,
          placa: result.data.placa,
          tipoLaudo: result.data.tipoLaudo,
          subtipoLaudo: result.data.subtipoLaudo,
          dataValidade: result.data.dataValidade,
          nomeArquivo: result.data.nomeArquivo,
          status: 'success',
          message: result.message,
          veiculoId: result.data.veiculoId
        };
      } else {
        throw new Error(result.error || 'Resposta inválida da API');
      }

    } catch (error) {
      console.error('❌ Erro ao processar laudo:', error);
      return {
        id: `error-${Date.now()}`,
        placa: 'N/A',
        tipoLaudo: _tipoLaudo,
        subtipoLaudo: _subtipoLaudo,
        dataValidade: 'N/A',
        nomeArquivo: file.name,
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Extrai informações do nome do arquivo
   * Formato esperado: PLACA-DD-MM-YYYY.pdf
   */
  private extrairInformacoesDoNome(
    nomeArquivo: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tipoLaudo: string
  ): { placa: string; dataValidade: string } {
    // Remove a extensão .pdf
    const nomeSemExtensao = nomeArquivo.replace(/\.pdf$/i, '');
    
    // Divide pelo hífen
    const partes = nomeSemExtensao.split('-');
    
    if (partes.length < 4) {
      throw new Error(`Formato de nome inválido. Esperado: PLACA-DD-MM-YYYY.pdf`);
    }
    
    const placa = partes[0];
    const dia = partes[1];
    const mes = partes[2];
    const ano = partes[3];
    
    // Validação básica
    if (!placa || !dia || !mes || !ano) {
      throw new Error(`Dados inválidos extraídos do nome: placa=${placa}, dia=${dia}, mes=${mes}, ano=${ano}`);
    }
    
    const dataValidade = `${ano}-${mes}-${dia}`; // Formato ISO para o banco

    console.log(`Arquivo processado: ${nomeArquivo}`);
    console.log(`Placa extraída: ${placa}`);
    console.log(`Data de validade: ${dataValidade}`);

    return { placa, dataValidade };
  }

  /**
   * Processa múltiplos arquivos em lote
   */
  async processarLote(
    files: File[],
    tipoLaudo: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ProcessedLaudo[]> {
    const resultados: ProcessedLaudo[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: files.length,
          percentage: Math.round(((i + 1) / files.length) * 100),
          currentFile: file.name
        });
      }

      const resultado = await this.processarLaudo(file, tipoLaudo);
      resultados.push(resultado);
    }

    return resultados;
  }
}

// Exportar uma instância diretamente
export const uploadLaudosService = new UploadLaudosService();
