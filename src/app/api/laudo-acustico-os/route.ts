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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentoId = searchParams.get('documentoId');

    if (!documentoId) {
      return NextResponse.json({ error: 'ID do documento é obrigatório' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('laudo_acustico_os')
      .select('*')
      .eq('documento_id', documentoId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar OS:', error);
      return NextResponse.json({ error: 'Erro ao buscar OS' }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentoId = formData.get('documentoId') as string;
    const numeroOS = formData.get('numeroOS') as string;
    const descricao = formData.get('descricao') as string;

    if (!file || !documentoId || !numeroOS) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    // Verificar se o documento é realmente um laudo acústico
    const { data: documento, error: docError } = await getSupabaseAdmin()
      .from('documentos_veiculo')
      .select('tipo_documento')
      .eq('id', documentoId)
      .single();

    if (docError || documento?.tipo_documento !== 'acustico') {
      return NextResponse.json({ error: 'Documento não é um laudo acústico' }, { status: 400 });
    }

    // Função para limpar caracteres especiais do nome do arquivo
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD') // Decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Substituir caracteres especiais por underscore
        .toLowerCase();
    };

    const fileExt = file.name.split('.').pop();
    const sanitizedOS = sanitizeFileName(numeroOS);
    const fileName = `laudos-acusticos-os/${documentoId}/${sanitizedOS}-${Date.now()}.${fileExt}`;

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

    // 3. Inserir OS no banco
    const { data, error: insertError } = await getSupabaseAdmin()
      .from('laudo_acustico_os')
      .insert({
        documento_id: documentoId,
        numero_os: numeroOS,
        descricao: descricao || null,
        url_arquivo: publicUrl
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir OS:', insertError);
      return NextResponse.json({ error: 'Erro ao inserir OS' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OS cadastrada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const osId = searchParams.get('id');

    if (!osId) {
      return NextResponse.json({ error: 'ID da OS é obrigatório' }, { status: 400 });
    }

    // Buscar a OS para obter a URL do arquivo
    const { data: os, error: fetchError } = await getSupabaseAdmin()
      .from('laudo_acustico_os')
      .select('url_arquivo')
      .eq('id', osId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar OS:', fetchError);
      return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
    }

    // Extrair o caminho do arquivo da URL
    const urlParts = os.url_arquivo.split('/');
    const fileName = urlParts.slice(-3).join('/'); // laudos-acusticos-os/documentoId/arquivo.pdf

    // Deletar arquivo do storage
    const { error: deleteFileError } = await getSupabaseAdmin().storage
      .from('vehicle-documents')
      .remove([fileName]);

    if (deleteFileError) {
      console.error('Erro ao deletar arquivo:', deleteFileError);
      // Continuar mesmo se não conseguir deletar o arquivo
    }

    // Deletar registro do banco
    const { error: deleteError } = await getSupabaseAdmin()
      .from('laudo_acustico_os')
      .delete()
      .eq('id', osId);

    if (deleteError) {
      console.error('Erro ao deletar OS:', deleteError);
      return NextResponse.json({ error: 'Erro ao deletar OS' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OS excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}