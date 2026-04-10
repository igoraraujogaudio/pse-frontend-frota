import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Lê o arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Arquivo Excel vazio ou inválido' }, { status: 400 });
    }

    // Cria client admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar todas as bases ativas para usar como fallback
    const { data: bases } = await supabaseAdmin
      .from('bases')
      .select('id, nome, codigo, ativa, contrato_id')
      .eq('ativa', true);

    // Função para normalizar placa (remover hífen e converter para maiúscula)
    const normalizePlaca = (placa: string): string => {
      return placa.replace(/-/g, '').toUpperCase();
    };

    // Função para converter valores para string de forma segura
    const safeString = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    // Função para converter valores para número de forma segura
    const safeNumber = (value: unknown): number => {
      if (value === null || value === undefined || value === '') return 0;
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };

    // Processa cada linha do Excel
    const results = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;
      
      try {

        // Buscar contrato pelo nome na planilha
        const contratoNome = safeString(row.contrato || row.Contrato || row.contrato_nome || row['Contrato Nome'] || '');
        
        if (!contratoNome) {
          throw new Error('Nome do contrato é obrigatório na planilha');
        }

        // Buscar contrato pelo nome
        const { data: contrato, error: contratoError } = await supabaseAdmin
          .from('contratos')
          .select('id, nome, codigo, status')
          .eq('nome', contratoNome)
          .eq('status', 'ativo')
          .single();

        if (contratoError || !contrato) {
          throw new Error(`Contrato "${contratoNome}" não encontrado ou inativo`);
        }

        // Buscar base do contrato ou usar primeira base disponível
        const contratoBase = bases?.find(base => base.contrato_id === contrato.id);
        const baseId = contratoBase?.id || bases?.[0]?.id;

        if (!baseId) {
          throw new Error('Nenhuma base disponível encontrada');
        }

        // Mapear dados do Excel para o formato do veículo
        const placaOriginal = safeString(row.placa || row.Placa || '');
        const placaNormalizada = normalizePlaca(placaOriginal);
        
        const vehicleData = {
          placa: placaNormalizada,
          modelo: safeString(row.modelo || row.Modelo || ''),
          tipo_modelo: safeString(row.tipo_modelo || row['Tipo Modelo'] || ''),
          ano_fabricacao: safeNumber(row.ano_fabricacao || row['Ano Fabricação'] || row['Ano Fabricacao'] || ''),
          ano_modelo: safeNumber(row.ano_modelo || row['Ano Modelo'] || ''),
          renavam: safeString(row.renavam || row.Renavam || ''),
          chassis: safeString(row.chassis || row.Chassis || ''),
          status: 'disponivel',
          contrato_id: contrato.id,
          base_id: baseId,
          marca_equipamento: safeString(row.marca_equipamento || row['Marca Equipamento'] || ''),
          tipo_combustivel: safeString(row.tipo_combustivel || row['Tipo Combustível'] || row['Tipo Combustivel'] || ''),
          quilometragem_atual: safeNumber(row.quilometragem_atual || row['Quilometragem Atual'] || ''),
          numero_crlv: safeString(row.numero_crlv || row['Número CRLV'] || row['Numero CRLV'] || ''),
          versao: safeString(row.versao || row.Versao || ''),
          tipo_veiculo: safeString(row.tipo_veiculo || row['Tipo Veículo'] || row['Tipo Veiculo'] || ''),
          valor_aluguel: safeNumber(row.valor_aluguel || row['Valor Aluguel'] || ''),
          propriedade: safeString(row.propriedade || row.Propriedade || ''),
          condicao: safeString(row.condicao || row.Condição || row.Condicao || ''),
          equipamentos: {
            giroflex: Boolean(row.giroflex || row.Giroflex || false),
            camera: Boolean(row.camera || row.Camera || false),
            tracker: Boolean(row.tracker || row.Tracker || false),
          },
          rastreador: safeString(row.rastreador || row.Rastreador || ''),
          supervisor_id: null,
          ultima_manutencao: null,
          proxima_manutencao: null,
          equipe_id: null,
          operacao_combustivel: safeString(row.operacao_combustivel || row['Operação Combustível'] || row['Operacao Combustivel'] || ''),
          prefixo_fixo: safeString(row.prefixo_fixo || row['Prefixo Fixo'] || ''),
        };

        // Validações obrigatórias
        if (!placaOriginal) {
          throw new Error('Placa é obrigatória');
        }

        if (!vehicleData.modelo) {
          throw new Error('Modelo é obrigatório');
        }

        if (!vehicleData.tipo_modelo) {
          throw new Error('Tipo do modelo é obrigatório');
        }

        if (vehicleData.ano_fabricacao === 0) {
          throw new Error('Ano de fabricação é obrigatório');
        }

        if (vehicleData.ano_modelo === 0) {
          throw new Error('Ano do modelo é obrigatório');
        }

        // Verificar se a placa já existe e em qual contrato
        const { data: existingVehicle } = await supabaseAdmin
          .from('veiculos')
          .select('id, placa, contrato_id')
          .eq('placa', placaNormalizada)
          .single();

        let action = '';
        let vehicle = null;

        if (existingVehicle) {
          // Veículo existe
          if (existingVehicle.contrato_id === contrato.id) {
            // Veículo já está no contrato correto - atualizar chassis e RENAVAM
            const { data: updatedVehicle, error: updateError } = await supabaseAdmin
              .from('veiculos')
              .update({ 
                chassis: vehicleData.chassis,
                renavam: vehicleData.renavam,
                atualizado_em: new Date().toISOString()
              })
              .eq('id', existingVehicle.id)
              .select()
              .single();

            if (updateError) {
              throw new Error(`Erro ao atualizar veículo: ${updateError.message}`);
            }

            action = 'atualizado';
            vehicle = updatedVehicle;
          } else {
            const contratoOrigemId = existingVehicle.contrato_id;

            // Veículo está em outro contrato - transferir para o contrato correto e atualizar dados
            const { data: updatedVehicle, error: updateError } = await supabaseAdmin
              .from('veiculos')
              .update({ 
                contrato_id: contrato.id,
                base_id: baseId,
                chassis: vehicleData.chassis,
                renavam: vehicleData.renavam,
                atualizado_em: new Date().toISOString()
              })
              .eq('id', existingVehicle.id)
              .select()
              .single();

            if (updateError) {
              throw new Error(`Erro ao transferir veículo: ${updateError.message}`);
            }

            action = 'transferido';
            vehicle = updatedVehicle;

            // Log da transferência
            // IMPORTANTE: base_origem_id e base_destino_id recebem contrato_id, não base_id
            const { error: logError } = await supabaseAdmin
              .from('logs_transferencia_veiculo')
              .insert({
                veiculo_id: existingVehicle.id,
                base_origem_id: contratoOrigemId,
                base_destino_id: contrato.id,
                usuario_id: 'system', // TODO: Get actual user ID from session
                data_transferencia: new Date().toISOString(),
                observacoes: 'Transferência realizada via upload em massa'
              });

            if (logError) {
              console.error('Erro ao registrar histórico de transferência:', logError);
              // Não falhar a transferência, mas logar o erro
            }
          }
        } else {
          // Veículo não existe - criar novo
          const { data: newVehicle, error: insertError } = await supabaseAdmin
            .from('veiculos')
            .insert([vehicleData])
            .select()
            .single();

          if (insertError) {
            throw new Error(`Erro ao inserir veículo: ${insertError.message}`);
          }

          action = 'criado';
          vehicle = newVehicle;
        }

        results.push({
          success: true,
          placa: placaOriginal,
          contrato: contrato.nome,
          action: action,
          vehicle: vehicle
        });

      } catch (error) {
        results.push({
          success: false,
          placa: safeString(row.placa || row.Placa || `Linha ${i + 1}`),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return NextResponse.json({
      message: 'Upload processado com sucesso',
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        created: results.filter(r => r.success && r.action === 'criado').length,
        transferred: results.filter(r => r.success && r.action === 'transferido').length,
        updated: results.filter(r => r.success && r.action === 'atualizado').length,
        ignored: results.filter(r => r.success && r.action === 'ignorado').length
      }
    });

  } catch (error) {
    console.error('Erro no upload em massa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
