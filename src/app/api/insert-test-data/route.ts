import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  console.log('🚀 API insert-test-data chamada!');
  
  try {
    // Inserir uma ordem de teste
    const testOrder = {
      id: '0852d45e-ad5c-4304-a3ce-c72077b26321',
      created_by: '95473deb-d1fe-437a-b779-45c3a4610e87',
      target_user_id: '722c3229-8b17-4340-83a8-1d806efb8e5b',
      valor_total: '343.60',
      valor_parcela: '343.60',
      parcelas: '1',
      descricao: 'EXECUTAR OPERAÇÃO DE CONVERSÃO A ESQUERDA EM LOCAL PROIBIDO PELA SINALIZAÇÃO   N30749951 - N30755345',
      placa: 'RNU7E60',
      documentos: '["Multa de Trânsito"]',
      data_geracao: '2025-09-23 00:00:00+00',
      data_assinatura: null,
      arquivo_assinado_url: 'https://supabase.pse.srv.br/storage/v1/object/public/ordens-desconto-pdfs/discount-order-0852d45e-ad5c-4304-a3ce-c72077b26321.pdf',
      recusado: false,
      testemunha1_nome: null,
      testemunha1_cpf: null,
      testemunha2_nome: null,
      testemunha2_cpf: null,
      cpf: '131.818.227-10',
      outros_documentos: '',
      status: 'pendente',
      danos_evidencias: '[]',
      nf_os_documentos: '[]',
      tipo_documento: 'nf',
      numero_documento: null,
      valor_documento: null,
      data_documento: null,
      observacoes_danos: null,
      observacoes_documentos: null,
      updated_at: '2025-09-23 15:58:40.914556+00',
      danos_evidencias_urls: '{}',
      nf_os_documentos_urls: '{"https://supabase.pse.srv.br/storage/v1/object/public/discount-orders-documents/0852d45e-ad5c-4304-a3ce-c72077b26321/document_20250923_155841_321e28c2-c6d2-4513-92ca-8dd21f735891.pdf","https://supabase.pse.srv.br/storage/v1/object/public/discount-orders-documents/0852d45e-ad5c-4304-a3ce-c72077b26321/document_20250923_155841_b3aa7dc9-9ce8-4ac1-bdf4-49b02893b9f7.pdf"}',
      created_at: '2025-09-23 15:58:40.914556+00',
      base_id: '348a2d01-e239-4ff3-9b54-858a098ab666',
      atualizado_em: '2025-09-23 15:58:40.914556+00'
    };

    const { data, error } = await supabase
      .from('discount_orders')
      .insert([testOrder])
      .select();
    
    console.log('📊 Dados inseridos:', data);
    console.log('❌ Erro na inserção:', error);
    
    return NextResponse.json({ 
      success: true, 
      data: data,
      error: error
    });
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }, { status: 500 });
  }
}
