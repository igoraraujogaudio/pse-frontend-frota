// =============================
// API: QR CODE CARRO PARTICULAR
// =============================

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';
import { generateQRCodeWithPlate } from '@/lib/qr-generator';
import { modularPermissionService } from '@/services/modularPermissionService';

// GET: Gerar QR code para carro particular
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carroId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Verificar se tem permissão para gestão completa de frota (carros particulares)
    const hasFleetPermission = await modularPermissionService.checkUserPermissionModular(
      funcionario.id, 
      'veiculos.site.gestao_completa_frota'
    );

    // Buscar carro particular
    let query = supabase
      .from('carros_particulares')
      .select(`
        id,
        placa,
        ativo,
        funcionario_id
      `)
      .eq('id', carroId)
      .eq('ativo', true);

    // Se não tem permissão de gestão de frota, verificar se o carro pertence ao funcionário
    if (!hasFleetPermission) {
      query = query.eq('funcionario_id', funcionario.id);
    }

    const { data: carro, error: carroError } = await query.single();

    if (carroError || !carro) {
      return NextResponse.json({ error: 'Carro não encontrado' }, { status: 404 });
    }

    // Gerar dados do QR code
    const qrData = `PRIVATE:${carro.placa}:${carro.id}`;
    
    // Gerar QR code com logo e placa
    const qrCodeDataUrl = await generateQRCodeWithPlate(qrData, carro.placa);

    return NextResponse.json({
      qr_data: qrData,
      qr_code: qrCodeDataUrl,
      placa: carro.placa,
      carro_id: carro.id,
      success: true
    });

  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    return NextResponse.json({ 
      error: 'Erro ao gerar QR code',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}