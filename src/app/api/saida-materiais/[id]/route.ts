import { NextRequest, NextResponse } from 'next/server';
import { SaidaMateriaisService } from '@/services/saidaMateriaisService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const saida = await SaidaMateriaisService.getById(id);

    if (!saida) {
      return NextResponse.json(
        { error: 'Saída de material não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(saida);
  } catch (error) {
    console.error('Erro ao buscar saída de material:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar saída de material' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await SaidaMateriaisService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar saída de material:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar saída de material' },
      { status: 500 }
    );
  }
}
