'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentTextIcon, TruckIcon, ExclamationTriangleIcon, CheckCircleIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

// Mapeamento dos tipos de documento para exibição
const documentTypeLabels: { [key: string]: string } = {
  'crlv': 'CRLV',
  'acustico': 'Laudo ACÚSTICO',
  'eletrico': 'Laudo ELÉTRICO',
  'tacografo': 'Laudo TACÓGRAFO',
  'aet': 'AET',
  'fumaca': 'Laudo de FUMAÇA',
  'apolice': 'APÓLICE',
  'contrato_seguro': 'CONTRATO DE ALUGUEL'
};

const subtipoLabels: { [key: string]: string } = {
  'lanca_isolada': 'Lança Isolada',
  'liner': 'Liner',
  'geral': 'Geral'
};

function formatDocumentType(tipo: string, subtipo?: string | null): string {
  const baseLabel = documentTypeLabels[tipo] || tipo;
  if (tipo === 'eletrico' && subtipo && subtipo !== 'geral') {
    return `${baseLabel} - ${subtipoLabels[subtipo] || subtipo}`;
  }
  return baseLabel;
}

export default function SesmtLaudosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.SESMT.GERENCIAR_LAUDOS,
      PERMISSION_CODES.SESMT.VISUALIZAR_LAUDOS,
      PERMISSION_CODES.SESMT.CONTROLE_VENCIMENTO_LAUDOS,
      PERMISSION_CODES.SESMT.RELATORIOS_LAUDOS
    ]}>
      <Suspense fallback={<div>Carregando...</div>}>
        <SesmtLaudosContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function SesmtLaudosContent() {
  const { user } = useAuth();
  const { hasPermission } = useModularPermissions();
  const searchParams = useSearchParams();
  
  // Permissões SESMT
  const canManageLaudos = hasPermission(PERMISSION_CODES.SESMT.GERENCIAR_LAUDOS);
  const canViewLaudos = hasPermission(PERMISSION_CODES.SESMT.VISUALIZAR_LAUDOS);
  const canViewAlerts = hasPermission(PERMISSION_CODES.SESMT.CONTROLE_VENCIMENTO_LAUDOS);
  const canViewReports = hasPermission(PERMISSION_CODES.SESMT.RELATORIOS_LAUDOS);
  
  const highlightVehicleId = searchParams?.get('highlight');
  const highlightPlate = searchParams?.get('plate');
  
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'vencido' | 'proximo' | 'faltando' | 'em_dia'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [contratoFilter, setContratoFilter] = useState<string[]>([]);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showContratoDropdown, setShowContratoDropdown] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotification();
  const { userContratoIds } = useAuth();

  const {
    data: laudosData,
    isLoading: loading,
    error
  } = useQuery({
    queryKey: ['laudos_with_rules'],
    queryFn: async () => {
      const response = await fetch('/api/laudos');
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (error) notify('Erro ao carregar laudos', 'error');
  }, [error, notify]);

  const laudos = laudosData?.laudos || [];
  
  // Filtrar por acesso ao contrato
  const filteredLaudosByAccess = laudos.filter((laudo: { 
    veiculo?: { contrato_id?: string; contrato?: { id: string; nome?: string }; placa?: string; modelo?: string; tipo_veiculo?: string; } 
  }) => {
    if (!laudo || !laudo.veiculo) return false;
    const hasContratoAccess = user?.nivel_acesso === 'admin' || 
      !laudo.veiculo.contrato?.id || 
      (userContratoIds && userContratoIds.includes(laudo.veiculo.contrato.id));
    return hasContratoAccess;
  });

  useEffect(() => { setContratoFilter([]); }, []);

  useEffect(() => {
    if (highlightPlate && filteredLaudosByAccess.length > 0) {
      setSearch(highlightPlate);
      const vehicleLaudos = filteredLaudosByAccess.filter((laudo: { veiculo?: { placa: string } }) => 
        laudo.veiculo?.placa === highlightPlate
      );
      const hasExpired = vehicleLaudos.some((laudo: { status: string }) => laudo.status === 'vencido');
      const hasExpiring = vehicleLaudos.some((laudo: { status: string }) => laudo.status === 'proximo');
      if (hasExpired) setStatusFilter('vencido');
      else if (hasExpiring) setStatusFilter('proximo');
      else setStatusFilter('all');
    }
  }, [highlightPlate, filteredLaudosByAccess]);

  const uniqueContratos = Array.from(new Set(
    filteredLaudosByAccess
      .map((laudo: { veiculo: { contrato?: { nome?: string } } }) => laudo.veiculo.contrato?.nome)
      .filter((contrato: unknown): contrato is string => Boolean(contrato))
  ));

  type Laudo = {
    id: string;
    veiculo: {
      placa: string; modelo: string; tipo_veiculo?: string;
      contrato?: { nome: string }; local?: { nome: string };
    };
    tipo_documento: string; subtipo_documento?: string | null;
    url_arquivo: string | null; expira_em: string | null;
    criado_em: string; atualizado_em: string;
    status: string; statusLabel: string; statusColor: string; tem_regra?: boolean;
  };

  const filteredLaudos = filteredLaudosByAccess.filter((laudo: Laudo) => {
    if (!laudo || !laudo.veiculo) return false;
    const matchesSearch = search === '' || 
      laudo.veiculo.placa?.toLowerCase().includes(search.toLowerCase()) ||
      laudo.veiculo.modelo?.toLowerCase().includes(search.toLowerCase()) ||
      laudo.veiculo?.tipo_veiculo?.toLowerCase().includes(search.toLowerCase()) ||
      laudo.veiculo.contrato?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      documentTypeLabels[laudo.tipo_documento]?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      ? ['vencido', 'proximo', 'faltando', 'valido'].includes(laudo.status)
      : statusFilter === 'em_dia' ? laudo.status === 'valido' : laudo.status === statusFilter;
    const matchesContrato = contratoFilter.length === 0 ? true : (laudo.veiculo.contrato?.nome && contratoFilter.includes(laudo.veiculo.contrato.nome));
    return matchesSearch && matchesStatus && matchesContrato;
  });

  const totalPages = Math.ceil(filteredLaudos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLaudos = filteredLaudos.slice(startIndex, startIndex + itemsPerPage);

  const getStatusCounts = () => {
    return filteredLaudosByAccess.reduce((acc: { vencidos: number; proximos: number; faltando: number; em_dia: number }, laudo: { 
      veiculo?: { contrato?: { nome?: string }; placa?: string; modelo?: string; tipo_veiculo?: string; };
      tipo_documento?: string; status?: string;
    }) => {
      if (!laudo || !laudo.veiculo) return acc;
      const matchesSearch = search === '' || 
        laudo.veiculo.placa?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.veiculo.modelo?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.veiculo?.tipo_veiculo?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.veiculo.contrato?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        (laudo.tipo_documento ? documentTypeLabels[laudo.tipo_documento]?.toLowerCase().includes(search.toLowerCase()) : false);
      const matchesContrato = contratoFilter.length === 0 ? true : (laudo?.veiculo?.contrato?.nome && contratoFilter.includes(laudo.veiculo.contrato.nome));
      if (!matchesSearch || !matchesContrato) return acc;
      if (laudo?.status === 'vencido') acc.vencidos++;
      else if (laudo?.status === 'proximo') acc.proximos++;
      else if (laudo?.status === 'faltando') acc.faltando++;
      else if (laudo?.status === 'valido') acc.em_dia++;
      return acc;
    }, { vencidos: 0, proximos: 0, faltando: 0, em_dia: 0 });
  };
  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-gray-500">Carregando laudos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-red-600 mb-2">Erro ao carregar laudos</div>
          <div className="text-sm text-gray-500">{error.message}</div>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  async function handleFileUpload(documentId: string) {
    if (!fileInputRef.current?.files?.[0] || !newExpirationDate) {
      notify('Selecione um arquivo e uma data de validade', 'error');
      return;
    }
    try {
      setUploading(documentId);
      const file = fileInputRef.current.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('vehicle-documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('vehicle-documents').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('documentos_veiculo').update({ url_arquivo: publicUrl, expira_em: newExpirationDate }).eq('id', documentId);
      if (updateError) throw updateError;
      notify('Documento atualizado com sucesso!', 'success');
      setShowUploadModal(null);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      notify('Erro ao fazer upload do arquivo', 'error');
    } finally {
      setUploading(null);
    }
  }

  const getStatusSimples = (status: string): string => {
    if (status === 'vencido') return 'Vencido';
    if (status === 'proximo') return 'Vencendo';
    if (status === 'valido') return 'Válido';
    if (status === 'faltando') return 'Faltando';
    return 'N/A';
  };

  const exportarExcel = async () => {
    try {
      setExportingExcel(true);
      const dadosExcel = filteredLaudos.map((laudo: Laudo) => ({
        'Placa': laudo.veiculo?.placa || 'N/A',
        'Modelo': laudo.veiculo?.modelo || 'N/A',
        'Tipo Veículo': laudo.veiculo?.tipo_veiculo || 'N/A',
        'Contrato': laudo.veiculo?.contrato?.nome || 'Não definido',
        'Tipo Laudo': formatDocumentType(laudo.tipo_documento, laudo.subtipo_documento),
        'Subtipo': laudo.subtipo_documento || 'N/A',
        'Data Validade': laudo.expira_em ? new Date(laudo.expira_em).toLocaleDateString('pt-BR') : 'Sem validade',
        'Status': laudo.statusLabel || laudo.status || 'N/A',
        'Status Simplificado': getStatusSimples(laudo.status),
        'Criado em': laudo.criado_em ? new Date(laudo.criado_em).toLocaleDateString('pt-BR') : 'N/A',
        'Atualizado em': laudo.atualizado_em ? new Date(laudo.atualizado_em).toLocaleDateString('pt-BR') : 'N/A',
        'URL Arquivo': laudo.url_arquivo || 'N/A'
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 50 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laudos SESMT');
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.download = `Laudos_SESMT_${dataAtual}.xlsx`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      notify('Relatório Excel gerado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      notify('Erro ao gerar relatório Excel', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laudos SESMT</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">Controle de Laudos e Documentos</span>
                <div className="flex items-center gap-1">
                  {canManageLaudos && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Gerenciar</span>
                  )}
                  {canViewAlerts && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Alertas</span>
                  )}
                  {canViewReports && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Relatórios</span>
                  )}
                  {canViewLaudos && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Visualizar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div>
            <button
              onClick={exportarExcel}
              disabled={exportingExcel || filteredLaudos.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
        </div>

        {highlightPlate && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Veículo destacado: <span className="font-bold">{highlightPlate}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cards de Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
          <button onClick={() => setStatusFilter(statusFilter === 'em_dia' ? 'all' : 'em_dia')}
            className={`bg-white rounded-xl shadow-sm p-6 border transition-colors ${statusFilter === 'em_dia' ? 'border-green-200' : 'border-gray-200 hover:border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Laudos em Dia</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">{statusCounts.em_dia}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg"><CheckCircleIcon className="h-6 w-6 text-green-600" /></div>
            </div>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'vencido' ? 'all' : 'vencido')}
            className={`bg-white rounded-xl shadow-sm p-6 border transition-colors ${statusFilter === 'vencido' ? 'border-red-200' : 'border-gray-200 hover:border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Laudos Vencidos</p>
                <p className="text-2xl font-semibold text-red-600 mt-1">{statusCounts.vencidos}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg"><ExclamationTriangleIcon className="h-6 w-6 text-red-600" /></div>
            </div>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'proximo' ? 'all' : 'proximo')}
            className={`bg-white rounded-xl shadow-sm p-6 border transition-colors ${statusFilter === 'proximo' ? 'border-yellow-200' : 'border-gray-200 hover:border-yellow-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Próximos do Vencimento</p>
                <p className="text-2xl font-semibold text-yellow-600 mt-1">{statusCounts.proximos}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg"><ClockIcon className="h-6 w-6 text-yellow-600" /></div>
            </div>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'faltando' ? 'all' : 'faltando')}
            className={`bg-white rounded-xl shadow-sm p-6 border transition-colors ${statusFilter === 'faltando' ? 'border-gray-400' : 'border-gray-200 hover:border-gray-400'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Laudos Faltando</p>
                <p className="text-2xl font-semibold text-gray-600 mt-1">{statusCounts.faltando}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg"><ExclamationTriangleIcon className="h-6 w-6 text-gray-500" /></div>
            </div>
          </button>
        </div>

        {/* Barra de pesquisa e filtros */}
        <div className="mb-3 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input type="text" placeholder="Buscar por placa, modelo, contrato ou tipo de laudo..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 items-end flex-shrink-0">
              {(['all', 'vencido', 'proximo', 'em_dia'] as const).map((s) => {
                const label = s === 'all' ? 'Todos' : s === 'vencido' ? 'Vencidos' : s === 'proximo' ? 'Próximos' : 'Em Dia';
                const activeColor = s === 'all' ? 'bg-blue-500' : s === 'vencido' ? 'bg-red-500' : s === 'proximo' ? 'bg-yellow-500' : 'bg-green-500';
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      statusFilter === s ? `${activeColor} text-white shadow-sm` : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}>{label}</button>
                );
              })}
            </div>
            <div className="flex flex-col w-full sm:w-64 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
              {uniqueContratos.length > 1 ? (
                <div className="relative">
                  <button type="button" onClick={() => setShowContratoDropdown(!showContratoDropdown)}
                    className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between">
                    <span className="text-gray-700">
                      {contratoFilter.length === 0 ? 'Todos os Contratos' : contratoFilter.length === 1 ? contratoFilter[0] : `${contratoFilter.length} contratos selecionados`}
                    </span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showContratoDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowContratoDropdown(false)} />
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2">
                          <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
                            <Checkbox id="sesmt-contrato-all" checked={contratoFilter.length === 0}
                              onCheckedChange={(checked) => { if (checked) setContratoFilter([]); }} />
                            <label htmlFor="sesmt-contrato-all" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">Todos os Contratos</label>
                          </div>
                          {(uniqueContratos as string[]).map((contrato: string) => (
                            <div key={contrato} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
                              <Checkbox id={`sesmt-contrato-${contrato}`} checked={contratoFilter.includes(contrato)}
                                onCheckedChange={(checked) => {
                                  if (checked) setContratoFilter([...contratoFilter, contrato]);
                                  else setContratoFilter(contratoFilter.filter(c => c !== contrato));
                                }} />
                              <label htmlFor={`sesmt-contrato-${contrato}`} className="text-sm text-gray-700 cursor-pointer flex-1">{contrato}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Select value={contratoFilter.length > 0 ? contratoFilter[0] : "all"} onValueChange={(value) => setContratoFilter(value === "all" ? [] : [value])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os Contratos">{contratoFilter.length === 0 ? 'Todos os Contratos' : contratoFilter[0]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Contratos</SelectItem>
                    {(uniqueContratos as string[]).map((contrato: string) => (
                      <SelectItem key={contrato} value={contrato}>{contrato}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Veículo</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Contrato</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Laudo</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Validade</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Status</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700 text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedLaudos.map((laudo: {
                  id?: string;
                  veiculo?: { contrato_id?: string; local?: { id: string; nome?: string }; contrato?: { id: string; nome?: string }; placa?: string; modelo?: string; tipo_veiculo?: string; };
                  tipo_documento?: string; subtipo_documento?: string; expira_em?: string;
                  status?: string; statusColor?: string; statusLabel?: string; url_arquivo?: string;
                }) => {
                  const isHighlighted = highlightVehicleId && laudo.veiculo?.placa === highlightPlate;
                  return (
                    <tr key={laudo.id} className={`hover:bg-gray-50 ${isHighlighted ? 'bg-yellow-50 border-l-4 border-yellow-400 shadow-md' : ''}`}>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <div className="flex items-center">
                          <TruckIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{laudo.veiculo?.placa || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{laudo.veiculo?.modelo || 'N/A'} {laudo.veiculo?.tipo_veiculo ? `- ${laudo.veiculo.tipo_veiculo}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{laudo.veiculo?.contrato?.nome || 'Não definido'}</div>
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {laudo.tipo_documento ? formatDocumentType(laudo.tipo_documento, laudo.subtipo_documento) : 'N/A'}
                        </div>
                        {laudo.tipo_documento === 'eletrico' && (
                          <div className="text-xs text-gray-500 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              laudo.subtipo_documento === 'lanca_isolada' ? 'bg-blue-100 text-blue-800' :
                              laudo.subtipo_documento === 'liner' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {laudo.subtipo_documento ? (subtipoLabels[laudo.subtipo_documento] || laudo.subtipo_documento) : 'Geral (sem subtipo)'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {laudo.expira_em ? new Date(laudo.expira_em).toLocaleDateString('pt-BR') : 'Sem validade'}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${laudo.statusColor}`}>
                          {(laudo.status === 'vencido' || laudo.status === 'faltando') && <ExclamationTriangleIcon className="h-4 w-4 mr-1" />}
                          {laudo.status !== 'vencido' && laudo.status !== 'faltando' && <CheckCircleIcon className="h-4 w-4 mr-1" />}
                          {laudo.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <div className="flex gap-2 justify-center">
                          {laudo.status !== 'faltando' && canManageLaudos && (
                            <button onClick={() => { setShowUploadModal(laudo.id || null); setNewExpirationDate(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                              <ArrowUpTrayIcon className="h-4 w-4 mr-1" />Atualizar
                            </button>
                          )}
                          {laudo.url_arquivo && canViewLaudos && (
                            <a href={laudo.url_arquivo} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" title="Ver PDF">
                              <DocumentTextIcon className="h-4 w-4 mr-1 text-blue-600" />Ver PDF
                            </a>
                          )}
                          {laudo.status === 'faltando' && canManageLaudos && (
                            <button onClick={() => { setShowUploadModal(laudo.id || null); setNewExpirationDate(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                              <ArrowUpTrayIcon className="h-4 w-4 mr-1" />Adicionar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="bg-white px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 gap-2">
            <div className="text-xs text-gray-600 mb-1 sm:mb-0">
              Mostrando <span className="font-semibold">{startIndex + 1}</span> - <span className="font-semibold">{Math.min(startIndex + itemsPerPage, filteredLaudos.length)}</span> de <span className="font-semibold">{filteredLaudos.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sesmtItemsPerPage" className="text-xs text-gray-600">Itens por página:</label>
              <select id="sesmtItemsPerPage" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="block border-gray-300 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500">
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-1 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`relative inline-flex items-center px-3 py-1 border text-xs font-medium ${
                      currentPage === page ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-1 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Modal de Upload */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl max-w-md w-full p-8 border border-gray-200">
              <button type="button" onClick={() => setShowUploadModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold focus:outline-none" aria-label="Fechar">×</button>
              {(() => {
                const l = filteredLaudosByAccess.find((d: Laudo) => d.id === showUploadModal);
                if (!l) return null;
                return (
                  <div className="mb-6 flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2 text-blue-700 text-base font-semibold">
                      <TruckIcon className="h-5 w-5" />
                      {l.veiculo?.placa}
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-700 font-normal">{l.veiculo?.modelo} {l.veiculo?.tipo_veiculo ? `- ${l.veiculo.tipo_veiculo}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 text-sm mt-1">
                      <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{documentTypeLabels[l.tipo_documento] || l.tipo_documento}</span>
                    </div>
                  </div>
                );
              })()}
              <div className="flex flex-col items-center">
                <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <ArrowUpTrayIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center">Atualizar Documento</h3>
                <p className="text-gray-500 text-sm mb-6 text-center">Selecione um novo arquivo PDF e defina a nova data de validade do laudo.</p>
              </div>
              <form className="space-y-5" onSubmit={e => { e.preventDefault(); handleFileUpload(showUploadModal); }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF</label>
                  <input type="file" ref={fileInputRef}
                    className="block w-full text-sm text-gray-700 bg-white/70 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
                    accept=".pdf" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nova Data de Validade</label>
                  <div className="flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 transition">
                    <CalendarIcon className="h-5 w-5 text-blue-500" />
                    <input type="date" value={newExpirationDate} onChange={(e) => setNewExpirationDate(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-gray-700 text-sm placeholder-gray-400" required />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowUploadModal(null)}
                    className="px-5 py-2 rounded-full text-sm font-medium text-gray-700 bg-white/80 border border-gray-300 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-400">
                    Cancelar
                  </button>
                  <button type="submit" disabled={uploading === showUploadModal}
                    className="px-6 py-2 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60">
                    {uploading === showUploadModal ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
