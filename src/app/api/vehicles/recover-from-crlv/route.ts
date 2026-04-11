import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
}

// Extrair texto de um PDF usando pdfjs-dist
async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;

  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      const str = (item as { str?: string }).str?.trim();
      if (str && str.length > 0) {
        lines.push(str);
      }
    }
  }

  return lines;
}

// Parsear dados do CRLV digital a partir das linhas de texto extraídas
// Layout real do CRLV digital (baseado no exemplo fornecido):
//   RENAVAM (11 dígitos)
//   PLACA EXERCÍCIO
//   ANO_FAB ANO_MODELO
//   NÚMERO DO CRV (12 dígitos)
//   ... (código segurança, etc)
//   MARCA / MODELO / VERSÃO
//   ESPÉCIE TIPO
//   PLACA_ANTERIOR/UF CHASSI
//   COR COMBUSTÍVEL
function parseCrlvData(lines: string[]): {
  placa: string | null;
  renavam: string | null;
  numero_crlv: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  modelo: string | null;
  chassi: string | null;
  tipo_combustivel: string | null;
  tipo_veiculo: string | null;
  marca_equipamento: string | null;
  versao: string | null;
  cor: string | null;
  especie: string | null;
  raw_text: string;
} {
  const result = {
    placa: null as string | null,
    renavam: null as string | null,
    numero_crlv: null as string | null,
    ano_fabricacao: null as number | null,
    ano_modelo: null as number | null,
    modelo: null as string | null,
    chassi: null as string | null,
    tipo_combustivel: null as string | null,
    tipo_veiculo: null as string | null,
    marca_equipamento: null as string | null,
    versao: null as string | null,
    cor: null as string | null,
    especie: null as string | null,
    raw_text: lines.join('\n'),
  };

  const fullText = lines.join(' ');

  // RENAVAM - 11 dígitos
  const renavamMatch = fullText.match(/\b(\d{11})\b/);
  if (renavamMatch) {
    result.renavam = renavamMatch[1];
  }

  // PLACA - formato Mercosul (ABC1D23) ou antigo (ABC1234 / ABC-1234)
  const placaMatch = fullText.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i)
    || fullText.match(/\b([A-Z]{3}-?\d{4})\b/i);
  if (placaMatch) {
    result.placa = placaMatch[1].replace('-', '').toUpperCase();
  }

  // ANO FABRICAÇÃO / ANO MODELO - dois anos de 4 dígitos consecutivos (20XX 20XX)
  // Procurar padrão de dois anos próximos no texto
  const anosMatch = fullText.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  if (anosMatch) {
    const ano1 = parseInt(anosMatch[1]);
    const ano2 = parseInt(anosMatch[2]);
    // O menor é fabricação, o maior é modelo (ou iguais)
    if (ano1 >= 1900 && ano1 <= 2030 && ano2 >= 1900 && ano2 <= 2030) {
      result.ano_fabricacao = Math.min(ano1, ano2);
      result.ano_modelo = Math.max(ano1, ano2);
    }
  }

  // NÚMERO DO CRV - geralmente 12 dígitos, aparece após os anos
  const crvMatch = fullText.match(/\b(\d{12})\b/);
  if (crvMatch) {
    result.numero_crlv = crvMatch[1];
  }

  // CHASSI - 17 caracteres alfanuméricos (padrão VIN), pode ter *******/** antes
  const chassiMatch = fullText.match(/\*+\/?\*+\s+([A-Z0-9]{17})\b/i)
    || fullText.match(/\b([A-Z0-9]{17})\b/);
  if (chassiMatch) {
    // Validar que parece um chassi (não é só números)
    const possibleChassi = chassiMatch[1];
    if (/[A-Z]/i.test(possibleChassi) && /\d/.test(possibleChassi)) {
      result.chassi = possibleChassi.toUpperCase();
    }
  }

  // MARCA / MODELO / VERSÃO - linha que contém "/" e está após o CRV
  // Exemplo: "VW/17.190 CRM 4X2 ROB"
  for (const line of lines) {
    if (line.includes('/') && /[A-Z]{2,}\//.test(line) && !line.includes('CPF') && !line.includes('CNPJ') && !line.includes('http')) {
      // Parece ser marca/modelo/versão
      const parts = line.split('/');
      if (parts.length >= 2) {
        result.marca_equipamento = parts[0].trim();
        const modeloVersao = parts.slice(1).join('/').trim();
        result.modelo = modeloVersao;
        // Tentar separar versão se houver espaços
        const modeloParts = modeloVersao.split(/\s+/);
        if (modeloParts.length > 1) {
          result.modelo = line.trim(); // Guardar tudo como modelo completo
          result.versao = modeloParts.slice(1).join(' ');
        }
        break;
      }
    }
  }

  // COMBUSTÍVEL - palavras-chave conhecidas
  const combustiveis = ['GASOLINA', 'DIESEL', 'ETANOL', 'FLEX', 'GNV', 'ELETRICO', 'HIBRIDO', 'ALCOOL'];
  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    for (const comb of combustiveis) {
      if (upper === comb || upper.includes(comb)) {
        result.tipo_combustivel = comb;
        break;
      }
    }
    if (result.tipo_combustivel) break;
  }

  // TIPO VEÍCULO - palavras-chave
  const tipos = ['CAMINHAO', 'CAMINHÃO', 'CAMIONETA', 'AUTOMOVEL', 'AUTOMÓVEL', 'MOTOCICLETA', 'ONIBUS', 'ÔNIBUS', 'REBOQUE', 'UTILITARIO', 'UTILITÁRIO', 'MICROONIBUS'];
  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    for (const tipo of tipos) {
      if (upper.includes(tipo)) {
        result.tipo_veiculo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        break;
      }
    }
    if (result.tipo_veiculo) break;
  }

  // ESPÉCIE - ESPECIAL, PARTICULAR, OFICIAL, etc
  const especies = ['ESPECIAL', 'PARTICULAR', 'OFICIAL', 'ALUGUEL', 'APRENDIZAGEM'];
  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    for (const esp of especies) {
      if (upper === esp || upper.startsWith(esp)) {
        result.especie = esp;
        break;
      }
    }
    if (result.especie) break;
  }

  // COR
  const cores = ['BRANCA', 'PRETA', 'CINZA', 'PRATA', 'VERMELHA', 'AZUL', 'VERDE', 'AMARELA', 'MARROM', 'BEGE', 'DOURADA', 'VINHO', 'LARANJA', 'ROSA', 'FANTASIA'];
  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    for (const cor of cores) {
      if (upper === cor || upper.startsWith(cor)) {
        result.cor = cor;
        break;
      }
    }
    if (result.cor) break;
  }

  return result;
}

