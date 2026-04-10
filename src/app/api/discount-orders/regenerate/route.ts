import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gerarHtmlOrdemDesconto } from '../pdfGenerator';

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId é obrigatório' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar ordem existente
  const { data: order, error: orderError } = await supabase
    .from('discount_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Ordem não encontrada' }, { status: 404 });
  }

  // Buscar nome do colaborador
  const { data: user } = await supabase
    .from('usuarios')
    .select('nome, matricula')
    .eq('id', order.target_user_id)
    .single();
  const nomeColaborador = user?.nome || '________________';

  // Buscar estado da base com fallback
  let estadoBase = '';
  if (order.base_id) {
    const { data: baseData } = await supabase
      .from('bases').select('estado').eq('id', order.base_id).single();
    if (baseData?.estado) estadoBase = baseData.estado;
  }
  if (!estadoBase && order.created_by) {
    const { data: userData } = await supabase
      .from('usuarios').select('base_id').eq('id', order.created_by).single();
    if (userData?.base_id) {
      const { data: baseData } = await supabase
        .from('bases').select('estado').eq('id', userData.base_id).single();
      if (baseData?.estado) estadoBase = baseData.estado;
    }
  }
  if (!estadoBase && order.target_user_id) {
    const { data: userData } = await supabase
      .from('usuarios').select('base_id').eq('id', order.target_user_id).single();
    if (userData?.base_id) {
      const { data: baseData } = await supabase
        .from('bases').select('estado').eq('id', userData.base_id).single();
      if (baseData?.estado) estadoBase = baseData.estado;
    }
  }
  if (!estadoBase) estadoBase = 'São Paulo';

  try {
    const html = await gerarHtmlOrdemDesconto({
      nomeColaborador,
      cpf: order.cpf,
      descricao: order.descricao,
      placa: order.placa,
      auto_infracao: order.auto_infracao,
      valor_total: order.valor_total,
      valor_parcela: order.valor_parcela,
      parcelas: order.parcelas,
      documentos: order.documentos,
      outros_documentos: order.outros_documentos,
      estadoBase,
      data_geracao: order.data_geracao,
    });
    console.log('✅ HTML regenerado. Tamanho:', html.length);

    // Upload
    const htmlBuffer = Buffer.from(html, 'utf-8');
    const fileName = `discount-order-${orderId}-${Date.now()}.html`;
    const bucket = 'ordens-desconto-pdfs';
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, htmlBuffer, { contentType: 'text/html', upsert: true });

    if (uploadError) {
      console.warn('⚠️ Erro no upload do HTML:', uploadError.message);
    }

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
    await supabase.from('discount_orders').update({ arquivo_assinado_url: fileUrl }).eq('id', orderId);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Supabase-File-Url': fileUrl,
        'X-Discount-Order-Id': orderId,
      },
    });

  } catch (e) {
    console.error('Erro ao regenerar HTML:', e);
    return NextResponse.json({ error: 'Erro ao gerar documento', details: (e as Error).message }, { status: 500 });
  }
}
