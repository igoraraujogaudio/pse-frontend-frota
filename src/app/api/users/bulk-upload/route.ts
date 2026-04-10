import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { validarCPF } from '@/utils/cpfUtils';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const contratoId = formData.get('contrato_id') as string;
    const baseId = formData.get('base_id') as string;
    const nivelAcesso = formData.get('nivel_acesso') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!contratoId) {
      return NextResponse.json({ error: 'Contrato não selecionado' }, { status: 400 });
    }

    if (!baseId) {
      return NextResponse.json({ error: 'Base não selecionada' }, { status: 400 });
    }

    if (!nivelAcesso) {
      return NextResponse.json({ error: 'Nível de acesso não selecionado' }, { status: 400 });
    }

    // Lê o arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Cria client admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Valida se contrato existe e está ativo
    const { data: contrato, error: contratoError } = await supabaseAdmin
      .from('contratos')
      .select('id, nome, codigo, status')
      .eq('id', contratoId)
      .eq('status', 'ativo')
      .single();

    if (contratoError || !contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado ou inativo' }, { status: 400 });
    }

    // Valida se base existe e está ativa
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id, nome, codigo, ativa, contrato_id')
      .eq('id', baseId)
      .eq('ativa', true)
      .single();

    if (baseError || !base) {
      return NextResponse.json({ error: 'Base não encontrada ou inativa' }, { status: 400 });
    }

    // Valida se a base pertence ao contrato selecionado
    if (base.contrato_id !== contratoId) {
      return NextResponse.json({ error: 'A base selecionada não pertence ao contrato escolhido' }, { status: 400 });
    }

    const results = {
      success: [] as Array<{
        linha: number;
        usuario: Record<string, unknown>;
        email: string;
        senha: string;
      }>,
      errors: [] as Array<{
        linha: number;
        erro: string;
        dados: Record<string, unknown>;
      }>,
      total: data.length
    };

    // Processa cada linha da planilha
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;
      
      try {
        // Mapeia os campos da planilha (ajuste conforme necessário)
        const nome = String(row['Nome'] || row['nome'] || row['NOME'] || '').trim();
        const cpfRaw = String(row['CPF'] || row['cpf'] || '').trim();
        // Remove formatação e garante que o CPF tenha 11 dígitos (adiciona zeros à esquerda se necessário)
        const cpfDigits = cpfRaw.replace(/\D/g, '');
        const cpf = cpfDigits.padStart(11, '0');
        const matricula = String(row['Matrícula'] || row['matricula'] || row['MATRICULA'] || '').trim();
        const departamento = String(row['Departamento'] || row['departamento'] || row['DEPARTAMENTO'] || 'operacoes').trim();
        const cargo = String(row['Cargo'] || row['cargo'] || row['CARGO'] || 'Operação').trim();
        const posicao = String(row['Posição'] || row['posicao'] || row['POSIÇÃO'] || row['PosiÃ§Ã£o'] || 'Operador').trim();
        
        // Campos adicionais do schema
        const telefoneEmpresarial = String(row['Telefone Empresarial'] || row['telefone_empresarial'] || row['TELEFONE_EMPRESARIAL'] || '').trim();
        const dataAdmissao = String(row['Data Admissão'] || row['data_admissao'] || row['DATA_ADMISSAO'] || '').trim();
        const dataNascimento = String(row['Data Nascimento'] || row['data_nascimento'] || row['DATA_NASCIMENTO'] || '').trim();
        const cnh = String(row['CNH'] || row['cnh'] || '').trim();
        const validadeCnh = String(row['Validade CNH'] || row['validade_cnh'] || row['VALIDADE_CNH'] || '').trim();
        const cnhCategoria = String(row['CNH Categoria'] || row['cnh_categoria'] || row['CNH_CATEGORIA'] || '').trim();
        const dataUltimoExameAso = String(row['Data Último Exame ASO'] || row['data_ultimo_exame_aso'] || row['DATA_ULTIMO_EXAME_ASO'] || '').trim();
        const dataAgendamentoAso = String(row['Data Agendamento ASO'] || row['data_agendamento_aso'] || row['DATA_AGENDAMENTO_ASO'] || '').trim();
        const harVencimento = String(row['HAR Vencimento'] || row['har_vencimento'] || row['HAR_VENCIMENTO'] || '').trim();
        const dataDemissao = String(row['Data Demissão'] || row['data_demissao'] || row['DATA_DEMISSAO'] || '').trim();
        const tipoDemissao = String(row['Tipo Demissão'] || row['tipo_demissao'] || row['TIPO_DEMISSAO'] || '').trim();
        const observacoesDemissao = String(row['Observações Demissão'] || row['observacoes_demissao'] || row['OBSERVACOES_DEMISSAO'] || '').trim();
        
        // Mapeia departamento para operação
        const mapearOperacao = (dept: string): string => {
          const deptLower = dept.toLowerCase();
          if (deptLower.includes('emergencia')) return 'emergencia';
          if (deptLower.includes('técnica') || deptLower.includes('tecnica')) return 'tecnica';
          if (deptLower.includes('comercial')) return 'comercial';
          if (deptLower.includes('manutenção') || deptLower.includes('manutencao')) return 'manutencao';
          if (deptLower.includes('almoxarifado')) return 'almoxarifado';
          if (deptLower.includes('portaria')) return 'portaria';
          return 'geral'; // Valor padrão
        };
        
        const operacao = mapearOperacao(departamento);
        const telefone = String(row['Telefone'] || row['telefone'] || row['TELEFONE'] || '').trim();
        const email = String(row['Email'] || row['email'] || row['EMAIL'] || `${matricula}@pse.srv.br`).trim();
        const contratoId = String(row['Contrato'] || row['contrato'] || '').trim();

        // Debug: log dos valores extraídos para as primeiras linhas
        if (i < 3) {
          console.log(`Linha ${i + 1} - Valores extraídos:`, {
            nome: `"${nome}"`,
            cpfRaw: `"${cpfRaw}"`,
            cpfFormatted: `"${cpf}"`,
            matricula: `"${matricula}"`,
            departamento: `"${departamento}"`,
            operacao: `"${operacao}"`,
            rawRow: row
          });
        }

        // Validações básicas - CPF não é mais obrigatório
        if (!nome || nome === 'undefined' || nome === 'null' || 
            !matricula || matricula === 'undefined' || matricula === 'null') {
          results.errors.push({
            linha: i + 1,
            erro: 'Nome e Matrícula são obrigatórios',
            dados: row
          });
          continue;
        }

        // Se CPF estiver presente, validar
        if (cpfRaw && cpfRaw !== 'undefined' && cpfRaw !== 'null' && cpfRaw.trim() !== '') {
          // Valida se o CPF tem pelo menos alguns dígitos
          if (cpfDigits.length < 9) {
            results.errors.push({
              linha: i + 1,
              erro: 'CPF deve ter pelo menos 9 dígitos',
              dados: row
            });
            continue;
          }

          // Valida CPF
          if (!validarCPF(cpf)) {
            results.errors.push({
              linha: i + 1,
              erro: 'CPF inválido',
              dados: row
            });
            continue;
          }
        }

        // CPF já está limpo e formatado (pode ser vazio)
        const cpfLimpo = cpf || '';

        // Verifica se usuário já existe
        let existingUser = null;
        if (cpfLimpo) {
          // Se tem CPF, verifica por CPF ou matrícula
          const { data } = await supabaseAdmin
            .from('usuarios')
            .select('id, cpf, matricula')
            .or(`cpf.eq.${cpfLimpo},matricula.eq.${matricula}`)
            .single();
          existingUser = data;
        } else {
          // Se não tem CPF, verifica apenas por matrícula
          const { data } = await supabaseAdmin
            .from('usuarios')
            .select('id, cpf, matricula')
            .eq('matricula', matricula)
            .single();
          existingUser = data;
        }

        if (existingUser) {
          results.errors.push({
            linha: i + 1,
            erro: 'Usuário já existe (CPF ou matrícula duplicada)',
            dados: row
          });
          continue;
        }

        // Gera senha padrão
        const senha = 'PSE2025';

        // 1. Cria usuário no Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
        });

        if (authError || !authUser?.user) {
          results.errors.push({
            linha: i + 1,
            erro: `Erro no Auth: ${authError?.message}`,
            dados: row
          });
          continue;
        }

        // 2. Cria usuário na tabela usuarios
        const { data: userData, error: userError } = await supabaseAdmin
          .from('usuarios')
          .insert({
            nome,
            email,
            departamento,
            cargo,
            posicao,
            matricula,
            cpf: cpfLimpo || null,
            telefone,
            telefone_empresarial: telefoneEmpresarial || null,
            nivel_acesso: nivelAcesso, // Usa o nível selecionado
            operacao: operacao, // Campo obrigatório - mapeado do departamento
            status: 'ativo',
            auth_usuario_id: authUser.user.id,
            contrato_origem_id: contratoId, // Define o contrato do bulk como contrato origem
            data_admissao: dataAdmissao ? new Date(dataAdmissao).toISOString().split('T')[0] : null,
            data_nascimento: dataNascimento ? new Date(dataNascimento).toISOString().split('T')[0] : null,
            cnh: cnh || null,
            validade_cnh: validadeCnh ? new Date(validadeCnh).toISOString().split('T')[0] : null,
            cnh_categoria: cnhCategoria || null,
            data_ultimo_exame_aso: dataUltimoExameAso ? new Date(dataUltimoExameAso).toISOString().split('T')[0] : null,
            data_agendamento_aso: dataAgendamentoAso ? new Date(dataAgendamentoAso).toISOString() : null,
            har_vencimento: harVencimento ? new Date(harVencimento).toISOString().split('T')[0] : null,
            data_demissao: dataDemissao ? new Date(dataDemissao).toISOString().split('T')[0] : null,
            tipo_demissao: tipoDemissao || null,
            observacoes_demissao: observacoesDemissao || null,
          })
          .select()
          .single();

        if (userError) {
          // Rollback: deleta usuário do Auth
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          results.errors.push({
            linha: i + 1,
            erro: `Erro na base de dados: ${userError.message}`,
            dados: row
          });
          continue;
        }

        // 3. Associa usuário ao contrato
        try {
          const { error: contratoAssociationError } = await supabaseAdmin
            .from('usuario_contratos')
            .insert({
              usuario_id: userData.id,
              contrato_id: contratoId,
              ativo: true,
              data_inicio: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (contratoAssociationError) {
            console.warn(`Erro ao associar usuário ${matricula} ao contrato ${contratoId}: ${contratoAssociationError.message}`);
          }
        } catch (error) {
          console.warn(`Erro ao processar associação de contrato para usuário ${matricula}:`, error);
        }

        // 4. Associa usuário à base
        try {
          const { error: baseAssociationError } = await supabaseAdmin
            .from('usuario_bases')
            .insert({
              usuario_id: userData.id,
              base_id: baseId,
              tipo_acesso: 'total', // Acesso total por padrão
              ativo: true,
              data_inicio: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (baseAssociationError) {
            console.warn(`Erro ao associar usuário ${matricula} à base ${baseId}: ${baseAssociationError.message}`);
          }
        } catch (error) {
          console.warn(`Erro ao processar associação de base para usuário ${matricula}:`, error);
        }

        results.success.push({
          linha: i + 1,
          usuario: {
            ...userData,
            contrato_nome: contrato.nome,
            contrato_codigo: contrato.codigo,
            base_nome: base.nome,
            base_codigo: base.codigo
          },
          email,
          senha
        });

      } catch (error) {
        results.errors.push({
          linha: i + 1,
          erro: `Erro inesperado: ${error}`,
          dados: row
        });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({ 
      error: `Erro ao processar arquivo: ${error}` 
    }, { status: 500 });
  }
}