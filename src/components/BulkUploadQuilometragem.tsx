'use client';

import React, { useState } from 'react';
import { CloudArrowUpIcon, DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { QuilometragemBulkService, QuilometragemUpload, UploadResult } from '@/services/quilometragemBulkService';
import * as XLSX from 'xlsx';

interface BulkUploadQuilometragemProps {
  onUploadComplete?: (results: UploadResult[]) => void;
}

export default function BulkUploadQuilometragem({ onUploadComplete }: BulkUploadQuilometragemProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dadosProcessados, setDadosProcessados] = useState<QuilometragemUpload[]>([]);
  const [resultados, setResultados] = useState<UploadResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Função para processar arquivo Excel
  const processarArquivoExcel = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const dados: QuilometragemUpload[] = [];

        // Processar cada linha do Excel (pulando cabeçalho se existir)
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          
          // Pular linhas vazias
          if (!row || row.length === 0 || !row[0]) continue;

          // Tentar extrair placa e quilometragem
          const placa = String(row[0] || '').trim().toUpperCase();
          const quilometragem = parseInt(String(row[1] || '0'));

          // Validar se parece ser uma linha de dados válida
          if (placa && placa !== 'PLACA' && !isNaN(quilometragem)) {
            dados.push({
              placa,
              quilometragem
            });
          }
        }

        if (dados.length === 0) {
          setErro('Nenhum dado válido encontrado no arquivo Excel. Certifique-se de que a primeira coluna contém as placas e a segunda coluna contém as quilometragens.');
          return;
        }

        setDadosProcessados(dados);
        setErro(null);
      } catch (error) {
        setErro('Erro ao processar arquivo Excel: ' + (error as Error).message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Função para processar o arquivo de texto
  const processarArquivoTexto = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const conteudo = e.target?.result as string;
        const linhas = conteudo.split('\n').map(linha => linha.trim()).filter(linha => linha);
        
        // Processar dados - você pode modificar esta lógica conforme necessário
        const dados: QuilometragemUpload[] = linhas.map((linha, index) => {
          // Se a linha contém placa e quilometragem separados por espaço ou vírgula
          if (linha.includes(' ') || linha.includes(',')) {
            const partes = linha.split(/[\s,]+/);
            if (partes.length >= 2) {
              return {
                placa: partes[0].trim().toUpperCase(), // Manter formato original (com ou sem hífen)
                quilometragem: parseInt(partes[1].trim())
              };
            }
          }
          
          // Se é apenas quilometragem, usar placeholder
          return {
            placa: `PLACA${String(index + 1).padStart(3, '0')}`,
            quilometragem: parseInt(linha)
          };
        });

        setDadosProcessados(dados);
        setErro(null);
      } catch (error) {
        setErro('Erro ao processar arquivo: ' + (error as Error).message);
      }
    };

    reader.readAsText(file);
  };

  // Função para processar o arquivo (detecta automaticamente o tipo)
  const processarArquivo = (file: File) => {
    const extensao = file.name.split('.').pop()?.toLowerCase();
    
    if (extensao === 'xlsx' || extensao === 'xls') {
      processarArquivoExcel(file);
    } else {
      processarArquivoTexto(file);
    }
  };

  // Função para fazer upload dos dados
  const fazerUpload = async () => {
    if (dadosProcessados.length === 0) return;

    setCarregando(true);
    setErro(null);

    try {
      // Validar dados primeiro
      const { validos, invalidos } = QuilometragemBulkService.validarDadosUpload(dadosProcessados);
      
      // Processar dados válidos
      const resultados = await QuilometragemBulkService.processarUploadBulk(validos);
      
      // Adicionar resultados inválidos
      const resultadosInvalidos: UploadResult[] = invalidos.map(({dado, erro}) => ({
        placa: dado.placa,
        quilometragem: dado.quilometragem,
        sucesso: false,
        erro
      }));

      const todosResultados = [...resultados, ...resultadosInvalidos];
      setResultados(todosResultados);
      onUploadComplete?.(todosResultados);

    } catch (error) {
      setErro('Erro durante o upload: ' + (error as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  // Função para limpar dados
  const limparDados = () => {
    setArquivo(null);
    setDadosProcessados([]);
    setResultados([]);
    setErro(null);
  };

  // Função para baixar template de texto
  const baixarTemplateTexto = () => {
    const template = `ABC-1234 184515
DEF-5678 156383
GHI-9012 179913
JKL-3456 149709
MNO-7890 167834
PQR-1234 184770
STU-5678 183577
VWX-9012 159817
YZA-3456 7602
BCD-7890 6226
EFG-1234 6430
HIJ-5678 7740
KLM-9012 3334
NOP-3456 5239
QRS-7890 4230
TUV-1234 3801
WXY-5678 5127
ZAB-9012 4143
CDE-3456 4392
FGH-7890 4406
IJK-1234 3868
LMN-5678 6432
OPQ-9012 6704
RST-3456 6459
UVW-7890 3069
XYZ-1234 7707
ABC-5678 6894
DEF-9012 44098
GHI-3456 2136
JKL-7890 5201
MNO-1234 35207
PQR-5678 6366
STU-9012 140702
VWX-3456 0
YZA-7890 176833
BCD-1234 6968`;

    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_quilometragem.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Função para baixar template Excel
  const baixarTemplateExcel = () => {
    // Dados de exemplo para o template
    const dadosExemplo = [
      ['PLACA', 'QUILOMETRAGEM'],
      ['ABC-1234', 184515],
      ['DEF-5678', 156383],
      ['GHI-9012', 179913],
      ['JKL-3456', 149709],
      ['MNO-7890', 167834],
      ['PQR-1234', 184770],
      ['STU-5678', 183577],
      ['VWX-9012', 159817],
      ['YZA-3456', 7602],
      ['BCD-7890', 6226],
      ['EFG-1234', 6430],
      ['HIJ-5678', 7740],
      ['KLM-9012', 3334],
      ['NOP-3456', 5239],
      ['QRS-7890', 4230],
      ['TUV-1234', 3801],
      ['WXY-5678', 5127],
      ['ZAB-9012', 4143],
      ['CDE-3456', 4392],
      ['FGH-7890', 4406],
      ['IJK-1234', 3868],
      ['LMN-5678', 6432],
      ['OPQ-9012', 6704],
      ['RST-3456', 6459],
      ['UVW-7890', 3069],
      ['XYZ-1234', 7707],
      ['ABC-5678', 6894],
      ['DEF-9012', 44098],
      ['GHI-3456', 2136],
      ['JKL-7890', 5201],
      ['MNO-1234', 35207],
      ['PQR-5678', 6366],
      ['STU-9012', 140702],
      ['VWX-3456', 0],
      ['YZA-7890', 176833],
      ['BCD-1234', 6968]
    ];

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dadosExemplo);

    // Definir largura das colunas
    ws['!cols'] = [
      { wch: 15 }, // Coluna PLACA
      { wch: 15 }  // Coluna QUILOMETRAGEM
    ];

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Quilometragem');

    // Gerar e baixar o arquivo
    XLSX.writeFile(wb, 'template_quilometragem.xlsx');
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center gap-3 mb-6">
        <CloudArrowUpIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h3 className="text-xl font-bold text-gray-900">Upload em Lote - Quilometragem</h3>
          <p className="text-sm text-gray-600">Faça upload da quilometragem de múltiplos veículos</p>
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">Como usar:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Baixe o template de exemplo (Excel ou texto)</li>
          <li>Edite o arquivo com as placas e quilometragens dos veículos</li>
          <li>Excel: Primeira coluna = PLACA, Segunda coluna = QUILOMETRAGEM</li>
          <li>Texto: Formato PLACA QUILOMETRAGEM (uma por linha)</li>
          <li>Placas aceitas: ABC1234 ou ABC-1234 (com ou sem hífen)</li>
          <li>Faça upload do arquivo editado</li>
          <li>Confirme os dados e execute o upload</li>
        </ol>
        <div className="mt-3 flex gap-4">
          <button
            onClick={baixarTemplateExcel}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            📊 Baixar template Excel (.xlsx)
          </button>
          <button
            onClick={baixarTemplateTexto}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            📄 Baixar template Texto (.txt)
          </button>
        </div>
      </div>

      {/* Upload de arquivo */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Arquivo de Quilometragem
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setArquivo(file);
                processarArquivo(file);
              }
            }}
            className="hidden"
            id="arquivo-quilometragem"
          />
          <label
            htmlFor="arquivo-quilometragem"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <DocumentTextIcon className="h-12 w-12 text-gray-400" />
            <span className="text-sm text-gray-600">
              {arquivo ? arquivo.name : 'Clique para selecionar arquivo'}
            </span>
            <span className="text-xs text-gray-500">
              Formatos aceitos: .txt, .csv, .xlsx, .xls
            </span>
          </label>
        </div>
      </div>

      {/* Dados processados */}
      {dadosProcessados.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">
            Dados Processados ({dadosProcessados.length} registros)
          </h4>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Placa
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Quilometragem
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dadosProcessados.map((dado, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {dado.placa}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {dado.quilometragem.toLocaleString()} km
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Resultados do Upload</h4>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Placa
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Quilometragem
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resultados.map((resultado, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {resultado.placa}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {resultado.quilometragem.toLocaleString()} km
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {resultado.sucesso ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircleIcon className="h-4 w-4" />
                          Sucesso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          {resultado.erro}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">{erro}</span>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex gap-3">
        <button
          onClick={fazerUpload}
          disabled={dadosProcessados.length === 0 || carregando}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {carregando ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processando...
            </>
          ) : (
            <>
              <CloudArrowUpIcon className="h-4 w-4" />
              Fazer Upload
            </>
          )}
        </button>

        <button
          onClick={limparDados}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Limpar Dados
        </button>
      </div>

      {/* Estatísticas */}
      {resultados.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {resultados.filter(r => r.sucesso).length}
            </div>
            <div className="text-sm text-green-800">Sucessos</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-600">
              {resultados.filter(r => !r.sucesso).length}
            </div>
            <div className="text-sm text-red-800">Erros</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">
              {resultados.length}
            </div>
            <div className="text-sm text-blue-800">Total</div>
          </div>
        </div>
      )}
    </div>
  );
}
