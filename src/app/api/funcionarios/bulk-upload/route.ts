import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { validarCPF } from '@/utils/cpfUtils';
import { modularPermissionService } from '@/services/modularPermissionService';
import { mapearCargoParaNivelAcesso } from '@/utils/cargoMapping';
import { parseExcelDate } from '@/utils/excelDateUtils';

// Mapeamento de Centro de Custo para Contrato
// Os valores devem corresponder aos nomes EXATOS dos contratos na DB
const CENTRO_CUSTO_PARA_CONTRATO: Record<string, string> = {
  'ADMINISTRATIVO/GOIAS': 'Goiás',
  'COMERCIAL GOIAS': 'Goiás',
  'ENEL NITERÓI-RJ': 'Niterói',
  'ENEL NITEROI-RJ': 'Niterói',
  'MAGE-RJ': 'Magé',
  'MAUÁ TMA': 'TMA São Paulo',
  'MAUA TMA': 'TMA São Paulo',
  'MOOCA TMA': 'TMA São Paulo',
  'OBRAS CRASH': 'Obras Crash SP',
  'SERVIÇOS LIGHT/RJ': 'Niterói',
  'SERVICOS LIGHT/RJ': 'Niterói',
  'TECNICOS GOIAS': 'Goiás'
};

// Função para mapear Centro de Custo para nome do contrato
function mapearCentroCustoParaContrato(centroCusto: string): string | null {
  const centroCustoNormalizado = centroCusto.trim().toUpperCase();
  return CENTRO_CUSTO_PARA_CONTRATO[centroCustoNormalizado] || null;
}

