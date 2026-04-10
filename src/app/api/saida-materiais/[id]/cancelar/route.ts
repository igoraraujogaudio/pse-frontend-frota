import { NextRequest, NextResponse } from 'next/server';
import { SaidaMateriaisService } from '@/services/saidaMateriaisService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const saida = await SaidaMateriaisService.cancelar(id);

    return NextResponse.json(saida);
  } catch (error) {
    console.error('Erro ao cancelar saída de material:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar saída de material' },
      { status: 500 }
    );
  }
}
