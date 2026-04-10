import { NextRequest, NextResponse } from 'next/server';
import { SaidaMateriaisService } from '@/services/saidaMateriaisService';
import { CreateSaidaMaterialDTO } from '@/types/saida-materiais';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contratoId = searchParams.get('contratoId');

    const saidas = contratoId 
      ? await SaidaMateriaisService.getByContrato(contratoId)
      : await SaidaMateriaisService.getAll();

    return NextResponse.json(saidas);
  } catch (error) {
    console.error('Erro ao buscar saídas de materiais:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar saídas de materiais' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const dto = await request.json() as CreateSaidaMaterialDTO;
    
    console.log('📦 Recebendo DTO:', JSON.stringify(dto, null, 2));

    if (!dto.entreguePor) {
      return NextResponse.json(
        { error: 'ID do funcionário que entregou é obrigatório' },
        { status: 400 }
      );
    }

    if (!dto.responsavelId) {
      return NextResponse.json(
        { error: 'ID do responsável é obrigatório' },
        { status: 400 }
      );
    }

    if (!dto.equipeId) {
      return NextResponse.json(
        { error: 'ID da equipe é obrigatório' },
        { status: 400 }
      );
    }

    console.log('✅ Validações passaram, criando saída...');
    const saida = await SaidaMateriaisService.create(dto);
    console.log('✅ Saída criada com sucesso:', saida.id);

    return NextResponse.json(saida, { status: 201 });
  } catch (error) {
    console.error('❌ Erro ao criar saída de material:', error);
    console.error('❌ Stack:', error instanceof Error ? error.stack : undefined);
    console.error('❌ Message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { 
        error: 'Erro ao criar saída de material',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