// Função helper para parsear datas (aceita número Excel ou texto)
function parseDate(value: unknown): Date | null {
  if (!value || value === 'undefined' || value === 'null' || value === '') return null;
  
  // Se for número (data Excel)
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
  
  // Se for string (data em texto)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    // Tenta parsear como data
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      if (year >= 1800 && year <= 2100) {
        return parsed;
      }
      return null;
    }
    
    // Tenta formato brasileiro DD/MM/YYYY
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
    const contratoIdManual = formData.get('contrato_id') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Lê o arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Arquivo Excel vazio ou inválido' }, { status: 400 });
    }

    // Cria client admin
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      urlLength: supabaseUrl?.length,
      hasKey: !!serviceRoleKey,
      keyLength: serviceRoleKey?.length,
      keyPrefix: serviceRoleKey?.substring(0, 10) + '...'
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: 'Variáveis de ambiente não configuradas',
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Determina modo de operação: manual (contrato único) ou automático (por centro de custo)
    const modoAutomatico = !contratoIdManual || contratoIdManual.trim() === '';
    let contratoUnico = null;

    // Se modo manual, valida o contrato fornecido
    if (!modoAutomatico) {
      const { data: contrato, error: contratoError } = await supabaseAdmin
        .from('contratos')
        .select('id, nome, codigo, status')
        .eq('id', contratoIdManual)
        .single();

      if (contratoError) {
        console.error('Erro ao buscar contrato:', contratoError);
        return NextResponse.json({ 
          error: 'Erro ao validar contrato',
          details: contratoError.message,
          contratoId: contratoIdManual
        }, { status: 400 });
      }

      if (!contrato) {
        return NextResponse.json({ 
          error: 'Contrato não encontrado',
          contratoId: contratoIdManual
        }, { status: 400 });
      }

      if (contrato.status !== 'ativo') {
        return NextResponse.json({ 
          error: 'Contrato inativo',
          contratoId: contratoIdManual,
          status: contrato.status,
          contratoNome: contrato.nome 
        }, { status: 400 });
      }
      
      contratoUnico = contrato;
    }

    // Se modo automático, busca todos os contratos ativos para fazer o mapeamento
    const contratosMap: Record<string, { id: string; nome: string; codigo: string }> = {};
    if (modoAutomatico) {
      const { data: contratos, error: contratosError } = await supabaseAdmin
        .from('contratos')
        .select('id, nome, codigo, status')
        .eq('status', 'ativo');

      if (contratosError || !contratos) {
        return NextResponse.json({ error: 'Erro ao buscar contratos' }, { status: 500 });
      }

      // Cria mapa de nome/código do contrato para ID
      // Usa nome exato (com acentuação) como chave
      contratos.forEach(contrato => {
        contratosMap[contrato.nome] = contrato;
        contratosMap[contrato.codigo.toUpperCase()] = contrato;
      });
    }

    const results = {
      sucessos: [] as Array<{ linha: number; funcionario: string; dados: Record<string, unknown> }>,
      erros: [] as Array<{ linha: number; erro: string; dados: Record<string, unknown> }>,
      atualizados: [] as Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>,
      criados: [] as Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>,
      demitidos: [] as Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>
    };

    // Processa cada linha da planilha
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;

      try {
        // Extrai dados da linha - suporta formato padrão e formato ENEL
        const nome = String(
          row['nome'] || row['Nome'] || row['NOME'] || 
          '' // ENEL usa "Nome" diretamente
        ).trim();
        
        const emailOriginal = String(row['email'] || row['Email'] || row['EMAIL'] || '').trim().toLowerCase();
        
        const matricula = String(
          row['matricula'] || row['Matrícula'] || row['MATRICULA'] || 
          row['Cadastro'] || row['cadastro'] || row['CADASTRO'] || // ENEL
          ''
        ).trim();
        
        const cpfRaw = String(row['cpf'] || row['CPF'] || '').trim();
        // Remove formatação e garante que o CPF tenha 11 dígitos (adiciona zeros à esquerda se necessário)
        const cpfDigits = cpfRaw.replace(/\D/g, '');
        const cpf = cpfDigits.padStart(11, '0');
        
        const telefone = String(row['telefone'] || row['Telefone'] || row['TELEFONE'] || '').trim();
        
        const cargo = String(
          row['cargo'] || row['Cargo'] || row['CARGO'] || 
          row['Título Reduzido (Cargo)'] || row['Titulo Reduzido (Cargo)'] || 
          row['titulo_reduzido'] || row['TITULO_REDUZIDO'] || // ENEL
          ''
        ).trim();
        
        const posicao = String(
          row['posicao'] || row['Posição'] || row['POSIÇÃO'] || 
          row['Descrição'] || row['Descricao'] || row['DESCRICAO'] || // ENEL - descrição do cargo
          ''
        ).trim();
        
        const operacao = String(row['operacao'] || row['Operação'] || row['OPERACAO'] || '').trim();
        const departamento = String(row['departamento'] || row['Departamento'] || row['DEPARTAMENTO'] || '').trim();
        
        // NOVO: Centro de Custo (ENEL) - usado para mapear contrato automaticamente
        const centroCusto = String(
          row['Descrição (C.Custo)'] || row['Descricao (C.Custo)'] || 
          row['centro_custo'] || row['Centro_Custo'] || row['CENTRO_CUSTO'] ||
          row['C.Custo'] || row['c_custo'] ||
          ''
        ).trim();
        
        // Determina o contrato para este funcionário
        let contratoId: string;
        
        if (modoAutomatico) {
          // Modo automático: usa Centro de Custo para determinar o contrato
          if (!centroCusto) {
            results.erros.push({
              linha: i + 1,
              erro: 'Centro de Custo (C.Custo) é obrigatório quando não há contrato selecionado',
              dados: row
            });
            continue;
          }
          
          // Mapeia Centro de Custo para nome do contrato
          const nomeContratoMapeado = mapearCentroCustoParaContrato(centroCusto);
          if (!nomeContratoMapeado) {
            results.erros.push({
              linha: i + 1,
              erro: `Centro de Custo "${centroCusto}" não mapeado. Configure o mapeamento ou selecione um contrato manualmente.`,
              dados: row
            });
            continue;
          }
          
          // Busca o ID do contrato pelo nome mapeado (exato, com acentuação)
          const contratoEncontrado = contratosMap[nomeContratoMapeado];
          if (!contratoEncontrado) {
            results.erros.push({
              linha: i + 1,
              erro: `Contrato "${nomeContratoMapeado}" (mapeado de "${centroCusto}") não encontrado no sistema`,
              dados: row
            });
            continue;
          }
          
          contratoId = contratoEncontrado.id;
        } else {
          // Modo manual: usa o contrato único selecionado
          contratoId = contratoUnico!.id;
        }
        
        // Status - suporta formato ENEL (Descrição (Situação))
        const statusOriginal = String(
          row['status'] || row['Status'] || row['STATUS'] || 
          row['Descrição (Situação)'] || row['Descricao (Situacao)'] || 
          row['situacao'] || row['Situacao'] || row['SITUACAO'] || // ENEL
          'ativo'
        ).trim();
        // Campos removidos do template: base_id e nivel_acesso (nivel_acesso é mapeado automaticamente pelo cargo)
        // let nivelAcesso = String(row['nivel_acesso'] || row['nivel_acesso'] || row['NIVEL_ACESSO'] || '').trim();
        // const baseId = String(row['base_id'] || row['base_id'] || row['BASE_ID'] || '').trim();
        const cnh = String(row['cnh'] || row['CNH'] || '').trim();
        const validadeCnh = String(row['validade_cnh'] || row['Validade_CNH'] || row['VALIDADE_CNH'] || '').trim();
        const cnhCategoria = String(row['cnh_categoria'] || row['CNH_Categoria'] || row['CNH_CATEGORIA'] || '').trim();
        const dataUltimoExameAso = String(row['data_ultimo_exame_aso'] || row['Data_Ultimo_Exame_ASO'] || row['DATA_ULTIMO_EXAME_ASO'] || '').trim();
        const dataAgendamentoAso = String(row['data_agendamento_aso'] || row['Data_Agendamento_ASO'] || row['DATA_AGENDAMENTO_ASO'] || '').trim();
        const validadeAso = String(row['validade_aso'] || row['Validade_ASO'] || row['VALIDADE_ASO'] || '').trim();
        const harVencimento = String(row['har_vencimento'] || row['HAR_Vencimento'] || row['HAR_VENCIMENTO'] || '').trim();
        
        // Campos adicionais do schema
        const telefoneEmpresarial = String(row['telefone_empresarial'] || row['Telefone_Empresarial'] || row['TELEFONE_EMPRESARIAL'] || '').trim();
        
        const dataAdmissao = String(
          row['data_admissao'] || row['Data_Admissao'] || row['DATA_ADMISSAO'] || 
          row['Admissão'] || row['Admissao'] || row['ADMISSAO'] || // ENEL
          ''
        ).trim();
        
        const dataNascimento = String(
          row['data_nascimento'] || row['Data_Nascimento'] || row['DATA_NASCIMENTO'] || 
          row['Nascimento'] || row['nascimento'] || row['NASCIMENTO'] || // ENEL
          ''
        ).trim();
        
        // ENEL - Data Afastamento (uso depende do status)
        const dataAfastamento = String(
          row['Data Afastamento'] || row['data_afastamento'] || row['DATA_AFASTAMENTO'] ||
          row['data_afas'] || row['Data Afas'] || row['DATA_AFAS'] ||
          ''
        ).trim();
        
        const dataDemissao = String(row['data_demissao'] || row['Data_Demissao'] || row['DATA_DEMISSAO'] || '').trim();
        const tipoDemissao = String(row['tipo_demissao'] || row['Tipo_Demissao'] || row['TIPO_DEMISSAO'] || '').trim();
        const observacoesDemissao = String(row['observacoes_demissao'] || row['Observacoes_Demissao'] || row['OBSERVACOES_DEMISSAO'] || '').trim();

        // Validações obrigatórias
        if (!nome || nome === 'undefined' || nome === 'null') {
          results.erros.push({
            linha: i + 1,
            erro: 'Nome é obrigatório',
            dados: row
          });
          continue;
        }

        // Email não é mais obrigatório - será gerado automaticamente se necessário

        if (!matricula || matricula === 'undefined' || matricula === 'null') {
          results.erros.push({
            linha: i + 1,
            erro: 'Matrícula é obrigatória',
            dados: row
          });
          continue;
        }

        if (!cargo) {
          results.erros.push({
            linha: i + 1,
            erro: 'Cargo é obrigatório',
            dados: row
          });
          continue;
        }

        // Operação não é mais obrigatória - será definida como padrão se não fornecida
        const operacaoFinal = operacao || 'GERAL';

        // Validação de email (apenas se fornecido)
        let email = emailOriginal;
        if (email && email !== 'undefined' && email !== 'null' && email.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            results.erros.push({
              linha: i + 1,
              erro: 'Email inválido',
              dados: row
            });
            continue;
          }
        }

        // Mapear status ENEL para status do sistema
        let statusMapeado = statusOriginal.toLowerCase();
        
        // Mapeamento específico ENEL
        if (statusOriginal.includes('Trabalhando') || statusOriginal.includes('trabalhando') || statusOriginal === '###') {
          statusMapeado = 'ativo';
        } else if (statusOriginal.includes('Férias') || statusOriginal.includes('Ferias')) {
          statusMapeado = 'ferias';
        } else if (statusOriginal.includes('Demitido') || statusOriginal.includes('demitido') || statusOriginal.includes('Demissão') || statusOriginal.includes('Demissao')) {
          statusMapeado = 'demitido';
        } else if (statusOriginal.includes('Atestado') || statusOriginal.includes('Auxílio') || statusOriginal.includes('Auxilio') || 
                   statusOriginal.includes('Licença') || statusOriginal.includes('Licenca') || statusOriginal.includes('Maternidade')) {
          statusMapeado = 'afastado';
        }
        
        // Normalizar status usando função SQL (sem alterar constraints)
        const { data: statusNormalizado } = await supabaseAdmin
          .rpc('normalizar_status_usuario', { p_status: statusMapeado });
        const status = statusNormalizado || 'ativo';

        // Validação de CPF - obrigatório exceto para demitidos
        if (status !== 'demitido') {
          // Para funcionários não demitidos, CPF é obrigatório
          if (!cpfRaw || cpfRaw === 'undefined' || cpfRaw === 'null' || cpfRaw.trim() === '') {
            results.erros.push({
              linha: i + 1,
              erro: 'CPF é obrigatório para funcionários não demitidos',
              dados: row
            });
            continue;
          }
        }

        // Se CPF estiver presente, validar
        if (cpfRaw && cpfRaw !== 'undefined' && cpfRaw !== 'null' && cpfRaw.trim() !== '') {
          // Valida se o CPF tem pelo menos alguns dígitos
          // Nota: Excel remove zeros à esquerda, então um CPF como 00012345678 vira 12345678 (8 dígitos)
          // padStart(11, '0') resolve isso, então só rejeitamos se tiver muito poucos dígitos
          if (cpfDigits.length < 3) {
            results.erros.push({
              linha: i + 1,
              erro: 'CPF deve ter pelo menos 3 dígitos (zeros à esquerda são adicionados automaticamente)',
              dados: row
            });
            continue;
          }

          // Valida CPF
          if (!validarCPF(cpf)) {
            results.erros.push({
              linha: i + 1,
              erro: 'CPF inválido',
              dados: row
            });
            continue;
          }
        }

        // CPF já está limpo e formatado (pode ser vazio)
        const cpfLimpo = cpf || '';
        
        // Validação de status
        const statusValidos = ['ativo', 'demitido', 'ferias', 'afastado', 'suspenso'];
        if (!statusValidos.includes(status)) {
          results.erros.push({
            linha: i + 1,
            erro: `Status inválido. Use: ${statusValidos.join(', ')}`,
            dados: row
          });
          continue;
        }

        // Mapeamento automático de cargo para nível de acesso (sempre automático)
        let nivelAcesso = 'operacao'; // Fallback padrão
        try {
          nivelAcesso = await mapearCargoParaNivelAcesso(cargo, supabaseAdmin);
        } catch {
          nivelAcesso = 'operacao'; // Fallback seguro
        }

        // Validação de nível de acesso removida - aceita qualquer nível retornado pelo banco

        // Validação de base removida do template
        // let baseIdValidado = null;
        // if (baseId) {
        //   const { data: base, error: baseError } = await supabaseAdmin
        //     .from('bases')
        //     .select('id')
        //     .eq('id', baseId)
        //     .eq('ativa', true)
        //     .single();

        //   if (baseError || !base) {
        //     results.erros.push({
        //       linha: i + 1,
        //       erro: 'Base não encontrada ou inativa',
        //       dados: row
        //     });
        //     continue;
        //   }
        //   baseIdValidado = baseId;
        // }

        // Verifica se funcionário já existe
        let existingUser = null;
        if (cpfLimpo) {
          // Se tem CPF, verifica por CPF ou matrícula
          const { data } = await supabaseAdmin
            .from('usuarios')
            .select('id, cpf, matricula, email, cargo, nivel_acesso')
            .or(`cpf.eq.${cpfLimpo},matricula.eq.${matricula}`)
            .single();
          existingUser = data;
        } else {
          // Se não tem CPF, verifica apenas por matrícula
          const { data } = await supabaseAdmin
            .from('usuarios')
            .select('id, cpf, matricula, email, cargo, nivel_acesso')
            .eq('matricula', matricula)
            .single();
          existingUser = data;
        }

        // Lógica de email automático
        if (existingUser) {
          // Se funcionário existe, usa o email dele automaticamente
          email = existingUser.email;
        } else if (!email || email === 'undefined' || email === 'null' || email.trim() === '') {
          // Se funcionário não existe e não tem email, gera automaticamente usando função SQL
          const { data: emailData } = await supabaseAdmin
            .rpc('gerar_email_unico', { p_matricula: matricula, p_nome: nome });
          email = emailData || `${matricula}@pse.srv.br`;
        } else {
          // Verificar se email já existe
          const { data: emailExists } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .eq('email', email)
            .single();
          
          if (emailExists) {
            // Se email já existe, gerar um único
            const { data: emailData } = await supabaseAdmin
              .rpc('gerar_email_unico', { p_matricula: matricula, p_nome: nome });
            email = emailData || `${matricula}@pse.srv.br`;
          }
        }

        // Debug removido para melhorar performance

        // Calcula validade_aso automaticamente se não fornecida
        let validadeAsoCalculada = parseDate(validadeAso);
        const dataUltimoExameAsoParsed = parseDate(dataUltimoExameAso);
        if (!validadeAsoCalculada && dataUltimoExameAsoParsed) {
          const dataVencimentoASO = new Date(dataUltimoExameAsoParsed.getTime() + (365 * 24 * 60 * 60 * 1000));
          validadeAsoCalculada = dataVencimentoASO;
        }

        // Mapeia Data Afastamento baseado no status (ENEL)
        let dataDemissaoFinal = parseDate(dataDemissao);
        let dataInicioFerias = null;
        
        if (dataAfastamento && dataAfastamento !== '' && dataAfastamento !== 'undefined') {
          const dataAfastamentoParsed = parseDate(dataAfastamento);
          
          if (status === 'demitido') {
            // Se demitido, Data Afastamento = data_demissao
            dataDemissaoFinal = dataAfastamentoParsed;
          } else if (status === 'ferias' || status === 'afastado') {
            // Se férias ou licença maternidade, Data Afastamento = data de início das férias
            dataInicioFerias = dataAfastamentoParsed;
          }
        }

        // 🔒 PROTEÇÃO TOTAL PARA USUÁRIOS EXISTENTES
        // Usuários existentes NÃO podem ter alterados via bulk:
        // - cargo
        // - nivel_acesso (perfil_id)
        // - contrato_id
        
        const isNewUser = !existingUser;

        // Prepara dados para inserção/atualização
        const userData = {
          nome,
          email,
          departamento: departamento || null,
          // 🔒 CRÍTICO: Cargo NÃO pode ser alterado em usuários existentes
          ...(isNewUser ? { cargo } : {}),
          posicao: posicao || null,
          matricula,
          cpf: cpfLimpo || null,
          telefone: telefone || null,
          telefone_empresarial: telefoneEmpresarial || null,
          // 🔒 CRÍTICO: Nivel_acesso NÃO pode ser alterado em usuários existentes
          ...(isNewUser ? { nivel_acesso: nivelAcesso } : {}),
          operacao: operacaoFinal,
          status,
          cnh: cnh || null,
          validade_cnh: parseDate(validadeCnh),
          cnh_categoria: cnhCategoria || null,
          data_ultimo_exame_aso: dataUltimoExameAsoParsed,
          data_agendamento_aso: parseDate(dataAgendamentoAso),
          validade_aso: validadeAsoCalculada,
          har_vencimento: parseDate(harVencimento),
          data_admissao: parseDate(dataAdmissao),
          data_nascimento: parseDate(dataNascimento),
          data_demissao: dataDemissaoFinal,
          tipo_demissao: tipoDemissao || null,
          observacoes_demissao: observacoesDemissao || null,
          // ENEL - Data de início das férias (salvar em observações por enquanto, se não houver campo específico)
          ...(dataInicioFerias ? { observacoes: `Data início férias/afastamento: ${dataInicioFerias}` } : {})
        };

        if (existingUser) {
          // Atualiza funcionário existente
          
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update(userData)
            .eq('id', existingUser.id)
            .select()
            .single();

          if (updateError) {
            results.erros.push({
              linha: i + 1,
              erro: `Erro ao atualizar: ${updateError.message}`,
              dados: row
            });
            continue;
          }

          // Lógica de base_id removida do template
          // Atualiza relacionamentos se necessário
          // if (baseIdValidado) {
          //   // Remove relacionamentos antigos
          //   await supabaseAdmin
          //     .from('usuario_bases')
          //     .delete()
          //     .eq('usuario_id', existingUser.id);

          //   // Cria novo relacionamento
          //   await supabaseAdmin
          //     .from('usuario_bases')
          //     .insert({
          //       usuario_id: existingUser.id,
          //       base_id: baseIdValidado,
          //       ativo: true
          //     });
          // }

          // 🔒 CRÍTICO: Contrato NÃO é atualizado em usuários existentes via bulk
          // O contrato permanece o mesmo que foi definido originalmente

          // Verifica se foi marcado como demitido
          if (status === 'demitido') {
            // Executa demissão completa usando a função SQL existente
            try {
              const { error: demissaoError } = await supabaseAdmin
                .rpc('demitir_funcionario', {
                  p_usuario_id: existingUser.id,
                  p_data_demissao: dataDemissaoFinal?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
                  p_tipo_demissao: tipoDemissao || 'sem_justa_causa',
                  p_observacoes: observacoesDemissao || `Demitido via upload em lote - Linha ${i + 1}`,
                  p_demitido_por: null
                });

              if (demissaoError) {
                results.erros.push({
                  linha: i + 1,
                  erro: `Erro ao demitir funcionário: ${demissaoError.message}`,
                  dados: row
                });
                continue;
              }

              results.demitidos.push({
                linha: i + 1,
                funcionario: updatedUser,
                dados: row
              });
            } catch (demissaoError) {
              results.erros.push({
                linha: i + 1,
                erro: `Erro ao executar demissão: ${demissaoError instanceof Error ? demissaoError.message : 'Erro desconhecido'}`,
                dados: row
              });
              continue;
            }
          } else {
            results.atualizados.push({
              linha: i + 1,
              funcionario: updatedUser,
              dados: row
            });
          }

        } else {
          // Cria novo funcionário
          // Gera senha padrão
          const senha = 'PSE2025';

          // 1. Cria usuário no Auth
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
          });

          if (authError || !authUser?.user) {
            results.erros.push({
              linha: i + 1,
              erro: `Erro no Auth: ${authError?.message}`,
              dados: row
            });
            continue;
          }

          // 2. Cria usuário na tabela usuarios
          // userData já contém cargo e nivel_acesso para novos usuários
          const { data: newUser, error: userError } = await supabaseAdmin
            .from('usuarios')
            .insert({
              ...userData,
              auth_usuario_id: authUser.user.id,
              contrato_origem_id: contratoId, // Define o contrato do bulk como contrato origem
            })
            .select()
            .single();

          if (userError) {
            // Se falhou, remove o usuário do auth
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            results.erros.push({
              linha: i + 1,
              erro: `Erro ao criar usuário: ${userError.message}`,
              dados: row
            });
            continue;
          }

          // 3. Cria relacionamentos (base_id removido do template)
          // if (baseIdValidado) {
          //   await supabaseAdmin
          //     .from('usuario_bases')
          //     .insert({
          //       usuario_id: newUser.id,
          //       base_id: baseIdValidado,
          //       ativo: true
          //     });
          // }

          await supabaseAdmin
            .from('usuario_contratos')
            .insert({
              usuario_id: newUser.id,
              contrato_id: contratoId,
              tipo_acesso: 'origem', // Define como contrato de origem
              perfil_contrato: 'operador', // Perfil padrão
              ativo: true
            });

          // ✅ NOVO: 4. Aplicar permissões padrão do perfil automaticamente
          if (newUser && nivelAcesso) {
            try {
              // Usar função SQL para aplicar permissões sem ambiguidade
              const { error: permissaoError } = await supabaseAdmin
                .rpc('aplicar_permissoes_padrao_usuario', {
                  p_usuario_id: newUser.id,
                  p_nivel_acesso: nivelAcesso
                });

              if (permissaoError) {
                // Fallback: usar serviço modular
                try {
                  const { data: perfil, error: perfilError } = await supabaseAdmin
                    .from('perfis_acesso')
                    .select('id')
                    .eq('codigo', nivelAcesso)
                    .eq('ativo', true)
                    .single();

                  if (!perfilError && perfil) {
                    await modularPermissionService.applyProfileDefaultPermissions(
                      newUser.id,
                      perfil.id,
                      'sistema',
                      'api_bulk'
                    );
                  }
                } catch {
                  // Silencioso - não impacta criação do usuário
                }
              }
            } catch {
              // Não falha a criação do usuário, apenas log do erro se necessário
            }
          }

          results.criados.push({
            linha: i + 1,
            funcionario: newUser,
            dados: row
          });
        }

        results.sucessos.push({
          linha: i + 1,
          funcionario: existingUser ? 'Atualizado' : 'Criado',
          dados: row
        });

      } catch (error) {
        results.erros.push({
          linha: i + 1,
          erro: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          dados: row
        });
      }
    }

    return NextResponse.json({
      message: 'Processamento concluído',
      modo: modoAutomatico ? 'automático (por centro de custo)' : 'manual (contrato único)',
      contrato: modoAutomatico ? 'múltiplos contratos' : contratoUnico?.nome,
      total: data.length,
      sucessos: results.sucessos.length,
      erros: results.erros.length,
      atualizados: results.atualizados.length,
      criados: results.criados.length,
      demitidos: results.demitidos.length,
      detalhes: {
        sucessos: results.sucessos,
        erros: results.erros,
        atualizados: results.atualizados,
        criados: results.criados,
        demitidos: results.demitidos
      }
    });

  } catch (error) {
    console.error('Erro no bulk upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
