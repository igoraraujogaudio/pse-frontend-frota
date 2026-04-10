import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { 
  ContratoSharePointConfig, 
  getContratoConfig, 
  getAllContratosConfig,
  CONTRATOS_CONFIG,
  normalizeColumnMapping,
  type ColumnMappingValue
} from '@/config/contratos-sharepoint';

/**
 * Carrega configuração do banco de dados ou usa fallback do arquivo
 */
async function loadContratoConfigFromDB(contratoNome: string): Promise<ContratoSharePointConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sharepoint_contratos_config')
      .select('*')
      .eq('contrato_nome', contratoNome)
      .single();

    if (error || !data) {
      // Fallback para configuração do arquivo
      return getContratoConfig(contratoNome);
    }

    const config = {
      contratoNome: data.contrato_nome,
      sharePointUrl: data.sharepoint_url,
      columnMapping: data.column_mapping as ContratoSharePointConfig['columnMapping'],
      statusMapping: data.status_mapping as ContratoSharePointConfig['statusMapping'],
      headerRow: data.header_row || 1,
      // IMPORTANTE: Se buscar_equipe_por_encarregado for null/undefined, usar true (padrão Niterói)
      // Se for explicitamente false, usar false (buscar diretamente)
      buscarEquipePorEncarregado: data.buscar_equipe_por_encarregado !== false,
      equipeMapping: data.equipe_mapping as ContratoSharePointConfig['equipeMapping'],
      equipesFixas: data.equipes_fixas as string[] || [],
      sheetName: data.sheet_name as string | undefined,
    };
    
    console.log(`📋 Configuração carregada do banco para ${config.contratoNome}:`);
    console.log(`   - buscar_equipe_por_encarregado (raw): ${data.buscar_equipe_por_encarregado}`);
    console.log(`   - buscarEquipePorEncarregado (processado): ${config.buscarEquipePorEncarregado}`);
    console.log(`   - equipesFixas: ${config.equipesFixas?.length || 0} equipes`);
    
    return config;
  } catch (error) {
    console.warn(`Erro ao carregar configuração do banco para ${contratoNome}, usando fallback:`, error);
    return getContratoConfig(contratoNome);
  }
}

/**
 * Carrega todas as configurações do banco de dados ou usa fallback do arquivo
 */
async function loadAllContratosConfigFromDB(): Promise<ContratoSharePointConfig[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sharepoint_contratos_config')
      .select('*')
      .order('contrato_nome');

    if (error || !data || data.length === 0) {
      // Fallback para configurações do arquivo
      return getAllContratosConfig();
    }

    return data.map(item => ({
      contratoNome: item.contrato_nome,
      sharePointUrl: item.sharepoint_url,
      columnMapping: item.column_mapping as ContratoSharePointConfig['columnMapping'],
      statusMapping: item.status_mapping as ContratoSharePointConfig['statusMapping'],
      headerRow: item.header_row || 1,
    }));
  } catch (error) {
    console.warn('Erro ao carregar configurações do banco, usando fallback:', error);
    return getAllContratosConfig();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Types
interface EquipeComEncarregado {
  encarregado?: {
    nome: string;
  } | {
    nome: string;
  }[] | null;
  prefixo?: string;
  nome: string;
  contrato_id?: string;
}


interface ExcelRow extends Record<string, unknown> {
  'Data Execução'?: string | number;
  'Nº SOB'?: string;
  'Responsável Execução'?: string;
  'Contrato'?: string;
  'CONTRATO'?: string;
  'VALORES'?: string | number;
  'STATUS'?: string;
  'Logradouro'?: string;
  'Bairro'?: string;
  'Município'?: string;
  'Descrição do serviço'?: string;
  'INFO STATUS'?: string;
  'Tipo de Serviço'?: string;
  'PRIORIDADE'?: string;
  'Hor Inic Obra'?: string;
  'Hor Térm Obra'?: string;
  'OBS'?: string;
  'Nº EQ (RE, CO, CF, CC ou TR)'?: string;
  'Inic deslig'?: string;
  'Térm deslig'?: string;
  'Tipo de SGD'?: string;
  'NUMERO SGD'?: string;
  'Anotação'?: string;
  'Apoio'?: string;
  'CRITICO'?: string;
  'COORDENADA'?: string;
  'VALIDADE'?: string | number;
}

interface ActivityToCreate {
  date: string;
  team: string;
  osNumber: string;
  value: number;
  status: string;
  location: string;
  notes: string;
  statusNotes: string;
  tipoServico?: string;
  prioridade?: string;
  horarioInicio?: string;
  horarioFim?: string;
  atividade?: string;
  pontoEletrico?: string;
  inicioIntervencao?: string;
  terminoIntervencao?: string;
  tipoSGD?: string;
  numeroSGD?: string;
  obs?: string;
  apoio?: string;
  critico?: string;
  coordenada?: string;
  validade?: string;
}

/**
 * Busca valor de coluna com ou sem espaços no final (para lidar com nomes inconsistentes)
 * Procura em TODAS as chaves da row para encontrar uma correspondência
 */
function getColumnValue(row: Record<string, unknown>, columnName: string): string | number | null | undefined {
  // Normalizar o nome procurado (sem espaços extras)
  const normalizedSearch = columnName.trim().toUpperCase();
  
  // Procurar em todas as chaves da row
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const normalizedKey = key.trim().toUpperCase();
      if (normalizedKey === normalizedSearch) {
        const value = row[key];
        // Type assertion: Excel values can be string, number, null, or undefined
        return value as string | number | null | undefined;
      }
    }
  }
  
  return undefined;
}

/**
 * Busca valor de coluna usando mapeamento de colunas do contrato
 * Suporta concatenação de múltiplas colunas
 */
