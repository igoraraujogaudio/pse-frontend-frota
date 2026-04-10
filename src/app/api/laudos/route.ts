import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Tipos auxiliares
interface Vehicle {
  id: string;
  placa: string;
  modelo: string;
  tipo_veiculo?: string;
  status: string;
  contrato: { id: string; nome: string; codigo: string } | null;
  contrato_id?: string;
}

interface DocumentRule {
  id: string;
  contrato_id: string;
  placa_especifica?: string | null;
  prefixos_placa?: string[] | null;
  prefixo_placa?: string | null;
  tipo_veiculo?: string[] | null;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  descricao?: string;
  ativa: boolean;
  criado_em: string;
}

interface VehicleDocument {
  id: string;
  veiculo_id: string;
  tipo_documento: string;
  subtipo_documento?: string | null;
  url_arquivo?: string | null;
  expira_em?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

function calcularStatus(expiraEm: string | null | undefined) {
  if (!expiraEm) {
    return { status: 'faltando', statusLabel: 'Faltando', statusColor: 'bg-gray-200 text-gray-600' };
  }
  const hoje = new Date();
  const expira = new Date(expiraEm);
  hoje.setHours(0, 0, 0, 0);
  expira.setHours(0, 0, 0, 0);
  const diffMs = expira.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return { status: 'vencido', statusLabel: `Vencido há ${Math.abs(diffDias)} dia${Math.abs(diffDias) === 1 ? '' : 's'}`, statusColor: 'bg-red-100 text-red-700' };
  } else if (diffDias <= 30) {
    return { status: 'proximo', statusLabel: `Vence em ${diffDias} dia${diffDias === 1 ? '' : 's'}`, statusColor: 'bg-yellow-100 text-yellow-700' };
  } else {
    return { status: 'valido', statusLabel: `Vence em ${diffDias} dia${diffDias === 1 ? '' : 's'}`, statusColor: 'bg-green-100 text-green-700' };
  }
}

function calcularStatusComDoc(doc: VehicleDocument | undefined) {
  if (!doc) {
    return { status: 'faltando', statusLabel: 'Faltando', statusColor: 'bg-gray-200 text-gray-600' };
  }
  if (!doc.expira_em) {
    return { status: 'sem_data', statusLabel: 'Sem data de validade', statusColor: 'bg-gray-100 text-gray-600' };
  }
  return calcularStatus(doc.expira_em);
}

// Replica a lógica da RPC obter_documentos_obrigatorios_veiculo em JS
function obterRegrasParaVeiculo(
  vehicle: Vehicle,
  regras: DocumentRule[]
): { documentos_obrigatorios: string[]; documentos_opcionais: string[]; tem_regra: boolean } {
  const contratoId = vehicle.contrato?.id || vehicle.contrato_id;
  const prefixoPlaca = vehicle.placa?.substring(0, 3) || '';
  const tipoVeiculo = vehicle.tipo_veiculo || '';

  // Filtrar regras do mesmo contrato
  const regrasContrato = regras.filter(r => r.contrato_id === contratoId);

  // Prioridade 1: Placa específica
  const regraPlaca = regrasContrato.find(r => r.placa_especifica === vehicle.placa);
  if (regraPlaca) {
    return { documentos_obrigatorios: regraPlaca.documentos_obrigatorios || [], documentos_opcionais: regraPlaca.documentos_opcionais || [], tem_regra: true };
  }

  // Prioridade 2: Múltiplos prefixos de placa
  const regraPrefixos = regrasContrato.find(r => 
    r.prefixos_placa && r.prefixos_placa.length > 0 && r.prefixos_placa.includes(prefixoPlaca)
  );
  if (regraPrefixos) {
    return { documentos_obrigatorios: regraPrefixos.documentos_obrigatorios || [], documentos_opcionais: regraPrefixos.documentos_opcionais || [], tem_regra: true };
  }

  // Prioridade 3: Tipo de veículo (ARRAY)
  const regraTipo = regrasContrato.find(r => 
    r.tipo_veiculo && r.tipo_veiculo.length > 0 && r.tipo_veiculo.includes(tipoVeiculo)
  );
  if (regraTipo) {
    return { documentos_obrigatorios: regraTipo.documentos_obrigatorios || [], documentos_opcionais: regraTipo.documentos_opcionais || [], tem_regra: true };
  }

  // Prioridade 4: Prefixo único de placa
  const regraPrefixoUnico = regrasContrato.find(r => r.prefixo_placa === prefixoPlaca);
  if (regraPrefixoUnico) {
    return { documentos_obrigatorios: regraPrefixoUnico.documentos_obrigatorios || [], documentos_opcionais: regraPrefixoUnico.documentos_opcionais || [], tem_regra: true };
  }

  // Sem regra: retornar vazio (fallback será aplicado no processamento)
  return { documentos_obrigatorios: [], documentos_opcionais: [], tem_regra: false };
}

