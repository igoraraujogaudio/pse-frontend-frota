import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contratoId } = await params;

    // Criar cliente Supabase com service role key para operações administrativas
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Primeiro buscar os IDs dos veículos do contrato
    const { data: vehicles, error: vehiclesError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa')
      .eq('contrato_id', contratoId);

    if (vehiclesError) {
      console.error('Erro ao buscar veículos do contrato:', vehiclesError);
      return NextResponse.json(
        { error: 'Erro ao buscar veículos do contrato' },
        { status: 500 }
      );
    }

    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json([]);
    }

    // Extrair os IDs dos veículos
    const vehicleIds = vehicles.map(v => v.id);

    // Buscar documentos desses veículos
    const { data: documents, error } = await supabaseAdmin
      .from('documentos_veiculo')
      .select(`
        id,
        tipo_documento,
        veiculo_id
      `)
      .in('veiculo_id', vehicleIds);

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar documentos' },
        { status: 500 }
      );
    }

    // Mapear os campos para o formato esperado pelo frontend
    const mappedDocuments = (documents || []).map(doc => {
      const vehicle = vehicles.find(v => v.id === doc.veiculo_id);
      return {
        id: doc.id,
        name: doc.tipo_documento || 'Documento',
        type: doc.tipo_documento || 'N/A',
        vehiclePlate: vehicle ? vehicle.placa : 'N/A'
      };
    });

    return NextResponse.json(mappedDocuments);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