function getColumnValueByMapping(
  row: Record<string, unknown>, 
  mapping: ColumnMappingValue
): string | number | null | undefined {
  const normalized = normalizeColumnMapping(mapping);
  
  // Se for para concatenar, junta todas as colunas que tiverem valor
  if (normalized.concatenate && normalized.columns.length > 1) {
    const values: string[] = [];
    for (const columnName of normalized.columns) {
      const value = getColumnValue(row, columnName);
      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value).trim());
      }
    }
    if (values.length > 0) {
      return values.join(normalized.separator || ' ');
    }
    return undefined;
  }
  
  // Se não for para concatenar, usa a primeira coluna que encontrar valor
  for (const columnName of normalized.columns) {
    const value = getColumnValue(row, columnName);
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Converte número decimal do Excel para formato de hora
 */
function convertExcelTimeToHour(timeValue: string | number | null | undefined): string {
  if (!timeValue) return '';
  
  // Se já é string, retorna como está
  if (typeof timeValue === 'string') {
    return timeValue;
  }
  
  // Se é número (decimal do Excel), converte para hora
  if (typeof timeValue === 'number') {
    // Excel armazena horas como fração do dia (0.5 = 12:00)
    const hours = Math.floor(timeValue * 24);
    const minutes = Math.floor((timeValue * 24 - hours) * 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  return String(timeValue);
}

/**
 * Extrai responsáveis do campo "Responsável Execução"
 */
function extractResponsaveis(responsavel?: string | number | null): string[] {
  if (!responsavel) return [];
  
  // Converter para string se for número ou outro tipo
  const responsavelStr = String(responsavel).trim();
  
  // Se for string vazia após trim, retornar vazio
  if (!responsavelStr || responsavelStr === '' || responsavelStr === '-') return [];
  
  return responsavelStr
    .split(/[\/\|]/) // Split por / ou |
    .map(r => r.trim())
    .filter(r => r && r !== '-' && r.toLowerCase() !== 'cesto');
}

/**
 * Extrai valores do campo "VALORES" (pode ter múltiplos separados por / ou |)
 */
function extractValores(valores?: string | number | null): number[] {
  if (!valores) return [0];
  
  // Converter para string se for número
  const valoresStr = String(valores);
  
  // Separar por / ou |
  const valoresArray = valoresStr
    .split(/[\/\|]/)
    .map(v => v.trim())
    .filter(v => v);
  
  // Converter cada valor para número
  return valoresArray.map(v => parseValue(v));
}

/**
 * Extrai múltiplos textos separados por / ou |
 * Usado para descrições, atividades, observações, etc.
 */
function extractMultipleTexts(text?: string | null): string[] {
  if (!text) return [''];
  
  const textStr = String(text);
  
  // Separar por / ou | (mantém pelo menos um item vazio se não houver separador)
  const textsArray = textStr
    .split(/[\/\|]/)
    .map(t => t.trim());
  
  // Se não houver separador, retornar o texto completo
  if (textsArray.length === 1) {
    return textsArray;
  }
  
  // Filtrar apenas textos vazios no meio, manter vazios no final se houver
  return textsArray;
}

/**
 * Busca equipe do encarregado por nome parcial
 */
/**
 * Cache de encarregados para evitar múltiplas consultas
 */
let encarregadosCache: Array<{
  nome: string;
  nomeNormalizado: string;
  equipe: string;
  contratoId: string;
}> | null = null;

/**
 * Cache de contratos para evitar múltiplas consultas
 */
let contratosCache: Map<string, string> | null = null;

async function loadEncarregados(): Promise<void> {
  if (encarregadosCache) return;
  
  console.log('📥 Carregando lista de encarregados...');
  
  // Buscar APENAS equipes ativas com encarregado
  const { data: equipes, error } = await supabaseAdmin
    .from('equipes')
    .select(`
      id,
      nome,
      prefixo,
      contrato_id,
      encarregado:usuarios!equipes_encarregado_id_fkey(
        id,
        nome,
        matricula
      )
    `)
    .eq('status', 'active')
    .not('encarregado_id', 'is', null);

  if (error || !equipes) {
    console.error('❌ Erro ao carregar encarregados:', error);
    encarregadosCache = [];
    return;
  }

  encarregadosCache = (equipes as EquipeComEncarregado[])
    .filter((e) => e.encarregado)
    .map((e) => {
      const enc = Array.isArray(e.encarregado) ? e.encarregado[0] : e.encarregado;
      return {
        nome: enc!.nome,
        nomeNormalizado: enc!.nome
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/THOMAS\b/g, 'THOMAZ'), // Normaliza THOMAS -> THOMAZ
        equipe: e.prefixo || e.nome,
        contratoId: e.contrato_id || '',
      };
    });

  console.log(`✅ ${encarregadosCache.length} encarregados carregados`);
}

async function loadContratos(): Promise<void> {
  if (contratosCache) return;
  
  console.log('📥 Carregando lista de contratos...');
  
  const { data: contratos, error } = await supabaseAdmin
    .from('contratos')
    .select('id, nome');
  
  if (error || !contratos) {
    console.error('❌ Erro ao carregar contratos:', error);
    contratosCache = new Map();
    return;
  }
  
  contratosCache = new Map();
  contratos.forEach(c => {
    const nomeNormalizado = c.nome.toUpperCase().trim();
    contratosCache!.set(nomeNormalizado, c.id);
  });
  
  console.log(`✅ ${contratosCache.size} contratos carregados em cache`);
}

async function findContratoId(nomeContrato: string): Promise<string | undefined> {
  await loadContratos();
  
  if (!contratosCache || !nomeContrato) return undefined;
  
  const nomeNormalizado = nomeContrato.toUpperCase().trim();
  return contratosCache.get(nomeNormalizado);
}

// Função findEquipeDireta removida - a lógica está inline no processContrato

async function findEquipeByEncarregado(nome: string, contratoId?: string): Promise<string | null> {
  try {
    // Garantir que cache está carregado
    await loadEncarregados();
    
    if (!encarregadosCache || encarregadosCache.length === 0) {
      return null;
    }
    
    // Normalizar nome da planilha
    const nomeBusca = nome
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/THOMAS\b/g, 'THOMAZ'); // Normaliza THOMAS -> THOMAZ
    
    const palavras = nomeBusca.split(/\s+/).filter(p => p.length >= 3);
    
    // Filtrar por contrato primeiro (se especificado)
    let candidatos = encarregadosCache;
    if (contratoId) {
      candidatos = candidatos.filter(e => e.contratoId === contratoId);
    }
    
    // Buscar match
    for (const candidato of candidatos) {
      const nomeEnc = candidato.nomeNormalizado;
      
      // Estratégia 1: Todas as palavras da busca estão no nome do encarregado
      if (palavras.every(p => nomeEnc.includes(p))) {
        console.log(`🔍 "${nome}" → ${candidato.nome.substring(0, 30)}... → ${candidato.equipe}`);
        return candidato.equipe;
      }
    }
    
    // Estratégia 2: Pelo menos a primeira palavra bate
    if (palavras.length > 0) {
      const primeiraPalavra = palavras[0];
      const match = candidatos.find(c => c.nomeNormalizado.includes(primeiraPalavra));
      
      if (match) {
        console.log(`🔍 "${nome}" → ${match.nome.substring(0, 30)}... (parcial) → ${match.equipe}`);
        return match.equipe;
      }
    }
    
    console.log(`⚠️ "${nome}" não encontrado entre ${candidatos.length} encarregados`);
    return null;
  } catch (error) {
    console.error(`❌ Erro: "${nome}":`, error);
    return null;
  }
}

/**
 * Parse de data no formato da planilha
 * Suporta: 8/1/2025, 01/08/2025, serial do Excel, etc.
 */
function parseDate(dateStr: string | number): string | null {
  try {
    // Se for número (serial do Excel)
    if (typeof dateStr === 'number') {
      // Serial do Excel: dias desde 1900-01-01
      const excelEpoch = new Date(1900, 0, 1);
      const days = dateStr - 2; // Ajuste para bug do Excel com 1900
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
    
    // Se for string
    const str = String(dateStr).trim();
    
    // Formato ISO (2025-08-01)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    
    // Formato com barras (8/1/2025 ou 01/08/2025)
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let day, month, year;
      
      // Detectar formato baseado no terceiro valor
      const third = parseInt(parts[2], 10);
      
      if (third > 31) {
        // Terceiro valor é ano: M/D/YYYY
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = third;
      } else {
        // Terceiro valor é dia: YYYY/MM/DD ou DD/MM/YYYY
        const first = parseInt(parts[0], 10);
        
        if (first > 31) {
          // YYYY/MM/DD
          year = first;
          month = parseInt(parts[1], 10);
          day = third;
        } else {
          // DD/MM/YYYY
          day = first;
          month = parseInt(parts[1], 10);
          year = third;
        }
      }
      
      // Corrigir anos de 2 dígitos
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      // Validar
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Formato com traços (01-08-2025)
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      const third = parseInt(parts[2], 10);
      
      // Tentar diferentes formatos
      if (first > 31) {
        // YYYY-MM-DD
        return `${first}-${String(second).padStart(2, '0')}-${String(third).padStart(2, '0')}`;
      } else if (third > 31) {
        // DD-MM-YYYY
        return `${third}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao fazer parse de data:', dateStr, error);
    return null;
  }
}

/**
 * Mapeia status da planilha SharePoint para status do sistema
 * SharePoint: CONCLUIDO, CANCELADO, PARCIAL PLANEJADO, PARCIAL NÃO PLANEJADO
 * Sistema: EXEC, CANC, PARP, PANP, PROG
 * 
 * Suporta mapeamento customizado por contrato
 */
function mapStatus(
  status?: string, 
  customMapping?: Record<string, 'PROG' | 'PANP' | 'EXEC' | 'CANC' | 'PARP'>
): 'PROG' | 'PANP' | 'EXEC' | 'CANC' | 'PARP' {
  if (!status) return 'PROG';
  
  const statusUpper = status.toUpperCase().trim();
  
  // Primeiro, verificar mapeamento customizado (busca exata)
  if (customMapping) {
    // Busca exata
    if (customMapping[statusUpper]) {
      return customMapping[statusUpper];
    }
    
    // Busca parcial (se o status da planilha contém a chave do mapeamento)
    for (const [key, value] of Object.entries(customMapping)) {
      if (statusUpper.includes(key.toUpperCase())) {
        return value;
      }
    }
  }
  
  // Mapeamento padrão (fallback)
  // CONCLUIDO → EXEC (Executada)
  if (statusUpper.includes('CONCLUIDO') || statusUpper.includes('CONCLUÍDA') || statusUpper.includes('EXECUTAD')) {
    return 'EXEC';
  } 
  // CANCELADO → CANC (Cancelada)
  else if (statusUpper.includes('CANCELADO') || statusUpper.includes('CANCELADA')) {
    return 'CANC';
  } 
  // PARCIAL NÃO PLANEJADO → PANP (Parcial Não Planejada)
  else if (statusUpper.includes('PARCIAL') && statusUpper.includes('NÃO PLANEJAD')) {
    return 'PANP';
  } 
  // PARCIAL PLANEJADO → PARP (Parcial Planejada)
  else if (statusUpper.includes('PARCIAL') && statusUpper.includes('PLANEJAD')) {
    return 'PARP';
  }
  // PROGRAMADO → PROG (Programada)
  else if (statusUpper.includes('PROGRAMAD')) {
    return 'PROG';
  }
  
  return 'PROG';
}

/**
 * Parse de valor monetário
 */
function parseValue(valor?: string | number): number {
  if (!valor) return 0;
  
  const cleaned = valor.toString().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extrai o shareId de uma URL do SharePoint
 */
function extractShareId(shareUrl: string): string | null {
  try {
    // Formato: https://.../:x:/g/personal/{user}/{shareId}?e=...
    // Exemplo: https://psvsrv-my.sharepoint.com/:x:/g/personal/geraldo_junior_pse_srv_br/EQpz5vrm4AhAlRIfds04-L0BSG2C7Rbggnxj4EmvycK7tQ?rtime=...
    
    const url = new URL(shareUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    console.log('🔍 Path parts:', pathParts);
    
    // Procurar pelo shareId - ele vem depois de {user}
    // Path: [':x:', 'g', 'personal', '{user}', '{shareId}']
    const personalIndex = pathParts.indexOf('personal');
    
    if (personalIndex !== -1 && pathParts.length > personalIndex + 1) {
      // O shareId é 2 posições depois de 'personal' (pulando o username)
      // Índices: [..., 'personal', 'geraldo_junior_pse_srv_br', 'EQpz5vrm...']
      //                   ^            ^                           ^
      //                   i            i+1                         i+2
      
      const potentialShareId = pathParts[pathParts.length - 1]; // Último elemento do path
      
      // ShareIds do SharePoint são strings Base64-like com 40+ caracteres
      // Ex: EQpz5vrm4AhAlRIfds04-L0BSG2C7Rbggnxj4EmvycK7tQ
      if (potentialShareId && potentialShareId.length > 30 && /^[A-Za-z0-9_-]+$/.test(potentialShareId)) {
        console.log(`✅ ShareId extraído: ${potentialShareId}`);
        return potentialShareId;
      }
    }
    
    console.warn('⚠️ Não foi possível extrair shareId da URL');
    console.warn('   URL:', shareUrl);
    console.warn('   Path:', pathParts);
    return null;
  } catch (error) {
    console.error('❌ Erro ao extrair shareId:', error);
    return null;
  }
}


/**
 * Tenta múltiplas estratégias para baixar o arquivo do SharePoint
 */
async function tryDownloadFromSharePoint(shareUrl: string): Promise<Response | null> {
  const shareId = extractShareId(shareUrl);
  const pathParts = new URL(shareUrl).pathname.split('/').filter(p => p);
  const personalIndex = pathParts.indexOf('personal');
  const user = pathParts[personalIndex + 1];
  
  const attempts = [
    {
      name: 'URL Original (se já for link de download)',
      url: shareUrl.includes('download.aspx') ? shareUrl : null,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, application/vnd.ms-excel',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    },
    {
      name: 'Download com share',
      url: shareId ? `https://psvsrv-my.sharepoint.com/personal/${user}/_layouts/15/download.aspx?share=${shareId}` : null,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream',
        'User-Agent': 'Mozilla/5.0',
      }
    },
    {
      name: 'Download com UniqueId',
      url: shareId ? `https://psvsrv-my.sharepoint.com/personal/${user}/_layouts/15/download.aspx?UniqueId=${shareId}` : null,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    },
    {
      name: 'URL Original com ?download=1',
      url: `${shareUrl.split('?')[0]}?download=1`,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'User-Agent': 'Mozilla/5.0',
      }
    },
    {
      name: 'URL Original com &download=1',
      url: shareUrl.includes('?') ? `${shareUrl}&download=1` : null,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'User-Agent': 'Mozilla/5.0',
      }
    },
    {
      name: 'guestaccess.aspx',
      url: shareId ? `https://psvsrv-my.sharepoint.com/personal/${user}/_layouts/15/guestaccess.aspx?share=${shareId}&action=download` : null,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'User-Agent': 'Mozilla/5.0',
      }
    }
  ].filter(a => a.url !== null); // Remove tentativas sem URL

  for (const attempt of attempts) {
    try {
      console.log(`🔄 Tentando: ${attempt.name}`);
      console.log(`   URL: ${attempt.url!.substring(0, 80)}...`);
      
      const response = await fetch(attempt.url!, {
        method: 'GET',
        headers: attempt.headers,
        cache: 'no-store',
        redirect: 'follow',
      });

      if (response.ok) {
        // Verificar se é realmente um arquivo Excel e não HTML
        const contentType = response.headers.get('content-type') || '';
        const isExcel = contentType.includes('spreadsheetml') || 
                       contentType.includes('excel') || 
                       contentType.includes('octet-stream') ||
                       contentType.includes('application/vnd.ms-excel') ||
                       contentType.includes('application/x-zip');
        
        console.log(`   Content-Type: ${contentType}`);
        
        // Se for HTML, rejeitar
        if (contentType.includes('text/html')) {
          console.log(`⚠️ ${attempt.name} retornou HTML em vez de Excel (Content-Type: ${contentType})`);
        }
        // Se for application/* ou isExcel, aceitar (incluindo XLSB que vem como application/octet-stream)
        else if (isExcel || contentType.includes('application')) {
          console.log(`✅ Sucesso com: ${attempt.name} (Status: ${response.status})`);
          return response;
        } else {
          console.log(`⚠️ ${attempt.name} tipo desconhecido (Content-Type: ${contentType})`);
        }
      } else {
        console.log(`❌ Falhou: ${attempt.name} (Status: ${response.status} ${response.statusText})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ Erro: ${attempt.name} - ${errorMessage}`);
    }
  }

  return null;
}

