import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs/promises';
import path from 'path';

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
  const { warningId } = await req.json();

  try {
    // 1. Busca o aviso com joins
    const { data: warning, error: warningError } = await supabase
      .from('medidas_disciplinares')
      .select(`
        *,
        target_user:usuarios!medidas_disciplinares_target_user_id_fkey(id, nome, email, cpf, matricula, cargo, departamento),
        base:bases!medidas_disciplinares_base_id_fkey(id, nome, estado, endereco, cidade, contrato_id)
      `)
      .eq('id', warningId)
      .single();

    if (warningError || !warning) {
      return NextResponse.json({ error: 'Aviso não encontrado' }, { status: 404 });
    }

    // 2. Busca CNPJ e nome do contrato
    let cnpj = '';
    let nomeContrato = '';
    if (warning.base?.contrato_id) {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('CNPJ, nome')
        .eq('id', warning.base.contrato_id)
        .single();
      if (contrato) {
        cnpj = contrato.CNPJ || '';
        nomeContrato = contrato.nome || '';
      }
    }

    // 3. Gera HTML a partir do template (sem Puppeteer)
    const templatePath = path.resolve(process.cwd(), `src/templates/${warning.tipo_aviso}Pdf.html`);
    let html;
    try {
      html = await fs.readFile(templatePath, 'utf8');
    } catch (e) {
      console.error('Erro ao ler template HTML:', e);
      return NextResponse.json({ error: 'Erro ao ler template HTML' }, { status: 500 });
    }

    const templateData: Record<string, string> = {
      nome_colaborador: warning.target_user?.nome || '',
      cpf: formatCPF(warning.target_user?.cpf || ''),
      matricula: warning.target_user?.matricula || '',
      cargo: warning.target_user?.cargo || '',
      setor: warning.target_user?.departamento || '',
      base_nome: nomeContrato || warning.base?.nome || 'Contrato não encontrado',
      cidade_base: warning.base?.cidade || '',
      estado_base: warning.base?.estado || '',
      endereco_base: warning.base?.endereco || '',
      cnpj_base: formatCNPJ(cnpj),
      data_geracao: new Date().toLocaleDateString('pt-BR'),
      descricao: warning.descricao,
      motivo: warning.motivo,
      data_ocorrencia: new Date(warning.data_ocorrencia).toLocaleDateString('pt-BR'),
      observacoes: warning.observacoes || '',
      periodo_suspensao: warning.periodo_suspensao || '',
      data_inicio_suspensao: warning.data_inicio_suspensao ? new Date(warning.data_inicio_suspensao).toLocaleDateString('pt-BR') : '',
      data_fim_suspensao: warning.data_fim_suspensao ? new Date(warning.data_fim_suspensao).toLocaleDateString('pt-BR') : '',
      data_retorno_conclusoes: warning.data_retorno_conclusoes ? new Date(warning.data_retorno_conclusoes).toLocaleDateString('pt-BR') : '',
      tipo_aviso: warning.tipo_aviso,
      tipo_aviso_titulo: getTipoAvisoTitulo(warning.tipo_aviso),
      'documentos_comprobatórios': gerarDocumentosComprobatorios(warning.documentos_urls || []),
      testemunha1_nome: warning.testemunha1_nome || '',
      testemunha1_cpf: warning.testemunha1_cpf || '',
      testemunha2_nome: warning.testemunha2_nome || '',
      testemunha2_cpf: warning.testemunha2_cpf || ''
    };

    let processedHtml = html;
    Object.entries(templateData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    // 4. Upload do HTML para o Supabase Storage
    const htmlBuffer = Buffer.from(processedHtml, 'utf-8');
    const fileName = `aviso_${warning.tipo_aviso}_${warning.id}_${Date.now()}.html`;
    const bucket = 'medidas-disciplinares';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, htmlBuffer, { contentType: 'text/html', upsert: true });

    if (uploadError) {
      console.warn('Erro no upload do HTML:', uploadError.message);
    }

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;

    // 5. Atualizar o registro com a nova URL
    await supabase
      .from('medidas_disciplinares')
      .update({ arquivo_assinado_url: fileUrl })
      .eq('id', warning.id);

    // 6. Retornar HTML pro frontend
    return new NextResponse(processedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Supabase-File-Url': fileUrl,
        'X-Warning-Id': warning.id
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
