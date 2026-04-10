import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// ============================================================================
// API PARA DEMISSÃO EM LOTE VIA ARQUIVO XLS
// ============================================================================

interface FuncionarioDemissao {
  matricula: string;
  data_demissao?: string;
  operacao?: string;
  cargo?: string;
  tipo_demissao?: string;
  observacoes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se é um arquivo Excel
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { error: 'Arquivo deve ser um Excel (.xlsx ou .xls)' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Ler arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('📊 Arquivo Excel lido:', {
      nome: file.name,
      tamanho: file.size,
      linhas: data.length,
      colunas: Object.keys(data[0] || {})
    });

    // Validar estrutura do arquivo
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Arquivo está vazio' },
        { status: 400 }
      );
    }

    // Mapear colunas (case insensitive)
    const firstRow = data[0] as Record<string, unknown>;
    const columns = Object.keys(firstRow).reduce((acc, key) => {
      const lowerKey = key.toLowerCase().trim();
      acc[lowerKey] = key;
      return acc;
    }, {} as Record<string, string>);

    console.log('📋 Colunas encontradas:', columns);

    // Verificar se tem matrícula
    if (!columns['matricula'] && !columns['matrícula']) {
      return NextResponse.json(
        { error: 'Arquivo deve conter coluna "matrícula"' },
        { status: 400 }
      );
    }

    // Função para converter data do Excel para formato YYYY-MM-DD
    const convertExcelDate = (excelDate: unknown): string => {
      if (!excelDate) return '';
      
      // Se já é uma string no formato correto
      if (typeof excelDate === 'string') {
        // Verificar se é formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
          return excelDate;
        }
        // Tentar converter string para data
        const date = new Date(excelDate);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return '';
      }
      
      // Se é um número (data serial do Excel)
      if (typeof excelDate === 'number') {
        // Excel conta dias desde 1900-01-01, mas tem um bug: considera 1900 como ano bissexto
        // Então precisamos ajustar para 1899-12-30
        const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
        const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
      }
      
      return '';
    };

    // Processar dados
    const funcionarios: FuncionarioDemissao[] = (data as Record<string, unknown>[]).map((row: Record<string, unknown>) => {
      const matricula = (row[columns['matricula']] || row[columns['matrícula']] || '') as string;
      const data_demissao_raw = (row[columns['data_demissao']] || row[columns['data_demissão']] || '') as string;
      const operacao = (row[columns['operacao']] || row[columns['operação']] || '') as string;
      const cargo = (row[columns['cargo']] || '') as string;
      const tipo_demissao = (row[columns['tipo_demissao']] || row[columns['tipo_demissão']] || 'sem_justa_causa') as string;
      const observacoes = (row[columns['observacoes']] || row[columns['observações']] || '') as string;

      // Converter data do Excel
      const data_demissao = convertExcelDate(data_demissao_raw);
      
      // Log para debug (apenas se houver data)
      if (data_demissao_raw && data_demissao) {
        console.log(`📅 Conversão de data - Matrícula: ${matricula}, Original: ${data_demissao_raw} (${typeof data_demissao_raw}), Convertida: ${data_demissao}`);
      }

      return {
        matricula: matricula.toString().trim(),
        data_demissao: data_demissao,
        operacao: operacao.toString().trim(),
        cargo: cargo.toString().trim(),
        tipo_demissao,
        observacoes: observacoes.toString().trim()
      };
    }).filter(f => f.matricula); // Filtrar linhas sem matrícula

    console.log('👥 Funcionários para demitir:', funcionarios.length);

    // Processar demissões
    const resultados = {
      sucessos: [] as Array<{matricula: string; nome: string; data_demissao: string; operacao?: string; cargo?: string; tipo_demissao: string}>,
      erros: [] as Array<{matricula: string; erro: string; detalhes?: string}>,
      total: funcionarios.length
    };

    for (const funcionario of funcionarios) {
      try {
        console.log(`🔄 Processando demissão: ${funcionario.matricula}`);

        // 1. Buscar usuário pela matrícula
        const { data: usuario, error: usuarioError } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('matricula', funcionario.matricula)
          .eq('status', 'ativo')
          .single();

        if (usuarioError || !usuario) {
          resultados.erros.push({
            matricula: funcionario.matricula,
            erro: 'Usuário não encontrado ou já inativo',
            detalhes: usuarioError?.message
          });
          continue;
        }

        // 2. Verificar inventário
        const { data: inventarioCheck, error: inventarioError } = await supabaseAdmin
          .rpc('verificar_inventario_funcionario', {
            p_usuario_id: usuario.id
          });

        if (inventarioError) {
          resultados.erros.push({
            matricula: funcionario.matricula,
            erro: 'Erro ao verificar inventário',
            detalhes: inventarioError.message
          });
          continue;
        }

        // 3. Se tem itens pendentes, bloquear demissão
        if (inventarioCheck && inventarioCheck.tem_itens) {
          resultados.erros.push({
            matricula: funcionario.matricula,
            erro: 'Demissão bloqueada - possui itens no inventário',
            detalhes: inventarioCheck.mensagem_erro
          });
          continue;
        }

        // 4. Executar demissão
        const data_demissao = funcionario.data_demissao || new Date().toISOString().split('T')[0];
        
        const { data: demissaoResult, error: demissaoError } = await supabaseAdmin
          .rpc('demitir_funcionario_com_validacao', {
            p_usuario_id: usuario.id,
            p_data_demissao: data_demissao,
            p_tipo_demissao: funcionario.tipo_demissao,
            p_observacoes: funcionario.observacoes,
            p_demitido_por: null
          });

        if (demissaoError) {
          resultados.erros.push({
            matricula: funcionario.matricula,
            erro: 'Erro ao demitir funcionário',
            detalhes: demissaoError.message
          });
          continue;
        }

        // 5. Verificar se a demissão foi bem-sucedida
        const resultado = Array.isArray(demissaoResult) ? demissaoResult[0] : demissaoResult;
        
        if (!resultado || !resultado.sucesso) {
          resultados.erros.push({
            matricula: funcionario.matricula,
            erro: 'Demissão não autorizada',
            detalhes: resultado?.mensagem || 'Erro desconhecido'
          });
          continue;
        }

        // 6. Atualizar informações do usuário (operação e cargo)
        if (funcionario.operacao || funcionario.cargo) {
          const updateData: Record<string, string> = {};
          if (funcionario.operacao) updateData.operacao = funcionario.operacao;
          if (funcionario.cargo) updateData.cargo = funcionario.cargo;

          const { error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update(updateData)
            .eq('id', usuario.id);

          if (updateError) {
            console.warn(`⚠️ Erro ao atualizar informações do usuário ${funcionario.matricula}:`, updateError);
          }
        }

        // 7. Deletar usuário do Supabase Auth
        if (usuario.auth_usuario_id) {
          try {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(usuario.auth_usuario_id);
            
            if (deleteError) {
              console.warn(`⚠️ Erro ao deletar usuário do Auth ${funcionario.matricula}:`, deleteError);
            } else {
              console.log(`✅ Usuário ${funcionario.matricula} deletado do Auth`);
            }
          } catch (authError) {
            console.warn(`⚠️ Erro ao deletar usuário do Auth ${funcionario.matricula}:`, authError);
          }
        }

        resultados.sucessos.push({
          matricula: funcionario.matricula,
          nome: usuario.nome,
          data_demissao: data_demissao,
          operacao: funcionario.operacao || usuario.operacao,
          cargo: funcionario.cargo || usuario.cargo,
          tipo_demissao: funcionario.tipo_demissao || 'sem_justa_causa'
        });

        console.log(`✅ Funcionário ${funcionario.matricula} demitido com sucesso`);

      } catch (error) {
        console.error(`❌ Erro ao processar ${funcionario.matricula}:`, error);
        resultados.erros.push({
          matricula: funcionario.matricula,
          erro: 'Erro interno',
          detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    console.log('📊 Resultado final:', {
      total: resultados.total,
      sucessos: resultados.sucessos.length,
      erros: resultados.erros.length
    });

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`,
      resultados
    });

  } catch (error) {
    console.error('❌ Erro na API de demissão em lote:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}