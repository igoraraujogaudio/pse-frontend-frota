import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ContratoSharePointConfig } from '@/config/contratos-sharepoint';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET - Carregar todas as configurações ou uma específica por contrato
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contratoNome = searchParams.get('contrato');

    if (contratoNome) {
      // Buscar configuração específica
      const { data, error } = await supabaseAdmin
        .from('sharepoint_contratos_config')
        .select('*')
        .eq('contrato_nome', contratoNome)
        .single();

      if (error) {
        // Se não encontrar, retornar null (não é erro)
        if (error.code === 'PGRST116') {
          return NextResponse.json({ 
            success: true,
            config: null 
          });
        }
        // Se a tabela não existir, retornar null
        if (error.code === '42P01') {
          return NextResponse.json({ 
            success: true,
            config: null 
          });
        }
        throw error;
      }

      return NextResponse.json({ 
        success: true,
        config: data || null 
      });
    } else {
      // Buscar todas as configurações
      const { data, error } = await supabaseAdmin
        .from('sharepoint_contratos_config')
        .select('*')
        .order('contrato_nome');

      if (error) {
        // Se a tabela não existir, retornar vazio
        if (error.code === '42P01') {
          return NextResponse.json({ configs: [] });
        }
        throw error;
      }

      return NextResponse.json({ 
        configs: data || [],
        success: true 
      });
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar configurações', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// POST - Salvar/atualizar configuração
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      contratoNome, 
      sharePointUrl, 
      columnMapping, 
      statusMapping, 
      headerRow,
      sheetName,
      buscarEquipePorEncarregado,
      equipeMapping,
      equipesFixas
    } = body as ContratoSharePointConfig;

    if (!contratoNome || !sharePointUrl || !columnMapping) {
      return NextResponse.json(
        { error: 'Dados incompletos. É necessário: contratoNome, sharePointUrl e columnMapping' },
        { status: 400 }
      );
    }

    // Validar se o contrato existe na tabela contratos
    const { data: contrato, error: contratoError } = await supabaseAdmin
      .from('contratos')
      .select('id, nome')
      .eq('nome', contratoNome)
      .single();

    if (contratoError || !contrato) {
      return NextResponse.json(
        { error: `Contrato "${contratoNome}" não encontrado na tabela de contratos. Verifique se o nome está correto.` },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const { data: existing } = await supabaseAdmin
      .from('sharepoint_contratos_config')
      .select('id')
      .eq('contrato_nome', contratoNome)
      .single();

    const configData: Record<string, unknown> = {
      contrato_nome: contratoNome,
      sharepoint_url: sharePointUrl,
      column_mapping: columnMapping,
      header_row: headerRow || 1, // Padrão: linha 1
      sheet_name: sheetName || null, // Nome da aba (null = usar primeira aba)
      buscar_equipe_por_encarregado: buscarEquipePorEncarregado ?? true, // Padrão: true (comportamento de Niterói)
      updated_at: new Date().toISOString(),
    };

    // Adicionar statusMapping se existir e tiver valores válidos
    if (statusMapping && Object.keys(statusMapping).length > 0) {
      // Normalizar chaves para maiúsculas e remover vazias
      const normalizedStatusMapping: Record<string, string> = {};
      for (const [key, value] of Object.entries(statusMapping)) {
        const normalizedKey = key.trim().toUpperCase();
        if (normalizedKey && value) {
          normalizedStatusMapping[normalizedKey] = value;
        }
      }
      if (Object.keys(normalizedStatusMapping).length > 0) {
        configData.status_mapping = normalizedStatusMapping;
      } else {
        // Se não houver mapeamentos válidos, não salvar o campo
        configData.status_mapping = null;
      }
    } else {
      configData.status_mapping = null;
    }

    // Adicionar equipeMapping se existir
    if (equipeMapping) {
      configData.equipe_mapping = equipeMapping;
    } else {
      configData.equipe_mapping = null;
    }

    // Adicionar equipesFixas se existir
    if (equipesFixas && Array.isArray(equipesFixas) && equipesFixas.length > 0) {
      // Filtrar valores vazios e normalizar
      const equipesNormalizadas = equipesFixas
        .filter(eq => eq && String(eq).trim())
        .map(eq => String(eq).trim());
      if (equipesNormalizadas.length > 0) {
        configData.equipes_fixas = equipesNormalizadas;
      } else {
        configData.equipes_fixas = [];
      }
    } else {
      configData.equipes_fixas = [];
    }

    let result;
    if (existing) {
      // Atualizar
      const { data, error } = await supabaseAdmin
        .from('sharepoint_contratos_config')
        .update(configData)
        .eq('contrato_nome', contratoNome)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Inserir
      const { data, error } = await supabaseAdmin
        .from('sharepoint_contratos_config')
        .insert({
          ...configData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ 
      success: true, 
      config: result,
      message: existing ? 'Configuração atualizada com sucesso' : 'Configuração criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// DELETE - Remover configuração
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contratoNome = searchParams.get('contrato');

    if (!contratoNome) {
      return NextResponse.json(
        { error: 'É necessário informar o nome do contrato' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('sharepoint_contratos_config')
      .delete()
      .eq('contrato_nome', contratoNome);

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      message: 'Configuração removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover configuração:', error);
    return NextResponse.json(
      { error: 'Erro ao remover configuração', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

