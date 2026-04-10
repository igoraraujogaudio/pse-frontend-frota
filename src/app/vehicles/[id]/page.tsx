"use client";
import Link from 'next/link';
import {
  ArrowLeftIcon, TruckIcon, ArrowsRightLeftIcon, BuildingOfficeIcon, UserGroupIcon, MapPinIcon, TagIcon, CalendarIcon, ShieldCheckIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, Cog6ToothIcon, CurrencyDollarIcon, UserIcon, LightBulbIcon, VideoCameraIcon, SignalIcon, KeyIcon, ChevronLeftIcon, ChevronRightIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import React, { useState, useCallback } from 'react';
import type { Vehicle, VehicleDocument } from '@/types';
import { useParams } from 'next/navigation';
import { vehicleService } from '@/services/vehicleService';
import { useQuery } from '@tanstack/react-query';
// import { Badge } from "@/components/ui/badge"; // TODO: Use for status indicators
// import { AlertCircle, Clock } from "lucide-react"; // TODO: Use for status icons
import { VehicleDocumentUploadModal } from '@/components/VehicleDocumentUploadModal';
import { VehicleTransferModal } from '@/components/VehicleTransferModal';
import { VehicleTeamReallocateModal } from '@/components/VehicleTeamReallocateModal';
import { OSLaudoAcusticoModal } from '@/components/OSLaudoAcusticoModal';
import { VehicleDocumentSection } from '@/components/VehicleDocumentSection';
import { EditExpirationDateModal } from '@/components/EditExpirationDateModal';
import { useNotification } from '@/contexts/NotificationContext';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import PermissionGuard from '@/components/permissions/PermissionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

export default function VehicleDetails() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
      PERMISSION_CODES.VEICULOS.CADASTRAR_VEICULO,
      PERMISSION_CODES.VEICULOS.EDITAR_VEICULO,
      PERMISSION_CODES.VEICULOS.RELATORIO_FROTA
    ]}>
      <VehicleDetailsContent />
    </ProtectedRoute>
  );
}

