import { useState, useCallback } from 'react';
import { ProcessedLaudo } from '@/services/uploadLaudosService';
// import type { UploadProgress } from '@/services/uploadLaudosService'; // TODO: Implement progress tracking

interface UseUploadLaudosReturn {
  isUploading: boolean;
  uploadProgress: number;
  currentProcessing: string;
  processarLote: (files: File[], tipoLaudo: string, subtipoLaudo?: string) => Promise<ProcessedLaudo[]>;  
  resetState: () => void;
}

export function useUploadLaudos(): UseUploadLaudosReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentProcessing, setCurrentProcessing] = useState('');

  const processarLote = useCallback(async (
    files: File[], 
    tipoLaudo: string,
    subtipoLaudo?: string
  ): Promise<ProcessedLaudo[]> => {
    console.log('🔄 Iniciando processamento de lote:', { files: files.length, tipoLaudo });
    
    if (!files.length) {
      console.error('❌ Nenhum arquivo selecionado');
      return [];
    }

    if (!tipoLaudo) {
      console.error('❌ Tipo de laudo não selecionado');
      return [];
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentProcessing('');

    const resultados: ProcessedLaudo[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        setCurrentProcessing(file.name);

        console.log(`🔄 Processando arquivo ${i + 1}/${files.length}: ${file.name}`);

        try {
          // Extrair informações do nome do arquivo
          const nomeSemExtensao = file.name.replace(/\.pdf$/i, '');
          const partes = nomeSemExtensao.split('-');
          
          if (partes.length < 4) {
            throw new Error(`Formato de nome inválido. Esperado: PLACA-DD-MM-YYYY.pdf`);
          }
          
          const placa = partes[0];
          const dia = partes[1];
          const mes = partes[2];
          const ano = partes[3];
          const dataValidade = `${ano}-${mes}-${dia}`;

          console.log(`📋 Arquivo: ${file.name} - Placa: ${placa} - Data: ${dataValidade}`);

          // Criar FormData para enviar para a API
          const formData = new FormData();
          formData.append('file', file);
          formData.append('tipoLaudo', tipoLaudo);
          if (subtipoLaudo) {
            formData.append('subtipoLaudo', subtipoLaudo);
          }
          formData.append('placa', placa);
          formData.append('dataValidade', dataValidade);

          // Enviar para a API route
          const response = await fetch('/api/upload-laudos', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Erro no upload');
          }

          if (result.success && result.data) {
            resultados.push({
              id: result.data.id,
              placa: result.data.placa,
              tipoLaudo: result.data.tipoLaudo,
              dataValidade: result.data.dataValidade,
              nomeArquivo: result.data.nomeArquivo,
              status: 'success',
              message: result.message,
              veiculoId: result.data.veiculoId
            });
            console.log(`✅ ${file.name} processado com sucesso`);
          } else {
            throw new Error(result.error || 'Resposta inválida da API');
          }

        } catch (error) {
          console.error(`❌ Erro ao processar ${file.name}:`, error);
          resultados.push({
            id: `error-${Date.now()}-${i}`,
            placa: 'N/A',
            tipoLaudo,
            dataValidade: 'N/A',
            nomeArquivo: file.name,
            status: 'error',
            message: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      // Mostra resumo dos resultados
      const sucessos = resultados.filter(r => r.status === 'success').length;
      const erros = resultados.filter(r => r.status === 'error').length;

      if (sucessos > 0) {
        console.log(`✅ ${sucessos} arquivo(s) processado(s) com sucesso!`);
      }

      if (erros > 0) {
        console.error(`❌ ${erros} arquivo(s) com erro no processamento.`);
      }

      return resultados;

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      return [];
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentProcessing('');
    }
  }, []);

  const resetState = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentProcessing('');
  }, []);

  return {
    isUploading,
    uploadProgress,
    currentProcessing,
    processarLote,
    resetState
  };
}
