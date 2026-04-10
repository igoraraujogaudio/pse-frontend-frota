import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs/promises';
import path from 'path';

// Funções de formatação
function formatCPF(cpf: string): string {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCNPJ(cnpj: string | number): string {
  if (!cnpj) return '';
  const cleaned = cnpj.toString().replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function getTipoAvisoTitulo(tipo: string): string {
  switch (tipo) {
    case 'advertencia': return 'ADVERTÊNCIA';
    case 'suspensao': return 'SUSPENSÃO';
    case 'falta_grave': return 'FALTA GRAVE';
    default: return 'AVISO';
  }
}

function gerarDocumentosComprobatorios(documentos: string[] = []): string {
  const opcoes = [
    { label: 'Relatório de Ocorrência', value: 'Relatório de Ocorrência' },
    { label: 'Boletim de Ocorrência Policial', value: 'Boletim de Ocorrência Policial' },
    { label: 'Relatório do Setor de Segurança', value: 'Relatório do Setor de Segurança' },
    { label: 'Laudo Pericial', value: 'Laudo Pericial' },
    { label: 'Nota Fiscal', value: 'Nota Fiscal' },
    { label: 'Ordem de Serviço', value: 'Ordem de Serviço' },
    { label: 'Outros', value: 'Outros' }
  ];
  return opcoes.map(opt => {
    return `<li>${documentos.includes(opt.value) ? '<b>X</b> ' : ''}${opt.label}</li>`;
  }).join('');
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    // 1. Busca dados do usuário alvo
    const { data: targetUser, error: userError } = await supabase
      .from('usuarios')
      .select('id, nome, email, cpf, matricula, cargo, departamento')
      .eq('id', body.target_user_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // 2. Busca dados da base
    const { data: base, error: baseError } = await supabase
      .from('bases')
      .select('id, nome, estado, endereco, cidade, contrato_id')
      .eq('id', body.base_id)
      .single();

    if (baseError || !base) {
      return NextResponse.json({ error: 'Base não encontrada' }, { status: 404 });
    }

    // 3. Busca CNPJ e nome do contrato
    let cnpj = '';
    let nomeContrato = '';
    if (base.contrato_id) {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('CNPJ, nome')
        .eq('id', base.contrato_id)
        .single();
      if (contrato) {
        cnpj = contrato.CNPJ || '';
        nomeContrato = contrato.nome || '';
      }
    }

    // 4. Busca dados do usuário criador
    const { data: creatorUser, error: creatorError } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('id', body.created_by)
      .single();

    if (creatorError || !creatorUser) {
      return NextResponse.json({ error: 'Usuário criador não encontrado' }, { status: 404 });
    }

    // 5. Insere no banco de dados
    const warningData = {
      created_by: creatorUser.id,
      target_user_id: targetUser.id,
      base_id: body.base_id,
      tipo_aviso: body.tipo_aviso,
      motivo: body.motivo,
      data_ocorrencia: body.data_ocorrencia,
      descricao: body.descricao,
      observacoes: body.observacoes,
      periodo_suspensao: body.periodo_suspensao ? parseInt(body.periodo_suspensao) : null,
      data_inicio_suspensao: body.data_inicio_suspensao || null,
      data_fim_suspensao: body.data_fim_suspensao || null,
      data_retorno_conclusoes: body.data_retorno_conclusoes || null,
      documentos_urls: body.documentos_urls || null
    };

    const { data: insertedWarning, error: insertError } = await supabase
      .from('medidas_disciplinares')
      .insert([warningData])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir aviso:', insertError);
      return NextResponse.json({ error: 'Erro ao criar aviso' }, { status: 500 });
    }

    // 6. Gera HTML a partir do template (sem Puppeteer)
    const templatePath = path.resolve(process.cwd(), `src/templates/${body.tipo_aviso}Pdf.html`);
    let html;
    try {
      html = await fs.readFile(templatePath, 'utf8');
    } catch (e) {
      console.error('Erro ao ler template HTML:', e);
      return NextResponse.json({ error: 'Erro ao ler template HTML' }, { status: 500 });
    }

    const templateData: Record<string, string> = {
      nome_colaborador: targetUser.nome,
      cpf: formatCPF(targetUser.cpf || ''),
      matricula: targetUser.matricula,
      cargo: targetUser.cargo,
      setor: targetUser.departamento,
      base_nome: nomeContrato || base.nome || 'Contrato não encontrado',
      cidade_base: base.cidade,
      estado_base: base.estado,
      endereco_base: base.endereco,
      cnpj_base: formatCNPJ(cnpj),
      data_geracao: new Date().toLocaleDateString('pt-BR'),
      descricao: body.descricao,
      motivo: body.motivo,
      data_ocorrencia: new Date(body.data_ocorrencia).toLocaleDateString('pt-BR'),
      observacoes: body.observacoes || '',
      periodo_suspensao: body.periodo_suspensao || '',
      data_inicio_suspensao: body.data_inicio_suspensao ? new Date(body.data_inicio_suspensao).toLocaleDateString('pt-BR') : '',
      data_fim_suspensao: body.data_fim_suspensao ? new Date(body.data_fim_suspensao).toLocaleDateString('pt-BR') : '',
      data_retorno_conclusoes: body.data_retorno_conclusoes ? new Date(body.data_retorno_conclusoes).toLocaleDateString('pt-BR') : '',
      tipo_aviso: body.tipo_aviso,
      tipo_aviso_titulo: getTipoAvisoTitulo(body.tipo_aviso),
      'documentos_comprobatórios': gerarDocumentosComprobatorios(body.documentos_urls || [])
    };

    // Substituir placeholders no HTML
    let processedHtml = html;
    Object.entries(templateData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    // 7. Upload do HTML para o Supabase Storage
    const htmlBuffer = Buffer.from(processedHtml, 'utf-8');
    const fileName = `aviso_${body.tipo_aviso}_${insertedWarning.id}_${Date.now()}.html`;
    const bucket = 'medidas-disciplinares';
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, htmlBuffer, { contentType: 'text/html', upsert: true });

    if (uploadError) {
      console.warn('Erro no upload do HTML:', uploadError.message);
    }

    // 8. Obter URL pública do arquivo
    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;

    // 9. Atualizar o registro com a URL do arquivo
    await supabase
      .from('medidas_disciplinares')
      .update({ arquivo_assinado_url: fileUrl })
      .eq('id', insertedWarning.id);

    // 10. Retornar HTML pro frontend abrir em nova aba
    return new NextResponse(processedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Supabase-File-Url': fileUrl,
        'X-Warning-Id': insertedWarning.id
      }
    });

  } catch (error) {
    console.error('Erro geral na API:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor', 
      details: error instanceof Error ? error.message : 'Erro desconhecido' 
    }, { status: 500 });
  }
}
