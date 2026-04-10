/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Create admin client with service role key for bypassing RLS
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const contratoId = formData.get('contratoId') as string;
    const operacaoPadrao = formData.get('operacaoPadrao') as string;

    console.log('📦 Dados recebidos no upload:');
    console.log('   - Arquivo:', file?.name);
    console.log('   - Contrato ID:', contratoId);
    console.log('   - Operação ID:', operacaoPadrao);

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!contratoId) {
      return NextResponse.json({ error: 'Contrato não selecionado' }, { status: 400 });
    }

    if (!operacaoPadrao) {
      return NextResponse.json({ error: 'Operação não selecionada' }, { status: 400 });
    }

    // Ler o arquivo
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Filtrar linhas vazias (onde todos os valores são vazios ou só tem espaços)
    const data = rawData.filter((row: any) => {
      const nomeEquipe = String(row.nome || row.nome_equipe || Object.values(row)[0] || '').trim();
      return nomeEquipe !== ''; // Manter apenas linhas com nome
    });

    console.log('📄 Arquivo lido:');
    console.log('   - Nome da planilha:', sheetName);
    console.log('   - Total de linhas (com vazias):', rawData.length);
    console.log('   - Total de linhas válidas:', data.length);
    console.log('   - Primeiras 3 linhas:', JSON.stringify(data.slice(0, 3), null, 2));

    // Validar estrutura dos dados
    if (data.length === 0) {
      return NextResponse.json({ error: 'Arquivo vazio ou sem linhas válidas' }, { status: 400 });
    }

    // Buscar a operação selecionada para obter dados
    console.log('🔍 Buscando operação no banco:', operacaoPadrao);
    
    const { data: operacao, error: operacaoError } = await supabaseAdmin
      .from('operacoes_padrao')
      .select('id, codigo, nome, requer_encarregado')
      .eq('id', operacaoPadrao)
      .maybeSingle(); // Usar maybeSingle para não dar erro se não encontrar

    console.log('📊 Resultado da busca:');
    console.log('   - Data:', operacao);
    console.log('   - Error:', operacaoError);

    if (operacaoError) {
      console.error('❌ Erro ao buscar operação:', operacaoError);
      return NextResponse.json({ 
        error: 'Erro ao buscar operação',
        message: operacaoError.message,
        details: operacaoError
      }, { status: 400 });
    }

    if (!operacao) {
      console.error('❌ Operação não encontrada com ID:', operacaoPadrao);
      return NextResponse.json({ 
        error: 'Operação não encontrada',
        message: `Nenhuma operação encontrada com ID: ${operacaoPadrao}`,
        hint: 'Verifique se a operação existe no banco de dados'
      }, { status: 404 });
    }
    
    console.log('✅ Operação encontrada:', operacao.nome, '(', operacao.codigo, ')');

    // Processar e inserir dados
    // O CSV pode ter: nome, setor (código), matricula_encarregado
    // A operação vem do formulário
    const teamsToInsert = await Promise.all(
      (data as Record<string, unknown>[]).map(async (row) => {
        // Aceitar tanto "nome" quanto a primeira coluna ou o valor direto
        const nomeEquipe = String(row.nome || row.nome_equipe || Object.values(row)[0] || '').trim();
        const setorCodigo = String(row.setor || '').trim().toUpperCase(); // Código do setor (ex: OBRA, MANUT)
        const matriculaEncarregado = String(row.matricula_encarregado || row.matricula || '').trim();
        
        // Validar se o setor existe e está associado à operação
        let setorValidado = null;
        if (setorCodigo) {
          const { data: setorAssociado } = await supabaseAdmin
            .from('vw_operacao_setores')
            .select('setor_codigo')
            .eq('operacao_id', operacao.id)
            .eq('setor_codigo', setorCodigo)
            .maybeSingle();
          
          if (setorAssociado) {
            setorValidado = setorCodigo;
          } else {
            console.warn(`⚠️  Setor ${setorCodigo} não está associado à operação ${operacao.codigo} para equipe ${nomeEquipe}`);
          }
        }
        
        // Buscar encarregado por matrícula se fornecida
        let encarregadoId = null;
        if (matriculaEncarregado) {
          const { data: encarregado } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .eq('matricula', matriculaEncarregado)
            .eq('status', 'ativo')
            .maybeSingle();
          
          if (encarregado) {
            encarregadoId = encarregado.id;
          } else {
            console.warn(`⚠️  Matrícula ${matriculaEncarregado} não encontrada para equipe ${nomeEquipe}`);
          }
        }
        
        return {
          nome: nomeEquipe,
          operacao: operacao.codigo, // Código da operação (compatibilidade - será preenchido pelo trigger)
          operacao_id: operacao.id, // ID da operação (FK para operacoes_padrao)
          contrato_id: contratoId,
          status: 'active',
          setor: setorValidado, // Código do setor validado
          encarregado_id: encarregadoId
        };
      })
    );

    // Log de todas as equipes processadas
    console.log('📋 Equipes processadas para inserção/atualização:');
    teamsToInsert.forEach((team, index) => {
      console.log(`   ${index + 1}. Nome: "${team.nome}" | Setor: ${team.setor || 'N/A'} | Encarregado: ${team.encarregado_id ? 'Sim' : 'Não'}`);
    });
    
    console.log('✅ Total de equipes válidas:', teamsToInsert.length);

    // Buscar equipes existentes no mesmo contrato
    const teamNames = teamsToInsert.map(team => team.nome);
    const { data: existingTeams } = await supabaseAdmin
      .from('equipes')
      .select('id, nome')
      .eq('contrato_id', contratoId)
      .in('nome', teamNames);

    const existingTeamsMap = new Map(
      (existingTeams || []).map((team: any) => [team.nome, team.id])
    );

    // Separar em inserções e atualizações
    const teamsToUpdate: any[] = [];
    const teamsToCreate: any[] = [];

    teamsToInsert.forEach(team => {
      const existingId = existingTeamsMap.get(team.nome);
      if (existingId) {
        // Equipe já existe - preparar para UPDATE
        teamsToUpdate.push({
          id: existingId,
          ...team
        });
      } else {
        // Equipe não existe - preparar para INSERT
        teamsToCreate.push(team);
      }
    });

    let created = 0;
    let updated = 0;
    const allTeams: any[] = [];

    // Inserir novas equipes
    if (teamsToCreate.length > 0) {
      const { data: insertedTeams, error: insertError } = await supabaseAdmin
        .from('equipes')
        .insert(teamsToCreate)
        .select();

      if (insertError) {
        console.error('Erro ao inserir equipes:', insertError);
        return NextResponse.json({ 
          error: 'Erro ao inserir equipes no banco de dados',
          details: insertError.message
        }, { status: 500 });
      }

      created = insertedTeams?.length || 0;
      allTeams.push(...(insertedTeams || []));
    }

    // Atualizar equipes existentes
    if (teamsToUpdate.length > 0) {
      for (const team of teamsToUpdate) {
        const { id, ...updateData } = team;
        const { data: updatedTeam, error: updateError } = await supabaseAdmin
          .from('equipes')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          console.error(`Erro ao atualizar equipe ${team.nome}:`, updateError);
        } else {
          updated++;
          allTeams.push(updatedTeam);
        }
      }
    }

    // Estatísticas do upload
    const comEncarregado = allTeams.filter(t => t.encarregado_id).length;
    const comSetor = allTeams.filter(t => t.setor).length;

    return NextResponse.json({ 
      success: true,
      message: `Upload concluído com sucesso!\n` +
               `Criadas: ${created}\n` +
               `Atualizadas: ${updated}\n` +
               `Operação: ${operacao.nome} (${operacao.codigo})\n` +
               `Com encarregado: ${comEncarregado}\n` +
               `Com setor: ${comSetor}`,
      count: allTeams.length,
      stats: {
        total: allTeams.length,
        created,
        updated,
        comEncarregado,
        comSetor
      },
      operacao: {
        id: operacao.id,
        codigo: operacao.codigo,
        nome: operacao.nome
      },
      teams: allTeams
    });

  } catch (error) {
    console.error('Erro no upload em massa:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}