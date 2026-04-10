import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar o mesmo padrão do PDF (igual ao route.ts principal)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, damageUrls, documentUrls } = body;

    console.log('🚀 API - INICIANDO update-urls');
    console.log('🔍 API - Dados recebidos:', { orderId, damageUrls, documentUrls });
    console.log('📁 URLs de danos:', damageUrls, 'Tipo:', typeof damageUrls, 'Array?', Array.isArray(damageUrls));
    console.log('📄 URLs de documentos:', documentUrls, 'Tipo:', typeof documentUrls, 'Array?', Array.isArray(documentUrls));

    // Helper: sanitize incoming arrays to avoid values like "[\"url\"]"
    const sanitizeUrls = (value: unknown): string[] => {
      const coerce = (s: string): string[] => {
        const t = s.trim();
        // Try parse if looks like JSON array
        if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('"') && t.endsWith('"'))) {
          try {
            const parsed = JSON.parse(t);
            if (Array.isArray(parsed)) {
              return parsed.map(v => String(v));
            }
          } catch {}
        }
        // Strip wrapping brackets/quotes if any
        const stripped = t.replace(/^\[+|\]+$/g, '').replace(/^"+|"+$/g, '');
        return [stripped];
      };
      if (Array.isArray(value)) {
        return value.flatMap(v => coerce(String(v)));
      }
      if (typeof value === 'string') {
        return coerce(value);
      }
      return [];
    };

    const sanitizedDamage = sanitizeUrls(damageUrls);
    const sanitizedDocs = sanitizeUrls(documentUrls);
    console.log('🧹 API - Sanitized damage URLs:', sanitizedDamage);
    console.log('🧹 API - Sanitized document URLs:', sanitizedDocs);

    // Update damage URLs
    if (sanitizedDamage.length > 0) {
      console.log('🔄 API - Tentando atualizar URLs de danos...');
      console.log('🆔 API - ID da ordem:', orderId);
      console.log('🔗 API - URLs para salvar:', sanitizedDamage);
      
      // UPDATE igual ao PDF (mesmo padrão que funciona)
      const { error: damageError } = await supabase
        .from('discount_orders')
        .update({ danos_evidencias_urls: sanitizedDamage })
        .eq('id', orderId);

      if (damageError) {
        console.error('❌ API - ERRO REAL ao atualizar URLs de danos:', damageError);
        return NextResponse.json({ error: 'Erro ao atualizar URLs de danos: ' + damageError.message }, { status: 500 });
      }
      console.log('✅ API - URLs de danos atualizadas com sucesso!');
    }

    // Update document URLs
    if (sanitizedDocs.length > 0) {
      // UPDATE igual ao PDF (mesmo padrão que funciona)
      const { error: documentError } = await supabase
        .from('discount_orders')
        .update({ nf_os_documentos_urls: sanitizedDocs })
        .eq('id', orderId);

      if (documentError) {
        console.error('❌ API - ERRO REAL ao atualizar URLs de documentos:', documentError);
        return NextResponse.json({ error: 'Erro ao atualizar URLs de documentos: ' + documentError.message }, { status: 500 });
      }
      console.log('✅ URLs de documentos atualizadas com sucesso!');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'URLs atualizadas com sucesso!' 
    });

  } catch (error) {
    console.error('❌ Erro geral na API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
