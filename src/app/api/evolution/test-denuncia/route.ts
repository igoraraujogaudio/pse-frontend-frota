import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppImage, formatDenunciaMessage } from '@/lib/whatsapp';

/**
 * POST /api/evolution/test-denuncia
 * Endpoint para testar envio de denúncia completa com evidências via Evolution API
 * Salva no banco de dados e envia fotos via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const number = formData.get('number')?.toString();
    const message = formData.get('message')?.toString();
    const evidencias = formData.getAll('evidencias') as File[];

    if (!number) {
      return NextResponse.json(
        { error: 'Número é obrigatório' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient();
    const testId = `test-${Date.now()}`;

    // Buscar uma base válida para o teste (usar a primeira base ativa)
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id')
      .eq('ativa', true)
      .limit(1)
      .single();

    let denuncia: { id: string } | null = null;

    // Tentar criar denúncia de teste no banco de dados (apenas se tiver base)
    if (base && !baseError) {
      const denunciaData = {
        anonimo: true,
        email: null,
        matricula: null,
        base_id: base.id,
        descricao: 'Esta é uma denúncia de teste do sistema. A denúncia foi criada para verificar se o envio de notificações está funcionando corretamente.',
        status: 'pendente',
        ip_address: request.headers.get('x-forwarded-for') || 'test',
        user_agent: request.headers.get('user-agent') || 'test',
        observacoes_internas: 'DENÚNCIA DE TESTE - Criada via /api/evolution/test-denuncia'
      };

      const { data: denunciaDataResult, error: denunciaError } = await supabaseAdmin
        .from('denuncias')
        .insert(denunciaData)
        .select()
        .single();

      if (denunciaError) {
        console.error('❌ Erro ao criar denúncia de teste:', denunciaError);
        // Continuar mesmo se falhar - é apenas um teste
      } else {
        denuncia = denunciaDataResult;
      }
    } else {
      console.warn('⚠️ Nenhuma base ativa encontrada. Denúncia de teste não será salva no banco, mas o envio de WhatsApp continuará.');
    }

    // Processar evidências (fotos) - sempre processar, mesmo sem denúncia no banco
    const evidenciasUrls: string[] = [];
    const evidenciasData: Array<{
      denuncia_id: string;
      arquivo_url: string;
      arquivo_path: string;
      nome_arquivo: string;
      tipo_mime: string;
      tamanho_bytes: number;
      ordem: number;
    }> = [];

    if (evidencias && evidencias.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB por arquivo

      for (let i = 0; i < evidencias.length; i++) {
        const file = evidencias[i];

        // Validar tipo
        if (!allowedTypes.includes(file.type)) {
          console.warn(`⚠️ Arquivo ${file.name} ignorado: tipo não permitido`);
          continue;
        }

        // Validar tamanho
        if (file.size > maxSize) {
          console.warn(`⚠️ Arquivo ${file.name} ignorado: muito grande (${file.size} bytes)`);
          continue;
        }

        // Gerar nome único para o arquivo
        const fileExt = file.name.split('.').pop() || 'jpg';
        const denunciaId = denuncia?.id || testId;
        const fileName = `denuncia_${denunciaId}_${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `denuncias/${fileName}`;

        // Upload para o bucket
        console.log(`📤 Fazendo upload de ${file.name} para o bucket denuncias...`);
        const { error: uploadError } = await supabaseAdmin.storage
          .from('denuncias')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Erro ao fazer upload de ${file.name}:`, uploadError);
          console.error(`   Detalhes:`, JSON.stringify(uploadError, null, 2));
          // Se o erro for de bucket não encontrado, informar
          if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
            console.error(`   ⚠️ BUCKET NÃO ENCONTRADO! Execute o script CRIAR_BUCKET_DENUNCIAS.sql no Supabase.`);
          }
          continue;
        }

        console.log(`✅ Upload concluído: ${filePath}`);

        // Obter URL pública
        const { data: urlData } = supabaseAdmin.storage
          .from('denuncias')
          .getPublicUrl(filePath);

        console.log(`🔗 URL pública gerada: ${urlData.publicUrl}`);
        evidenciasUrls.push(urlData.publicUrl);

        // Adicionar à lista de evidências para salvar no banco (apenas se tiver denúncia)
        if (denuncia) {
          evidenciasData.push({
            denuncia_id: denuncia.id,
            arquivo_url: urlData.publicUrl,
            arquivo_path: filePath,
            nome_arquivo: file.name,
            tipo_mime: file.type,
            tamanho_bytes: file.size,
            ordem: i
          });
        }
      }

      // Inserir evidências no banco (apenas se tiver denúncia e evidências)
      if (denuncia && evidenciasData.length > 0) {
        console.log(`💾 Salvando ${evidenciasData.length} evidência(s) no banco de dados...`);
        const { data: evidenciasInserted, error: evidenciasError } = await supabaseAdmin
          .from('denuncias_evidencias')
          .insert(evidenciasData)
          .select();

        if (evidenciasError) {
          console.error('❌ Erro ao salvar evidências:', evidenciasError);
          console.error(`   Detalhes:`, JSON.stringify(evidenciasError, null, 2));
          // Continuar mesmo se falhar
        } else {
          console.log(`✅ ${evidenciasInserted?.length || 0} evidência(s) salva(s) no banco de dados`);
        }
      } else {
        if (!denuncia) {
          console.warn('⚠️ Denúncia não foi criada, evidências não serão salvas no banco (mas serão enviadas via WhatsApp)');
        }
        if (denuncia && evidenciasData.length === 0) {
          console.warn('⚠️ Nenhuma evidência válida para salvar no banco');
        }
      }
    }

    // Criar mensagem de teste de denúncia
    const testMessage = message || formatDenunciaMessage({
      id: denuncia?.id || testId,
      base: 'Base Teste',
      descricao: 'Esta é uma denúncia de teste do sistema. A denúncia foi criada para verificar se o envio de notificações está funcionando corretamente.',
      anonimo: true,
      evidencias_count: evidenciasUrls.length
    });

    // Enviar mensagem de texto
    const result = await sendWhatsAppMessage(number, testMessage);

    // Enviar imagens via WhatsApp
    const imageResults: Array<{ url: string; success: boolean; error?: string }> = [];
    if (evidenciasUrls.length > 0) {
      console.log(`📷 Enviando ${evidenciasUrls.length} imagem(ns) via WhatsApp...`);
      for (let i = 0; i < evidenciasUrls.length; i++) {
        const imageUrl = evidenciasUrls[i];
        console.log(`📤 Enviando imagem ${i + 1}/${evidenciasUrls.length}: ${imageUrl.substring(0, 50)}...`);
        const imageResult = await sendWhatsAppImage(number, imageUrl, `Evidência ${i + 1} da denúncia de teste`);
        imageResults.push({
          url: imageUrl,
          success: imageResult.success,
          error: imageResult.error
        });
        if (imageResult.success) {
          console.log(`✅ Imagem ${i + 1} enviada com sucesso`);
        } else {
          console.error(`❌ Erro ao enviar imagem ${i + 1}:`, imageResult.error);
        }
        // Pequeno delay entre envios para evitar rate limiting
        if (i < evidenciasUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      console.log('ℹ️ Nenhuma evidência para enviar via WhatsApp');
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Teste de denúncia enviado com sucesso!',
        number: number,
        denuncia_id: denuncia?.id || testId,
        denuncia_saved: !!denuncia,
        evidencias_count: evidenciasUrls.length,
        evidencias_uploaded: evidenciasUrls.length,
        evidencias_saved_to_db: denuncia ? evidenciasData.length : 0,
        evidencias_sent: imageResults.filter(r => r.success).length,
        evidencias_info: evidencias.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        })),
        image_results: imageResults,
        debug: {
          has_base: !!base,
          has_denuncia: !!denuncia,
          evidencias_urls_count: evidenciasUrls.length,
          evidencias_data_count: evidenciasData.length
        }
      });
    } else {
      // Determinar status HTTP baseado no tipo de erro
      const isClientError = result.error?.includes('não está registrado') || 
                           result.error?.includes('não existe') ||
                           result.error?.includes('Bad Request');
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erro ao enviar teste de denúncia',
          number: number,
          denuncia_id: denuncia?.id || testId,
          evidencias_count: evidenciasUrls.length,
          evidencias_sent: imageResults.filter(r => r.success).length,
          image_results: imageResults,
          hint: result.error?.includes('não está registrado') 
            ? 'Verifique se o número está correto e se a pessoa tem WhatsApp instalado e ativo.'
            : undefined
        },
        { status: isClientError ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('❌ Erro ao testar denúncia:', error);
    return NextResponse.json(
      {
        error: 'Erro ao testar denúncia',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