export async function GET(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  request: NextRequest
) {
  try {
    // 3 queries paralelas em vez de N+2 sequenciais
    const [vehiclesResult, documentsResult, rulesResult] = await Promise.all([
      supabase
        .from('veiculos')
        .select('id, placa, modelo, tipo_veiculo, status, contrato_id, contrato:contratos(id, nome, codigo)')
        .in('status', ['ativo', 'manutenção', 'manutencao', 'disponivel', 'operacao']),
      supabase
        .from('documentos_veiculo')
        .select('*'),
      supabase
        .from('regras_documentacao_veiculo')
        .select('*')
        .eq('ativa', true)
        .order('criado_em', { ascending: false }),
    ]);

    if (vehiclesResult.error) {
      console.error('❌ Erro ao buscar veículos:', vehiclesResult.error);
      return NextResponse.json({ error: 'Erro ao buscar veículos' }, { status: 500 });
    }
    if (documentsResult.error) {
      console.error('❌ Erro ao buscar documentos:', documentsResult.error);
      return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 });
    }
    if (rulesResult.error) {
      console.error('❌ Erro ao buscar regras:', rulesResult.error);
      return NextResponse.json({ error: 'Erro ao buscar regras' }, { status: 500 });
    }

    const vehicles = ((vehiclesResult.data || []) as unknown[]).map((v: unknown) => {
      const veh = v as Record<string, unknown>;
      return {
        ...veh,
        contrato: Array.isArray(veh.contrato) ? veh.contrato[0] || null : veh.contrato || null,
      };
    }) as Vehicle[];
    const documents = (documentsResult.data || []) as VehicleDocument[];
    const regras = (rulesResult.data || []) as DocumentRule[];

    // Indexar documentos por veiculo_id para lookup O(1)
    const docsByVehicle = new Map<string, VehicleDocument[]>();
    for (const doc of documents) {
      const vid = String(doc.veiculo_id);
      if (!docsByVehicle.has(vid)) docsByVehicle.set(vid, []);
      docsByVehicle.get(vid)!.push(doc);
    }

    const laudos: unknown[] = [];

    for (const vehicle of vehicles) {
      const vehicleId = String(vehicle.id);
      const vehicleDocs = docsByVehicle.get(vehicleId) || [];

      // Obter regras aplicáveis (lógica replicada da RPC, sem chamada ao banco)
      const { documentos_obrigatorios, documentos_opcionais, tem_regra } = obterRegrasParaVeiculo(vehicle, regras);

      const requiredTypes = new Set<string>(documentos_obrigatorios);
      const optionalTypes = new Set<string>(documentos_opcionais);

      // Fallback se não há regras
      if (requiredTypes.size === 0 && optionalTypes.size === 0) {
        const prefixoPlaca = vehicle.placa?.substring(0, 3) || '';
        const prefixosRNU = ['RNU', 'RTY', 'RUC', 'PLT'];
        if (prefixosRNU.includes(prefixoPlaca)) {
          requiredTypes.add('crlv');
          optionalTypes.add('apolice');
          optionalTypes.add('contrato_seguro');
        } else {
          ['crlv', 'acustico', 'eletrico', 'tacografo', 'aet', 'fumaca'].forEach(t => requiredTypes.add(t));
          ['apolice', 'contrato_seguro'].forEach(t => optionalTypes.add(t));
        }
      }

      // Processar documentos obrigatórios
      requiredTypes.forEach(tipoDocumento => {
        if (tipoDocumento === 'eletrico') {
          const docsEletricos = vehicleDocs.filter(d => d.tipo_documento === tipoDocumento);
          if (docsEletricos.length === 0) {
            laudos.push({
              id: `${vehicleId}-${tipoDocumento}`, veiculo: vehicle,
              tipo_documento: tipoDocumento, subtipo_documento: null,
              url_arquivo: null, expira_em: null, criado_em: '', atualizado_em: '',
              status: 'faltando', statusLabel: 'Faltando', statusColor: 'bg-gray-200 text-gray-600',
              opcional: false, tem_regra
            });
            return;
          }
          docsEletricos.forEach(doc => {
            const st = calcularStatusComDoc(doc);
            laudos.push({
              id: doc.id || `${vehicleId}-${tipoDocumento}-${doc.subtipo_documento || 'geral'}`,
              veiculo: vehicle, tipo_documento: tipoDocumento,
              subtipo_documento: doc.subtipo_documento || 'geral',
              url_arquivo: doc.url_arquivo || null, expira_em: doc.expira_em || null,
              criado_em: doc.criado_em || '', atualizado_em: doc.atualizado_em || '',
              ...st, opcional: false, tem_regra
            });
          });
          return;
        }

        const doc = vehicleDocs.find(d => d.tipo_documento === tipoDocumento);
        const st = calcularStatusComDoc(doc);
        laudos.push({
          id: doc?.id || `${vehicleId}-${tipoDocumento}`, veiculo: vehicle,
          tipo_documento: tipoDocumento, subtipo_documento: doc?.subtipo_documento || null,
          url_arquivo: doc?.url_arquivo || null, expira_em: doc?.expira_em || null,
          criado_em: doc?.criado_em || '', atualizado_em: doc?.atualizado_em || '',
          ...st, opcional: false, tem_regra
        });
      });

      // Processar documentos opcionais (todos os status, incluindo válidos e faltando)
      optionalTypes.forEach(tipoDocumento => {
        const doc = vehicleDocs.find(d => d.tipo_documento === tipoDocumento);
        const st = calcularStatusComDoc(doc);
        laudos.push({
          id: doc?.id || `${vehicleId}-${tipoDocumento}`, veiculo: vehicle,
          tipo_documento: tipoDocumento, subtipo_documento: doc?.subtipo_documento || null,
          url_arquivo: doc?.url_arquivo || null, expira_em: doc?.expira_em || null,
          criado_em: doc?.criado_em || '', atualizado_em: doc?.atualizado_em || '',
          ...st, opcional: true, tem_regra
        });
      });
    }

    return NextResponse.json({ laudos });
  } catch (err) {
    console.error('Erro inesperado na API laudos:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
