import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseExcelDate } from '@/utils/excelDateUtils';

// Cliente Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Função para parsear datas (Excel ou string)
function parseDate(value: unknown): Date | null {
  if (!value || value === 'undefined' || value === 'null' || value === '') return null;

  // Se for número (formato Excel)
  if (typeof value === 'number') {
    const date = parseExcelDate(value);
    // Valida adicionalmente se o ano está em um range válido
    if (date) {
      const year = date.getFullYear();
      if (year < 1800 || year > 2100) {
        return null;
      }
    }
    return date;
  }

  // Se for string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Tenta parseamento direto
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      if (year >= 1800 && year <= 2100) {
        return parsed;
      }
      return null;
    }

    // Tenta formato brasileiro DD/MM/AAAA
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      const yearNum = parseInt(year);
      if (yearNum >= 1800 && yearNum <= 2100) {
        return new Date(yearNum, parseInt(month) - 1, parseInt(day));
      }
      return null;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    // Ler arquivo
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Arquivo vazio ou inválido' },
        { status: 400 }
      );
    }

    // Resultados
    const results = {
      atualizados: [] as Array<{ linha: number; matricula: string; nome: string; data_aso: string }>,
      erros: [] as Array<{ linha: number; erro: string; matricula?: string }>,
      total: data.length
    };

    // Processar cada linha
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;

      try {
        // 1. Extrair matrícula (aceita variações de nome de coluna)
        const matricula = String(
          row['matricula'] || row['Matricula'] || row['MATRICULA'] ||
          row['matrícula'] || row['Matrícula'] || row['MATRÍCULA'] ||
          row['Cadastro'] || row['cadastro'] || row['CADASTRO'] || // ENEL
          ''
        ).trim();

        if (!matricula) {
          results.erros.push({
            linha: i + 2, // +2 porque linha 1 é cabeçalho
            erro: 'Matrícula não fornecida'
          });
          continue;
        }

        // 2. Extrair data do ASO (aceita variações)
        const dataAsoRaw = row['data_aso'] || row['Data ASO'] || row['DATA_ASO'] ||
                          row['data_ultimo_exame_aso'] || row['Data Último Exame ASO'] ||
                          row['data_exame'] || row['Data Exame'] ||
                          '';

        const dataAsoParsed = parseDate(dataAsoRaw);

        if (!dataAsoParsed) {
          results.erros.push({
            linha: i + 2,
            erro: 'Data do ASO inválida ou não fornecida',
            matricula
          });
          continue;
        }

        // 3. Buscar usuário pela matrícula
        const { data: usuario, error: usuarioError } = await supabaseAdmin
          .from('usuarios')
          .select('id, nome, matricula')
          .eq('matricula', matricula)
          .single();

        if (usuarioError || !usuario) {
          results.erros.push({
            linha: i + 2,
            erro: `Funcionário com matrícula ${matricula} não encontrado`,
            matricula
          });
          continue;
        }

        // 4. Calcular validade_aso (1 ano após o exame)
        const validadeAso = new Date(dataAsoParsed);
        validadeAso.setFullYear(validadeAso.getFullYear() + 1);

        // 5. Atualizar data_ultimo_exame_aso e validade_aso
        const { error: updateError } = await supabaseAdmin
          .from('usuarios')
          .update({
            data_ultimo_exame_aso: dataAsoParsed.toISOString().split('T')[0],
            validade_aso: validadeAso.toISOString().split('T')[0]
          })
          .eq('id', usuario.id);

        if (updateError) {
          results.erros.push({
            linha: i + 2,
            erro: `Erro ao atualizar: ${updateError.message}`,
            matricula
          });
          continue;
        }

        // Sucesso
        results.atualizados.push({
          linha: i + 2,
          matricula: usuario.matricula,
          nome: usuario.nome,
          data_aso: dataAsoParsed.toISOString().split('T')[0]
        });

      } catch (error) {
        results.erros.push({
          linha: i + 2,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
          matricula: String(row['matricula'] || '')
        });
      }
    }

    // Retornar resultado
    return NextResponse.json({
      success: true,
      message: `Upload concluído: ${results.atualizados.length} ASOs atualizados, ${results.erros.length} erros`,
      results
    });

  } catch (error) {
    console.error('Erro no bulk upload de ASO:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao processar upload',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}