// GET - Modo dry-run: lista documentos CRLV e tenta extrair dados sem inserir
// POST - Executa a recuperação: extrai dados e insere na tabela veiculos
export async function GET() {
  try {
    console.log('🔍 [RECOVER] Buscando documentos CRLV na tabela documentos_veiculo...');

    // 1. Buscar todos os documentos CRLV
    const { data: documentos, error: docError } = await getSupabaseAdmin()
      .from('documentos_veiculo')
      .select('id, veiculo_id, tipo_documento, url_arquivo, expira_em')
      .eq('tipo_documento', 'crlv')
      .not('url_arquivo', 'is', null)
      .not('veiculo_id', 'is', null);

    if (docError) {
      console.error('❌ Erro ao buscar documentos:', docError);
      return NextResponse.json({ error: 'Erro ao buscar documentos', details: docError }, { status: 500 });
    }

    if (!documentos || documentos.length === 0) {
      return NextResponse.json({ message: 'Nenhum documento CRLV encontrado', documentos: [] });
    }

    // 2. Pegar UUIDs únicos (pode haver mais de um CRLV por veículo, pegar o mais recente)
    const veiculoMap = new Map<string, typeof documentos[0]>();
    for (const doc of documentos) {
      if (!veiculoMap.has(doc.veiculo_id)) {
        veiculoMap.set(doc.veiculo_id, doc);
      }
    }

    // 3. Verificar quais veículos já existem na tabela veiculos
    const veiculoIds = Array.from(veiculoMap.keys());
    const { data: existingVeiculos } = await getSupabaseAdmin()
      .from('veiculos')
      .select('id')
      .in('id', veiculoIds);

    const existingIds = new Set((existingVeiculos || []).map(v => v.id));

    // 4. Filtrar apenas os que NÃO existem
    const missingIds = veiculoIds.filter(id => !existingIds.has(id));

    console.log(`📊 Total CRLVs: ${documentos.length}, UUIDs únicos: ${veiculoIds.length}, Já existem: ${existingIds.size}, Faltam: ${missingIds.length}`);

    // 5. Para cada veículo faltante, tentar extrair dados do PDF
    const results = [];
    for (const veiculoId of missingIds) {
      const doc = veiculoMap.get(veiculoId)!;
      let extractedData = null;
      let error = null;

      try {
        // Baixar o PDF
        const pdfResponse = await fetch(doc.url_arquivo);
        if (!pdfResponse.ok) {
          error = `Erro ao baixar PDF: ${pdfResponse.status} ${pdfResponse.statusText}`;
        } else {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          const lines = await extractTextFromPdf(pdfBuffer);
          extractedData = parseCrlvData(lines);
        }
      } catch (e) {
        error = `Erro ao processar PDF: ${e instanceof Error ? e.message : String(e)}`;
      }

      results.push({
        veiculo_id: veiculoId,
        documento_id: doc.id,
        url_arquivo: doc.url_arquivo,
        expira_em: doc.expira_em,
        extracted: extractedData,
        error,
      });
    }

    return NextResponse.json({
      summary: {
        total_crlvs: documentos.length,
        uuids_unicos: veiculoIds.length,
        ja_existem: existingIds.size,
        faltam_recuperar: missingIds.length,
      },
      results,
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    // Permite filtrar por veículo_ids específicos
    const filterIds: string[] | null = body.veiculo_ids || null;

    console.log(`🔄 [RECOVER] Iniciando recuperação de veículos... (dryRun: ${dryRun})`);

    // 1. Buscar documentos CRLV
    const { data: documentos, error: docError } = await getSupabaseAdmin()
      .from('documentos_veiculo')
      .select('id, veiculo_id, tipo_documento, url_arquivo, expira_em')
      .eq('tipo_documento', 'crlv')
      .not('url_arquivo', 'is', null)
      .not('veiculo_id', 'is', null);

    if (docError) {
      return NextResponse.json({ error: 'Erro ao buscar documentos', details: docError }, { status: 500 });
    }

    if (!documentos || documentos.length === 0) {
      return NextResponse.json({ message: 'Nenhum documento CRLV encontrado' });
    }

    // 2. Mapa de veículo_id -> documento mais recente
    const veiculoMap = new Map<string, typeof documentos[0]>();
    for (const doc of documentos) {
      if (!veiculoMap.has(doc.veiculo_id)) {
        veiculoMap.set(doc.veiculo_id, doc);
      }
    }

    // 3. Verificar quais já existem
    const veiculoIds = filterIds || Array.from(veiculoMap.keys());
    const { data: existingVeiculos } = await getSupabaseAdmin()
      .from('veiculos')
      .select('id')
      .in('id', veiculoIds);

    const existingIds = new Set((existingVeiculos || []).map(v => v.id));
    const missingIds = veiculoIds.filter(id => !existingIds.has(id) && veiculoMap.has(id));

    console.log(`📊 Faltam recuperar: ${missingIds.length} veículos`);

    // 4. Processar cada veículo
    const inserted: Array<{ veiculo_id: string; placa: string | null; status: string }> = [];
    const errors: Array<{ veiculo_id: string; error: string; extracted?: unknown }> = [];
    const previews: Array<{ veiculo_id: string; data: unknown }> = [];

    for (const veiculoId of missingIds) {
      const doc = veiculoMap.get(veiculoId)!;

      try {
        // Baixar PDF
        const pdfResponse = await fetch(doc.url_arquivo);
        if (!pdfResponse.ok) {
          errors.push({ veiculo_id: veiculoId, error: `Erro ao baixar PDF: ${pdfResponse.status}` });
          continue;
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        const lines = await extractTextFromPdf(pdfBuffer);
        const data = parseCrlvData(lines);

        // Validar dados mínimos obrigatórios
        if (!data.placa) {
          errors.push({
            veiculo_id: veiculoId,
            error: 'Não foi possível extrair a placa do CRLV',
            extracted: { ...data, raw_text: data.raw_text.substring(0, 500) }
          });
          continue;
        }

        // Montar registro do veículo
        const veiculoRecord = {
          id: veiculoId,
          placa: data.placa,
          renavam: data.renavam || 'RECUPERAR',
          chassis: data.chassi || 'RECUPERAR',
          numero_crlv: data.numero_crlv || 'RECUPERAR',
          ano_fabricacao: data.ano_fabricacao || 0,
          ano_modelo: data.ano_modelo || 0,
          modelo: data.modelo || 'RECUPERAR',
          tipo_modelo: data.tipo_veiculo || 'RECUPERAR',
          versao: data.versao || 'RECUPERAR',
          tipo_veiculo: data.tipo_veiculo || 'RECUPERAR',
          marca_equipamento: data.marca_equipamento || 'RECUPERAR',
          tipo_combustivel: data.tipo_combustivel || 'RECUPERAR',
          operacao_combustivel: data.tipo_combustivel || 'RECUPERAR',
          propriedade: data.especie?.toLowerCase() === 'particular' ? 'proprio' : 'locado',
          condicao: 'bom',
          status: 'disponivel',
          equipamentos: {},
          quilometragem_atual: 0,
          intervalo_preventiva: 10000,
          alerta_preventiva_km: 1000,
        };

        if (dryRun) {
          previews.push({ veiculo_id: veiculoId, data: veiculoRecord });
        } else {
          // Inserir no banco
          const { error: insertError } = await getSupabaseAdmin()
            .from('veiculos')
            .insert(veiculoRecord);

          if (insertError) {
            errors.push({
              veiculo_id: veiculoId,
              error: `Erro ao inserir: ${insertError.message}`,
              extracted: veiculoRecord
            });
          } else {
            inserted.push({ veiculo_id: veiculoId, placa: data.placa, status: 'inserido' });
            console.log(`✅ Veículo ${data.placa} (${veiculoId}) inserido com sucesso`);
          }
        }

      } catch (e) {
        errors.push({
          veiculo_id: veiculoId,
          error: `Erro ao processar: ${e instanceof Error ? e.message : String(e)}`
        });
      }
    }

    const response = {
      dryRun,
      summary: {
        total_crlvs: documentos.length,
        uuids_unicos: veiculoMap.size,
        ja_existem: existingIds.size,
        processados: missingIds.length,
        inseridos: inserted.length,
        erros: errors.length,
        previews: previews.length,
      },
      inserted,
      errors,
      ...(dryRun ? { previews } : {}),
    };

    console.log(`🏁 [RECOVER] Finalizado. Inseridos: ${inserted.length}, Erros: ${errors.length}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
