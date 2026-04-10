import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  try {
    const { orderId, type, index } = await request.json();

    if (!orderId || !type || index === undefined) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: orderId, type, index' }, { status: 400 });
    }

    if (!['damages', 'documents'].includes(type)) {
      return NextResponse.json({ error: 'Tipo deve ser "damages" ou "documents"' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar a ordem atual
    const { data: order, error: fetchError } = await supabase
      .from('discount_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    // Obter as URLs atuais
    const currentUrls = type === 'damages' 
      ? order.danos_evidencias_urls || []
      : order.nf_os_documentos_urls || [];

    if (index < 0 || index >= currentUrls.length) {
      return NextResponse.json({ error: 'Índice inválido' }, { status: 400 });
    }

    const urlToDelete = currentUrls[index];
    const fileName = urlToDelete.split('/').pop();
    
    // Remover do storage se o arquivo existir
    if (fileName) {
      const filePath = `discount-orders/${orderId}/${fileName}`;
      const { error: storageError } = await supabase.storage
        .from('pse-files')
        .remove([filePath]);

      if (storageError) {
        console.warn('Aviso: Erro ao remover arquivo do storage:', storageError);
        // Não falhar se o arquivo não existir no storage
      }
    }

    // Remover da lista de URLs
    const updatedUrls = currentUrls.filter((_: string, i: number) => i !== index);

    // Atualizar no banco de dados
    const { error: updateError } = await supabase
      .from('discount_orders')
      .update({
        [type === 'damages' ? 'danos_evidencias_urls' : 'nf_os_documentos_urls']: updatedUrls
      })
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar ordem: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Anexo excluído com sucesso!',
      updatedUrls 
    });

  } catch (error) {
    console.error('Erro na API de exclusão de anexo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

