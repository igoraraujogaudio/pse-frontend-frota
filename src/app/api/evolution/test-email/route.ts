import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail, formatDenunciaEmail } from '@/lib/email';

/**
 * POST /api/evolution/test-email
 * Endpoint para testar envio de email de denúncia completa com evidências
 * Salva no banco de dados e envia email com links para fotos
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const email = formData.get('email')?.toString();
    const message = formData.get('message')?.toString();
    const evidencias = formData.getAll('evidencias') as File[];

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient();
    const testId = `test-${Date.now()}`;

    // Buscar uma base válida para o teste (usar a primeira base ativa)
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id, nome')
      .eq('ativa', true)
      .limit(1)
      .single();

    let denuncia: { id: string } | null = null;
    const evidenciasUrls: string[] = [];

    // Tentar criar denúncia de teste no banco de dados (apenas se tiver base)
    if (base && !baseError) {
      const denunciaData = {
        anonimo: true,
        email: null,
        matricula: null,
        base_id: base.id,
        descricao: message || 'Esta é uma denúncia de teste do sistema. A denúncia foi criada para verificar se o envio de notificações está funcionando corretamente.',
        status: 'pendente',
        ip_address: request.headers.get('x-forwarded-for') || 'test',
        user_agent: request.headers.get('user-agent') || 'test',
        observacoes_internas: 'DENÚNCIA DE TESTE - Criada via /api/evolution/test-email'
      };

      const { data: denunciaCriada, error: denunciaError } = await supabaseAdmin
        .from('denuncias')
        .insert(denunciaData)
        .select('id')
        .single();

      if (denunciaError) {
        console.warn('⚠️ Erro ao criar denúncia de teste:', denunciaError);
      } else {
        denuncia = denunciaCriada;
        console.log(`✅ Denúncia de teste criada: ${denuncia.id}`);
      }
    } else {
      console.warn('⚠️ Nenhuma base ativa encontrada. Continuando sem salvar no banco.');
    }

    // Processar evidências se houver
    if (evidencias.length > 0) {
      const denunciaId = denuncia?.id || testId;

      for (let i = 0; i < evidencias.length; i++) {
        const file = evidencias[i];
        
        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
          console.warn(`⚠️ Arquivo ${file.name} não é uma imagem. Pulando...`);
          continue;
        }

        // Validar tamanho (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`⚠️ Arquivo ${file.name} excede 10MB. Pulando...`);
          continue;
        }

        try {
          // Converter File para ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Gerar nome único para o arquivo
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 15);
          const fileExt = file.name.split('.').pop() || 'jpg';
          const fileName = `denuncia_${denunciaId}_${timestamp}_${i}_${randomStr}.${fileExt}`;
          const filePath = `denuncias/${fileName}`;

          // Upload para Supabase Storage
          const { error: uploadError } = await supabaseAdmin.storage
            .from('denuncias')
            .upload(filePath, buffer, {
              contentType: file.type,
              upsert: false
            });

          if (uploadError) {
            console.error(`❌ Erro ao fazer upload de ${file.name}:`, uploadError);
            continue;
          }

          // Obter URL pública
          const { data: urlData } = supabaseAdmin.storage
            .from('denuncias')
            .getPublicUrl(filePath);

          if (urlData?.publicUrl) {
            evidenciasUrls.push(urlData.publicUrl);
            console.log(`✅ Upload concluído: ${filePath}`);

            // Salvar evidência no banco se tiver denúncia
            if (denuncia) {
              const { error: evidenciaError } = await supabaseAdmin
                .from('denuncias_evidencias')
                .insert({
                  denuncia_id: denuncia.id,
                  arquivo_url: urlData.publicUrl,
                  arquivo_nome: file.name,
                  arquivo_tipo: file.type,
                  arquivo_tamanho: file.size
                });

              if (evidenciaError) {
                console.error('❌ Erro ao salvar evidência no banco:', evidenciaError);
              }
            }
          }
        } catch (fileError) {
          console.error(`❌ Erro ao processar arquivo ${file.name}:`, fileError);
        }
      }
    }

    // Formatar e enviar email
    const baseNome = base?.nome || 'Base Teste';
    const denunciaId = denuncia?.id || testId;
    const descricao = message || 'Esta é uma denúncia de teste do sistema. A denúncia foi criada para verificar se o envio de notificações está funcionando corretamente.';

    const emailContent = formatDenunciaEmail({
      id: denunciaId,
      base: baseNome,
      descricao: descricao,
      anonimo: true,
      evidencias_count: evidenciasUrls.length,
      evidencias_urls: evidenciasUrls
    });

    // Enviar email
    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Erro ao enviar email',
          denuncia_saved: denuncia !== null,
          evidencias_uploaded: evidenciasUrls.length,
          evidencias_saved_to_db: denuncia ? evidenciasUrls.length : 0
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email de teste enviado com sucesso!',
      email: email,
      denuncia_saved: denuncia !== null,
      denuncia_id: denuncia?.id || null,
      evidencias_uploaded: evidenciasUrls.length,
      evidencias_saved_to_db: denuncia ? evidenciasUrls.length : 0,
      evidencias_urls: evidenciasUrls
    });
  } catch (error) {
    console.error('❌ Erro ao testar envio de email:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
