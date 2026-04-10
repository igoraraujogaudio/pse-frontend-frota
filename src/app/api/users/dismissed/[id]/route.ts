import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: funcionarioId } = await params;

    if (!funcionarioId) {
      return NextResponse.json(
        { error: 'ID do funcionário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar dados do funcionário demitido
    const { data: funcionario, error } = await supabaseAdmin
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        matricula,
        cpf,
        telefone,
        cargo,
        posicao,
        operacao,
        departamento,
        status,
        nivel_acesso,
        criado_em,
        atualizado_em,
        data_demissao,
        tipo_demissao,
        observacoes_demissao,
        demitido_por,
        contrato_id
      `)
      .eq('id', funcionarioId)
      .eq('status', 'demitido')
      .single();

    if (error) {
      console.error('Erro ao buscar funcionário:', error);
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar nome do usuário que demitiu
    let demitidoPorNome = 'Sistema';
    if (funcionario.demitido_por) {
      const { data: demitidor } = await supabaseAdmin
        .from('usuarios')
        .select('nome')
        .eq('id', funcionario.demitido_por)
        .single();
      
      if (demitidor) {
        demitidoPorNome = demitidor.nome;
      }
    }

    // Buscar informações de base através da tabela de associação
    let baseNome = null;
    try {
      const { data: usuarioBase } = await supabaseAdmin
        .from('usuario_bases')
        .select('base_id')
        .eq('usuario_id', funcionarioId)
        .eq('ativo', true)
        .single();
      
      if (usuarioBase?.base_id) {
        const { data: base } = await supabaseAdmin
          .from('bases')
          .select('nome')
          .eq('id', usuarioBase.base_id)
          .single();
        
        if (base) {
          baseNome = base.nome;
        }
      }
    } catch (error) {
      console.log('Erro ao buscar base (pode não existir):', error);
    }

    // Buscar informações de contrato (primeiro da tabela usuarios, depois da associação)
    let contratoNome = null;
    try {
      // Primeiro tenta buscar do contrato_id direto na tabela usuarios
      if (funcionario.contrato_id) {
        const { data: contrato } = await supabaseAdmin
          .from('contratos')
          .select('nome')
          .eq('id', funcionario.contrato_id)
          .single();
        
        if (contrato) {
          contratoNome = contrato.nome;
        }
      }
      
      // Se não encontrou, tenta pela tabela de associação
      if (!contratoNome) {
        const { data: usuarioContrato } = await supabaseAdmin
          .from('usuario_contratos')
          .select('contrato_id')
          .eq('usuario_id', funcionarioId)
          .eq('ativo', true)
          .single();
        
        if (usuarioContrato?.contrato_id) {
          const { data: contrato } = await supabaseAdmin
            .from('contratos')
            .select('nome')
            .eq('id', usuarioContrato.contrato_id)
            .single();
          
          if (contrato) {
            contratoNome = contrato.nome;
          }
        }
      }
    } catch (error) {
      console.log('Erro ao buscar contrato (pode não existir):', error);
    }

    // Formatar resposta
    const funcionarioFormatado = {
      ...funcionario,
      base_nome: baseNome,
      contrato_nome: contratoNome,
      demitido_por_nome: demitidoPorNome
    };

    return NextResponse.json({
      success: true,
      funcionario: funcionarioFormatado
    });

  } catch (error) {
    console.error('Erro na API de detalhes do funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
