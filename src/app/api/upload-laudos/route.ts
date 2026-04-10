import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipoLaudo = formData.get('tipoLaudo') as string;
    const subtipoLaudo = formData.get('subtipoLaudo') as string; // Novo campo para subtipo
    const placa = formData.get('placa') as string;
    const dataValidade = formData.get('dataValidade') as string;

    if (!file || !tipoLaudo || !placa || !dataValidade) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    // Para laudos elétricos, verificar se subtipo foi fornecido
    if (tipoLaudo === 'eletrico' && !subtipoLaudo) {
      return NextResponse.json({ 
        error: 'Subtipo é obrigatório para laudos elétricos (lanca_isolada, liner, geral)' 
      }, { status: 400 });
    }

    console.log(`🔍 Processando laudo: ${file.name} - Placa: ${placa} - Tipo: ${tipoLaudo}${subtipoLaudo ? ` - Subtipo: ${subtipoLaudo}` : ''}`);

    // 1. Buscar veículo pela placa
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa, modelo, marca_equipamento')
      .eq('placa', placa)
      .single();

    if (veiculoError || !veiculo) {
      console.error('❌ Veículo não encontrado:', placa);
      return NextResponse.json({
        error: `Veículo com placa ${placa} não encontrado no sistema`,
        placa,
        status: 'error'
      }, { status: 404 });
    }

    console.log(`✅ Veículo encontrado: ${veiculo.placa} - ID: ${veiculo.id}`);

    // 2. Verificar se já existe um documento deste tipo para este veículo
    // Para laudos elétricos, verificar por tipo E subtipo
    let existingDocQuery = supabaseAdmin
      .from('documentos_veiculo')
      .select('id')
      .eq('veiculo_id', veiculo.id)
      .eq('tipo_documento', tipoLaudo);
    
    // Se for laudo elétrico, verificar por subtipo também
    if (tipoLaudo === 'eletrico' && subtipoLaudo) {
      existingDocQuery = existingDocQuery.eq('subtipo_documento', subtipoLaudo);
    }
    
    const { data: existingDoc } = await existingDocQuery.single();

    // 3. Upload do arquivo para o bucket vehicle-documents (mesmo padrão da página de laudos)
    const fileExt = file.name.split('.').pop();
    
    // Função para limpar caracteres especiais do nome do arquivo (mesmo da página de laudos)
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD') // Decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Substituir caracteres especiais por underscore
        .toLowerCase();
    };
    
    const sanitizedType = sanitizeFileName(tipoLaudo);
    const sanitizedSubtipo = subtipoLaudo ? sanitizeFileName(subtipoLaudo) : '';
    const fileName = `${veiculo.id}/${sanitizedType}${sanitizedSubtipo ? `_${sanitizedSubtipo}` : ''}-${Date.now()}.${fileExt}`;

    console.log(`📤 Fazendo upload: ${fileName}`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('vehicle-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/pdf',
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      return NextResponse.json({
        error: `Erro no upload do arquivo: ${uploadError.message}`,
        placa,
        status: 'error'
      }, { status: 500 });
    }

    console.log(`✅ Upload realizado: ${fileName}`);

    // 4. Obter URL pública
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('vehicle-documents')
      .getPublicUrl(fileName);

    // 5. Inserir ou atualizar documento na tabela documentos_veiculo
    let documento;
    
    if (existingDoc) {
      // Atualizar documento existente
      const updateData: Record<string, unknown> = {
        url_arquivo: publicUrl,
        expira_em: dataValidade
      };

      // Se for laudo elétrico e tiver subtipo, atualizar também o subtipo
      if (tipoLaudo === 'eletrico' && subtipoLaudo) {
        updateData.subtipo_documento = subtipoLaudo;
      }

      const { data: updatedDoc, error: updateError } = await supabaseAdmin
        .from('documentos_veiculo')
        .update(updateData)
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao atualizar documento:', updateError);
        return NextResponse.json({
          error: `Erro ao atualizar laudo: ${updateError.message}`,
          placa,
          status: 'error'
        }, { status: 500 });
      }

      documento = updatedDoc;
      console.log(`✅ Documento atualizado: ID ${documento.id}`);
    } else {
      // Inserir novo documento
      const insertData: Record<string, unknown> = {
        veiculo_id: veiculo.id,
        tipo_documento: tipoLaudo,
        url_arquivo: publicUrl,
        expira_em: dataValidade
      };

      // Se for laudo elétrico e tiver subtipo, incluir o subtipo
      if (tipoLaudo === 'eletrico' && subtipoLaudo) {
        insertData.subtipo_documento = subtipoLaudo;
      }

      const { data: newDoc, error: insertError } = await supabaseAdmin
        .from('documentos_veiculo')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao inserir documento:', insertError);
        return NextResponse.json({
          error: `Erro ao salvar laudo: ${insertError.message}`,
          placa,
          status: 'error'
        }, { status: 500 });
      }

      documento = newDoc;
      console.log(`✅ Documento inserido: ID ${documento.id}`);
    }

    return NextResponse.json({
      success: true,
      message: existingDoc ? 'Laudo atualizado com sucesso' : 'Laudo processado com sucesso',
      data: {
        id: documento.id,
        placa: veiculo.placa,
        tipoLaudo,
        subtipoLaudo: subtipoLaudo || null,
        dataValidade,
        nomeArquivo: file.name,
        veiculoId: veiculo.id,
        status: 'success'
      }
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      status: 'error'
    }, { status: 500 });
  }
}
