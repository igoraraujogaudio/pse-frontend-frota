'use client';

import React, { useState } from 'react';
import { ChartBarIcon, CloudArrowUpIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon, CheckCircleIcon, PlusIcon, XMarkIcon, TruckIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import BulkUploadQuilometragem from '@/components/BulkUploadQuilometragem';
import QuilometragemDashboard from '@/components/QuilometragemDashboard';
import { QuilometragemBulkService, UploadResult } from '@/services/quilometragemBulkService';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { maintenanceService } from '@/services/maintenanceService';
import { workshopService } from '@/services/workshopService';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Maintenance, Vehicle } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

export function PreventivaContent() {
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'upload' | 'veiculos'>('dashboard');
  const [resultados, setResultados] = useState<UploadResult[]>([]);
  const [showNewPreventivaModal, setShowNewPreventivaModal] = useState(false);
  const [showEditUltimaPreventivaModal, setShowEditUltimaPreventivaModal] = useState<{
    veiculo: Vehicle | null;
    quilometragem_preventiva: number | null;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contratoFilter, setContratoFilter] = useState<string | null>(null);
  const [novaPreventiva, setNovaPreventiva] = useState({
    veiculo_id: '',
    buscaVeiculo: '',
    descricao: '',
    prioridade: 'normal',
    oficina_id: '',
    buscaOficina: '',
    numero_orcamento: ''
  });

  const { notify } = useNotification();
  const { user, userContratoIds } = useAuth();
  const queryClient = useQueryClient();

  // Buscar veículos filtrados por contratos do usuário
  const {
    data: vehicles = [],
    isLoading: loadingVehicles,
    error: errorVehicles
  } = useQuery({
    queryKey: ['vehicles', userContratoIds],
    queryFn: () => vehicleService.getAll(undefined, userContratoIds), // Filtrar por contratos do usuário
    enabled: abaAtiva === 'veiculos' || abaAtiva === 'dashboard'
  });

  // Buscar oficinas filtradas por contrato do usuário
  const {
    data: workshops = []
  } = useQuery({
    queryKey: ['workshops', userContratoIds],
    queryFn: async () => {
      const allWorkshops = await workshopService.getAll();
      
      // Se usuário é admin ou não tem contratos específicos, retorna todas
      if (!userContratoIds || userContratoIds.length === 0) {
        return allWorkshops;
      }
      
      // Filtrar oficinas pelos contratos do usuário
      return allWorkshops.filter(workshop => 
        workshop.contrato_id && userContratoIds.includes(workshop.contrato_id)
      );
    },
    enabled: !!user
  });

  // Lista contratos únicos
  const uniqueContratos = Array.from(new Set(vehicles.map((v: Vehicle) => v.contrato?.nome).filter(Boolean)));

  // Filtro de veículos
  const filteredVehicles = vehicles.filter((vehicle: Vehicle) =>
    (contratoFilter ? vehicle.contrato?.nome === contratoFilter : true) &&
    (
      (vehicle.placa && vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.modelo && vehicle.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.marca_equipamento && vehicle.marca_equipamento.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.tipo_veiculo && vehicle.tipo_veiculo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.contrato?.nome && vehicle.contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  // Mutation para criar nova manutenção preventiva
  const createPreventivaMutation = useMutation({
    mutationFn: async (dadosPreventiva: Omit<Maintenance, 'id' | 'criado_em'>) => {
      return await maintenanceService.create({
        ...dadosPreventiva,
        tipo: 'preventive'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowNewPreventivaModal(false);
              setNovaPreventiva({
                veiculo_id: '',
                buscaVeiculo: '',
                descricao: '',
                prioridade: 'normal',
                oficina_id: '',
                buscaOficina: '',
                numero_orcamento: ''
              });
      notify('Manutenção preventiva criada com sucesso!', 'success');
    },
    onError: (error: Error) => {
      notify(`Erro ao criar manutenção preventiva: ${error.message}`, 'error');
    }
  });

  // Mutation para atualizar última preventiva
  const updateUltimaPreventivaMapping = useMutation({
    mutationFn: async ({ veiculoId, quilometragem_preventiva }: { veiculoId: string; quilometragem_preventiva: number | null }) => {
      // Calcular próxima preventiva automaticamente
      const veiculo = vehicles?.find((v: Vehicle) => String(v.id) === veiculoId);
      const intervalo = veiculo?.intervalo_preventiva || 10000;
      const proxima_preventiva_km = quilometragem_preventiva !== null
        ? quilometragem_preventiva + intervalo
        : null;

      return await vehicleService.update(veiculoId, {
        quilometragem_preventiva,
        proxima_preventiva_km
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowEditUltimaPreventivaModal(null);
      notify('Última preventiva atualizada com sucesso! A próxima preventiva foi recalculada automaticamente.', 'success');
    },
    onError: (error: Error) => {
      notify(`Erro ao atualizar última preventiva: ${error.message}`, 'error');
    }
  });

  const handleUploadComplete = async (resultados: UploadResult[]) => {
    try {
      setResultados(resultados);
      
      // Gerar relatório
      const relatorio = QuilometragemBulkService.gerarRelatorioUpload(resultados);
      console.log('Relatório de upload:', relatorio);
      
      // Mostrar notificação de sucesso/erro
      if (relatorio.sucessos > 0) {
        notify(`${relatorio.sucessos} veículos atualizados com sucesso!`, 'success');
      }
      
      if (relatorio.erros > 0) {
        notify(`${relatorio.erros} veículos com erro na atualização`, 'error');
      }

    } catch (error) {
      console.error('Erro no upload:', error);
      notify('Erro ao processar upload de quilometragem', 'error');
    }
  };

  // Função para exportar relatório completo de preventivas
  const handleExportarRelatorioCompleto = () => {
    try {
      // Usar veículos filtrados (com base no contrato selecionado)
      const veiculosParaRelatorio = filteredVehicles;

      if (veiculosParaRelatorio.length === 0) {
        notify('Nenhum veículo encontrado para exportar', 'warning');
        return;
      }

      // Preparar dados para Excel
      const dadosExcel = veiculosParaRelatorio.map((vehicle: Vehicle) => {
        // Calcular status da preventiva
        let statusPreventiva = 'Sem dados';
        if (vehicle.quilometragem_atual && vehicle.proxima_preventiva_km) {
          if (vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km) {
            statusPreventiva = 'Vencida';
          } else if (vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))) {
            statusPreventiva = 'Próxima';
          } else {
            statusPreventiva = 'OK';
          }
        }

        // Calcular km restante até próxima preventiva
        let kmRestante = null;
        if (vehicle.quilometragem_atual && vehicle.proxima_preventiva_km) {
          kmRestante = vehicle.proxima_preventiva_km - vehicle.quilometragem_atual;
        }

        return {
          'Placa': vehicle.placa || '',
          'Modelo': vehicle.modelo || '',
          'Marca': vehicle.marca_equipamento || '',
          'Tipo Veículo': vehicle.tipo_veiculo || '',
          'Contrato': vehicle.contrato?.nome || '',
          'Base': vehicle.base?.nome || '',
          'Quilometragem Atual': vehicle.quilometragem_atual || 0,
          'Última Preventiva (km)': vehicle.quilometragem_preventiva || 'Não registrada',
          'Próxima Preventiva (km)': vehicle.proxima_preventiva_km || 'Não calculada',
          'Intervalo Preventiva': vehicle.intervalo_preventiva || 10000,
          'Alerta KM': vehicle.alerta_preventiva_km || 1000,
          'Status': statusPreventiva,
          'KM Restante': kmRestante !== null ? kmRestante : 'N/A',
          'Status Veículo': vehicle.status || '',
          'Prefixo': vehicle.prefixo_fixo || ''
        };
      });

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);

      // Configurar larguras das colunas
      const colWidths = [
        { wch: 10 },  // Placa
        { wch: 25 },  // Modelo
        { wch: 20 },  // Marca
        { wch: 20 },  // Tipo Veículo
        { wch: 25 },  // Contrato
        { wch: 20 },  // Base
        { wch: 18 },  // Quilometragem Atual
        { wch: 22 },  // Última Preventiva
        { wch: 22 },  // Próxima Preventiva
        { wch: 20 },  // Intervalo Preventiva
        { wch: 12 },  // Alerta KM
        { wch: 15 },  // Status
        { wch: 15 },  // KM Restante
        { wch: 18 },  // Status Veículo
        { wch: 12 }   // Prefixo
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Preventivas');

      // Adicionar aba com resumo
      const resumoData = [
        { 'Métrica': 'Total de Veículos', 'Valor': veiculosParaRelatorio.length },
        { 'Métrica': 'Veículos com Preventiva Vencida', 'Valor': dadosExcel.filter(v => v.Status === 'Vencida').length },
        { 'Métrica': 'Veículos Próximos da Preventiva', 'Valor': dadosExcel.filter(v => v.Status === 'Próxima').length },
        { 'Métrica': 'Veículos OK', 'Valor': dadosExcel.filter(v => v.Status === 'OK').length },
        { 'Métrica': 'Veículos Sem Última Preventiva', 'Valor': dadosExcel.filter(v => v['Última Preventiva (km)'] === 'Não registrada').length },
        { 'Métrica': 'Contrato Filtrado', 'Valor': contratoFilter || 'Todos' },
        { 'Métrica': 'Data/Hora Exportação', 'Valor': new Date().toLocaleString('pt-BR') }
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      wsResumo['!cols'] = [{ wch: 35 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

      // Gerar nome do arquivo
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const contratoNome = contratoFilter ? `_${contratoFilter.replace(/[^a-zA-Z0-9]/g, '_')}` : '_Todos';
      const nomeArquivo = `Relatorio_Preventivas${contratoNome}_${dataAtual}.xlsx`;

      // Download
      XLSX.writeFile(wb, nomeArquivo);
      notify(`Relatório exportado com sucesso! ${veiculosParaRelatorio.length} veículos incluídos.`, 'success');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      notify('Erro ao exportar relatório de preventivas', 'error');
    }
  };

  const handleSubmitPreventiva = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novaPreventiva.veiculo_id) {
      notify('Digite e selecione um veículo', 'error');
      return;
    }

    if (!novaPreventiva.descricao.trim()) {
      notify('Descrição é obrigatória', 'error');
      return;
    }

    if (!novaPreventiva.oficina_id) {
      notify('Selecione uma oficina', 'error');
      return;
    }

    try {
      // 1. Criar manutenção preventiva
      const dadosPreventiva = {
        veiculo_id: novaPreventiva.veiculo_id,
        descricao: novaPreventiva.descricao,
        prioridade: novaPreventiva.prioridade as 'baixa' | 'normal' | 'alta' | 'urgente',
        status: 'pendente' as const,
        tipo: 'preventive' as const,
        atualizado_em: new Date().toISOString(),
        solicitante_id: user?.id || '',
        numero_orcamento: novaPreventiva.numero_orcamento || undefined,
        tipo_servico: 'externo' as const
      };

      const manutencaoCriada = await maintenanceService.create(dadosPreventiva);

      // 2. Aprovar automaticamente (com oficina)
      const historicoAprovacao = [
        {
          status: 'aprovada',
          data: new Date().toISOString(),
          usuario_id: user?.id,
          comentario: 'Aprovação automática de manutenção preventiva'
        }
      ];
      await maintenanceService.update(manutencaoCriada.id, {
        status: 'aprovada',
        oficina_id: novaPreventiva.oficina_id,
        aprovador_id: user?.id,
        aprovado_em: new Date().toISOString(),
        historico: historicoAprovacao
      });

      // Limpar formulário e fechar modal
      setNovaPreventiva({
        veiculo_id: '',
        buscaVeiculo: '',
        descricao: '',
        prioridade: 'normal',
        oficina_id: '',
        buscaOficina: '',
        numero_orcamento: ''
      });
      setShowNewPreventivaModal(false);
      
      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      
      notify('Manutenção preventiva criada e aprovada com sucesso!', 'success');

      // Redirecionar para página de manutenção
      window.location.href = '/manutencoes';

    } catch (error) {
      notify(`Erro ao criar manutenção preventiva: ${(error as Error).message}`, 'error');
    }
  };

  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.MANUTENCAO.DASHBOARD_QUILOMETRAGEM,
      PERMISSION_CODES.MANUTENCAO.ALERTAS_QUILOMETRAGEM,
      PERMISSION_CODES.MANUTENCAO.CONFIGURAR_INTERVALOS_PREVENTIVA,
      PERMISSION_CODES.MANUTENCAO.CONFIGURAR_ALERTAS_KM,
      PERMISSION_CODES.MANUTENCAO.MARCAR_PREVENTIVA_REALIZADA,
      PERMISSION_CODES.MANUTENCAO.RELATORIO_PREVENTIVAS_KM,
      PERMISSION_CODES.MANUTENCAO.HISTORICO_PREVENTIVAS_KM,
      PERMISSION_CODES.MANUTENCAO.ANALISE_UTILIZACAO_FROTA,
      PERMISSION_CODES.MANUTENCAO.PLANEJAMENTO_PREVENTIVO_KM,
      PERMISSION_CODES.MANUTENCAO.RELATORIO_EFICIENCIA_PREVENTIVA,
      PERMISSION_CODES.MANUTENCAO.VISUALIZAR_ALERTAS_KM,
      PERMISSION_CODES.MANUTENCAO.MARCAR_PREVENTIVA_MOBILE,
      PERMISSION_CODES.MANUTENCAO.ATUALIZAR_QUILOMETRAGEM
    ]}>
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-2 sm:px-6 lg:px-8">
          <div className="px-4 py-2 sm:px-0">
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-4">
                <WrenchScrewdriverIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Manutenção Preventiva</h1>
                  <p className="text-gray-600">Sistema de manutenção preventiva por quilometragem</p>
                </div>
              </div>

              {/* Navegação por abas */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setAbaAtiva('dashboard')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      abaAtiva === 'dashboard'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="h-4 w-4" />
                      Dashboard
                    </div>
                  </button>
                  <button
                    onClick={() => setAbaAtiva('veiculos')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      abaAtiva === 'veiculos'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-4 w-4" />
                      Veículos
                    </div>
                  </button>
                  <button
                    onClick={() => setAbaAtiva('upload')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      abaAtiva === 'upload'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Upload Quilometragem
                    </div>
                  </button>
                </nav>
              </div>
            </div>

            {/* Conteúdo das abas */}
                    {abaAtiva === 'dashboard' && (
                      <div>
                        {/* Barra de pesquisa e filtros para dashboard */}
                        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder="Buscar por placa, modelo, marca..."
                              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <select
                              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={contratoFilter || ''}
                              onChange={(e) => setContratoFilter(e.target.value || null)}
                            >
                              <option value="">Todos os Contratos</option>
                              {uniqueContratos.map(contrato => (
                                <option key={contrato} value={contrato}>{contrato}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleExportarRelatorioCompleto}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
                              title="Exportar relatório completo de preventivas para Excel"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Exportar Relatório
                            </button>
                          </div>
                        </div>
                        <QuilometragemDashboard vehicles={filteredVehicles} />
                      </div>
                    )}

            {abaAtiva === 'veiculos' && (
              <div>
                {/* Barra de ações */}
                <div className="mb-3 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Veículos da Frota</h2>
                    <p className="text-sm text-gray-600">Gerencie manutenções preventivas por quilometragem</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleExportarRelatorioCompleto}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
                      title="Exportar relatório completo de preventivas para Excel"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Exportar Relatório
                    </button>
                    <button
                      onClick={() => setShowNewPreventivaModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Nova Manutenção Preventiva
                    </button>
                  </div>
                </div>

                {/* Barra de pesquisa e filtros */}
                <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar por placa, modelo, marca..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={contratoFilter || ''}
                      onChange={(e) => setContratoFilter(e.target.value || null)}
                    >
                      <option value="">Todos os Contratos</option>
                      {uniqueContratos.map(contrato => (
                        <option key={contrato} value={contrato}>{contrato}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista de veículos */}
                {loadingVehicles ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : errorVehicles ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">Erro ao carregar veículos: {(errorVehicles as Error).message}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Veículo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quilometragem Atual
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Última Preventiva
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Próxima Preventiva
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ações
                            </th>
                          </tr>
                        </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {filteredVehicles.map((vehicle) => (
                            <tr key={vehicle.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                      <TruckIcon className="h-5 w-5 text-blue-600" />
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{vehicle.placa}</div>
                                    <div className="text-sm text-gray-500">{vehicle.modelo}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {vehicle.quilometragem_atual?.toLocaleString() || '-'} km
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-900">
                                    {vehicle.quilometragem_preventiva?.toLocaleString() || '-'} km
                                  </span>
                                  <button
                                    onClick={() => {
                                      setShowEditUltimaPreventivaModal({
                                        veiculo: vehicle,
                                        quilometragem_preventiva: vehicle.quilometragem_preventiva || null
                                      });
                                    }}
                                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                                    title="Editar última preventiva"
                                  >
                                    Editar
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {vehicle.proxima_preventiva_km?.toLocaleString() || '-'} km
                                {vehicle.quilometragem_preventiva && (
                                  <span className="text-xs block text-gray-400">
                                    (auto-calculado)
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  vehicle.quilometragem_atual && vehicle.proxima_preventiva_km
                                    ? vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km
                                      ? 'bg-red-100 text-red-800'
                                      : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {vehicle.quilometragem_atual && vehicle.proxima_preventiva_km
                                    ? vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km
                                      ? 'Vencida'
                                      : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                                        ? 'Próxima'
                                        : 'OK'
                                    : 'Sem dados'
                                  }
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => {
                                    setNovaPreventiva(prev => ({ 
                                      ...prev, 
                                      veiculo_id: vehicle.id.toString(),
                                      buscaVeiculo: `${vehicle.placa} - ${vehicle.modelo}`
                                    }));
                                    setShowNewPreventivaModal(true);
                                  }}
                                  className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-md transition-colors"
                                >
                                  Nova Preventiva
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'upload' && (
              <div>
                <BulkUploadQuilometragem onUploadComplete={handleUploadComplete} />
                
                {/* Histórico de uploads */}
                {resultados.length > 0 && (
                  <div className="mt-8 bg-white rounded-xl shadow p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Histórico de Uploads</h3>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Placa
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quilometragem
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Detalhes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {resultados.map((resultado, index) => (
                            <tr key={index} className={resultado.sucesso ? 'bg-green-50' : 'bg-red-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {resultado.placa}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {resultado.quilometragem.toLocaleString()} km
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {resultado.sucesso ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                                    Sucesso
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                    Erro
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {resultado.erro || 'Atualizado com sucesso'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Informações importantes */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                Sistema Coeso de Quilometragem:
              </h4>
              <div className="space-y-4 text-sm text-blue-800">
                <div>
                  <p className="font-semibold mb-2">📊 Quilometragem Atual (Atualizada Diariamente):</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Upload em lote via Excel (aba &quot;Upload Quilometragem&quot;)</li>
                    <li>Portaria mobile ao registrar saída do veículo</li>
                    <li>Edição manual na página de detalhes do veículo</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-semibold mb-2">🔧 Última Preventiva (Definida pelo Gestor):</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Clique em &quot;Editar&quot; na tabela de veículos acima</li>
                    <li>Defina a quilometragem da última preventiva realizada</li>
                    <li>Ex: Última preventiva aos 97 km → Sistema calcula próxima em 10.097 km</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-semibold mb-2">✅ Próxima Preventiva (Calculada Automaticamente):</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Fórmula: Próxima = Última Preventiva + 10.000 km</li>
                    <li>Atualizada automaticamente quando você edita a última preventiva</li>
                    <li>Não precisa editar manualmente</li>
                  </ul>
                </div>
                
                <div className="pt-2 border-t border-blue-300">
                  <p className="font-semibold mb-1">⚠️ Importante:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Upload de quilometragem atualiza APENAS a quilometragem atual</li>
                    <li>Última preventiva deve ser editada manualmente APENAS quando realizar preventiva</li>
                    <li>O sistema calcula automaticamente a próxima preventiva baseado na última</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nova Manutenção Preventiva */}
      {showNewPreventivaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg mx-4 animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                  <PlusIcon className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Nova Manutenção Preventiva</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewPreventivaModal(false)}
                disabled={createPreventivaMutation.isPending}
                className="h-8 w-8 p-0 hover:bg-gray-100/80 rounded-lg"
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmitPreventiva} className="p-6 space-y-4">
              {/* Veículo */}
              <div className="space-y-2">
                <Label htmlFor="veiculo">Veículo</Label>
                <div className="relative">
                  <Input
                    id="veiculo"
                    placeholder="Digite a placa ou modelo do veículo..."
                    value={novaPreventiva.buscaVeiculo}
                    onChange={(e) => {
                      const busca = e.target.value;
                      setNovaPreventiva(prev => ({ ...prev, buscaVeiculo: busca }));
                      
                              // Buscar veículo correspondente
                              const veiculoEncontrado = filteredVehicles.find(v => 
                                v.placa.toLowerCase().includes(busca.toLowerCase()) ||
                                v.modelo.toLowerCase().includes(busca.toLowerCase())
                              );
                      
                      if (veiculoEncontrado) {
                        setNovaPreventiva(prev => ({ ...prev, veiculo_id: veiculoEncontrado.id.toString() }));
                      } else {
                        setNovaPreventiva(prev => ({ ...prev, veiculo_id: '' }));
                      }
                    }}
                  />
                  {novaPreventiva.buscaVeiculo && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {filteredVehicles
                                .filter(v => 
                                  v.placa.toLowerCase().includes(novaPreventiva.buscaVeiculo.toLowerCase()) ||
                                  v.modelo.toLowerCase().includes(novaPreventiva.buscaVeiculo.toLowerCase())
                                )
                                .map((vehicle) => (
                          <div
                            key={vehicle.id}
                            onClick={() => {
                              setNovaPreventiva(prev => ({ 
                                ...prev, 
                                veiculo_id: vehicle.id.toString(),
                                buscaVeiculo: `${vehicle.placa} - ${vehicle.modelo}`
                              }));
                            }}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900">{vehicle.placa}</div>
                            <div className="text-xs text-gray-500">{vehicle.modelo}</div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                {novaPreventiva.veiculo_id && (
                  <div className="text-xs text-green-600">
                    ✓ Veículo selecionado
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição da Manutenção</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva a manutenção preventiva a ser realizada..."
                  value={novaPreventiva.descricao}
                  onChange={(e) => setNovaPreventiva(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Número do Orçamento/OS */}
              <div className="space-y-2">
                <Label htmlFor="numero_orcamento">
                  Número do Orçamento / OS
                  <span className="text-xs text-gray-500 font-normal ml-2">(Opcional)</span>
                </Label>
                <Input
                  id="numero_orcamento"
                  placeholder="Ex: ORC-2024-001234 ou OS-2024-001234"
                  value={novaPreventiva.numero_orcamento}
                  onChange={(e) => setNovaPreventiva(prev => ({ ...prev, numero_orcamento: e.target.value }))}
                />
                <p className="text-xs text-gray-500">
                  Se já tiver o número do orçamento ou OS da oficina, pode adiantar e preencher aqui.
                </p>
              </div>

              {/* Linha: Prioridade e Oficina */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prioridade">Prioridade</Label>
                  <Select
                    value={novaPreventiva.prioridade}
                    onValueChange={(value) => setNovaPreventiva(prev => ({ ...prev, prioridade: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oficina">Oficina</Label>
                  <div className="relative">
                    <Input
                      id="oficina"
                      placeholder="Digite o nome da oficina..."
                      value={novaPreventiva.buscaOficina}
                      onChange={(e) => {
                        const busca = e.target.value;
                        setNovaPreventiva(prev => ({ ...prev, buscaOficina: busca }));
                        
                        // Buscar oficina correspondente
                        const oficinaEncontrada = workshops.find(w => 
                          w.nome.toLowerCase().includes(busca.toLowerCase())
                        );
                        
                        if (oficinaEncontrada) {
                          setNovaPreventiva(prev => ({ ...prev, oficina_id: oficinaEncontrada.id }));
                        } else {
                          setNovaPreventiva(prev => ({ ...prev, oficina_id: '' }));
                        }
                      }}
                    />
                    {novaPreventiva.buscaOficina && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {workshops
                          .filter(w => 
                            w.nome.toLowerCase().includes(novaPreventiva.buscaOficina.toLowerCase()) ||
                            w.cidade?.toLowerCase().includes(novaPreventiva.buscaOficina.toLowerCase()) ||
                            w.estado?.toLowerCase().includes(novaPreventiva.buscaOficina.toLowerCase())
                          )
                          .map((workshop) => (
                            <div
                              key={workshop.id}
                              onClick={() => {
                                setNovaPreventiva(prev => ({ 
                                  ...prev, 
                                  oficina_id: workshop.id,
                                  buscaOficina: workshop.nome
                                }));
                              }}
                              className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">{workshop.nome}</div>
                              <div className="text-xs text-gray-500">
                                {workshop.cidade && workshop.estado && `${workshop.cidade}, ${workshop.estado}`}
                                {workshop.contrato?.nome && (
                                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                    {workshop.contrato.nome}
                                  </span>
                                )}
                              </div>
                              {workshop.especialidades && workshop.especialidades.length > 0 && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Especialidades: {workshop.especialidades.join(', ')}
                                </div>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  {novaPreventiva.oficina_id && (
                    <div className="text-xs text-green-600">
                      ✓ Oficina selecionada
                    </div>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                        <Button
                          type="submit"
                          disabled={createPreventivaMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {createPreventivaMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Criando...
                            </>
                          ) : (
                            'Criar e Aprovar Preventiva'
                          )}
                        </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewPreventivaModal(false)}
                  disabled={createPreventivaMutation.isPending}
                  className="px-6"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Última Preventiva */}
      {showEditUltimaPreventivaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg mx-4 animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <WrenchScrewdriverIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Editar Última Preventiva</h2>
                  <p className="text-sm text-gray-500">
                    {showEditUltimaPreventivaModal.veiculo?.placa} - {showEditUltimaPreventivaModal.veiculo?.modelo}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditUltimaPreventivaModal(null)}
                disabled={updateUltimaPreventivaMapping.isPending}
                className="h-8 w-8 p-0 hover:bg-gray-100/80 rounded-lg"
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Formulário */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!showEditUltimaPreventivaModal.veiculo) return;
                
                updateUltimaPreventivaMapping.mutate({
                  veiculoId: showEditUltimaPreventivaModal.veiculo.id.toString(),
                  quilometragem_preventiva: showEditUltimaPreventivaModal.quilometragem_preventiva
                });
              }} 
              className="p-6 space-y-6"
            >
              {/* Info sobre quilometragem atual */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ChartBarIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">Quilometragem Atual do Veículo</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {showEditUltimaPreventivaModal.veiculo?.quilometragem_atual?.toLocaleString() || '0'} km
                    </p>
                  </div>
                </div>
              </div>

              {/* Quilometragem da última preventiva */}
              <div className="space-y-2">
                <Label htmlFor="quilometragem_preventiva" className="text-sm font-medium">
                  Quilometragem da Última Preventiva <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quilometragem_preventiva"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ex: 97"
                  value={showEditUltimaPreventivaModal.quilometragem_preventiva || ''}
                  onChange={(e) => {
                    setShowEditUltimaPreventivaModal(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        quilometragem_preventiva: e.target.value ? parseInt(e.target.value) : null
                      };
                    });
                  }}
                  className="text-lg"
                  required
                />
                <p className="text-xs text-gray-500">
                  Informe a quilometragem em que a última manutenção preventiva foi realizada.
                  <br />
                  A próxima preventiva será calculada automaticamente (última + 10.000 km).
                </p>
              </div>

              {/* Preview do cálculo */}
              {showEditUltimaPreventivaModal.quilometragem_preventiva !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-2">Próxima Preventiva (calculada automaticamente)</p>
                      <div className="space-y-1 text-sm text-green-800">
                        <p>• Última preventiva: <span className="font-semibold">{showEditUltimaPreventivaModal.quilometragem_preventiva.toLocaleString()} km</span></p>
                        <p>• Intervalo: <span className="font-semibold">10.000 km</span></p>
                        <p>• Próxima preventiva: <span className="font-semibold text-green-600">
                          {(showEditUltimaPreventivaModal.quilometragem_preventiva + 10000).toLocaleString()} km
                        </span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nota importante */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Importante:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Este campo deve ser atualizado apenas quando uma preventiva é realizada</li>
                      <li>O sistema calcula automaticamente a próxima preventiva</li>
                      <li>O upload de quilometragem diário atualiza apenas a quilometragem atual</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditUltimaPreventivaModal(null)}
                  disabled={updateUltimaPreventivaMapping.isPending}
                  className="px-6"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    updateUltimaPreventivaMapping.isPending ||
                    showEditUltimaPreventivaModal.quilometragem_preventiva === null
                  }
                  className="px-6 bg-blue-600 hover:bg-blue-700"
                >
                  {updateUltimaPreventivaMapping.isPending ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
