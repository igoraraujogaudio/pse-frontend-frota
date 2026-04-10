import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gerarHtmlOrdemDesconto } from './pdfGenerator';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    created_by, target_user_id, valor_total, valor_parcela, parcelas,
    descricao, placa, cpf, documentos, data_geracao, outros_documentos, base_id,
    tipo_documento, numero_documento, valor_documento, data_documento,
    observacoes_danos, observacoes_documentos, danos_evidencias, nf_os_documentos,
    auto_infracao,
  } = body;

  console.log('🔍 Criando ordem de desconto...');
  console.log('base_id recebido:', base_id);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar nome do colaborador
  const { data: user } = await supabase
    .from('usuarios')
    .select('nome, matricula')
    .eq('id', target_user_id)
    .single();
  const nomeColaborador = user?.nome || '________________';

  // Buscar estado da base
  let estadoBase = '';
  if (base_id) {
    const { data: baseData, error: baseError } = await supabase
      .from('bases')
      .select('estado')
      .eq('id', base_id)
      .single();
    if (!baseError && baseData && baseData.estado) {
      estadoBase = baseData.estado;
    } else {
      return NextResponse.json({ error: 'Não foi possível encontrar o estado da base selecionada.', base_id }, { status: 400 });
    }
  }

  try {
    // Gerar HTML a partir do template
    const html = await gerarHtmlOrdemDesconto({
      nomeColaborador,
      cpf,
      descricao,
      placa,
      auto_infracao,
      valor_total,
      valor_parcela,
      parcelas,
      documentos,
      outros_documentos,
      estadoBase,
      data_geracao,
    });
    console.log('✅ HTML gerado a partir do template. Tamanho:', html.length);

    // Salvar no banco
    const { data: order, error: orderError } = await supabase
      .from('discount_orders')
      .insert([{
        created_by, target_user_id, valor_total, valor_parcela, parcelas,
        descricao, placa, cpf, documentos, outros_documentos, data_geracao,
        auto_infracao: auto_infracao || null,
        base_id: base_id || null,
        status: 'pendente',
        tipo_documento: tipo_documento || 'nf',
        numero_documento: numero_documento || null,
        valor_documento: valor_documento || null,
        data_documento: data_documento || null,
        observacoes_danos: observacoes_danos || null,
        observacoes_documentos: observacoes_documentos || null,
        danos_evidencias_urls: danos_evidencias || [],
        nf_os_documentos_urls: nf_os_documentos || [],
        criado_por_setor: (!!placa || (documentos && documentos.includes('Multa de Trânsito INFRAÇÃO'))) ? 'frota' : 'almoxarifado',
      }])
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Erro ao criar ordem' }, { status: 400 });
    }

    // Upload do HTML pro Supabase Storage (pra ter registro salvo)
    const htmlBuffer = Buffer.from(html, 'utf-8');
    const fileName = `discount-order-${order.id}.html`;
    const bucket = 'ordens-desconto-pdfs';
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, htmlBuffer, { contentType: 'text/html', upsert: true });

    if (uploadError) {
      console.warn('⚠️ Erro no upload do HTML:', uploadError.message);
    }

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
    await supabase.from('discount_orders').update({ arquivo_assinado_url: fileUrl }).eq('id', order.id);

    console.log('✅ Ordem criada:', order.id);

    // Retornar HTML pro frontend abrir em nova aba
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Supabase-File-Url': fileUrl,
        'X-Discount-Order-Id': String(order.id),
      },
    });

  } catch (e) {
    console.error('Erro ao gerar HTML:', e);
    return NextResponse.json({ error: 'Erro ao gerar documento', details: (e as Error).message }, { status: 500 });
  }
}
