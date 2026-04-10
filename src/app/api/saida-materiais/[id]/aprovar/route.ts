import { NextRequest, NextResponse } from 'next/server';
import { SaidaMateriaisService } from '@/services/saidaMateriaisService';
import { AprovarSaidaMaterialDTO } from '@/types/saida-materiais';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dto: AprovarSaidaMaterialDTO = await request.json();
    const saida = await SaidaMateriaisService.aprovar(id, dto);

    return NextResponse.json(saida);
  } catch (error) {
    console.error('Erro ao aprovar saída de material:', error);
    return NextResponse.json(
      { error: 'Erro ao aprovar saída de material' },
      { status: 500 }
    );
  }
}