function VehicleDetailsContent() {
  const { id } = useParams();
  const { notify } = useNotification();
  const { userContratoIds } = useAuth();
  
  // DEBUG TEMPORÁRIO
  console.log('🔍 DEBUG NAVEGAÇÃO:', {
    userContratoIds,
    hasContratos: userContratoIds && userContratoIds.length > 0,
    contratoCount: userContratoIds?.length || 0,
    vehicleId: id
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  // const documentTypes = [ // TODO: Use for document type mapping
  //   { key: 'crlv', label: 'CRLV' },
  //   { key: 'tacografo', label: 'Tacógrafo' },
  //   { key: 'fumaca', label: 'Fumaça' },
  //   { key: 'eletrico', label: 'Elétrico' },
  //   { key: 'acustico', label: 'Acústico' },
  //   { key: 'apolice', label: 'Apólice' },
  //   { key: 'contrato_seguro', label: 'Contrato de Aluguel' },
  // ];
  const [showUploadModal, setShowUploadModal] = useState<{
    tipoDocumento: string;
    documentId?: string | null;
    documentTypeLabel?: string;
  } | null>(null);
  
  // Função para lidar com clique em upload de documento (compatível com VehicleDocumentSection)
  const handleDocumentUploadClick = (docData: { tipo: string; label: string; documento?: { id?: string } }) => {
    setShowUploadModal({
      tipoDocumento: docData.tipo,
      documentId: docData.documento?.id || null,
      documentTypeLabel: docData.label
    });
  };

  // Função para lidar com clique no botão OS do laudo acústico
  const handleOSClick = (documento: VehicleDocument) => {
    setShowOSModal({ documento });
  };


  // Função para lidar com mudanças nas datas editáveis
  const handleDateChange = (documentId: string, newDate: string) => {
    setEditableDocuments(prev => ({
      ...prev,
      [documentId]: newDate
    }));
  };
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTeamReallocateModal, setShowTeamReallocateModal] = useState(false);
  const [locations, setLocations] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [teamReallocateLoading, setTeamReallocateLoading] = useState(false);
  const [showOSModal, setShowOSModal] = useState<{ documento: VehicleDocument } | null>(null);
  const [showEditExpirationModal, setShowEditExpirationModal] = useState<VehicleDocument | null>(null);
  const [editableDocuments, setEditableDocuments] = useState<{[key: string]: string}>({});


  const {
    data: vehicle,
    isLoading: isVehicleLoading,
    error: vehicleError,
    refetch: refetchVehicle,
  } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => vehicleService.getById(id as string),
    enabled: !!id,
  });

  // Query para obter lista de todos os veículos para navegação (filtrados por contrato)
  const {
    data: allVehicles,
    isLoading: isVehiclesLoading,
  } = useQuery({
    queryKey: ['vehicles-navigation', userContratoIds],
    queryFn: async () => {
      console.log('🚗 CARREGANDO VEÍCULOS PARA NAVEGAÇÃO:', {
        userContratoIds,
        contratoCount: userContratoIds?.length || 0
      });
      
      const vehicles = await vehicleService.getAll(undefined, userContratoIds);
      
      console.log('🚗 VEÍCULOS CARREGADOS:', {
        totalVehicles: vehicles?.length || 0,
        vehicles: vehicles?.map(v => ({ 
          id: v.id, 
          placa: v.placa, 
          contrato_id: v.contrato_id,
          contrato_nome: v.contrato?.nome 
        }))
      });
      
      return vehicles;
    },
    enabled: true, // Forçar execução sempre
  });

  // Encontrar índice do veículo atual e calcular anterior/próximo
  const currentIndex = allVehicles?.findIndex(v => String(v.id) === String(id)) ?? -1;
  const previousVehicle = currentIndex > 0 ? allVehicles?.[currentIndex - 1] : null;
  const nextVehicle = currentIndex >= 0 && currentIndex < (allVehicles?.length ?? 0) - 1 ? allVehicles?.[currentIndex + 1] : null;
  
  // DEBUG: Estado dos botões de navegação
  console.log('🔍 ESTADO NAVEGAÇÃO:', {
    isVehiclesLoading,
    allVehiclesLength: allVehicles?.length || 0,
    currentIndex,
    previousVehicle: previousVehicle?.placa,
    nextVehicle: nextVehicle?.placa,
    shouldShowButtons: !isVehiclesLoading && allVehicles && allVehicles.length > 1 && currentIndex >= 0
  });

  const {
    data: documents,
    isLoading: isDocumentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: ['vehicle-documents', vehicle?.id],
    queryFn: () => vehicleService.getDocuments(vehicle?.id?.toString() ?? ''),
    enabled: !!vehicle?.id,
  });

  const {
    data: transferHistory,
    isLoading: isTransferHistoryLoading,
  } = useQuery({
    queryKey: ['vehicle-transfer-history', vehicle?.id],
    queryFn: () => vehicleService.getTransferHistory(vehicle?.id?.toString() ?? ''),
    enabled: !!vehicle?.id,
  });

  // Função removida - funcionalidade não implementada nesta versão

  // Função para carregar contratos disponíveis
  const loadLocations = React.useCallback(async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      notify('Erro ao carregar contratos', 'error');
    }
  }, [notify]);

  // Função para transferir veículo de contrato
  async function handleTransferVehicle() {
    if (!selectedLocationId || !vehicle) return;

    if (selectedLocationId === vehicle.contrato_id) {
      notify('O veículo já está neste contrato', 'error');
      return;
    }

    const selectedLocation = locations.find(loc => loc.id === selectedLocationId);

    if (confirm(`Confirma a transferência do veículo ${vehicle.placa} para o contrato ${selectedLocation?.nome}?`)) {
      try {
        setTransferLoading(true);

        const headers = await getAuthHeaders();

        const response = await fetch(`/api/vehicles/${vehicle.id}/transfer`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            newContratoId: selectedLocationId,
            currentContratoId: vehicle.contrato_id
          }),
        });

        if (response.ok) {
          const result = await response.json();
          notify(result.message || 'Veículo transferido com sucesso!', 'success');
          setShowTransferModal(false);
          setSelectedLocationId(null);
          refetchVehicle();
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Erro na transferência' }));
          throw new Error(errorData.error || 'Erro na transferência');
        }
      } catch (error: unknown) {
        const err = error as Error
        console.error('Error transferring vehicle:', error);
        notify(err.message || 'Erro ao transferir veículo', 'error');
      } finally {
        setTransferLoading(false);
      }
    }
  }

  // Função para realocar equipe do veículo
  async function handleTeamReallocate(targetTeamId: string | null) {
    if (!vehicle) return;

    try {
      setTeamReallocateLoading(true);

      const headers = await getAuthHeaders();
      
      const response = await fetch(`/api/vehicles/${vehicle.id}/reallocate-team`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetTeamId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        notify(result.message, 'success');
        setShowTeamReallocateModal(false);
        refetchVehicle();
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao realocar equipe do veículo', 'error');
      }
    } catch (error) {
      console.error('Error reallocating team:', error);
      notify('Erro ao realocar equipe do veículo', 'error');
    } finally {
      setTeamReallocateLoading(false);
    }
  }

  // Carregar contratos quando o modal de transferência for aberto
  React.useEffect(() => {
    if (showTransferModal) {
      loadLocations();
    }
  }, [showTransferModal, loadLocations]);

  // Estados para modais de devolução/desmobilização
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [showDesmobilizarModal, setShowDesmobilizarModal] = useState(false);
  const [showReativarModal, setShowReativarModal] = useState(false);
  const [operacaoData, setOperacaoData] = useState({
    motivo: '',
    observacoes: ''
  });
  const [reativacaoObservacoes, setReativacaoObservacoes] = useState('');
  
  // Estados para modais de bloqueio/desbloqueio
  const [showBloquearModal, setShowBloquearModal] = useState(false);
  const [showDesbloquearModal, setShowDesbloquearModal] = useState(false);
  const [bloqueioData, setBloqueioData] = useState({
    motivo: '',
    observacoes: '',
    bloqueio_origem_contrato_id: ''
  });
  const [contratos, setContratos] = useState<Array<{id: string; nome: string}>>([]);
  const [desbloqueioObservacoes, setDesbloqueioObservacoes] = useState('');

  // Helper function to get auth headers
  const getAuthHeaders = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Erro ao obter sessão:', error);
        throw error;
      }
      
      if (!session) {
        console.error('Nenhuma sessão encontrada');
        throw new Error('Nenhuma sessão encontrada');
      }
      
      if (!session.access_token) {
        console.error('Token de acesso não encontrado na sessão');
        throw new Error('Token de acesso não encontrado');
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
      
      return headers;
    } catch (error) {
      console.error('Erro ao obter headers de autenticação:', error);
      throw error;
    }
  }, []);

  // Função para devolver veículo
  async function handleDevolverVeiculo() {
    if (!vehicle || !operacaoData.motivo.trim()) return;

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('/api/vehicles/devolve-dismobilize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          veiculo_id: vehicle.id,
          tipo_operacao: 'devolvido',
          motivo: operacaoData.motivo.trim(),
          observacoes: operacaoData.observacoes.trim()
        }),
      });

      if (response.ok) {
        notify(`Veículo ${vehicle.placa} devolvido com sucesso!`, 'success');
        setShowDevolverModal(false);
        setOperacaoData({ motivo: '', observacoes: '' });
        refetchVehicle();
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao devolver veículo', 'error');
      }
    } catch (error) {
      console.error('Error processing vehicle devolution:', error);
      notify('Erro ao devolver veículo', 'error');
    }
  }

  // Função para desmobilizar veículo
  async function handleDesmobilizarVeiculo() {
    if (!vehicle || !operacaoData.motivo.trim()) return;

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('/api/vehicles/devolve-dismobilize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          veiculo_id: vehicle.id,
          tipo_operacao: 'desmobilizado',
          motivo: operacaoData.motivo.trim(),
          observacoes: operacaoData.observacoes.trim()
        }),
      });

      if (response.ok) {
        notify(`Veículo ${vehicle.placa} desmobilizado com sucesso!`, 'success');
        setShowDesmobilizarModal(false);
        setOperacaoData({ motivo: '', observacoes: '' });
        refetchVehicle();
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao desmobilizar veículo', 'error');
      }
    } catch (error) {
      console.error('Error processing vehicle decommission:', error);
      notify('Erro ao desmobilizar veículo', 'error');
    }
  }

  // Função para reativar veículo
  async function handleReativarVeiculo() {
    if (!vehicle) return;

    try {
      const response = await fetch('/api/vehicles/reactivate', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          veiculo_id: vehicle.id,
          novo_status: 'disponivel', // Sempre disponivel
          observacoes: reativacaoObservacoes.trim()
        }),
      });

      if (response.ok) {
        const result = await response.json();
        notify(result.message, 'success');
        setShowReativarModal(false);
        setReativacaoObservacoes('');
        refetchVehicle();
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao reativar veículo', 'error');
      }
    } catch (error) {
      console.error('Error reactivating vehicle:', error);
      notify('Erro ao reativar veículo', 'error');
    }
  }

  // Função para carregar contratos disponíveis
  const loadContratos = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/admin/contracts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setContratos(data.contracts || []);
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  }, []);

  // Função para bloquear veículo
  async function handleBloquearVeiculo() {
    if (!vehicle || !bloqueioData.motivo.trim()) return;

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('/api/vehicles/block', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          veiculo_id: vehicle.id,
          motivo: bloqueioData.motivo.trim(),
          observacoes: bloqueioData.observacoes.trim(),
          bloqueio_origem_contrato_id: bloqueioData.bloqueio_origem_contrato_id || null
        }),
      });

      if (response.ok) {
        notify(`Veículo ${vehicle.placa} bloqueado com sucesso!`, 'success');
        setShowBloquearModal(false);
        setBloqueioData({ motivo: '', observacoes: '', bloqueio_origem_contrato_id: '' });
        refetchVehicle();
        // Invalidar query da página principal para atualizar o status lá também
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['blocked-vehicles-info'] });
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao bloquear veículo', 'error');
      }
    } catch (error) {
      console.error('Error blocking vehicle:', error);
      notify('Erro ao bloquear veículo', 'error');
    }
  }

  // Função para desbloquear veículo
  async function handleDesbloquearVeiculo() {
    if (!vehicle) return;

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('/api/vehicles/unblock', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          veiculo_id: vehicle.id,
          novo_status: 'disponivel',
          observacoes: desbloqueioObservacoes.trim()
        }),
      });

      if (response.ok) {
        const result = await response.json();
        notify(result.message, 'success');
        setShowDesbloquearModal(false);
        setDesbloqueioObservacoes('');
        refetchVehicle();
        // Invalidar query da página principal para atualizar o status lá também
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['blocked-vehicles-info'] });
      } else {
        const error = await response.json();
        notify(error.error || 'Erro ao desbloquear veículo', 'error');
      }
    } catch (error) {
      console.error('Error unblocking vehicle:', error);
      notify('Erro ao desbloquear veículo', 'error');
    }
  }

  // Carregar contratos quando o modal de bloqueio for aberto
  React.useEffect(() => {
    if (showBloquearModal) {
      loadContratos();
    }
  }, [showBloquearModal, loadContratos]);



  // Função para iniciar edição
  function handleEdit() {
    setEditVehicle({
      ...vehicle,
      equipamentos: {
        giroflex: vehicle?.equipamentos?.giroflex || false,
        camera: vehicle?.equipamentos?.camera || false,
        tracker: vehicle?.equipamentos?.tracker || false,
      },
    } as Vehicle);
    setIsEditing(true);
  }
  // Função para cancelar edição
  function handleCancelEdit() {
    setIsEditing(false);
    setEditVehicle(null);
    setEditableDocuments({});
  }
  // Função para salvar edição
  async function handleSaveEdit() {
    if (!editVehicle) return;
    try {
      // Enviar apenas os campos editáveis da tabela veiculos (sem id, criado_em, atualizado_em, e sem campos de relação)
      const payload: Partial<Vehicle> = {
        placa: editVehicle.placa,
        ano_fabricacao: editVehicle.ano_fabricacao,
        ano_modelo: editVehicle.ano_modelo,
        renavam: editVehicle.renavam,
        chassis: editVehicle.chassis,
        numero_crlv: editVehicle.numero_crlv,
        operacao_combustivel: editVehicle.operacao_combustivel,
        modelo: editVehicle.modelo,
        tipo_modelo: editVehicle.tipo_modelo,
        versao: editVehicle.versao,
        tipo_veiculo: editVehicle.tipo_veiculo,
        marca_equipamento: editVehicle.marca_equipamento,
        valor_aluguel: editVehicle.valor_aluguel,
        tipo_combustivel: editVehicle.tipo_combustivel,
        equipamentos: {
          giroflex: !!editVehicle.equipamentos?.giroflex,
          camera: !!editVehicle.equipamentos?.camera,
          tracker: !!editVehicle.equipamentos?.tracker,
        },
        rastreador: editVehicle.rastreador,
        propriedade: editVehicle.propriedade,
        condicao: editVehicle.condicao,
        status: editVehicle.status,
        contrato_id: editVehicle.contrato_id,
        base_id: editVehicle.base_id,
        supervisor_id: editVehicle.supervisor_id,
        ultima_manutencao: editVehicle.ultima_manutencao,
        proxima_manutencao: editVehicle.proxima_manutencao,
        quilometragem_atual: editVehicle.quilometragem_atual,
        quilometragem_preventiva: editVehicle.quilometragem_preventiva,
        intervalo_preventiva: editVehicle.intervalo_preventiva,
        proxima_preventiva_km: editVehicle.proxima_preventiva_km,
        alerta_preventiva_km: editVehicle.alerta_preventiva_km,
        prefixo_fixo: editVehicle.prefixo_fixo,
        equipe_id: editVehicle.equipe_id,
      };
      // Corrigir campos uuid/data vazios para null
      ['equipe_id', 'supervisor_id', 'ultima_manutencao', 'proxima_manutencao'].forEach(field => {
        if ((payload as Record<string, unknown>)[field] === "") {
          (payload as Record<string, unknown>)[field] = null;
        }
      });
      
      // Salvar o veículo
      await vehicleService.update(id as string, payload);
      
      // Salvar as datas dos documentos editadas
      for (const [documentId, newDate] of Object.entries(editableDocuments)) {
        if (newDate) {
          await fetch(`/api/vehicle-documents/${documentId}/expiration-date`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              expira_em: newDate
            }),
          });
        }
      }
      
      notify('Veículo atualizado com sucesso!', 'success');
      setIsEditing(false);
      setEditVehicle(null);
      setEditableDocuments({});
      refetchVehicle();
    } catch {
      notify('Erro ao atualizar veículo', 'error');
    }
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isVehicleLoading ? (
            <div className="text-gray-600">Carregando veículo...</div>
          ) : vehicleError ? (
            <div className="text-red-600">Erro ao carregar veículo</div>
          ) : vehicle ? (
            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" />
                    Voltar para a lista
                  </Link>
                  
                  {/* Botões de navegação entre veículos */}
                  {!isVehiclesLoading && allVehicles && allVehicles.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 font-medium">
                        {currentIndex + 1} de {allVehicles.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={previousVehicle ? `/vehicles/${previousVehicle.id}` : '#'}
                          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm ${
                            previousVehicle 
                              ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md' 
                              : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          }`}
                          title={previousVehicle ? `Anterior: ${previousVehicle.placa}` : 'Primeiro veículo'}
                        >
                          <ChevronLeftIcon className="h-4 w-4 mr-1" />
                          Anterior
                        </Link>
                        <Link
                          href={nextVehicle ? `/vehicles/${nextVehicle.id}` : '#'}
                          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm ${
                            nextVehicle 
                              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' 
                              : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          }`}
                          title={nextVehicle ? `Próximo: ${nextVehicle.placa}` : 'Último veículo'}
                        >
                          Próximo
                          <ChevronRightIcon className="h-4 w-4 ml-1" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <TruckIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 text-lg font-bold"
                            value={editVehicle?.placa || ''}
                            onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, placa: e.target.value } : v)}
                          />
                        ) : (
                          <>{vehicle?.placa} - {vehicle?.modelo}</>
                        )}
                      </h1>
                      <div className="flex items-center gap-2 ml-2">
                        <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.EDITAR_VEICULO}>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            title="Transferir base"
                            onClick={() => setShowTransferModal(true)}
                          >
                            <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                            Transferir
                          </button>
                        </PermissionGuard>
                        {/* Botão de bloqueio - apenas para veículos ativos */}
                        {vehicle?.status && !['devolvido', 'desmobilizado', 'bloqueado'].includes(vehicle.status.toLowerCase()) && (
                          <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.BLOQUEAR_VEICULO}>
                            <button
                              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              title="Bloquear veículo"
                              onClick={() => setShowBloquearModal(true)}
                            >
                              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                              Bloquear
                            </button>
                          </PermissionGuard>
                        )}
                      </div>
                      {/* Botão de reativação - apenas para veículos devolvidos/desmobilizados */}
                      {vehicle?.status && ['devolvido', 'desmobilizado'].includes(vehicle.status.toLowerCase()) && (
                        <button
                          className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ml-2"
                          title="Reativar veículo"
                          onClick={() => setShowReativarModal(true)}
                        >
                          <ArrowLeftIcon className="h-5 w-5 mr-2" />
                          Reativar
                        </button>
                      )}
                      {/* Botão de desbloqueio - apenas para veículos bloqueados */}
                      {vehicle?.status && vehicle.status.toLowerCase() === 'bloqueado' && (
                        <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.DESBLOQUEAR_VEICULO}>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ml-2"
                            title="Desbloquear veículo"
                            onClick={() => setShowDesbloquearModal(true)}
                          >
                            <ShieldCheckIcon className="h-5 w-5 mr-2" />
                            Desbloquear
                          </button>
                        </PermissionGuard>
                      )}
                      {!isEditing && (
                        <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.EDITAR_VEICULO}>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ml-2"
                            title="Editar veículo"
                            onClick={handleEdit}
                          >
                            Editar
                          </button>
                        </PermissionGuard>
                      )}
                      {isEditing && (
                        <>
                          <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.EDITAR_VEICULO}>
                            <button
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ml-2"
                              title="Salvar edição"
                              onClick={handleSaveEdit}
                            >
                              Salvar
                            </button>
                          </PermissionGuard>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ml-2"
                            title="Cancelar edição"
                            onClick={handleCancelEdit}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-wrap">
                      <BuildingOfficeIcon className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium text-blue-900 bg-blue-50 rounded px-2 py-0.5">
                        {/* TODO: Implement team relationship */}
                        {'-'}
                      </span>
                      <UserGroupIcon className="h-5 w-5 text-blue-500 ml-2" />
                      <span className="text-sm font-medium text-blue-900 bg-blue-50 rounded px-2 py-0.5">
                        {/* TODO: Implement team relationship */}
                        {'-'}
                      </span>
                      <span className="flex items-center text-sm font-medium text-green-900 bg-green-50 rounded px-2 py-0.5">
                        <BuildingOfficeIcon className="h-4 w-4 text-green-500 mr-1" />
                        {vehicle?.contrato?.nome || 'Sem contrato'}
                      </span>
                      <span className="flex items-center text-sm font-medium text-blue-900 bg-blue-50 rounded px-2 py-0.5">
                        <MapPinIcon className="h-4 w-4 text-blue-500 mr-1" />
                        {vehicle?.base?.nome || 'Sem base'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Botões de devolução/desmobilização - apenas para veículos ativos */}
                    {vehicle?.status && !['devolvido', 'desmobilizado', 'bloqueado'].includes(vehicle.status.toLowerCase()) && (
                      <div className="flex items-center gap-2">
                        <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.DEVOLVER_VEICULO}>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                            title="Devolver veículo"
                            onClick={() => setShowDevolverModal(true)}
                          >
                            <ArrowLeftIcon className="h-5 w-5 mr-2" />
                            Devolver
                          </button>
                        </PermissionGuard>
                        <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.DESMOBILIZAR_VEICULO}>
                          <button
                            className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                            title="Desmobilizar veículo"
                            onClick={() => setShowDesmobilizarModal(true)}
                          >
                            <TruckIcon className="h-5 w-5 mr-2" />
                            Desmobilizar
                          </button>
                        </PermissionGuard>
                      </div>
                    )}
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${["operacao", "operação"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-blue-50 text-blue-700' :
                      ["manutenção", "em manutenção", "manutencao"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-yellow-50 text-yellow-700' :
                        ["disponivel", "disponível"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-green-50 text-green-700' :
                          ["devolvido"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-orange-50 text-orange-700' :
                            ["desmobilizado"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-red-50 text-red-700' :
                              ["bloqueado"].includes((vehicle?.status || '').toLowerCase()) ? 'bg-red-50 text-red-700' :
                                'bg-gray-100 text-gray-500'
                      }`}>
                      {
                        ["operacao", "operação"].includes((vehicle?.status || '').toLowerCase()) ? 'Operação' :
                          ["manutenção", "em manutenção", "manutencao"].includes((vehicle?.status || '').toLowerCase()) ? 'Em Manutenção' :
                            ["disponivel", "disponível"].includes((vehicle?.status || '').toLowerCase()) ? 'Disponível' :
                              ["devolvido"].includes((vehicle?.status || '').toLowerCase()) ? 'Devolvido' :
                                ["desmobilizado"].includes((vehicle?.status || '').toLowerCase()) ? 'Desmobilizado' :
                                  ["bloqueado"].includes((vehicle?.status || '').toLowerCase()) ? 'Bloqueado' :
                                    vehicle?.status
                      }
                    </span>
                  </div>
                </div>
              </div>
              {/* GRID PRINCIPAL */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* COLUNA 1: Informações Básicas */}
                <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><TruckIcon className="h-6 w-6 text-blue-600" /> Informações Básicas</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2"><TagIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Marca</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.marca_equipamento || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, marca_equipamento: e.target.value } : v)} /> : (vehicle?.marca_equipamento || '-')}</span></div>
                    <div className="flex items-center gap-2"><TagIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Modelo</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.modelo || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, modelo: e.target.value } : v)} /> : (vehicle?.modelo || '-')}</span></div>
                    <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Ano</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.ano_fabricacao ?? ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, ano_fabricacao: e.target.value ? parseInt(e.target.value) : v.ano_fabricacao } : v)} /> : (vehicle?.ano_fabricacao && vehicle?.ano_modelo ? `${vehicle.ano_fabricacao}/${vehicle.ano_modelo}` : '-')}</span></div>
                    <div className="flex items-center gap-2"><ShieldCheckIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Placa</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.placa || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, placa: e.target.value } : v)} /> : (vehicle?.placa || '-')}</span></div>
                    <div className="flex items-center gap-2"><ClipboardDocumentCheckIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Tipo de Veículo</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.tipo_veiculo || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, tipo_veiculo: e.target.value } : v)} /> : (vehicle?.tipo_veiculo || '-')}</span></div>
                    <div className="flex items-center gap-2"><DocumentTextIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">RENAVAM</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.renavam || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, renavam: e.target.value } : v)} /> : (vehicle?.renavam || '-')}</span></div>
                    <div className="flex items-center gap-2"><DocumentTextIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">CHASSI</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.chassis || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, chassis: e.target.value } : v)} /> : (vehicle?.chassis || '-')}</span></div>
                    <div className="flex items-center gap-2"><DocumentTextIcon className="h-4 w-4 text-gray-400" /> <span><span className="text-gray-500">Número CRLV</span><br />{isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.numero_crlv || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, numero_crlv: e.target.value } : v)} /> : (vehicle?.numero_crlv || '-')}</span></div>
                  </div>
                </div>

                {/* COLUNA 2: Manutenção Preventiva e Quilometragem, Especificações */}
                <div className="flex flex-col gap-4">
                  
                  {/* Manutenção Preventiva e Quilometragem - Card Unificado */}
                  <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    {/* Header com Status */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <WrenchScrewdriverIcon className="h-5 w-5 text-white" />
                          <h3 className="font-semibold text-white">Manutenção Preventiva</h3>
                        </div>
                        {!isEditing && vehicle?.quilometragem_atual && vehicle?.proxima_preventiva_km && (
                          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km 
                              ? 'bg-red-100 text-red-700' 
                              : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                          }`}>
                            {vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km 
                              ? 'Vencida' 
                              : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                                ? 'Próxima'
                                : 'Em Dia'
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quilometragem Atual - Destaque Compacto */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-4 border-b border-blue-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Quilometragem Atual</p>
                          {isEditing ? (
                            <input 
                              className="text-2xl font-bold text-blue-900 border-2 border-blue-300 rounded px-2 py-1 w-40"
                              type="number"
                              value={editVehicle?.quilometragem_atual ?? ''} 
                              onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, quilometragem_atual: e.target.value ? parseInt(e.target.value) : 0 } : v)} 
                            />
                          ) : (
                            <p className="text-2xl font-bold text-blue-900">
                              {vehicle?.quilometragem_atual?.toLocaleString() || '0'} <span className="text-lg text-blue-600">km</span>
                            </p>
                          )}
                        </div>
                        {!isEditing && vehicle?.quilometragem_atual && vehicle?.proxima_preventiva_km && (
                          <div className="text-right">
                            <p className="text-xs text-blue-600 font-medium">
                              {vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km
                                ? 'Atrasada'
                                : 'Faltam'
                              }
                            </p>
                            <p className="text-lg font-bold text-blue-900">
                              {Math.abs(vehicle.proxima_preventiva_km - vehicle.quilometragem_atual).toLocaleString()} <span className="text-sm">km</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dados da Preventiva */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Última Preventiva</p>
                          {isEditing ? (
                            <input 
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full" 
                              type="number"
                              value={editVehicle?.quilometragem_preventiva ?? ''} 
                              onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, quilometragem_preventiva: e.target.value ? parseInt(e.target.value) : null } : v)} 
                              placeholder="Ex: 97"
                            />
                          ) : (
                            <p className="font-semibold text-gray-900">
                              {vehicle?.quilometragem_preventiva ? vehicle.quilometragem_preventiva.toLocaleString() + ' km' : '-'}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Próxima Preventiva</p>
                          {isEditing ? (
                            <p className="text-sm text-gray-500 italic">Auto-calculado</p>
                          ) : (
                            <p className="font-semibold text-gray-900">
                              {vehicle?.proxima_preventiva_km ? vehicle.proxima_preventiva_km.toLocaleString() + ' km' : '-'}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Intervalo</p>
                          {isEditing ? (
                            <input 
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full" 
                              type="number"
                              value={editVehicle?.intervalo_preventiva ?? 10000} 
                              onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, intervalo_preventiva: e.target.value ? parseInt(e.target.value) : 10000 } : v)} 
                              placeholder="10000"
                            />
                          ) : (
                            <p className="font-semibold text-gray-900">
                              {vehicle?.intervalo_preventiva ? vehicle.intervalo_preventiva.toLocaleString() + ' km' : '10.000 km'}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Alerta</p>
                          {isEditing ? (
                            <input 
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full" 
                              type="number"
                              value={editVehicle?.alerta_preventiva_km ?? 1000} 
                              onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, alerta_preventiva_km: e.target.value ? parseInt(e.target.value) : 1000 } : v)} 
                              placeholder="1000"
                            />
                          ) : (
                            <p className="font-semibold text-gray-900">
                              {vehicle?.alerta_preventiva_km ? vehicle.alerta_preventiva_km.toLocaleString() + ' km antes' : '1.000 km antes'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Barra de Progresso */}
                      {!isEditing && vehicle?.quilometragem_atual && vehicle?.proxima_preventiva_km && vehicle?.quilometragem_preventiva && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-600">Progresso até próxima preventiva</span>
                            <span className="text-xs font-semibold text-gray-900">
                              {Math.min(100, Math.round(((vehicle.quilometragem_atual - vehicle.quilometragem_preventiva) / (vehicle.proxima_preventiva_km - vehicle.quilometragem_preventiva)) * 100))}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km 
                                  ? 'bg-red-500' 
                                  : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ 
                                width: `${Math.min(100, Math.round(((vehicle.quilometragem_atual - vehicle.quilometragem_preventiva) / (vehicle.proxima_preventiva_km - vehicle.quilometragem_preventiva)) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Especificações + Equipamentos */}
                  <div className="bg-white rounded-xl shadow p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Cog6ToothIcon className="h-6 w-6 text-blue-600" /> Especificações</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {/* Coluna 1: Dados técnicos/financeiros */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Cog6ToothIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Combustível</span><br />
                            {isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.tipo_combustivel || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, tipo_combustivel: e.target.value } : v)} /> : (vehicle?.tipo_combustivel || '-')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Valor Locação</span><br />
                            {isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.valor_aluguel ?? ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, valor_aluguel: e.target.value ? parseFloat(e.target.value) : v.valor_aluguel } : v)} /> : (vehicle?.valor_aluguel ? `R$ ${vehicle.valor_aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Propriedade</span><br />
                            {isEditing ? (
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value={editVehicle?.propriedade || ''}
                                onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, propriedade: e.target.value as Vehicle['propriedade'] } : v)}
                              >
                                <option value="">Selecione</option>
                                <option value="Próprio">Próprio</option>
                                <option value="Alugado">Alugado</option>
                              </select>
                            ) : (
                              vehicle?.propriedade === 'Próprio' ? 'Próprio' : 'Alugado'
                            )}
                          </span>
                        </div>
                      </div>
                      {/* Coluna 2: Equipamentos */}
                      <div className="flex flex-col gap-1 mt-2 md:mt-0">
                        <div className="flex items-center gap-2">
                          <LightBulbIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Giroflex</span>: {isEditing ? (
                              <input
                                type="checkbox"
                                checked={!!editVehicle?.equipamentos?.giroflex}
                                onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, equipamentos: { ...v.equipamentos, giroflex: e.target.checked } } : v)}
                              />
                            ) : (
                              vehicle?.equipamentos?.giroflex ? 'Sim' : 'Não'
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <VideoCameraIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Câmera</span>: {isEditing ? (
                              <input
                                type="checkbox"
                                checked={!!editVehicle?.equipamentos?.camera}
                                onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, equipamentos: { ...v.equipamentos, camera: e.target.checked } } : v)}
                              />
                            ) : (
                              vehicle?.equipamentos?.camera ? 'Sim' : 'Não'
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SignalIcon className="h-4 w-4 text-gray-400" />
                          <span>
                            <span className="text-gray-500">Rastreador</span>: {isEditing ? (
                              <input
                                type="checkbox"
                                checked={!!editVehicle?.equipamentos?.tracker}
                                onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, equipamentos: { ...v.equipamentos, tracker: e.target.checked } } : v)}
                              />
                            ) : (
                              vehicle?.equipamentos?.tracker ? 'Sim' : 'Não'
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <KeyIcon className="h-4 w-4 text-gray-400" />
                          <span><span className="text-gray-500">Nº Rastreador</span>: {isEditing ? <input className="border rounded px-2 py-1" value={editVehicle?.rastreador || ''} onChange={e => setEditVehicle((v: Vehicle | null) => v ? { ...v, rastreador: e.target.value } : v)} /> : (vehicle?.rastreador || '-')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUNA 3: Documentos */}
                <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600" /> 
                    Documentos
                  </h3>
                  <VehicleDocumentSection
                    vehicleId={id as string}
                    documents={documents || []}
                    isLoading={isDocumentsLoading}
                    error={documentsError ? (documentsError as Error).message : null}
                    onUploadClick={handleDocumentUploadClick}
                    onOSClick={handleOSClick}
                    isEditing={isEditing}
                    onDateChange={handleDateChange}
                    editableDocuments={editableDocuments}
                  />
                </div>
              </div>

              {/* Seção de Histórico de Transferências */}
              <div className="bg-white rounded-xl shadow p-4 mt-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowsRightLeftIcon className="h-6 w-6 text-blue-600" /> 
                  Histórico de Transferências
                </h3>
                {isTransferHistoryLoading ? (
                  <div className="text-center py-4 text-gray-500">Carregando histórico...</div>
                ) : transferHistory && transferHistory.length > 0 ? (
                  <div className="space-y-3">
                    {transferHistory.map((transfer: {
                      id: string
                      contrato_origem?: { nome: string }
                      contrato_destino?: { nome: string }
                      data_transferencia: string
                      observacoes?: string
                      usuario?: { nome: string }
                    }) => (
                      <div key={transfer.id} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <ArrowsRightLeftIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {transfer.contrato_origem?.nome || 'Contrato origem'} → {transfer.contrato_destino?.nome || 'Contrato destino'}
                              </span>
                            </div>
                            {transfer.observacoes && (
                              <p className="text-sm text-gray-600 mb-1">{transfer.observacoes}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                <CalendarIcon className="h-3 w-3 inline mr-1" />
                                {new Date(transfer.data_transferencia).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {transfer.usuario?.nome && (
                                <span>
                                  <UserIcon className="h-3 w-3 inline mr-1" />
                                  {transfer.usuario.nome}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Nenhuma transferência registrada
                  </div>
                )}
              </div>

              {/* Modais */}
              {showUploadModal && (
                <VehicleDocumentUploadModal
                  open={!!showUploadModal}
                  onClose={() => setShowUploadModal(null)}
                  vehicle={vehicle}
                  tipoDocumento={showUploadModal.tipoDocumento}
                  documentId={showUploadModal.documentId}
                  documentTypeLabel={showUploadModal.documentTypeLabel}
                  onUploadSuccess={() => {
                    refetchVehicle();
                    setShowUploadModal(null);
                  }}
                />
              )}

              {showOSModal && (
                <OSLaudoAcusticoModal
                  open={!!showOSModal}
                  onClose={() => setShowOSModal(null)}
                  documento={showOSModal.documento}
                  onSuccess={() => {
                    refetchVehicle();
                  }}
                />
              )}

              {showEditExpirationModal && (
                <EditExpirationDateModal
                  open={!!showEditExpirationModal}
                  onClose={() => setShowEditExpirationModal(null)}
                  document={showEditExpirationModal}
                  onUpdateSuccess={() => {
                    refetchVehicle();
                    setShowEditExpirationModal(null);
                  }}
                />
              )}

              {showTransferModal && (
                <VehicleTransferModal
                  isOpen={showTransferModal}
                  onClose={() => setShowTransferModal(false)}
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onLocationSelect={setSelectedLocationId}
                  onTransfer={handleTransferVehicle}
                  loading={transferLoading}
                />
              )}

              {showTeamReallocateModal && (
                <VehicleTeamReallocateModal
                  isOpen={showTeamReallocateModal}
                  onClose={() => setShowTeamReallocateModal(false)}
                  vehicleId={vehicle?.id?.toString() || ''}
                  vehiclePlaca={vehicle?.placa || ''}
                  currentTeamId={vehicle?.equipe_id}
                  onReallocate={handleTeamReallocate}
                  loading={teamReallocateLoading}
                />
              )}

              {/* Modal de OS do Laudo Acústico */}
              {showOSModal && (
                <OSLaudoAcusticoModal
                  open={true}
                  onClose={() => setShowOSModal(null)}
                  documento={showOSModal.documento}
                  onSuccess={() => {
                    refetchVehicle();
                  }}
                />
              )}

              {/* Modal de Devolução */}
              {showDevolverModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Devolver Veículo {vehicle?.placa}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Motivo da Devolução *
                        </label>
                        <textarea
                          value={operacaoData.motivo}
                          onChange={(e) => setOperacaoData(prev => ({ ...prev, motivo: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          rows={3}
                          placeholder="Descreva o motivo da devolução..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações Adicionais
                        </label>
                        <textarea
                          value={operacaoData.observacoes}
                          onChange={(e) => setOperacaoData(prev => ({ ...prev, observacoes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          rows={2}
                          placeholder="Observações adicionais (opcional)..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowDevolverModal(false);
                          setOperacaoData({ motivo: '', observacoes: '' });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDevolverVeiculo}
                        disabled={!operacaoData.motivo.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
                      >
                        Confirmar Devolução
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Desmobilização */}
              {showDesmobilizarModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Desmobilizar Veículo {vehicle?.placa}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Motivo da Desmobilização *
                        </label>
                        <textarea
                          value={operacaoData.motivo}
                          onChange={(e) => setOperacaoData(prev => ({ ...prev, motivo: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows={3}
                          placeholder="Descreva o motivo da desmobilização..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações Adicionais
                        </label>
                        <textarea
                          value={operacaoData.observacoes}
                          onChange={(e) => setOperacaoData(prev => ({ ...prev, observacoes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows={2}
                          placeholder="Observações adicionais (opcional)..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowDesmobilizarModal(false);
                          setOperacaoData({ motivo: '', observacoes: '' });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDesmobilizarVeiculo}
                        disabled={!operacaoData.motivo.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
                      >
                        Confirmar Desmobilização
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Reativação */}
              {showReativarModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Reativar Veículo {vehicle?.placa}
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <p className="text-sm text-green-800">
                          O veículo será reativado com status <strong>disponível</strong>.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações sobre a Reativação
                        </label>
                        <textarea
                          value={reativacaoObservacoes}
                          onChange={(e) => setReativacaoObservacoes(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={3}
                          placeholder="Descreva o motivo da reativação (opcional)..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowReativarModal(false);
                          setReativacaoObservacoes('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleReativarVeiculo}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                      >
                        Confirmar Reativação
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Bloqueio */}
              {showBloquearModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Bloquear Veículo {vehicle?.placa}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Motivo do Bloqueio *
                        </label>
                        <textarea
                          value={bloqueioData.motivo}
                          onChange={(e) => setBloqueioData(prev => ({ ...prev, motivo: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows={3}
                          placeholder="Descreva o motivo do bloqueio..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contrato de Origem do Bloqueio
                        </label>
                        <select
                          value={bloqueioData.bloqueio_origem_contrato_id}
                          onChange={(e) => setBloqueioData(prev => ({ ...prev, bloqueio_origem_contrato_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        >
                          <option value="">Selecione o contrato (opcional)</option>
                          {contratos.map(contrato => (
                            <option key={contrato.id} value={contrato.id}>
                              {contrato.nome}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Contrato que originou o bloqueio (será registrado para histórico)
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações Adicionais
                        </label>
                        <textarea
                          value={bloqueioData.observacoes}
                          onChange={(e) => setBloqueioData(prev => ({ ...prev, observacoes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows={2}
                          placeholder="Observações adicionais (opcional)..."
                        />
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-800">
                          <strong>Contrato Atual:</strong> {vehicle?.contrato?.nome || 'Sem contrato'}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          O contrato atual será registrado automaticamente no momento do bloqueio.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowBloquearModal(false);
                          setBloqueioData({ motivo: '', observacoes: '', bloqueio_origem_contrato_id: '' });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleBloquearVeiculo}
                        disabled={!bloqueioData.motivo.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
                      >
                        Confirmar Bloqueio
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Desbloqueio */}
              {showDesbloquearModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Desbloquear Veículo {vehicle?.placa}
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <p className="text-sm text-green-800">
                          O veículo será desbloqueado com status <strong>disponível</strong>.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações sobre o Desbloqueio
                        </label>
                        <textarea
                          value={desbloqueioObservacoes}
                          onChange={(e) => setDesbloqueioObservacoes(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={3}
                          placeholder="Descreva o motivo do desbloqueio (opcional)..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowDesbloquearModal(false);
                          setDesbloqueioObservacoes('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDesbloquearVeiculo}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                      >
                        Confirmar Desbloqueio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}