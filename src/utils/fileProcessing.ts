/**
 * Utilitários para processamento de arquivos CSV e Excel
 */

// import { processarCPFExcel } from './cpfUtils'; // TODO: Implement CPF processing

interface UsuarioData {
  matricula: string;
  cpf?: string;
  data_nascimento?: string;
  data_admissao?: string;
}

interface WindowWithXLSX extends Window {
  XLSX: {
    read: (data: ArrayBuffer, options: { type: string }) => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    utils: {
      sheet_to_json: (worksheet: unknown, options: { header: number }) => unknown[][];
    };
  };
}

/**
 * Processa arquivo CSV
 */
export function processarCSV(csvText: string): UsuarioData[] {
  const linhas = csvText.trim().split('\n');
  const usuarios: UsuarioData[] = [];
  
  // Detectar se a primeira linha é cabeçalho
  const primeiraLinha = linhas[0]?.toLowerCase();
  const temCabecalho = primeiraLinha?.includes('matricula') || 
                      primeiraLinha?.includes('cpf') || 
                      primeiraLinha?.includes('data');
  
  const startIndex = temCabecalho ? 1 : 0;
  
  for (let i = startIndex; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue; // Pular linhas vazias
    
    // Processar CSV considerando aspas
    const partes = parseCSVLine(linha);
    
    if (partes.length >= 1 && partes[0]) {
      usuarios.push({
        matricula: partes[0].trim(),
        cpf: partes[1]?.trim() || undefined,
        data_nascimento: partes[2]?.trim() || undefined,
        data_admissao: partes[3]?.trim() || undefined
      });
    }
  }

  return usuarios;
}

/**
 * Processa linha CSV considerando aspas e vírgulas dentro de campos
 */
function parseCSVLine(linha: string): string[] {
  const resultado: string[] = [];
  let campoAtual = '';
  let dentroDeAspas = false;
  
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];
    
    if (char === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (char === ',' && !dentroDeAspas) {
      resultado.push(campoAtual.trim());
      campoAtual = '';
    } else {
      campoAtual += char;
    }
  }
  
  // Adicionar o último campo
  resultado.push(campoAtual.trim());
  
  return resultado;
}

/**
 * Processa arquivo Excel usando a biblioteca xlsx
 * Nota: Requer instalação da biblioteca xlsx
 */
export async function processarExcel(file: File): Promise<UsuarioData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        
        // Verificar se a biblioteca xlsx está disponível
        if (typeof window !== 'undefined' && (window as unknown as WindowWithXLSX).XLSX) {
          const XLSX = (window as unknown as WindowWithXLSX).XLSX;
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Pegar a primeira planilha
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Processar os dados
          const usuarios = processarDadosExcel(jsonData as unknown[][]);
          resolve(usuarios);
        } else {
          // Fallback: tentar processar como texto (para arquivos CSV salvos como .xlsx)
          const text = new TextDecoder().decode(data);
          const usuarios = processarCSV(text);
          resolve(usuarios);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Processa dados do Excel convertidos para array
 */
function processarDadosExcel(dados: unknown[][]): UsuarioData[] {
  const usuarios: UsuarioData[] = [];
  
  if (dados.length === 0) return usuarios;
  
  // Detectar se a primeira linha é cabeçalho
  const primeiraLinha = dados[0];
  const temCabecalho = primeiraLinha.some((cell: unknown) => 
    typeof cell === 'string' && 
    (cell.toLowerCase().includes('matricula') || 
     cell.toLowerCase().includes('cpf') || 
     cell.toLowerCase().includes('data'))
  );
  
  const startIndex = temCabecalho ? 1 : 0;
  
  for (let i = startIndex; i < dados.length; i++) {
    const linha = dados[i];
    
    if (linha && linha.length >= 1 && linha[0]) {
      usuarios.push({
        matricula: String(linha[0]).trim(),
        cpf: linha[1] ? String(linha[1]).trim() : undefined,
        data_nascimento: linha[2] ? formatarDataExcel(linha[2]) : undefined,
        data_admissao: linha[3] ? formatarDataExcel(linha[3]) : undefined
      });
    }
  }
  
  return usuarios;
}

/**
 * Formatar data do Excel para formato brasileiro DD/MM/AAAA
 */
function formatarDataExcel(valor: unknown): string | undefined {
  if (!valor) return undefined;
  
  // Se já é uma string no formato correto
  if (typeof valor === 'string') {
    // Se já está no formato DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      return valor;
    }
    
    // Se está no formato AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [ano, mes, dia] = valor.split('-');
      return `${dia}/${mes}/${ano}`;
    }
  }
  
  // Se é um número (data serial do Excel)
  if (typeof valor === 'number') {
    const data = new Date((valor - 25569) * 86400 * 1000);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  
  // Se é um objeto Date
  if (valor instanceof Date) {
    const dia = String(valor.getDate()).padStart(2, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const ano = valor.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  
  return String(valor).trim();
}

/**
 * Validar formato de arquivo
 */
export function validarFormatoArquivo(nomeArquivo: string): boolean {
  const extensoesPermitidas = ['.csv', '.xlsx', '.xls'];
  const extensao = nomeArquivo.toLowerCase().substring(nomeArquivo.lastIndexOf('.'));
  return extensoesPermitidas.includes(extensao);
}

/**
 * Obter tipo de arquivo
 */
export function obterTipoArquivo(nomeArquivo: string): 'csv' | 'excel' | 'desconhecido' {
  const extensao = nomeArquivo.toLowerCase().substring(nomeArquivo.lastIndexOf('.'));
  
  if (extensao === '.csv') return 'csv';
  if (extensao === '.xlsx' || extensao === '.xls') return 'excel';
  return 'desconhecido';
}