/**
 * Processa sincronização para um contrato específico
 */
async function processContrato(config: ContratoSharePointConfig, modoHistorico = false): Promise<{
  success: boolean;
  totalRows: number;
  totalFiltered: number;
  totalProcessed: number;
  totalCreated: number;
  errors: string[];
  warnings: string[];
  contratoNome: string;
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Log da configuração de busca de equipe
  console.log(`\n🔧 Configuração de busca de equipe para ${config.contratoNome}:`);
  console.log(`   - buscarEquipePorEncarregado: ${config.buscarEquipePorEncarregado}`);
  console.log(`   - equipeMapping: ${config.equipeMapping ? 'configurado' : 'não configurado'}`);
  console.log(`   - equipesFixas: ${config.equipesFixas?.length || 0} equipes`);
  if (config.equipesFixas && config.equipesFixas.length > 0) {
    console.log(`   - Equipes fixas: ${config.equipesFixas.slice(0, 5).join(', ')}${config.equipesFixas.length > 5 ? '...' : ''}`);
  }
  
  try {
    console.log(`\n🚀 Iniciando sincronização para contrato: ${config.contratoNome}`);
    console.log(`📎 URL configurada: ${config.sharePointUrl.substring(0, 80)}...`);

    if (!config.sharePointUrl) {
      throw new Error(`URL do SharePoint não configurada para o contrato ${config.contratoNome}`);
    }

    const downloadStart = Date.now();
    // Tentar baixar o arquivo usando múltiplas estratégias
    const response = await tryDownloadFromSharePoint(config.sharePointUrl);
    console.log(`⏱️ Download: ${Date.now() - downloadStart}ms`);

    if (!response) {
      const errorMsg = `Não foi possível baixar a planilha do SharePoint para o contrato ${config.contratoNome}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      return {
        success: false,
        totalRows: 0,
        totalFiltered: 0,
        totalProcessed: 0,
        totalCreated: 0,
        errors,
        warnings,
        contratoNome: config.contratoNome,
      };
    }

    // Ler arquivo Excel
    const parseStart = Date.now();
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log(`⏱️ Parse Excel: ${Date.now() - parseStart}ms`);
    
    // Pegar aba especificada ou primeira aba
    let sheetName = config.sheetName || workbook.SheetNames[0];
    
    // Verificar se a aba existe
    if (!workbook.SheetNames.includes(sheetName)) {
      console.warn(`⚠️ Aba "${sheetName}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}. Usando primeira aba.`);
      sheetName = workbook.SheetNames[0];
    }
    
    const worksheet = workbook.Sheets[sheetName];
    console.log(`📋 Usando aba: "${sheetName}"`);
    
    console.log('📊 Otimizando leitura da planilha...');
    
    // Obter range da planilha
    const fullRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`📏 Range original: ${fullRange.e.r + 1} linhas x ${fullRange.e.c + 1} colunas`);
    
    // Obter linha do cabeçalho (padrão: 1, baseado em 1)
    const headerRow = config.headerRow || 1;
    const headerRowIndex = headerRow - 1; // Converter para índice baseado em 0
    
    console.log(`📋 Linha do cabeçalho: ${headerRow} (índice: ${headerRowIndex})`);
    
    // OTIMIZAÇÃO CRÍTICA: Limitar drasticamente as colunas processadas
    // Planilha da Enel tem 16384 colunas mas só usa até ~BG
    // Colunas necessárias: Data, Nº SOB, Responsável, Contrato, Valores, Status, Local, Obs, etc
    // Limitar a coluna BG (59ª coluna - índice 58) que contém todos os dados necessários
    
    // Se o cabeçalho não está na linha 1, precisamos ajustar o range
    // O range deve começar na linha do cabeçalho
    const limitedRange = {
      s: { r: headerRowIndex, c: 0 },       // Start: Linha do cabeçalho
      e: { r: fullRange.e.r, c: 58 }        // End: Até coluna BG (58 = índice da coluna BG)
    };
    
    const rangeStr = XLSX.utils.encode_range(limitedRange);
    console.log(`📏 Range otimizado: ${rangeStr} (${fullRange.e.c + 1} → 59 colunas, cabeçalho na linha ${headerRow})`);
    
    // Converter para JSON com range otimizado
    const convertStart = Date.now();
    
    // Não especificar header para que o XLSX use automaticamente a primeira linha
    // do range como cabeçalho (com os nomes das colunas)
    const rowsRaw = XLSX.utils.sheet_to_json(worksheet, {
      raw: true,
      defval: '',
      dateNF: 'yyyy-mm-dd',
      range: limitedRange,
      // Sem header: usa primeira linha do range como nomes de colunas
    }) as ExcelRow[];
    
    console.log(`⏱️ Conversão para JSON: ${Date.now() - convertStart}ms`);
    console.log(`📊 Total de linhas extraídas: ${rowsRaw.length}`);
    
    // Debug: Mostrar TODAS as colunas da planilha
    if (rowsRaw.length > 0) {
      const firstRow = rowsRaw[0];
      const columns = Object.keys(firstRow);
      console.log(`\n🔍 ==================== DEBUG COLUNAS ====================`);
      console.log(`📋 Total de colunas: ${columns.length}`);
      console.log(`📋 TODAS AS COLUNAS (índice: nome):`);
      columns.forEach((col, idx) => {
        console.log(`   [${idx}] "${col}"`);
      });
      console.log(`\n📋 Procurando por CRITICO/COORDENADA especificamente:`);
      console.log(`   getColumnValue(row, 'CRITICO') = "${getColumnValue(firstRow, 'CRITICO')}"`);
      console.log(`   getColumnValue(row, 'COORDENADA') = "${getColumnValue(firstRow, 'COORDENADA')}"`);
      console.log(`🔍 ========================================================\n`);
    }
    
    // APLICAR FILTROS IMEDIATAMENTE
    const filterStart = Date.now();
    
    // Data limite: 31/12/2025 para modo normal, sem limite para modo histórico
    const dataLimite = modoHistorico ? new Date('2000-01-01') : new Date('2026-01-01');
    const dataLimiteMax = modoHistorico ? new Date('2026-01-01') : new Date('2100-01-01');
    
    if (modoHistorico) {
      console.log(`📜 MODO HISTÓRICO ATIVADO: Importando dados ANTES de 2026-01-01`);
      console.log(`   - Dados serão marcados como is_historico = TRUE`);
      console.log(`   - NÃO apagará dados existentes`);
    }
    
    const statusIgnorados = ['ADIADO', 'ANTECIPADO', 'RETIRADO'];
    
    const mapping = config.columnMapping;
    
    const rows = rowsRaw.filter((row, index) => {
      // Filtro de status PRIMEIRO (mais rápido) - usar mapeamento
      const statusValue = getColumnValueByMapping(row, mapping.status);
      const statusRaw = (statusValue || '').toString().toUpperCase().trim();
      if (statusIgnorados.some(s => statusRaw.includes(s))) {
        if (index < 10) console.log(`🚫 Linha ${index + 2} filtrada - Status: ${statusRaw}`);
        return false;
      }
      
      // Filtro de data - usar mapeamento
      const dateValue = getColumnValueByMapping(row, mapping.dataExecucao);
      if (!dateValue || dateValue === '') return false;
      
      const dateStr = parseDate(dateValue as string | number);
      if (!dateStr) return false;
      
      const dataRow = new Date(dateStr);
      
      // Modo histórico: apenas dados ANTES de 2026
      // Modo normal: apenas dados de 2026 em diante
      if (modoHistorico) {
        if (dataRow >= dataLimiteMax) {
          return false; // Ignorar dados de 2026 em diante no modo histórico
        }
      } else {
        if (dataRow < dataLimite) {
          return false; // Ignorar dados antes de 2026 no modo normal
        }
      }
      
      return true;
    });
    
    console.log(`⏱️ Tempo de filtro: ${Date.now() - filterStart}ms`);
    console.log(`✅ Após filtros: ${rows.length} linhas (filtradas ${rowsRaw.length - rows.length})`);
    
    // DEBUG: Mostrar primeiras linhas e colunas disponíveis
    if (rows.length > 0) {
      console.log('📋 Colunas disponíveis:', Object.keys(rows[0]));
    }

    // Processar cada linha
    const processStart = Date.now();
    const activitiesToCreate: ActivityToCreate[] = [];
    // errors e warnings já foram declarados no início da função

    // Obter contratoId uma vez antes do loop (melhor performance)
    // Usar sempre o contrato da configuração (já foi selecionado na interface)
    const contratoId = await findContratoId(config.contratoNome);
    console.log(`📋 Contrato ID obtido: ${contratoId || 'não encontrado'} para contrato "${config.contratoNome}"`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mapping = config.columnMapping;
      
      // Buscar SOB usando mapeamento
      const sobValue = getColumnValueByMapping(row, mapping.numeroSOB);
      
      // Buscar data usando mapeamento
      const dateValue = getColumnValueByMapping(row, mapping.dataExecucao);
      
      // Validar campos obrigatórios (já passou pelos filtros de status e data)
      if (!sobValue || !dateValue) {
        warnings.push(`Linha ${i + 2}: Falta SOB ou Data | SOB="${sobValue}" | Data="${dateValue}"`);
        continue;
      }

      // Parse da data (já validamos que existe e é >= out/2025 no filtro)
      const dateStr = parseDate(dateValue as string | number);
      if (!dateStr) {
        warnings.push(`Linha ${i + 2}: Data inválida após filtro`);
        continue;
      }

      // Verificar modo de busca de equipe
      // IMPORTANTE: Se buscarEquipePorEncarregado for undefined ou true, busca por encarregado
      // Se for explicitamente false, busca equipe diretamente
      // MODO HISTÓRICO: Sempre buscar por encarregado para Niterói
      const buscarPorEncarregado = modoHistorico ? true : (config.buscarEquipePorEncarregado !== false);
      
      if (i < 3) {
        console.log(`🔍 Linha ${i + 2}: Modo de busca = ${buscarPorEncarregado ? 'POR ENCARREGADO' : 'DIRETO DA PLANILHA'}${modoHistorico ? ' (FORÇADO - MODO HISTÓRICO)' : ''}`);
      }
      
      // Extrair responsáveis usando mapeamento (só necessário se buscar por encarregado)
      let responsaveis: string[] = [];
      if (buscarPorEncarregado) {
        const responsavelRaw = getColumnValueByMapping(row, mapping.responsavelExecucao);
        responsaveis = extractResponsaveis(responsavelRaw);
      
      // Debug: mostrar primeiras 5 linhas para entender o problema
      if (i < 5) {
        console.log(`🔍 Linha ${i + 2}: OS="${sobValue}" | Responsável Raw="${responsavelRaw}" | Responsáveis extraídos=[${responsaveis.join(', ')}]`);
        // Debug adicional: mostrar o que tem na linha
        console.log(`   - Colunas mapeadas:`, mapping.responsavelExecucao);
        console.log(`   - Valor direto row['Responsável Execução']:`, row['Responsável Execução']);
        console.log(`   - Keys da row (primeiras 20):`, Object.keys(row).slice(0, 20));
      }
      
      if (responsaveis.length === 0) {
        warnings.push(`Linha ${i + 2}: Sem responsável definido para OS ${sobValue} | Raw: "${responsavelRaw}"`);
        continue;
        }
      } else {
        // Se buscar equipe diretamente, usar apenas 1 "responsável" fictício para o loop
        responsaveis = [''];
      }

      // Extrair valores usando mapeamento
      const valoresRaw = getColumnValueByMapping(row, mapping.valores);
      const valores = extractValores(valoresRaw);
      
      // Extrair campos que podem ter múltiplos valores (um para cada equipe) usando mapeamento
      const descricoes = extractMultipleTexts(
        mapping.descricaoServico ? String(getColumnValueByMapping(row, mapping.descricaoServico) || '') : undefined
      );
      const atividades = extractMultipleTexts(
        mapping.obs ? String(getColumnValueByMapping(row, mapping.obs) || '') : undefined
      );
      const observacoes = extractMultipleTexts(
        mapping.anotacao ? String(getColumnValueByMapping(row, mapping.anotacao) || '') : undefined
      );
      const apoios = extractMultipleTexts(
        mapping.apoio ? String(getColumnValueByMapping(row, mapping.apoio) || '') : undefined
      );
      const infoStatus = extractMultipleTexts(
        mapping.infoStatus ? String(getColumnValueByMapping(row, mapping.infoStatus) || '') : undefined
      );
      const tiposServico = extractMultipleTexts(
        mapping.tipoServico ? String(getColumnValueByMapping(row, mapping.tipoServico) || '') : undefined
      );
      const prioridades = extractMultipleTexts(
        mapping.prioridade ? String(getColumnValueByMapping(row, mapping.prioridade) || '') : undefined
      );
      const pontosEletricos = extractMultipleTexts(
        mapping.numeroEQ ? String(getColumnValueByMapping(row, mapping.numeroEQ) || '') : undefined
      );
      const tiposSGD = extractMultipleTexts(
        mapping.tipoSGD ? String(getColumnValueByMapping(row, mapping.tipoSGD) || '') : undefined
      );
      const numerosSGD = extractMultipleTexts(
        mapping.numeroSGD ? String(getColumnValueByMapping(row, mapping.numeroSGD) || '') : ''
      );
      
      // Garantir que temos valores suficientes para todos os responsáveis
      // Se tiver menos valores, repetir o último valor
      const ensureLength = <T>(arr: T[], length: number, defaultValue: T): T[] => {
        const result = [...arr];
        while (result.length < length) {
          result.push(result[result.length - 1] || defaultValue);
        }
        return result;
      };
      
      const valoresAjustados = ensureLength(valores, responsaveis.length, 0);
      const descricoesAjustadas = ensureLength(descricoes, responsaveis.length, '');
      const atividadesAjustadas = ensureLength(atividades, responsaveis.length, '');
      const observacoesAjustadas = ensureLength(observacoes, responsaveis.length, '');
      const apoiosAjustados = ensureLength(apoios, responsaveis.length, '');
      const infoStatusAjustados = ensureLength(infoStatus, responsaveis.length, '');
      const tiposServicoAjustados = ensureLength(tiposServico, responsaveis.length, '');
      const prioridadesAjustadas = ensureLength(prioridades, responsaveis.length, '');
      const pontosEletricosAjustados = ensureLength(pontosEletricos, responsaveis.length, '');
      const tiposSGDAjustados = ensureLength(tiposSGD, responsaveis.length, '');
      const numerosSGDAjustados = ensureLength(numerosSGD, responsaveis.length, '');

      // Buscar equipe conforme configuração do contrato
      let equipe: string | null = null;
      
      if (buscarPorEncarregado) {
        // Modo padrão: buscar equipe pelo encarregado (comportamento de Niterói)
        // Para cada responsável, buscar equipe e criar OS (loop será feito abaixo)
      } else {
        // Modo alternativo: buscar equipe diretamente da planilha
        // Se equipeMapping estiver configurado, usar ele; senão, usar responsavelExecucao
        const equipeMappingToUse = config.equipeMapping || mapping.responsavelExecucao;
        const equipeRaw = getColumnValueByMapping(row, equipeMappingToUse);
        
        if (i < 5) {
          console.log(`🔍 Linha ${i + 2}: Modo DIRETO - Buscando equipe da coluna mapeada | OS="${sobValue}" | equipeMappingToUse:`, equipeMappingToUse);
          console.log(`   - equipeRaw extraído: "${equipeRaw}"`);
        }
        
        if (!equipeRaw) {
          warnings.push(`Linha ${i + 2}: Campo de equipe vazio na planilha (OS ${sobValue})`);
          if (i < 5) {
            console.log(`❌ Linha ${i + 2}: Campo de equipe vazio, pulando linha`);
          }
          continue;
        }
        
        const equipeNomeStr = String(equipeRaw).trim();
        
        // Suporte para múltiplas equipes separadas por / (ex: LMPES-08/CEST-01)
        const equipesNomes = equipeNomeStr.split('/').map(e => e.trim()).filter(e => e);
        
        if (i < 5) {
          console.log(`🔍 Linha ${i + 2}: Equipe(s) extraída(s) da planilha: "${equipeNomeStr}" → [${equipesNomes.join(', ')}]`);
          console.log(`   - Equipes fixas configuradas: ${config.equipesFixas?.length || 0}`);
          if (config.equipesFixas && config.equipesFixas.length > 0) {
            console.log(`   - Lista de equipes fixas:`, config.equipesFixas);
          }
        }
        
        // Array para armazenar todas as equipes válidas encontradas
        const equipesValidas: string[] = [];
        
        // Verificar cada equipe separadamente
        for (const equipeNome of equipesNomes) {
          let equipeEncontrada: string | null = null;
          
          // Verificar se a equipe está na lista de equipes fixas permitidas
          if (config.equipesFixas && config.equipesFixas.length > 0) {
            // Buscar match exato ou parcial (case-insensitive)
            equipeEncontrada = config.equipesFixas.find(eq => {
              const eqNormalizado = eq.trim().toUpperCase();
              const nomeNormalizado = equipeNome.toUpperCase();
              return eqNormalizado === nomeNormalizado || 
                     nomeNormalizado.includes(eqNormalizado) || 
                     eqNormalizado.includes(nomeNormalizado);
            }) || null;

            if (equipeEncontrada) {
              equipesValidas.push(equipeEncontrada);
              if (i < 5) {
                console.log(`✅ Linha ${i + 2}: Equipe encontrada: "${equipeNome}" → "${equipeEncontrada}"`);
              }
            } else {
              warnings.push(`Linha ${i + 2}: Equipe "${equipeNome}" não está na lista de equipes fixas permitidas (OS ${sobValue})`);
              if (i < 5) {
                console.log(`❌ Linha ${i + 2}: Equipe "${equipeNome}" NÃO encontrada na lista de equipes fixas`);
              }
            }
          } else {
            // Se não há lista de equipes fixas, usar o nome da planilha diretamente
            equipesValidas.push(equipeNome);
            if (i < 5) {
              console.log(`⚠️ Linha ${i + 2}: Nenhuma equipe fixa configurada, usando equipe: "${equipeNome}"`);
            }
          }
        }
        
        if (equipesValidas.length === 0) {
          warnings.push(`Linha ${i + 2}: Nenhuma equipe válida encontrada para "${equipeNomeStr}" (OS ${sobValue})`);
          if (i < 5) {
            console.log(`❌ Linha ${i + 2}: Nenhuma equipe válida, pulando linha`);
          }
          continue;
        }
        
        // Extrair campos de localização usando mapeamento (uma vez só)
        const logradouro = mapping.logradouro ? getColumnValueByMapping(row, mapping.logradouro) : undefined;
        const bairro = mapping.bairro ? getColumnValueByMapping(row, mapping.bairro) : undefined;
        const municipio = mapping.municipio ? getColumnValueByMapping(row, mapping.municipio) : undefined;
        const location = [logradouro, bairro, municipio].filter(Boolean).join(', ') || '';
        
        // Extrair status usando mapeamento
        const statusRaw = getColumnValueByMapping(row, mapping.status);
        
        // Extrair campos opcionais usando mapeamento
        const horInicObra = mapping.horInicObra ? getColumnValueByMapping(row, mapping.horInicObra) : undefined;
        const horTermObra = mapping.horTermObra ? getColumnValueByMapping(row, mapping.horTermObra) : undefined;
        const inicDeslig = mapping.inicDeslig ? getColumnValueByMapping(row, mapping.inicDeslig) : undefined;
        const termDeslig = mapping.termDeslig ? getColumnValueByMapping(row, mapping.termDeslig) : undefined;
        const criticoValue = mapping.critico ? getColumnValueByMapping(row, mapping.critico) : undefined;
        const coordenadaValue = mapping.coordenada ? getColumnValueByMapping(row, mapping.coordenada) : undefined;
        const validadeRaw = mapping.validade ? getColumnValueByMapping(row, mapping.validade) : undefined;
        const validadeStr = validadeRaw ? parseDate(validadeRaw as string | number) : undefined;
        
        // Criar uma atividade para CADA equipe válida
        for (let eqIdx = 0; eqIdx < equipesValidas.length; eqIdx++) {
          const equipeAtual = equipesValidas[eqIdx];
          
          // Se há múltiplos valores, usar um para cada equipe; senão, usar o primeiro ou 0
          const valor = valores.length > eqIdx ? valores[eqIdx] : (valores.length > 0 ? valores[0] : 0);
          
          // Usar valores correspondentes ao índice da equipe, ou o primeiro disponível
          const descricao = descricoes.length > eqIdx ? descricoes[eqIdx] : (descricoes.length > 0 ? descricoes[0] : '');
          const atividade = atividades.length > eqIdx ? atividades[eqIdx] : (atividades.length > 0 ? atividades[0] : '');
          const observacao = observacoes.length > eqIdx ? observacoes[eqIdx] : (observacoes.length > 0 ? observacoes[0] : '');
          const apoio = apoios.length > eqIdx ? apoios[eqIdx] : (apoios.length > 0 ? apoios[0] : '');
          const infoStatusValue = infoStatus.length > eqIdx ? infoStatus[eqIdx] : (infoStatus.length > 0 ? infoStatus[0] : '');
          const tipoServicoValue = tiposServico.length > eqIdx ? tiposServico[eqIdx] : (tiposServico.length > 0 ? tiposServico[0] : '');
          const prioridadeValue = prioridades.length > eqIdx ? prioridades[eqIdx] : (prioridades.length > 0 ? prioridades[0] : '');
          const pontoEletricoValue = pontosEletricos.length > eqIdx ? pontosEletricos[eqIdx] : (pontosEletricos.length > 0 ? pontosEletricos[0] : '');
          const tipoSGDValue = tiposSGD.length > eqIdx ? tiposSGD[eqIdx] : (tiposSGD.length > 0 ? tiposSGD[0] : '');
          const numeroSGDValue = numerosSGD.length > eqIdx ? numerosSGD[eqIdx] : (numerosSGD.length > 0 ? numerosSGD[0] : '');

          // Criar atividade com os valores
          const novaAtividade = {
            date: dateStr,
            team: equipeAtual,
            osNumber: String(sobValue) || '',
            value: valor,
            status: mapStatus(statusRaw ? String(statusRaw) : undefined, config.statusMapping),
            location,
            notes: descricao,
            statusNotes: infoStatusValue,
            // Campos adicionais
            tipoServico: tipoServicoValue,
            prioridade: prioridadeValue,
            horarioInicio: convertExcelTimeToHour(horInicObra),
            horarioFim: convertExcelTimeToHour(horTermObra),
            // Novos campos
            atividade: atividade,
            pontoEletrico: pontoEletricoValue,
            inicioIntervencao: convertExcelTimeToHour(inicDeslig),
            terminoIntervencao: convertExcelTimeToHour(termDeslig),
            tipoSGD: tipoSGDValue,
            numeroSGD: numeroSGDValue,
            obs: observacao,
            apoio: apoio,
            critico: criticoValue ? String(criticoValue).trim().toUpperCase() : '',
            coordenada: String(coordenadaValue || ''),
            validade: validadeStr || undefined,
          };
          
          activitiesToCreate.push(novaAtividade);
          
          if (i < 5) {
            console.log(`✅ Linha ${i + 2}: Atividade criada para OS "${sobValue}" | Equipe="${equipeAtual}" (${eqIdx + 1}/${equipesValidas.length}) | Data="${dateStr}" | Valor=${valor}`);
          }
          
          // Debug: mostrar TODAS as linhas com valor em CRITICO
          if (criticoValue) {
            console.log(`🔴 CRITICO na linha ${i + 2}: OS="${sobValue}" | Equipe="${equipeAtual}" | CRITICO="${criticoValue}" | Normalizado="${String(criticoValue).trim().toUpperCase()}"`);
          }
        }
        
        // Pular o loop de responsáveis quando buscar equipe diretamente
        continue;
      }

      // Para cada responsável (quando buscar por encarregado), criar OS
      for (let j = 0; j < responsaveis.length; j++) {
        const responsavel = responsaveis[j];
        const valor = valoresAjustados[j];
        
        // Buscar equipe para cada responsável
        equipe = await findEquipeByEncarregado(responsavel, contratoId);
        
        // Debug: mostrar primeiras 5 tentativas de busca de equipe
        if (i < 5 && j === 0) {
          console.log(`🔍 Linha ${i + 2}: Buscando equipe por encarregado "${responsavel}" | ContratoId: ${contratoId || 'não especificado'} | Equipe encontrada: ${equipe || 'NÃO ENCONTRADA'}`);
        }
        
        if (!equipe) {
          warnings.push(`Linha ${i + 2}: Equipe não encontrada para encarregado "${responsavel}" (OS ${sobValue})`);
          continue;
        }

        // Extrair campos de localização usando mapeamento
        const logradouro = mapping.logradouro ? getColumnValueByMapping(row, mapping.logradouro) : undefined;
        const bairro = mapping.bairro ? getColumnValueByMapping(row, mapping.bairro) : undefined;
        const municipio = mapping.municipio ? getColumnValueByMapping(row, mapping.municipio) : undefined;
        const location = [logradouro, bairro, municipio].filter(Boolean).join(', ') || '';
        
        // Extrair status usando mapeamento
        const statusRaw = getColumnValueByMapping(row, mapping.status);
        
        // Extrair campos opcionais usando mapeamento
        const horInicObra = mapping.horInicObra ? getColumnValueByMapping(row, mapping.horInicObra) : undefined;
        const horTermObra = mapping.horTermObra ? getColumnValueByMapping(row, mapping.horTermObra) : undefined;
        const inicDeslig = mapping.inicDeslig ? getColumnValueByMapping(row, mapping.inicDeslig) : undefined;
        const termDeslig = mapping.termDeslig ? getColumnValueByMapping(row, mapping.termDeslig) : undefined;
        const criticoValue = mapping.critico ? getColumnValueByMapping(row, mapping.critico) : undefined;
        const coordenadaValue = mapping.coordenada ? getColumnValueByMapping(row, mapping.coordenada) : undefined;
        const validadeRaw = mapping.validade ? getColumnValueByMapping(row, mapping.validade) : undefined;
        const validadeStr = validadeRaw ? parseDate(validadeRaw as string | number) : undefined;

        // Criar atividade com os valores correspondentes a cada equipe
        activitiesToCreate.push({
          date: dateStr,
          team: equipe,
          osNumber: String(sobValue) || '',
          value: valor,
          status: mapStatus(statusRaw ? String(statusRaw) : undefined, config.statusMapping),
          location,
          notes: descricoesAjustadas[j],
          statusNotes: infoStatusAjustados[j],
          // Campos adicionais
          tipoServico: tiposServicoAjustados[j],
          prioridade: prioridadesAjustadas[j],
          horarioInicio: convertExcelTimeToHour(horInicObra),
          horarioFim: convertExcelTimeToHour(horTermObra),
          // Novos campos
          atividade: atividadesAjustadas[j],
          pontoEletrico: pontosEletricosAjustados[j],
          inicioIntervencao: convertExcelTimeToHour(inicDeslig),
          terminoIntervencao: convertExcelTimeToHour(termDeslig),
          tipoSGD: tiposSGDAjustados[j],
          numeroSGD: numerosSGDAjustados[j],
          obs: observacoesAjustadas[j],
          apoio: apoiosAjustados[j],
          critico: criticoValue ? String(criticoValue).trim().toUpperCase() : '',
          coordenada: String(coordenadaValue || ''),
          validade: validadeStr || undefined,
        });
        
        // Debug: mostrar TODAS as linhas com valor em CRITICO
        if (criticoValue) {
          console.log(`🔴 CRITICO na linha ${i + 2}: OS="${sobValue}" | Equipe="${equipe}" | CRITICO="${criticoValue}" | Normalizado="${String(criticoValue).trim().toUpperCase()}"`);
        }
      }
    }

    console.log(`⏱️ Processamento de linhas: ${Date.now() - processStart}ms`);
    
    // Contar OS críticas e com coordenadas
    const osCriticas = activitiesToCreate.filter(a => a.critico?.toUpperCase() === 'SIM').length;
    const osComCoordenadas = activitiesToCreate.filter(a => a.coordenada && a.coordenada.trim() !== '').length;
    
    console.log(`\n📊 Resumo do processamento:`);
    console.log(`   - Total original: ${rowsRaw.length} linhas`);
    console.log(`   - Filtradas ANTES (status/data): ${rowsRaw.length - rows.length} linhas`);
    console.log(`   - Processadas: ${rows.length} linhas`);
    console.log(`   - Atividades criadas: ${activitiesToCreate.length}`);
    console.log(`   - 🔴 OS Críticas: ${osCriticas}`);
    console.log(`   - 🌍 OS com Coordenadas: ${osComCoordenadas}`);
    console.log(`   - Avisos: ${warnings.length}`);
    console.log(`   - Erros: ${errors.length}`);
    
    // Mostrar resumo dos tipos de avisos
    if (warnings.length > 0) {
      const avisosSemResponsavel = warnings.filter(w => w.includes('Sem responsável')).length;
      const avisosSemEquipe = warnings.filter(w => w.includes('Equipe não encontrada')).length;
      const avisosOutros = warnings.length - avisosSemResponsavel - avisosSemEquipe;
      
      console.log(`\n📋 Resumo dos avisos:`);
      console.log(`   - Sem responsável: ${avisosSemResponsavel}`);
      console.log(`   - Equipe não encontrada: ${avisosSemEquipe}`);
      console.log(`   - Outros: ${avisosOutros}`);
      
      // Mostrar primeiros 10 avisos como exemplo
      if (warnings.length > 0) {
        console.log(`\n📋 Primeiros 10 avisos (exemplo):`);
        warnings.slice(0, 10).forEach(w => console.log(`   - ${w}`));
      }
    }

    // Agrupar por data para criar schedules
    const activitiesByDate: Record<string, ActivityToCreate[]> = {};
    activitiesToCreate.forEach(activity => {
      if (!activitiesByDate[activity.date]) {
        activitiesByDate[activity.date] = [];
      }
      activitiesByDate[activity.date].push(activity);
    });

    let totalCreated = 0;
    const dates = Object.keys(activitiesByDate);

    console.log(`\n💾 ${modoHistorico ? 'Adicionando' : 'Substituindo'} atividades no banco...`);
    console.log(`   - Datas únicas: ${dates.length}`);

    // LIMPAR apenas as atividades do CONTRATO ATUAL a partir de outubro/2025 (substituição completa)
    // MODO HISTÓRICO: NÃO apagar nada, apenas adicionar
    if (!modoHistorico) {
      const deleteStart = Date.now();
      console.log(`\n🗑️ Limpando atividades do contrato "${config.contratoNome}" (ID: ${contratoId || 'NULL'}) a partir de 2026-01-01...`);
      
      // Buscar todos os schedules >= 2026-01-01
      const { data: schedulesToDelete, error: scheduleSearchError } = await supabaseAdmin
        .from('network_maintenance_schedules')
        .select('id')
        .gte('date', '2026-01-01');
    
    if (scheduleSearchError) {
      console.error(`❌ Erro ao buscar schedules: ${scheduleSearchError.message}`);
      errors.push(`Erro ao buscar schedules para limpeza: ${scheduleSearchError.message}`);
      return {
        success: false,
        totalRows: rowsRaw.length,
        totalFiltered: rowsRaw.length - rows.length,
        totalProcessed: rows.length,
        totalCreated: 0,
        errors,
        warnings,
        contratoNome: config.contratoNome,
      };
    }

      if (schedulesToDelete && schedulesToDelete.length > 0) {
        const scheduleIds = schedulesToDelete.map(s => s.id);
        
        console.log(`🗑️ Removendo atividades do contrato "${config.contratoNome}" de ${scheduleIds.length} schedules...`);
        
        // Deletar APENAS as atividades do CONTRATO ATUAL dos schedules >= 2026-01-01
        // IMPORTANTE: Filtrar por contrato_id para não deletar atividades de outros contratos
        // IMPORTANTE: NÃO deletar atividades históricas (is_historico = true)
        let deleteQuery = supabaseAdmin
          .from('network_maintenance_activities')
          .delete()
          .in('schedule_id', scheduleIds)
          .neq('is_historico', true); // PROTEGER ATIVIDADES HISTÓRICAS
        
        // Se há contrato_id, filtrar apenas atividades desse contrato
        if (contratoId) {
          deleteQuery = deleteQuery.eq('contrato_id', contratoId);
          console.log(`   - Filtrando por contrato_id: ${contratoId}`);
        } else {
          // Se não há contrato_id, deletar apenas atividades sem contrato (NULL)
          deleteQuery = deleteQuery.is('contrato_id', null);
          console.log(`   - Filtrando por contrato_id IS NULL (atividades sem contrato)`);
        }
        
        console.log(`   - ⚠️ PROTEGENDO atividades históricas (is_historico = true)`);
        
        const { error: deleteError } = await deleteQuery;
        
        if (deleteError) {
          console.error(`❌ Erro ao limpar atividades existentes: ${deleteError.message}`);
          errors.push(`Erro ao limpar dados antigos: ${deleteError.message}`);
          return {
            success: false,
            totalRows: rowsRaw.length,
            totalFiltered: rowsRaw.length - rows.length,
            totalProcessed: rows.length,
            totalCreated: 0,
            errors,
            warnings,
            contratoNome: config.contratoNome,
          };
        }
        
        console.log(`✅ Atividades antigas do contrato "${config.contratoNome}" removidas de ${scheduleIds.length} schedules`);
        console.log(`⏱️ Limpeza: ${Date.now() - deleteStart}ms`);
      } else {
        console.log(`ℹ️ Nenhum schedule existente >= 2026-01-01`);
      }
    } else {
      console.log(`📜 MODO HISTÓRICO: Pulando limpeza de dados (apenas adicionando novos registros)`);
    }

    // OTIMIZAÇÃO: Criar todos os schedules em lote
    console.log(`\n📋 Criando schedules para ${dates.length} datas em lote...`);
    
    const schedulesToCreate = dates.map(date => {
      const dateObj = new Date(date);
      return {
        date: date,
        day_of_week: dateObj.getDay()
      };
    });

    // Inserir schedules com UPSERT (sem ignorar duplicatas para retornar os registros)
    const { data: upsertedSchedules, error: schedulesError } = await supabaseAdmin
      .from('network_maintenance_schedules')
      .upsert(schedulesToCreate, { 
        onConflict: 'date',
        ignoreDuplicates: false 
      })
      .select('id, date');

    if (schedulesError) {
      console.error(`❌ Erro ao criar schedules: ${schedulesError.message}`);
      errors.push(`Erro ao criar schedules: ${schedulesError.message}`);
      return {
        success: false,
        totalRows: rowsRaw.length,
        totalFiltered: rowsRaw.length - rows.length,
        totalProcessed: rows.length,
        totalCreated: 0,
        errors,
        warnings,
        contratoNome: config.contratoNome,
      };
    }

    console.log(`✅ ${upsertedSchedules?.length || 0} schedules retornados pelo UPSERT`);

    // Buscar TODOS os schedules das datas (garantir que temos todos)
    const { data: schedules, error: fetchError } = await supabaseAdmin
      .from('network_maintenance_schedules')
      .select('id, date')
      .in('date', dates);

    if (fetchError) {
      console.error(`❌ Erro ao buscar schedules: ${fetchError.message}`);
      errors.push(`Erro ao buscar schedules: ${fetchError.message}`);
      return {
        success: false,
        totalRows: rowsRaw.length,
        totalFiltered: rowsRaw.length - rows.length,
        totalProcessed: rows.length,
        totalCreated: 0,
        errors,
        warnings,
        contratoNome: config.contratoNome,
      };
    }

    console.log(`✅ ${schedules.length} schedules encontrados no total`);

    // Criar mapa de schedule_id por data
    const scheduleMap = new Map();
    schedules.forEach(schedule => {
      scheduleMap.set(schedule.date, schedule.id);
    });

    // OTIMIZAÇÃO: Inserir todas as atividades em uma única operação
    console.log(`\n🚀 Inserindo todas as ${activitiesToCreate.length} atividades em lote...`);
    console.log(`📋 Contrato ID que será usado: ${contratoId || 'NULL (sem contrato)'} para "${config.contratoNome}"`);
    const insertStart = Date.now();
    
    // Marcar atividades antes de 2026-01-01 como históricas
    const dataLimiteHistorico = new Date('2026-01-01');
    
    let allActivitiesData = activitiesToCreate.map(activity => {
      const dataAtividade = new Date(activity.date);
      const isHistorico = modoHistorico && dataAtividade < dataLimiteHistorico;
      
      return {
        schedule_id: scheduleMap.get(activity.date),
        team: activity.team,
        os_number: activity.osNumber,
        value: activity.value,
        status: activity.status,
        location: activity.location,
        notes: activity.notes,
        status_notes: activity.statusNotes,
        contrato_id: contratoId || null, // SEMPRE usar o contrato da configuração selecionada
        prioridade: activity.prioridade,
        atividade: activity.atividade,
        ponto_eletrico: activity.pontoEletrico,
        inicio_intervencao: activity.inicioIntervencao,
        termino_intervencao: activity.terminoIntervencao,
        tipo_sgd: activity.tipoSGD,
        numero_sgd: activity.numeroSGD,
        obs: activity.obs,
        apoio: activity.apoio,
        critico: activity.critico,
        coordenada: activity.coordenada,
        validade: activity.validade,
        is_historico: isHistorico, // Marcar como histórico se antes de 2026
      };
    });

    // PROTEÇÃO EXTRA: na sincronização normal, não inserir registros que conflitam com atividades históricas já existentes
    // (evita duplicar OS/equipe/dia e aparentar que "zerou" notas/valores no dashboard)
    if (!modoHistorico) {
      const scheduleIdsInInsert = Array.from(
        new Set(allActivitiesData.map(a => a.schedule_id).filter(Boolean))
      ) as string[];

      if (scheduleIdsInInsert.length > 0) {
        let historicoQuery = supabaseAdmin
          .from('network_maintenance_activities')
          .select('schedule_id, team, os_number')
          .in('schedule_id', scheduleIdsInInsert)
          .eq('is_historico', true);

        if (contratoId) {
          historicoQuery = historicoQuery.eq('contrato_id', contratoId);
        }

        const { data: historicosExistentes, error: historicoError } = await historicoQuery;

        if (historicoError) {
          console.warn(`⚠️ Erro ao buscar atividades históricas existentes (proteção extra): ${historicoError.message}`);
        } else if (historicosExistentes && historicosExistentes.length > 0) {
          const historicoKeys = new Set(
            historicosExistentes.map(h => `${h.schedule_id}|${h.team}|${h.os_number}`)
          );

          const beforeFilter = allActivitiesData.length;
          allActivitiesData = allActivitiesData.filter(a => {
            const key = `${a.schedule_id}|${a.team}|${a.os_number}`;
            return !historicoKeys.has(key);
          });

          const skipped = beforeFilter - allActivitiesData.length;
          if (skipped > 0) {
            console.log(`🛡️ Proteção histórico: pulando ${skipped} atividades que já existem como is_historico=true`);
          }
        }
      }
    }
    
    // Log de quantas atividades históricas serão importadas
    const totalHistoricas = allActivitiesData.filter(a => a.is_historico).length;
    if (totalHistoricas > 0) {
      console.log(`📜 ${totalHistoricas} atividades serão marcadas como históricas (antes de 2026-01-01)`);
    }

    const { error: insertError, data: inserted } = await supabaseAdmin
      .from('network_maintenance_activities')
      .insert(allActivitiesData)
      .select('id');

    if (insertError) {
      console.error(`❌ Erro ao inserir atividades: ${insertError.message}`);
      errors.push(`Erro ao inserir atividades: ${insertError.message}`);
    } else {
      totalCreated = inserted?.length || allActivitiesData.length;
      console.log(`✅ ${totalCreated} atividades inseridas em lote`);
    }
    
    console.log(`⏱️ Inserção no banco: ${Date.now() - insertStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ TEMPO TOTAL: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`✅ Sincronização concluída para ${config.contratoNome}: ${totalCreated} atividades substituídas`);

    return {
      success: true,
      totalRows: rowsRaw.length,
      totalFiltered: rowsRaw.length - rows.length,
      totalProcessed: rows.length,
      totalCreated,
      errors,
      warnings,
      contratoNome: config.contratoNome,
    };

  } catch (error) {
    console.error(`❌ Erro na sincronização para ${config.contratoNome}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    errors.push(`Erro ao sincronizar: ${errorMessage}`);
    return {
      success: false,
      totalRows: 0,
      totalFiltered: 0,
      totalProcessed: 0,
      totalCreated: 0,
      errors,
      warnings,
      contratoNome: config.contratoNome,
    };
  }
}

