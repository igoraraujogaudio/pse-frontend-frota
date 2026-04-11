import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const vehicleId = formData.get('vehicleId') as string;
    const tipoDocumento = formData.get('tipoDocumento') as string;
    const subtipoDocumento = formData.get('subtipoDocumento') as string; // NOVO CAMPO
    const expiraEm = formData.get('expiraEm') as string;
    const documentId = formData.get('documentId') as string;

    console.log('🔍 Upload individual - Dados recebidos:', {
      vehicleId,
      tipoDocumento,
      subtipoDocumento,
      expiraEm,
      documentId
    });

    if (!file || !vehicleId || !tipoDocumento) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    // Para laudos elétricos, verificar se subtipo foi fornecido
    if (tipoDocumento === 'eletrico' && !subtipoDocumento) {
      return NextResponse.json({ 
        error: 'Subtipo é obrigatório para laudos elétricos (lanca_isolada, liner, geral)' 
      }, { status: 400 });
    }

    // Função para limpar caracteres especiais do nome do arquivo
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD') // Decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Substituir caracteres especiais por underscore
        .toLowerCase();
    };

    // Função para normalizar tipos de documento (remover acentos)
    const normalizeDocumentType = (type: string) => {
      return type
        .normalize('NFD') // Decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .toLowerCase();
    };

    const fileExt = file.name.split('.').pop();
    const normalizedDocType = normalizeDocumentType(tipoDocumento);
    const sanitizedDocType = sanitizeFileName(tipoDocumento);
    const sanitizedSubtipo = subtipoDocumento ? sanitizeFileName(subtipoDocumento) : '';
    const fileName = `${vehicleId}/${sanitizedDocType}${sanitizedSubtipo ? `_${sanitizedSubtipo}` : ''}-${Date.now()}.${fileExt}`;

    // 1. Upload do arquivo
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from('vehicle-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/pdf',
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return NextResponse.json({ error: 'Erro no upload do arquivo' }, { status: 500 });
    }

    // 2. Obter URL pública
    const { data: { publicUrl } } = getSupabaseAdmin().storage
      .from('vehicle-documents')
      .getPublicUrl(fileName);

    // 3. Inserir ou atualizar documento
    // Se não há documentId ou é laudo elétrico com documento undefined, sempre criar novo
    if (!documentId || documentId === 'null' || (tipoDocumento === 'eletrico' && !documentId)) {
      // Inserir novo documento
      const insertData: Record<string, unknown> = {
        veiculo_id: vehicleId,
        tipo_documento: normalizedDocType,
        url_arquivo: publicUrl,
        expira_em: expiraEm
      };

      // Se for laudo elétrico e tiver subtipo, incluir o subtipo
      if (tipoDocumento === 'eletrico' && subtipoDocumento) {
        insertData.subtipo_documento = subtipoDocumento;
      }

      console.log('📝 Inserindo novo documento:', insertData);

      const { error: insertError } = await getSupabaseAdmin()
        .from('documentos_veiculo')
        .insert(insertData);

      if (insertError) {
        console.error('Erro ao inserir documento:', insertError);
        return NextResponse.json({ error: 'Erro ao inserir documento' }, { status: 500 });
      }
    } else {
      // Atualizar documento existente
      const updateData: Record<string, unknown> = {
        url_arquivo: publicUrl,
        expira_em: expiraEm
      };

      // Se for laudo elétrico e tiver subtipo, atualizar também o subtipo
      if (tipoDocumento === 'eletrico' && subtipoDocumento) {
        updateData.subtipo_documento = subtipoDocumento;
      }

      console.log('🔄 Atualizando documento existente:', {
        id: documentId,
        updateData
      });

      const { error: updateError } = await getSupabaseAdmin()
        .from('documentos_veiculo')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        console.error('Erro ao atualizar documento:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar documento' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: documentId ? 'Documento atualizado com sucesso' : 'Documento cadastrado com sucesso',
      url: publicUrl,
      subtipo: subtipoDocumento || null
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}