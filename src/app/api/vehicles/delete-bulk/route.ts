import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithAuth } from '@/lib/supabase';

// ============================================================================
// API PARA DELETAR VEÍCULOS EM MASSA POR PLACAS
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placas, motivo, confirmacao } = body;

    // Validações obrigatórias
    if (!placas || !Array.isArray(placas) || placas.length === 0) {
      return NextResponse.json(
        { error: 'Lista de placas é obrigatória e deve ser um array' },
        { status: 400 }
      );
    }

    if (!motivo || motivo.trim() === '') {
      return NextResponse.json(
        { error: 'Motivo da exclusão é obrigatório' },
        { status: 400 }
      );
    }

    if (confirmacao !== 'CONFIRMAR_EXCLUSAO_EM_MASSA') {
      return NextResponse.json(
        { error: 'Confirmação obrigatória não fornecida' },
        { status: 400 }
      );
    }

    // Obter token de autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    console.log('🚗 INICIANDO EXCLUSÃO EM MASSA DE VEÍCULOS');
    console.log('👤 Usuário:', funcionario.nome);
    console.log('📋 Placas a serem deletadas:', placas);
    console.log('📝 Motivo:', motivo);

    // 1. VERIFICAÇÃO PRÉVIA - Buscar veículos que serão afetados
    console.log('🔍 Verificando veículos existentes...');
    const { data: veiculosExistentes, error: buscaError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa, modelo, status, contrato_id, base_id, equipe_id')
      .in('placa', placas);

    if (buscaError) {
      console.error('❌ Erro ao buscar veículos:', buscaError);
      return NextResponse.json(
        { error: 'Erro ao buscar veículos: ' + buscaError.message },
        { status: 500 }
      );
    }

    console.log(`📊 Encontrados ${veiculosExistentes?.length || 0} veículos para exclusão`);

    if (!veiculosExistentes || veiculosExistentes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum veículo encontrado com as placas fornecidas',
        dados: {
          placas_solicitadas: placas,
          veiculos_encontrados: 0,
          veiculos_deletados: 0
        }
      });
    }

    // 2. CRIAR BACKUP DOS DADOS
    console.log('💾 Criando backup dos dados...');
    
    // Backup dos veículos
    const { data: backupVeiculos, error: backupError } = await supabaseAdmin
      .from('veiculos')
      .insert(
        veiculosExistentes.map(veiculo => ({
          ...veiculo,
          backup_original_id: veiculo.id,
          backup_motivo: motivo,
          backup_usuario: funcionario.nome,
          backup_data: new Date().toISOString(),
          backup_tipo: 'exclusao_massa'
        }))
      )
      .select();

    if (backupError) {
      console.error('❌ Erro ao criar backup:', backupError);
      // Continuar mesmo com erro de backup, mas registrar
    } else {
      console.log(`✅ Backup criado com ${backupVeiculos?.length || 0} registros`);
    }

    // 3. BUSCAR DADOS RELACIONADOS PARA BACKUP
    const veiculoIds = veiculosExistentes.map(v => v.id);
    
    // Backup de documentos de veículos
    const { data: documentos } = await supabaseAdmin
      .from('documentos_veiculo')
      .select('*')
      .in('veiculo_id', veiculoIds);

    // Backup de histórico de movimentações
    const { data: movimentacoes } = await supabaseAdmin
      .from('historico_movimentacoes')
      .select('*')
      .in('veiculo_id', veiculoIds);

    // Backup de ordens de desconto
    const { data: ordensDesconto } = await supabaseAdmin
      .from('ordens_desconto')
      .select('*')
      .in('veiculo_id', veiculoIds);

    console.log(`📋 Dados relacionados encontrados:
      - Documentos: ${documentos?.length || 0}
      - Movimentações: ${movimentacoes?.length || 0}
      - Ordens de desconto: ${ordensDesconto?.length || 0}`);

    // 4. EXCLUSÃO DOS DADOS RELACIONADOS (em ordem para respeitar foreign keys)
    console.log('🗑️ Iniciando exclusão dos dados relacionados...');

    // Deletar documentos de veículos
    if (documentos && documentos.length > 0) {
      const { error: deleteDocsError } = await supabaseAdmin
        .from('documentos_veiculo')
        .delete()
        .in('veiculo_id', veiculoIds);

      if (deleteDocsError) {
        console.error('❌ Erro ao deletar documentos:', deleteDocsError);
      } else {
        console.log(`✅ ${documentos.length} documentos deletados`);
      }
    }

    // Deletar histórico de movimentações
    if (movimentacoes && movimentacoes.length > 0) {
      const { error: deleteMovError } = await supabaseAdmin
        .from('historico_movimentacoes')
        .delete()
        .in('veiculo_id', veiculoIds);

      if (deleteMovError) {
        console.error('❌ Erro ao deletar movimentações:', deleteMovError);
      } else {
        console.log(`✅ ${movimentacoes.length} movimentações deletadas`);
      }
    }

    // Deletar ordens de desconto
    if (ordensDesconto && ordensDesconto.length > 0) {
      const { error: deleteOrdensError } = await supabaseAdmin
        .from('ordens_desconto')
        .delete()
        .in('veiculo_id', veiculoIds);

      if (deleteOrdensError) {
        console.error('❌ Erro ao deletar ordens de desconto:', deleteOrdensError);
      } else {
        console.log(`✅ ${ordensDesconto.length} ordens de desconto deletadas`);
      }
    }

    // 5. EXCLUSÃO DOS VEÍCULOS
    console.log('🚗 Deletando veículos...');
    const { data: veiculosDeletados, error: deleteError } = await supabaseAdmin
      .from('veiculos')
      .delete()
      .in('id', veiculoIds)
      .select('id, placa, modelo');

    if (deleteError) {
      console.error('❌ Erro ao deletar veículos:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao deletar veículos: ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log(`✅ ${veiculosDeletados?.length || 0} veículos deletados com sucesso`);

    // 6. VERIFICAÇÃO PÓS-EXCLUSÃO
    console.log('🔍 Verificando exclusão...');
    const { data: veiculosRestantes, error: verificacaoError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa')
      .in('placa', placas);

    if (verificacaoError) {
      console.error('❌ Erro na verificação:', verificacaoError);
    }

    const veiculosNaoDeletados = veiculosRestantes || [];
    const sucessoCompleto = veiculosNaoDeletados.length === 0;

    // 7. LOG DA OPERAÇÃO
    const logOperacao = {
      tipo: 'exclusao_massa_veiculos',
      usuario_id: funcionario.id,
      usuario_nome: funcionario.nome,
      placas_solicitadas: placas,
      veiculos_encontrados: veiculosExistentes.length,
      veiculos_deletados: veiculosDeletados?.length || 0,
      veiculos_nao_deletados: veiculosNaoDeletados.length,
      motivo: motivo,
      sucesso_completo: sucessoCompleto,
      timestamp: new Date().toISOString(),
      dados_relacionados: {
        documentos: documentos?.length || 0,
        movimentacoes: movimentacoes?.length || 0,
        ordens_desconto: ordensDesconto?.length || 0
      }
    };

    console.log('📝 Log da operação:', logOperacao);

    // Salvar log no banco (se existir tabela de logs)
    try {
      await supabaseAdmin
        .from('logs_operacoes')
        .insert(logOperacao);
    } catch {
      console.log('⚠️ Não foi possível salvar log no banco (tabela pode não existir)');
    }

    // 8. RESPOSTA FINAL
    return NextResponse.json({
      success: true,
      message: sucessoCompleto 
        ? 'Todos os veículos foram deletados com sucesso'
        : 'Alguns veículos foram deletados, mas alguns não foram encontrados',
      dados: {
        placas_solicitadas: placas,
        veiculos_encontrados: veiculosExistentes.length,
        veiculos_deletados: veiculosDeletados?.length || 0,
        veiculos_nao_deletados: veiculosNaoDeletados.length,
        veiculos_deletados_detalhes: veiculosDeletados?.map(v => ({
          placa: v.placa,
          modelo: v.modelo
        })) || [],
        veiculos_nao_deletados_detalhes: veiculosNaoDeletados.map(v => ({
          placa: v.placa
        })),
        dados_relacionados_deletados: {
          documentos: documentos?.length || 0,
          movimentacoes: movimentacoes?.length || 0,
          ordens_desconto: ordensDesconto?.length || 0
        },
        motivo: motivo,
        usuario: funcionario.nome,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro geral na exclusão em massa:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
