import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

export async function POST(req: NextRequest) {
  try {
    const { orderIds } = await req.json();
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Lista de IDs de ordens é obrigatória' }, { status: 400 });
    }

    console.log(`📥 Iniciando download em massa de ${orderIds.length} PDFs...`);

    // Usar o mesmo cliente que a API de criação usa
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar ordens (usando a mesma abordagem que funciona)
    const { data: orders, error: ordersError } = await supabase
      .from('discount_orders')
      .select('*')
      .in('id', orderIds);

    console.log('📊 Ordens encontradas no banco:', orders?.length || 0);

    if (ordersError) {
      console.error('❌ Erro ao buscar ordens:', ordersError);
      return NextResponse.json({ error: 'Erro ao buscar ordens' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Nenhuma ordem encontrada com os IDs fornecidos' }, { status: 404 });
    }

    // Filtrar apenas ordens pendentes com PDF
    const validOrders = orders.filter(order => {
      const status = order.recusado ? 'recusada' : order.data_assinatura ? 'assinada' : 'pendente';
      return status === 'pendente' && order.arquivo_assinado_url;
    });

    console.log(`📊 Ordens válidas para download: ${validOrders.length} de ${orders.length}`);

    if (validOrders.length === 0) {
      return NextResponse.json({ error: 'Nenhuma ordem pendente com PDF encontrada' }, { status: 404 });
    }

    // 2. Buscar informações dos usuários
    const userIds = [...new Set(validOrders.map(o => o.target_user_id))];
    const { data: users } = await supabase
      .from('usuarios')
      .select('id, nome, matricula')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // 3. Baixar PDFs e criar ZIP
    const zip = new JSZip();
    let successfulDownloads = 0;
    let failedDownloads = 0;

    for (const order of validOrders) {
      try {
        const user = userMap.get(order.target_user_id);
        const userName = user?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'usuario';
        const userMatricula = user?.matricula || 'sem_matricula';
        const fileName = `ordem_${order.id}_${userName}_${userMatricula}.pdf`;
        
        // Baixar PDF da URL
        const response = await fetch(order.arquivo_assinado_url);
        if (!response.ok) {
          throw new Error(`Erro ao baixar PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = await response.arrayBuffer();
        zip.file(fileName, pdfBuffer);
        successfulDownloads++;
        
        console.log(`✅ PDF baixado: ${fileName}`);
      } catch (error) {
        console.error(`❌ Erro ao baixar PDF da ordem ${order.id}:`, error);
        failedDownloads++;
      }
    }

    if (successfulDownloads === 0) {
      return NextResponse.json({ error: 'Nenhum PDF pôde ser baixado com sucesso' }, { status: 500 });
    }

    // 4. Gerar ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFileName = `ordens_desconto_download_${Date.now()}.zip`;

    console.log(`✅ Download em massa concluído. Sucessos: ${successfulDownloads}, Falhas: ${failedDownloads}`);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'X-Successful-Count': successfulDownloads.toString(),
        'X-Failed-Count': failedDownloads.toString()
      }
    });

  } catch (error) {
    console.error('💥 Erro geral na API de download em massa:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor', 
      details: error instanceof Error ? error.message : 'Erro desconhecido' 
    }, { status: 500 });
  }
}