import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendWhatsAppToMultiple, sendWhatsAppImage, formatDenunciaMessage } from '@/lib/whatsapp';
import { sendEmailToMultiple, formatDenunciaEmail, type EmailResult } from '@/lib/email';

/**
 * POST /api/denuncias
 * Cria uma nova denúncia com evidências (fotos)
 * Endpoint público - não requer autenticação
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extrair dados do formulário
    const anonimo = formData.get('anonimo') === 'true';
    const email = formData.get('email')?.toString() || null;
    const matricula = formData.get('matricula')?.toString() || null;
    const baseId = formData.get('base_id')?.toString();
    const descricao = formData.get('descricao')?.toString();
    
    // Validar campos obrigatórios
    if (!baseId) {
      return NextResponse.json(
        { error: 'Base é obrigatória' },
        { status: 400 }
      );
    }
    
    if (!descricao || descricao.trim().length === 0) {
      return NextResponse.json(
        { error: 'Descrição da denúncia é obrigatória' },
        { status: 400 }
      );
    }
    
    // Validar se não é anônimo, deve ter email e matrícula
    if (!anonimo) {
      if (!email || email.trim().length === 0) {
        return NextResponse.json(
          { error: 'Email é obrigatório quando a denúncia não é anônima' },
          { status: 400 }
        );
      }
      if (!matricula || matricula.trim().length === 0) {
        return NextResponse.json(
          { error: 'Matrícula é obrigatória quando a denúncia não é anônima' },
          { status: 400 }
        );
      }
    }
    
    // Obter informações da requisição para segurança
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Usar service role para bypassar RLS
    const supabaseAdmin = createClient();
    
    // Verificar se a base existe e está ativa
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id, nome, ativa')
      .eq('id', baseId)
      .eq('ativa', true)
      .single();
    
    if (baseError || !base) {
      return NextResponse.json(
        { error: 'Base não encontrada ou inativa' },
        { status: 404 }
      );
    }
    
    // Criar a denúncia
    const denunciaData: {
      anonimo: boolean;
      email: string | null;
      matricula: string | null;
      base_id: string;
      descricao: string;
      status: string;
      ip_address: string;
      user_agent: string;
    } = {
      anonimo,
      email: anonimo ? null : email,
      matricula: anonimo ? null : matricula,
      base_id: baseId,
      descricao: descricao.trim(),
      status: 'pendente',
      ip_address: ipAddress,
      user_agent: userAgent,
    };
    
    const { data: denuncia, error: denunciaError } = await supabaseAdmin
      .from('denuncias')
      .insert(denunciaData)
      .select()
      .single();
    
    if (denunciaError) {
      console.error('❌ Erro ao criar denúncia:', denunciaError);
      return NextResponse.json(
        { error: 'Erro ao criar denúncia', details: denunciaError.message },
        { status: 500 }
      );
    }
    
    // Processar evidências (fotos)
    const evidencias: Array<{
      denuncia_id: string;
      arquivo_url: string;
      arquivo_path: string;
      nome_arquivo: string;
      tipo_mime: string;
      tamanho_bytes: number;
      ordem: number;
    }> = [];
    const files = formData.getAll('evidencias') as File[];
    
    if (files && files.length > 0) {
      // Validar e fazer upload de cada arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB por arquivo
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
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
        const fileName = `denuncia_${denuncia.id}_${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `denuncias/${fileName}`;
        
        // Upload para o bucket
        const { error: uploadError } = await supabaseAdmin.storage
          .from('denuncias')
          .upload(filePath, file, {
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
        
        // Adicionar à lista de evidências
        evidencias.push({
          denuncia_id: denuncia.id,
          arquivo_url: urlData.publicUrl,
          arquivo_path: filePath,
          nome_arquivo: file.name,
          tipo_mime: file.type,
          tamanho_bytes: file.size,
          ordem: i
        });
      }
      
      // Inserir evidências no banco
      if (evidencias.length > 0) {
        const { error: evidenciasError } = await supabaseAdmin
          .from('denuncias_evidencias')
          .insert(evidencias);
        
        if (evidenciasError) {
          console.error('❌ Erro ao salvar evidências:', evidenciasError);
          // Não falhar a denúncia se apenas o upload de evidências falhar
        }
      }
    }
    
    console.log(`✅ Denúncia criada: ${denuncia.id} com ${evidencias.length} evidências`);
    
    // Enviar notificação via WhatsApp para os números configurados
    try {
      // Buscar números ativos do banco de dados
      const { data: numerosAtivos } = await supabaseAdmin
        .from('denuncias_whatsapp_numeros')
        .select('numero')
        .eq('ativo', true);
      
      // Fallback para variável de ambiente (compatibilidade)
      let whatsappNumbers: string[] = [];
      
      if (numerosAtivos && numerosAtivos.length > 0) {
        // Usar números do banco de dados
        whatsappNumbers = numerosAtivos.map(n => n.numero);
      } else if (process.env.WHATSAPP_DENUNCIAS_NUMBERS) {
        // Fallback para variável de ambiente
        whatsappNumbers = process.env.WHATSAPP_DENUNCIAS_NUMBERS.split(',').map(n => n.trim()).filter(Boolean);
        console.warn('⚠️ Usando números da variável de ambiente. Configure os números no banco de dados em /admin/denuncias-whatsapp');
      }
      
      if (whatsappNumbers.length > 0) {
        console.log(`📱 Enviando WhatsApp para ${whatsappNumbers.length} número(s) cadastrado(s)...`);
        
        const message = formatDenunciaMessage({
          id: denuncia.id,
          base: base.nome,
          descricao: descricao.trim(),
          anonimo,
          email: anonimo ? undefined : email || undefined,
          matricula: anonimo ? undefined : matricula || undefined,
          evidencias_count: evidencias.length
        });

        // Coletar URLs das evidências
        const evidenciasUrls = evidencias.map(e => e.arquivo_url);

        // Enviar mensagem de texto para TODOS os números cadastrados
        sendWhatsAppToMultiple(whatsappNumbers, message).then(async (results) => {
          results.forEach((result) => {
            if (result.success) {
              console.log(`✅ Mensagem de texto enviada para ${result.number}`);
            } else {
              console.error(`❌ Erro ao enviar mensagem de texto para ${result.number}:`, result.error);
            }
          });

          // Enviar imagens para todos os números que receberam a mensagem com sucesso
          const numerosSucesso = results
            .filter(r => r.success)
            .map(r => r.number);

          if (numerosSucesso.length > 0 && evidenciasUrls.length > 0) {
            console.log(`📷 Enviando ${evidenciasUrls.length} evidência(s) para ${numerosSucesso.length} número(s)...`);
            
            // Enviar cada imagem para cada número
            for (const numero of numerosSucesso) {
              for (let i = 0; i < evidenciasUrls.length; i++) {
                const imageUrl = evidenciasUrls[i];
                try {
                  const imageResult = await sendWhatsAppImage(
                    numero, 
                    imageUrl, 
                    `Evidência ${i + 1} da denúncia #${denuncia.id.substring(0, 8)}`
                  );
                  
                  if (imageResult.success) {
                    console.log(`✅ Imagem ${i + 1} enviada para ${numero}`);
                  } else {
                    console.error(`❌ Erro ao enviar imagem ${i + 1} para ${numero}:`, imageResult.error);
                  }
                  
                  // Pequeno delay entre envios para evitar rate limiting
                  if (i < evidenciasUrls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                } catch (imageError) {
                  console.error(`❌ Erro ao enviar imagem ${i + 1} para ${numero}:`, imageError);
                }
              }
              
              // Delay entre números
              if (numerosSucesso.indexOf(numero) < numerosSucesso.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            console.log(`✅ Processo de envio de evidências concluído`);
          }
        }).catch(error => {
          console.error('❌ Erro ao enviar WhatsApp:', error);
          // Não falhar a denúncia se o WhatsApp falhar
        });
      } else {
        console.warn('⚠️ Nenhum número de WhatsApp configurado para denúncias. Configure em /admin/denuncias-whatsapp');
      }
    } catch (error) {
      console.error('❌ Erro ao processar envio de WhatsApp:', error);
      // Não falhar a denúncia se o WhatsApp falhar
    }

    // Enviar notificação via Email para os emails configurados
    try {
      // Buscar emails ativos do banco de dados (incluindo emails de usuários vinculados)
      const { data: emailsAtivos } = await supabaseAdmin
        .from('denuncias_email_destinatarios')
        .select(`
          email,
          usuario_id,
          usuarios!denuncias_email_destinatarios_usuario_id_fkey(email, nome, status)
        `)
        .eq('ativo', true);
      
      // Fallback para variável de ambiente (compatibilidade)
      let emailDestinatarios: string[] = [];
      
      if (emailsAtivos && emailsAtivos.length > 0) {
        // Processar emails: usar email do usuário se houver usuario_id, senão usar email direto
        type EmailItem = {
          email: string;
          usuario_id?: string | null;
          usuarios?: {email: string; nome: string; status: string} | Array<{email: string; nome: string; status: string}> | null;
        };
        emailDestinatarios = emailsAtivos
          .map((e: EmailItem) => {
            // Se tem usuario_id vinculado, usar email do usuário (se usuário estiver ativo)
            if (e.usuario_id && e.usuarios) {
              const usuario = Array.isArray(e.usuarios) ? e.usuarios[0] : e.usuarios;
              if (usuario && usuario.status === 'ativo' && usuario.email) {
                return usuario.email;
              }
              return null; // Usuário inativo ou sem email
            }
            // Senão, usar email direto da tabela
            return e.email;
          })
          .filter((email: string | null): email is string => email !== null && email.trim() !== '');
      } else if (process.env.EMAIL_DENUNCIAS_DESTINATARIOS) {
        // Fallback para variável de ambiente
        emailDestinatarios = process.env.EMAIL_DENUNCIAS_DESTINATARIOS.split(',').map(e => e.trim()).filter(Boolean);
        console.warn('⚠️ Usando emails da variável de ambiente. Configure os emails no banco de dados.');
      }
      
      if (emailDestinatarios.length > 0) {
        console.log(`📧 Enviando email para ${emailDestinatarios.length} destinatário(s) cadastrado(s)...`);
        
        // Coletar URLs das evidências
        const evidenciasUrls = evidencias.map(e => e.arquivo_url);

        const emailContent = formatDenunciaEmail({
          id: denuncia.id,
          base: base.nome,
          descricao: descricao.trim(),
          anonimo,
          email: anonimo ? undefined : email || undefined,
          matricula: anonimo ? undefined : matricula || undefined,
          evidencias_count: evidencias.length,
          evidencias_urls: evidenciasUrls
        });

        // Enviar email para TODOS os destinatários cadastrados (não bloqueia a resposta)
        sendEmailToMultiple(emailDestinatarios, emailContent).then((results: EmailResult[]) => {
          results.forEach((result: EmailResult) => {
            if (result.success) {
              console.log(`✅ Email enviado para ${result.email}`);
            } else {
              console.error(`❌ Erro ao enviar email para ${result.email}:`, result.error);
            }
          });
        }).catch((error: unknown) => {
          console.error('❌ Erro ao enviar emails:', error);
          // Não falhar a denúncia se o email falhar
        });
      } else {
        console.warn('⚠️ Nenhum email configurado para denúncias. Configure os emails no banco de dados.');
      }
    } catch (error) {
      console.error('❌ Erro ao processar envio de emails:', error);
      // Não falhar a denúncia se o email falhar
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: denuncia.id,
        status: denuncia.status,
        evidencias_count: evidencias.length
      },
      message: 'Denúncia enviada com sucesso!'
    });
    
  } catch (error) {
    console.error('❌ Erro inesperado ao criar denúncia:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao criar denúncia', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/denuncias
 * Lista denúncias (apenas para usuários autenticados)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const baseId = searchParams.get('base_id');
    
    const supabaseAdmin = createClient();
    
    let query = supabaseAdmin
      .from('denuncias')
      .select(`
        id,
        anonimo,
        email,
        matricula,
        base_id,
        descricao,
        status,
        criado_em,
        atualizado_em,
        base:bases(id, nome, codigo),
        evidencias:denuncias_evidencias(id, arquivo_url, nome_arquivo, ordem)
      `)
      .order('criado_em', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (baseId) {
      query = query.eq('base_id', baseId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao buscar denúncias:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar denúncias', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ denuncias: data || [] });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar denúncias:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao buscar denúncias', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

