import { NextRequest, NextResponse } from 'next/server';
import { SaidaMateriaisService } from '@/services/saidaMateriaisService';
import { EntregarSaidaMaterialDTO } from '@/types/saida-materiais';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dto: EntregarSaidaMaterialDTO = await request.json();
    const saida = await SaidaMateriaisService.entregar(id, dto);

    return NextResponse.json(saida);
  } catch (error) {
    console.error('Erro ao entregar saída de material:', error);
    return NextResponse.json(
      { error: 'Erro ao entregar saída de material' },
      { status: 500 }
    );
  }
}