/**
 * Rota POST principal - processa um ou todos os contratos
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verificar se foi especificado um contrato específico
    const { searchParams } = new URL(req.url);
    const contratoNome = searchParams.get('contrato');
    const modoHistorico = searchParams.get('modo') === 'historico';
    
    if (modoHistorico) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📜 MODO HISTÓRICO ATIVADO`);
      console.log(`${'='.repeat(60)}`);
    }
    
    let contratosParaProcessar: ContratoSharePointConfig[] = [];
    
    if (contratoNome) {
      // Processar apenas o contrato especificado - buscar do banco primeiro
      const config = await loadContratoConfigFromDB(contratoNome);
      if (!config) {
        return NextResponse.json({
          error: `Contrato "${contratoNome}" não encontrado`,
          contratosDisponiveis: Object.keys(CONTRATOS_CONFIG),
        }, { status: 400 });
      }
      contratosParaProcessar = [config];
    } else {
      // Processar todos os contratos configurados - buscar do banco primeiro
      contratosParaProcessar = await loadAllContratosConfigFromDB();
    }
    
    if (contratosParaProcessar.length === 0) {
      return NextResponse.json({
        error: 'Nenhum contrato configurado',
      }, { status: 400 });
    }
    
    console.log(`🚀 Iniciando sincronização para ${contratosParaProcessar.length} contrato(s)...`);
    
    // Processar cada contrato
    const resultados = await Promise.all(
      contratosParaProcessar.map(config => processContrato(config, modoHistorico))
    );
    
    // Consolidar resultados
    const totalRows = resultados.reduce((sum, r) => sum + r.totalRows, 0);
    const totalFiltered = resultados.reduce((sum, r) => sum + r.totalFiltered, 0);
    const totalProcessed = resultados.reduce((sum, r) => sum + r.totalProcessed, 0);
    const totalCreated = resultados.reduce((sum, r) => sum + r.totalCreated, 0);
    const allErrors = resultados.flatMap(r => r.errors);
    const allWarnings = resultados.flatMap(r => r.warnings);
    const success = resultados.every(r => r.success);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`\n📊 RESUMO GERAL:`);
    console.log(`   - Contratos processados: ${contratosParaProcessar.length}`);
    console.log(`   - Total de linhas: ${totalRows}`);
    console.log(`   - Total filtradas: ${totalFiltered}`);
    console.log(`   - Total processadas: ${totalProcessed}`);
    console.log(`   - Total criadas: ${totalCreated}`);
    console.log(`   - Erros: ${allErrors.length}`);
    console.log(`   - Avisos: ${allWarnings.length}`);
    console.log(`   - Tempo total: ${(totalTime / 1000).toFixed(2)}s`);
    
    return NextResponse.json({
      success,
      contratos: resultados.map(r => ({
        contrato: r.contratoNome,
        totalRows: r.totalRows,
        totalFiltered: r.totalFiltered,
        totalProcessed: r.totalProcessed,
        totalCreated: r.totalCreated,
        success: r.success,
      })),
      totalRows,
      totalFiltered,
      totalProcessed,
      totalCreated,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings.slice(0, 50) : undefined, // Limitar avisos
      message: `✅ Sincronização concluída: ${totalCreated} OSs importadas de ${contratosParaProcessar.length} contrato(s) em ${(totalTime / 1000).toFixed(1)}s`,
      performanceMs: totalTime
    });

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({
      error: 'Erro ao sincronizar com SharePoint',
      details: errorMessage
    }, { status: 500 });
  }
}

// GET para testar a conexão e listar contratos configurados
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contratoNome = searchParams.get('contrato');
    
    if (contratoNome) {
      // Testar conexão de um contrato específico - buscar do banco primeiro
      const config = await loadContratoConfigFromDB(contratoNome);
      if (!config) {
        return NextResponse.json({
          status: 'error',
          error: `Contrato "${contratoNome}" não encontrado`,
          contratosDisponiveis: Object.keys(CONTRATOS_CONFIG),
        }, { status: 400 });
      }
      
      if (!config.sharePointUrl) {
        return NextResponse.json({
          status: 'error',
          error: `URL do SharePoint não configurada para o contrato ${contratoNome}`,
        }, { status: 400 });
      }
      
      const response = await fetch(config.sharePointUrl, {
      method: 'HEAD',
      cache: 'no-store',
    });

    return NextResponse.json({
      status: 'ok',
        contrato: contratoNome,
      sharePointAccessible: response.ok,
      statusCode: response.status,
      contentType: response.headers.get('content-type'),
        url: config.sharePointUrl.substring(0, 80) + '...',
      });
    } else {
      // Listar todos os contratos configurados - buscar do banco primeiro
      const contratos = await loadAllContratosConfigFromDB();
      return NextResponse.json({
        status: 'ok',
        contratos: contratos.map(c => ({
          nome: c.contratoNome,
          urlConfigurada: !!c.sharePointUrl,
          url: c.sharePointUrl ? c.sharePointUrl.substring(0, 80) + '...' : null,
        })),
        total: contratos.length,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({
      status: 'error',
      message: errorMessage
    }, { status: 500 });
  }
}


