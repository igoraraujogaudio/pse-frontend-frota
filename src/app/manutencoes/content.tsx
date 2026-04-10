'use client';

import { useState, useEffect } from 'react';
import {
  TruckIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  XMarkIcon,
  PlusIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  XCircleIcon,
  ChartBarIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { maintenanceService } from '@/services/maintenanceService';
import { vehicleService } from '@/services/vehicleService';
import { workshopService } from '@/services/workshopService';
import { useNotification } from '@/contexts/NotificationContext';
import { Maintenance, MaintenanceAttachment, Vehicle, Workshop } from '@/types';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { supabase } from '@/lib/supabase';
import MaintenanceImageUpload from '@/components/maintenance/MaintenanceImageUpload';
import MaintenanceEditModalNew from '@/components/maintenance/MaintenanceEditModalNew';
import MaintenanceServiceTypeIndicator from '@/components/maintenance/MaintenanceServiceTypeIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import WorkshopSelector from '@/components/WorkshopSelector';

export function ManutencoesContent() {
  const { notify } = useNotification();
  const { user, userContratoIds } = useAuth();
  const { hasPermission } = useModularPermissions();
  
  
  // const userLocationIds = []; // TODO: Implement location-based filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showNewMaintenanceModal, setShowNewMaintenanceModal] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState({
    veiculo_id: '',
    buscaVeiculo: '',
    descricao: '',
    prioridade: 'normal',
    custo_estimado: '',
    observacoes: '',
    oficina_id: '',
    tipo: '',
    data_inicio: '',
    data_fim: '',
    localizacao: ''
  });
  const [showOrcamentoModal, setShowOrcamentoModal] = useState<{ id: string } | null>(null);
  const [orcamentoValor, setOrcamentoValor] = useState('');
  const [orcamentoDescricao, setOrcamentoDescricao] = useState('');
  const [numeroOrcamento, setNumeroOrcamento] = useState('');
  const [showIniciarManutencaoModal, setShowIniciarManutencaoModal] = useState<{ id: string } | null>(null);
  const [numeroCotacao, setNumeroCotacao] = useState('');
  const [showProntoRetiradaModal, setShowProntoRetiradaModal] = useState<{ id: string } | null>(null);
  const [numeroPedido, setNumeroPedido] = useState('');
  const [showRetornadoModal, setShowRetornadoModal] = useState<{ id: string } | null>(null);
  const [numeroNF, setNumeroNF] = useState('');
  const [nfVencimento, setNfVencimento] = useState('');
  const [nfArquivo, setNfArquivo] = useState<File | null>(null);
  const [showEditModal, setShowEditModal] = useState<{ maintenance: Maintenance } | null>(null);
  const [showAprovarModal, setShowAprovarModal] = useState<{ id: string } | null>(null);
  const [showRejeitarModal, setShowRejeitarModal] = useState<{ id: string } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [oficinaSelecionada, setOficinaSelecionada] = useState('');
  const [tipoServico, setTipoServico] = useState<'interno' | 'externo'>('externo');
  const [custoEstimado, setCustoEstimado] = useState('');
  const [responsaveisNomes, setResponsaveisNomes] = useState<Record<string, { solicitante?: string, aprovador?: string }>>({});
  const [showEntregarModal, setShowEntregarModal] = useState<{ id: string } | null>(null);
  const [orcamentoServicos, setOrcamentoServicos] = useState<Array<{ nome: string; valor?: number; }>>([]);
  const [orcamentoAnexos, setOrcamentoAnexos] = useState<MaintenanceAttachment[]>([]);
  const [historicoNomes, setHistoricoNomes] = useState<Record<string, string>>({});
  const [highlightedMaintenanceId, setHighlightedMaintenanceId] = useState<string | null>(null);
  const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);
  const [maintenanceImages, setMaintenanceImages] = useState<Array<{ id: string; url: string; nome_arquivo: string; tipo: string; tamanho: number; criado_em: string; maintenance_id: string }>>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  // React Query para buscar dados
  const {
    data: maintenances = [],
    isLoading: loadingMaintenances,
    error: errorMaintenances
  } = useQuery<Maintenance[], Error>({ queryKey: ['maintenances'], queryFn: maintenanceService.getAll });

  const {
    data: vehicles = [],
    isLoading: loadingVehicles,
    error: errorVehicles
  } = useQuery<Vehicle[], Error>({ queryKey: ['vehicles'], queryFn: () => vehicleService.getAll() });

  const {
    data: workshops = [],
    isLoading: loadingWorkshops,
    error: errorWorkshops
  } = useQuery<Workshop[]>({ 
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

  const loading = loadingMaintenances || loadingVehicles || loadingWorkshops;
  const error = errorMaintenances || errorVehicles || errorWorkshops;

  const queryClient = useQueryClient();

  // Bloquear scroll da página quando modal estiver aberto
  useEffect(() => {
    if (showNewMaintenanceModal) {
      // Calcular largura do scrollbar antes de esconder
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // Aplicar estilos para prevenir shift do layout
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      // Restaurar estilos
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }

    // Cleanup quando componente desmontar
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [showNewMaintenanceModal]);

  // Mutation para criar nova manutenção com TanStack React Query
  const createMaintenanceMutation = useMutation({
    mutationFn: async (dadosManutencao: Omit<Maintenance, 'id' | 'criado_em'>) => {
      return await maintenanceService.create(dadosManutencao);
    },
    onSuccess: async (newMaintenance) => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      setShowNewMaintenanceModal(false);
      setNovaManutencao({
        veiculo_id: '',
        buscaVeiculo: '',
        descricao: '',
        prioridade: 'normal',
        custo_estimado: '',
        observacoes: '',
        oficina_id: '',
        tipo: '',
        data_inicio: '',
        data_fim: '',
        localizacao: ''
      });
      // Fazer upload das imagens pendentes se houver
      if (pendingImages.length > 0 && newMaintenance?.id) {
        try {
          const uploadPromises = pendingImages.map(async (file) => {
            // Gerar caminho único
            const { data: filePath, error: pathError } = await supabase.rpc('generate_maintenance_image_path', {
              maintenance_id: newMaintenance.id,
              original_filename: file.name
            });

            if (pathError) {
              throw new Error(`Erro ao gerar caminho: ${pathError.message}`);
            }

            // Upload para storage
            const { error: uploadError } = await supabase.storage
              .from('manutencoes-imagens')
              .upload(filePath, file);

            if (uploadError) {
              throw new Error(`Erro no upload: ${uploadError.message}`);
            }

            // Obter URL pública
            const { data: urlData } = supabase.storage
              .from('manutencoes-imagens')
              .getPublicUrl(filePath);

            // Salvar no banco de dados
            const { data: imageData, error: dbError } = await supabase.rpc('add_maintenance_image', {
              p_maintenance_id: newMaintenance.id,
              p_url: urlData.publicUrl,
              p_nome_arquivo: file.name,
              p_tipo: file.type,
              p_tamanho: file.size
            });

            if (dbError) {
              throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
            }

            return {
              id: imageData,
              maintenance_id: newMaintenance.id,
              url: urlData.publicUrl,
              nome_arquivo: file.name,
              tipo: file.type,
              tamanho: file.size,
              criado_em: new Date().toISOString()
            };
          });

          await Promise.all(uploadPromises);
          notify('Manutenção criada com sucesso! Imagens enviadas.', 'success');
        } catch (error) {
          console.error('Erro ao fazer upload das imagens:', error);
          notify('Manutenção criada, mas houve erro ao enviar as imagens.', 'warning');
        }
      } else {
        notify('Manutenção criada com sucesso!', 'success');
      }

      setMaintenanceImages([]);
      setPendingImages([]);

      // Destacar a nova manutenção criada
      if (newMaintenance?.id) {
        setHighlightedMaintenanceId(newMaintenance.id);
        // Remover o destaque após 3 segundos
        setTimeout(() => {
          setHighlightedMaintenanceId(null);
        }, 3000);
      }

      // Scroll suave para o topo da lista de manutenções após um pequeno delay
      // para garantir que a lista foi atualizada
      setTimeout(() => {
        const maintenancesList = document.querySelector('[data-maintenances-list]');
        if (maintenancesList) {
          maintenancesList.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        } else {
          // Fallback: scroll para o topo da página
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }, 100);
    },
    onError: () => {
      notify('Erro ao criar manutenção.', 'error');
    }
  });

  useEffect(() => {
    if (error) {
      notify('Erro ao carregar dados das manutenções.', 'error');
    }
  }, [error, notify]);

  useEffect(() => {
    // Para cada manutenção, buscar nomes dos responsáveis se ainda não estiverem no estado
    maintenances.forEach(async (m) => {
      if (!m.solicitante_id && !m.aprovador_id) return;
      if (responsaveisNomes[m.id]) return;
      const nomes: { solicitante?: string, aprovador?: string } = {};
      if (m.solicitante_id) {
        try {
          const user = await userService.getById(m.solicitante_id);
          nomes.solicitante = user.nome;
        } catch { }
      }
      if (m.aprovador_id) {
        try {
          const user = await userService.getById(m.aprovador_id);
          nomes.aprovador = user.nome;
        } catch { }
      }
      setResponsaveisNomes(prev => ({ ...prev, [m.id]: nomes }));
    });
  }, [maintenances, responsaveisNomes]);

  useEffect(() => {
    const buscarNomes = async () => {
      const ids = new Set<string>();
      maintenances.forEach(m => {
        if (Array.isArray(m.historico)) {
          m.historico.forEach(ev => {
            if (typeof ev === "object" && ev !== null && "usuario_id" in ev) {
              const evento = ev as { usuario_id?: string };
              if (evento.usuario_id) ids.add(evento.usuario_id);
            }
          });
        }
      });
      const idsArray = Array.from(ids).filter(id => !historicoNomes[id]);
      for (const id of idsArray) {
        try {
          const user = await userService.getById(id);
          setHistoricoNomes(prev => ({ ...prev, [id]: user.nome }));
        } catch { }
      }
    };
    buscarNomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenances]);

  // Status options em português
  const statusOptions = [
    { key: 'pendente', label: 'Pendentes', icon: ExclamationTriangleIcon, color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-300' },
    { key: 'aprovada', label: 'Aprovadas', icon: WrenchScrewdriverIcon, color: 'bg-blue-100 text-blue-800', border: 'border-blue-300' },
    { key: 'entregue', label: 'Entregues', icon: ArrowPathIcon, color: 'bg-purple-100 text-purple-800', border: 'border-purple-300' },
    { key: 'em_orcamento', label: 'Em Orçamento', icon: CurrencyDollarIcon, color: 'bg-orange-100 text-orange-800', border: 'border-orange-300' },
    { key: 'pronto_retirada', label: 'Pronto para Retirada', icon: CheckCircleIcon, color: 'bg-green-100 text-green-800', border: 'border-green-300' },
    { key: 'retornado', label: 'Retornados', icon: ArrowPathIcon, color: 'bg-green-100 text-green-800', border: 'border-green-300' },
    { key: 'cancelada', label: 'Canceladas', icon: XMarkIcon, color: 'bg-red-100 text-red-800', border: 'border-red-300' },
    { key: 'em_manutencao', label: 'Em Manutenção', icon: ArrowPathIcon, color: 'bg-purple-100 text-purple-800', border: 'border-purple-300' },
  ];

  const toggleStatus = (key: string) => {
    setSelectedStatuses(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleAprovar = (id: string, workshopId: string) => {
    setShowAprovarModal({ id });
    setOficinaSelecionada(workshopId || '');
    setTipoServico('externo');
    setCustoEstimado('');
  };

  const handleAprovarConfirm = async () => {
    if (!showAprovarModal || !user) return;
    
    // Validações
    if (tipoServico === 'externo') {
      if (!oficinaSelecionada) {
        notify('Selecione uma oficina para serviço externo', 'error');
        return;
      }
      if (!custoEstimado || parseFloat(custoEstimado) <= 0) {
        notify('Informe um custo estimado válido para serviço externo', 'error');
        return;
      }
    }
    
    try {
      const maintenance = maintenances.find(m => m.id === showAprovarModal.id);
      
      await maintenanceService.aprovarManutencaoComTipo(
        showAprovarModal.id,
        user.id,
        tipoServico,
        tipoServico === 'externo' ? oficinaSelecionada : undefined,
        tipoServico === 'externo' ? parseFloat(custoEstimado) : undefined
      );
      
      // Atualizar status do veículo para manutenção
      if (maintenance && maintenance.veiculo_id) {
        await vehicleService.update(maintenance.veiculo_id, { status: 'manutenção' });
      }
      
      notify('Manutenção aprovada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowAprovarModal(null);
      setOficinaSelecionada('');
      setTipoServico('externo');
      setCustoEstimado('');
    } catch {
      notify('Erro ao aprovar manutenção.', 'error');
    }
  };

  const handleRejeitar = (id: string) => {
    setShowRejeitarModal({ id });
    setMotivoRejeicao('');
  };

  const handleRejeitarConfirm = async () => {
    if (!showRejeitarModal || !user) return;
    
    if (!motivoRejeicao.trim()) {
      notify('Por favor, informe o motivo da rejeição.', 'error');
      return;
    }

    try {
      await maintenanceService.rejeitarManutencao(
        showRejeitarModal.id,
        motivoRejeicao,
        user.id
      );
      
      notify('Manutenção rejeitada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowRejeitarModal(null);
      setMotivoRejeicao('');
    } catch (error) {
      console.error('Erro ao rejeitar manutenção:', error);
      notify('Erro ao rejeitar manutenção.', 'error');
    }
  };

  const handleEntregar = (id: string) => {
    setShowEntregarModal({ id });
  };

  const handleEntregarConfirm = async () => {
    if (!showEntregarModal || !user) return;
    try {
      const maintenance = maintenances.find(m => m.id === showEntregarModal.id);
      const historico = Array.isArray(maintenance?.historico) ? maintenance.historico : [];
      const novoHistorico = [
        ...historico,
        {
          status: 'entregue',
          data: new Date().toISOString(),
          usuario_id: user?.id,
          comentario: 'Veículo entregue na oficina'
        }
      ];
      await maintenanceService.update(showEntregarModal.id, {
        status: 'entregue',
        entregue_em: new Date().toISOString(),
        historico: novoHistorico
      });
      
      // Atualizar status do veículo para manutenção (se ainda não estiver)
      if (maintenance && maintenance.veiculo_id) {
        await vehicleService.update(maintenance.veiculo_id, { status: 'manutenção' });
      }
      
      notify('Veículo entregue na oficina!', 'success');
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowEntregarModal(null);
    } catch {
      notify('Erro ao sinalizar entrega.', 'error');
    }
  };

  const handleProntoRetirada = (id: string) => {
    setShowProntoRetiradaModal({ id });
  };

  const handleConfirmarProntoRetirada = async () => {
    if (!showProntoRetiradaModal) return;
    
    try {
      const maintenance = maintenances.find(m => m.id === showProntoRetiradaModal.id);
      const historico = Array.isArray(maintenance?.historico) ? maintenance.historico : [];
      const novoHistorico = [
        ...historico,
        {
          status: 'pronto_retirada',
          data: new Date().toISOString(),
          usuario_id: user?.id,
          comentario: 'Manutenção pronta para retirada'
        }
      ];
      await maintenanceService.update(showProntoRetiradaModal.id, {
        status: 'pronto_retirada',
        pronto_em: new Date().toISOString(),
        historico: novoHistorico,
        numero_pedido: numeroPedido || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      notify('Manutenção pronta para retirada!', 'success');
      setShowProntoRetiradaModal(null);
      setNumeroPedido('');
    } catch {
      notify('Erro ao sinalizar pronto para retirada.', 'error');
    }
  };

  const handleRetornado = (id: string) => {
    setShowRetornadoModal({ id });
  };

  const handleSaveMaintenance = async (updatedMaintenance: Partial<Maintenance>) => {
    if (!showEditModal) return;
    
    await maintenanceService.update(showEditModal.maintenance.id, updatedMaintenance);
    queryClient.invalidateQueries({ queryKey: ['maintenances'] });
    notify('Manutenção atualizada com sucesso!', 'success');
  };

  const handleConfirmarRetornado = async () => {
    if (!showRetornadoModal) return;
    
    try {
      let nfArquivoUrl = '';
      
      // Upload do arquivo da NF se fornecido
      if (nfArquivo) {
        const { data: filePath, error: pathError } = await supabase.rpc('generate_maintenance_nf_path', {
          maintenance_id: showRetornadoModal.id,
          original_filename: nfArquivo.name
        });

        if (pathError) {
          throw new Error(`Erro ao gerar caminho: ${pathError.message}`);
        }

        const { error: uploadError } = await supabase.storage
          .from('manutencoes-nfs')
          .upload(filePath, nfArquivo);

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('manutencoes-nfs')
          .getPublicUrl(filePath);
        
        nfArquivoUrl = urlData.publicUrl;
      }

      const maintenance = maintenances.find(m => m.id === showRetornadoModal.id);
      const historico = Array.isArray(maintenance?.historico) ? maintenance.historico : [];
      const novoHistorico = [
        ...historico,
        {
          status: 'retornado',
          data: new Date().toISOString(),
          usuario_id: user?.id,
          comentario: 'Veículo retornado'
        }
      ];
      await maintenanceService.update(showRetornadoModal.id, {
        status: 'retornado',
        retornado_em: new Date().toISOString(),
        historico: novoHistorico,
        numero_nf: numeroNF || undefined,
        nf_vencimento: nfVencimento || undefined,
        nf_arquivo: nfArquivoUrl || undefined
      });
      // Buscar a manutenção para obter o veiculo_id
      const manutencao = await maintenanceService.getById(showRetornadoModal.id);
      if (manutencao && manutencao.veiculo_id) {
        await vehicleService.update(manutencao.veiculo_id, { status: 'disponivel' });
      }
      notify('Veículo retornado com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowRetornadoModal(null);
      setNumeroNF('');
      setNfVencimento('');
      setNfArquivo(null);
    } catch (error) {
      console.error('Erro ao retornar veículo:', error);
      notify('Erro ao sinalizar retorno.', 'error');
    }
  };

  const handleIniciarManutencao = (id: string) => {
    setShowIniciarManutencaoModal({ id });
  };

  const handleConfirmarIniciarManutencao = async () => {
    if (!showIniciarManutencaoModal) return;
    
    try {
      const maintenance = maintenances.find(m => m.id === showIniciarManutencaoModal.id);
      const historico = Array.isArray(maintenance?.historico) ? maintenance.historico : [];
      const novoHistorico = [
        ...historico,
        {
          status: 'em_manutencao',
          data: new Date().toISOString(),
          usuario_id: user?.id,
          comentario: 'Manutenção iniciada'
        }
      ];
      await maintenanceService.update(showIniciarManutencaoModal.id, {
        status: 'em_manutencao',
        em_manutencao_em: new Date().toISOString(),
        historico: novoHistorico,
        numero_cotacao: numeroCotacao || undefined
      });
      // Buscar a manutenção para obter o veiculo_id
      const manutencao = await maintenanceService.getById(showIniciarManutencaoModal.id);
      if (manutencao && manutencao.veiculo_id) {
        await vehicleService.update(manutencao.veiculo_id, { status: 'manutenção' });
      }
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      notify('Manutenção iniciada!', 'success');
      setShowIniciarManutencaoModal(null);
      setNumeroCotacao('');
    } catch {
      notify('Erro ao iniciar manutenção.', 'error');
    }
  };

  const handleNovaManutencaoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevenir múltiplos cliques usando o estado do useMutation
    if (createMaintenanceMutation.isPending) {
      return;
    }

    if (!user) {
      notify('Usuário não autenticado.', 'error');
      return;
    }
    if (!novaManutencao.veiculo_id) {
      notify('Por favor, selecione um veículo.', 'error');
      return;
    }

    const dadosManutencao: Omit<Maintenance, 'id' | 'criado_em'> = {
      veiculo_id: novaManutencao.veiculo_id,
      descricao: novaManutencao.descricao,
      prioridade: novaManutencao.prioridade as 'normal' | 'baixa' | 'alta' | 'urgente',
      status: 'pendente',
      tipo: 'corrective',
      tipo_servico: 'externo', // Valor padrão - será alterado na aprovação
      atualizado_em: new Date().toISOString(),
      solicitante_id: user.id,
      // Adicione outros campos obrigatórios do tipo Maintenance com valores padrão ou undefined
    };

    // Usar o useMutation para criar a manutenção
    createMaintenanceMutation.mutate(dadosManutencao);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Carregando...</div>;
  }
  if (error) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{String(error)}</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Voltar para a lista de veículos
          </Link>
        </div>
      </div>
    );
  }

  // Filtrar manutenções por status e texto, e NÃO mostrar finalizadas
  // Também filtrar por local do usuário
  const filteredMaintenances = (maintenances as Maintenance[])
    .filter((maintenance: Maintenance) => {
      const isFinal = maintenance.status === 'retornado' || maintenance.status === 'cancelada';
      if (isFinal) return false;

      // Filtrar por contrato do usuário - só mostrar manutenções de veículos dos contratos que o usuário tem acesso
      const vehicle = maintenance.veiculo;
      // ✅ CORREÇÃO: Usar permissões modulares em vez de hierarquia antiga
      const hasContratoAccess = hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS) || 
        !vehicle?.contrato_id || 
        userContratoIds.includes(vehicle.contrato_id);
      if (!hasContratoAccess) return false;

      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(maintenance.status);
      const search = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (vehicle && (
          vehicle.placa.toLowerCase().includes(search) ||
          vehicle.modelo.toLowerCase().includes(search)
        )) ||
        maintenance.descricao.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });

  // Permissões modulares específicas de manutenção
  const canAprovarManutencao = hasPermission(PERMISSION_CODES.MANUTENCAO.APROVAR_MANUTENCAO);
  const canEntregarVeiculo = hasPermission(PERMISSION_CODES.MANUTENCAO.LEVAR_VEICULO);
  const canBuscarVeiculo = hasPermission(PERMISSION_CODES.MANUTENCAO.BUSCAR_VEICULO);
  const canFinalizarManutencao = hasPermission(PERMISSION_CODES.MANUTENCAO.FINALIZAR_MANUTENCAO);
  // const canIndicarManutencao = hasPermission(PERMISSION_CODES.MANUTENCAO.INDICAR_MANUTENCAO); // TODO: Use when needed
  // const canAgendarManutencao = hasPermission(PERMISSION_CODES.MANUTENCAO.AGENDAR_MANUTENCAO); // TODO: Use when needed
  

  return (
    <>
      <style jsx global>{`
        /* Garantir que botões dos modais sejam clicáveis */
        .fixed.inset-0 button,
        .fixed.inset-0 form button {
          pointer-events: auto !important;
          cursor: pointer !important;
          position: relative;
          z-index: 100 !important;
        }
        /* Garantir que o overlay não bloqueie os botões */
        .fixed.inset-0.z-50 > form,
        .fixed.inset-0.z-50 > div:not(.backdrop-blur) {
          pointer-events: auto !important;
          z-index: 50 !important;
        }
      `}</style>
    <main>
      <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Manutenções</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gerencie solicitações de manutenção e acompanhe o status dos veículos
            </p>
          </div>

          {/* Barra de pesquisa e ações */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por placa, modelo, equipe, supervisor..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Link
                href="/preventiva"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                <ChartBarIcon className="h-4 w-4" />
                Preventiva
              </Link>
              <button
                onClick={() => setShowNewMaintenanceModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                Nova Manutenção
              </button>
            </div>
          </div>

          {/* Seletores de status */}
          <div className="mb-6 flex flex-wrap gap-4">
            {statusOptions.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleStatus(option.key)}
                className={clsx(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-lg border text-base font-semibold transition-colors cursor-pointer',
                  option.border,
                  selectedStatuses.includes(option.key)
                    ? option.color + ' ring-2 ring-offset-2 ring-blue-200 border-2'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                )}
              >
                <option.icon className={clsx('h-5 w-5', selectedStatuses.includes(option.key) ? '' : 'text-gray-400')} />
                {option.label}
              </button>
            ))}
          </div>

          {/* Lista de Manutenções */}
          <div className="space-y-8" data-maintenances-list>
            {filteredMaintenances.map((maintenance: Maintenance) => {
              const vehicle = maintenance.veiculo;
              const workshop = (workshops as Workshop[]).find((w: Workshop) => w.id === maintenance.oficina_id);

              // Função para formatar data
              const formatDate = (dateString: string) => {
                if (!dateString) return '-';
                return new Date(dateString).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
              };

              // Função para formatar valor
              const formatCurrency = (value: number) => {
                if (!value) return '-';
                return new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(value);
              };

              // Função para obter cor do status (agora aceita português)
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'pendente': return 'from-yellow-200 to-yellow-100 text-yellow-900 border-yellow-200';
                  case 'aprovada': return 'from-blue-200 to-blue-100 text-blue-900 border-blue-200';
                  case 'entregue': return 'from-purple-200 to-purple-100 text-purple-900 border-purple-200';
                  case 'em_orcamento': return 'from-orange-200 to-orange-100 text-orange-900 border-orange-200';
                  case 'pronto_retirada': return 'from-green-200 to-green-100 text-green-900 border-green-200';
                  case 'retornado': return 'from-green-200 to-green-100 text-green-900 border-green-200';
                  case 'cancelada': return 'from-red-200 to-red-100 text-red-900 border-red-200';
                  case 'em_manutencao': return 'from-purple-200 to-purple-100 text-purple-900 border-purple-200';
                  default: return 'from-gray-200 to-gray-100 text-gray-900 border-gray-200';
                }
              };

              // Função para obter cor da prioridade
              const getPriorityColor = (priority: string) => {
                switch (priority) {
                  case 'baixa': return 'from-gray-200 to-gray-100 text-gray-700';
                  case 'normal': return 'from-blue-200 to-blue-100 text-blue-700';
                  case 'alta': return 'from-orange-200 to-orange-100 text-orange-700';
                  case 'urgente': return 'from-red-200 to-red-100 text-red-700';
                  default: return 'from-gray-200 to-gray-100 text-gray-700';
                }
              };

              // Função para obter texto do status (português)
              const getStatusText = (status: string) => {
                switch (status) {
                  case 'pendente': return 'Pendente';
                  case 'aprovada': return 'Aprovada';
                  case 'entregue': return 'Entregue';
                  case 'em_orcamento': return 'Em Orçamento';
                  case 'pronto_retirada': return 'Pronto para Retirada';
                  case 'retornado': return 'Retornado';
                  case 'cancelada': return 'Cancelada';
                  case 'em_manutencao': return 'Em Manutenção';
                  default: return status;
                }
              };

              // Função para obter texto da prioridade
              const getPriorityText = (priority: string) => {
                switch (priority) {
                  case 'baixa': return 'Baixa';
                  case 'normal': return 'Normal';
                  case 'alta': return 'Alta';
                  case 'urgente': return 'Urgente';
                  default: return priority;
                }
              };

              // Função para obter texto do tipo
              const getTypeText = (type: string) => {
                switch (type) {
                  case 'preventive': return 'Preventiva';
                  case 'corrective': return 'Corretiva';
                  case 'emergency': return 'Emergencial';
                  default: return type;
                }
              };

              const baseSteps = [
                { label: 'Abertura', key: 'pendente', date: maintenance.criado_em },
                { label: 'Aprovada', key: 'aprovada', date: maintenance.aprovado_em },
                { label: 'Entregue', key: 'entregue', date: maintenance.entregue_em },
                { label: 'Orçamento', key: 'em_orcamento', date: maintenance.orcado_em },
                { label: 'Em manutenção', key: 'em_manutencao', date: maintenance.em_manutencao_em },
                { label: 'Pronto para retirada', key: 'pronto_retirada', date: maintenance.pronto_em },
                { label: 'Retornado', key: 'retornado', date: maintenance.retornado_em },
              ];
              const isCancelled = maintenance.status === 'cancelada';
              const steps = isCancelled
                ? [...baseSteps, { label: 'Cancelada', key: 'cancelada', date: maintenance.cancelado_em }]
                : baseSteps;
              const currentStatus = maintenance.status;
              const currentIdx = steps.findIndex(s => s.key === currentStatus);

              return (
                <div
                  key={maintenance.id}
                  className={`bg-white rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all duration-500 ${highlightedMaintenanceId === maintenance.id
                    ? 'border-green-400 shadow-green-200 ring-2 ring-green-200 bg-green-50'
                    : 'border-gray-100'
                    }`}
                >
                  {/* Header do Card */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-xl shadow-sm">
                        <TruckIcon className="h-7 w-7 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-gray-900 tracking-tight">
                          {vehicle ? `${vehicle.placa} - ${vehicle.modelo}` : 'Veículo não encontrado'}
                        </h3>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                          <div><span className="font-semibold">Abertura:</span> {formatDate(maintenance.criado_em || '')}</div>
                          {('data_entrega' in maintenance) && (maintenance as unknown as { data_entrega: string }) && (maintenance as unknown as { data_entrega: string }).data_entrega && <div><span className="font-semibold">Entrega na oficina:</span> {formatDate((maintenance as unknown as { data_entrega: string }).data_entrega || '')}</div>}
                          {('data_orcamento' in maintenance) && (maintenance as unknown as { data_orcamento: string }) && (maintenance as unknown as { data_orcamento: string }).data_orcamento && <div><span className="font-semibold">Orçamento:</span> {formatDate((maintenance as unknown as { data_orcamento: string }).data_orcamento || '')}</div>}
                          {('data_pronto' in maintenance) && (maintenance as unknown as { data_pronto: string }) && (maintenance as unknown as { data_pronto: string }).data_pronto && <div><span className="font-semibold">Pronto para retirada:</span> {formatDate((maintenance as unknown as { data_pronto: string }).data_pronto || '')}</div>}
                          {('data_retorno' in maintenance) && (maintenance as unknown as { data_retorno: string }) && (maintenance as unknown as { data_retorno: string }).data_retorno && <div><span className="font-semibold">Retorno:</span> {formatDate((maintenance as unknown as { data_retorno: string }).data_retorno || '')}</div>}
                          {maintenance.cancelado_em && <div><span className="font-semibold">Cancelada:</span> {formatDate(maintenance.cancelado_em || '')}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 md:mt-0">
                      <span className={`px-4 py-1 rounded-full text-xs font-semibold border shadow-sm bg-gradient-to-r ${getStatusColor(maintenance.status)}`}>{getStatusText(maintenance.status)}</span>
                      <span className={`px-4 py-1 rounded-full text-xs font-semibold shadow-sm bg-gradient-to-r ${getPriorityColor(maintenance.prioridade)}`}>{getPriorityText(maintenance.prioridade)}</span>
                      <MaintenanceServiceTypeIndicator maintenance={maintenance} size="sm" />
                    </div>
                  </div>

                  {/* Timeline visual */}
                  <ul className="flex items-center justify-between w-full max-w-4xl mx-auto py-6 px-4 relative">
                    {/* Linha de fundo cinza */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 z-0" style={{ transform: 'translateY(-50%)' }} />
                    {/* Linha de progresso colorida */}
                    <div
                      className="absolute top-1/2 left-0 h-1 z-0"
                      style={{
                        width: `${(steps.length > 1 ? (100 * (steps.filter((s, idx) => idx <= currentIdx && (s.key !== 'cancelada' || isCancelled)).length - 1) / (steps.length - 1)) : 0)}%`,
                        background: isCancelled
                          ? 'linear-gradient(to right, #f87171, #fecaca)'
                          : 'linear-gradient(to right, #22c55e, #bbf7d0)',
                        transform: 'translateY(-50%)'
                      }}
                    />
                    {steps.map((step, idx) => {
                      const completed = !!step.date && (idx < currentIdx || (step.key === 'retornado' && currentStatus === 'retornado'));
                      const isCurrent = idx === currentIdx && !completed && step.key !== 'retornado';
                      const isCancel = step.key === 'cancelada' && step.date;
                      return (
                        <li key={step.label} className="flex-1 flex flex-col items-center relative z-10">
                          <div className={`flex items-center justify-center ${isCurrent ? 'animate-pulse' : ''}`}>
                            <span className={
                              isCancel
                                ? 'text-red-500'
                                : completed
                                  ? 'text-green-500'
                                  : isCurrent
                                    ? 'text-blue-600'
                                    : 'text-gray-300'
                            }>
                              {isCancel ? (
                                <XCircleIcon className="h-8 w-8" />
                              ) : completed ? (
                                <CheckCircleIcon className="h-8 w-8" />
                              ) : (
                                <ClockIcon className="h-8 w-8" />
                              )}
                            </span>
                          </div>
                          <span className={`text-xs mt-2 font-medium text-center
                            ${isCancel ? 'text-red-600' : completed ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-400'}`}>
                            {step.label}
                          </span>
                          {step.date && (
                            <span
                              className="text-[10px] text-gray-400 mt-1 cursor-help"
                              title={new Date(step.date).toLocaleString('pt-BR')}
                            >
                              {new Date(step.date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Conteúdo do Card */}
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:divide-x md:divide-gray-100">
                      {/* Coluna 1 - Informações Principais */}
                      <div className="space-y-6 md:pr-8">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Descrição</span>
                          </div>
                          <p className="text-gray-700 text-sm leading-relaxed ml-6">
                            {maintenance.descricao}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Tipo de Manutenção</span>
                          </div>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-6">
                            {getTypeText(maintenance.tipo)}
                          </span>
                        </div>
                        {/* NOVO: Responsáveis */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Responsáveis</span>
                          </div>
                          <ul className="ml-6 text-sm text-gray-700 space-y-1">
                            <li><span className="font-medium">Solicitante:</span> {responsaveisNomes[maintenance.id]?.solicitante || '-'}</li>
                            <li><span className="font-medium">Aprovador:</span> {responsaveisNomes[maintenance.id]?.aprovador || '-'}</li>
                          </ul>
                        </div>
                        {/* NOVO: Quilometragem */}
                        {vehicle?.quilometragem_atual && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Quilometragem</span>
                            </div>
                            <p className="ml-6 text-sm text-gray-700">{vehicle.quilometragem_atual.toLocaleString()} km</p>
                          </div>
                        )}
                        {/* NOVO: Prioridade (badge extra) */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Prioridade</span>
                          </div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ml-6 ${getPriorityColor(maintenance.prioridade)}`}>{getPriorityText(maintenance.prioridade)}</span>
                        </div>
                        {maintenance.observacoes && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Observações</span>
                            </div>
                            <p className="text-gray-600 text-sm ml-6">
                              {maintenance.observacoes}
                            </p>
                          </div>
                        )}
                        
                        {/* NOVO: Números de Documentos */}
                        {(maintenance.numero_orcamento || maintenance.numero_cotacao || maintenance.numero_pedido || maintenance.numero_nf) && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Números de Documentos</span>
                            </div>
                            <div className="ml-6 text-sm text-gray-700 space-y-1">
                              {maintenance.numero_orcamento && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-orange-600">Orçamento:</span>
                                  <span className="bg-orange-50 px-2 py-1 rounded text-xs">{maintenance.numero_orcamento}</span>
                                </div>
                              )}
                              {maintenance.numero_cotacao && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-purple-600">Cotação:</span>
                                  <span className="bg-purple-50 px-2 py-1 rounded text-xs">{maintenance.numero_cotacao}</span>
                                </div>
                              )}
                              {maintenance.numero_pedido && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-green-600">Pedido:</span>
                                  <span className="bg-green-50 px-2 py-1 rounded text-xs">{maintenance.numero_pedido}</span>
                                </div>
                              )}
                              {maintenance.numero_nf && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-blue-600">NF:</span>
                                  <span className="bg-blue-50 px-2 py-1 rounded text-xs">{maintenance.numero_nf}</span>
                                  {maintenance.nf_vencimento && (
                                    <span className="text-xs text-gray-500">
                                      (Venc: {new Date(maintenance.nf_vencimento).toLocaleDateString('pt-BR')})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coluna 2 - Datas, Localização, Itens/Serviços, Anexos */}
                      <div className="space-y-6 md:px-8">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Cronograma</span>
                          </div>
                          <div className="space-y-1 text-sm ml-6">
                            {maintenance.start_date && (
                              <div className="flex items-center gap-2">
                                <span>Início:</span>
                                <span>{formatDate(maintenance.start_date)}</span>
                              </div>
                            )}
                            {maintenance.end_date && (
                              <div className="flex items-center gap-2">
                                <span>Fim:</span>
                                <span>{formatDate(maintenance.end_date)}</span>
                              </div>
                            )}
                            {maintenance.started_at && (
                              <div className="flex items-center gap-2">
                                <span>Iniciado em:</span>
                                <span>{formatDate(maintenance.started_at)}</span>
                              </div>
                            )}
                            {maintenance.completed_at && (
                              <div className="flex items-center gap-2">
                                <span>Concluído em:</span>
                                <span>{formatDate(maintenance.completed_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {vehicle?.contrato?.nome && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Contrato</span>
                            </div>
                            <p className="text-gray-700 text-sm ml-6">
                              {vehicle.contrato?.nome}
                            </p>
                          </div>
                        )}
                        {/* Itens/Serviços */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Itens/Serviços</span>
                          </div>
                          <ul className="ml-6 text-sm text-gray-700 space-y-1">
                            {Array.isArray(maintenance.servicos) && maintenance.servicos.length > 0 ? (
                              maintenance.servicos.map((serv, idx) => {
                                if (typeof serv === "object" && serv !== null && "nome" in serv) {
                                  const s = serv as { nome?: string; valor?: number };
                                  return (
                                    <li key={idx}>
                                      {s.nome}
                                      {s.valor ? ` - R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                                    </li>
                                  );
                                }
                                return null;
                              })
                            ) : (
                              <li className="text-gray-400">Nenhum serviço informado</li>
                            )}
                          </ul>
                        </div>
                        {/* Anexos */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Anexos</span>
                          </div>
                          <ul className="ml-6 text-sm text-blue-700 space-y-1">
                            {Array.isArray(maintenance.anexos) && maintenance.anexos.length > 0 ? (
                              maintenance.anexos.map((anexo, idx) => {
                                if (typeof anexo === "object" && anexo !== null && "url" in anexo && "nome" in anexo) {
                                  const a = anexo as { url: string; nome: string };
                                  return (
                                    <li key={idx}><a href={a.url} className="underline" target="_blank" rel="noopener noreferrer">{a.nome}</a></li>
                                  );
                                }
                                return null;
                              })
                            ) : (
                              <li className="text-gray-400">Nenhum anexo</li>
                            )}
                          </ul>
                        </div>
                        
                        {/* NOVO: Imagens da Manutenção */}
                        {maintenance.imagens && maintenance.imagens.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <PhotoIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Imagens da Manutenção</span>
                            </div>
                            <ul className="ml-6 text-sm text-blue-700 space-y-1">
                              {maintenance.imagens.map((imagem, idx) => (
                                <li key={idx}>
                                  <a 
                                    href={imagem.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 hover:underline"
                                  >
                                    <PhotoIcon className="h-4 w-4" />
                                    {imagem.nome_arquivo}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Coluna 3 - Custos, Oficina, Histórico */}
                      <div className="space-y-6 md:pl-8">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Custos</span>
                          </div>
                          <div className="space-y-1 text-sm ml-6">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Estimado:</span>
                              <span className="font-medium">{formatCurrency(maintenance.custo_estimado ?? 0)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* NOVO: Arquivo da NF */}
                        {maintenance.nf_arquivo && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Nota Fiscal</span>
                            </div>
                            <div className="ml-6">
                              <a 
                                href={maintenance.nf_arquivo} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm transition-colors"
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                                Visualizar NF
                              </a>
                              {maintenance.nf_vencimento && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Vencimento: {new Date(maintenance.nf_vencimento).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {workshop && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-800 text-base">Oficina</span>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 ml-6 shadow-sm border border-gray-100">
                              <p className="font-medium text-gray-900 text-sm">{workshop.nome}</p>
                              <p className="text-gray-600 text-xs mt-1">{workshop.endereco}</p>
                              <p className="text-gray-600 text-xs">{workshop.telefone}</p>
                              
                              
                              {workshop.contrato && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <p className="text-gray-600 text-xs">
                                    <span className="font-medium">Contrato:</span> {workshop.contrato.nome} ({workshop.contrato.codigo})
                                  </p>
                                </div>
                              )}
                              {workshop.base && (
                                <div className="mt-1">
                                  <p className="text-gray-600 text-xs">
                                    <span className="font-medium">Base:</span> {workshop.base.nome} ({workshop.base.codigo})
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* NOVO: Histórico textual */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-800 text-base">Histórico</span>
                          </div>
                          <ul className="ml-6 text-xs text-gray-600 space-y-1">
                            {Array.isArray(maintenance.historico) && maintenance.historico.length > 0 ? (
                              maintenance.historico
                                .sort((a, b) => {
                                  if (
                                    typeof a === "object" && a !== null && "data" in a &&
                                    typeof b === "object" && b !== null && "data" in b
                                  ) {
                                    return new Date((a as { data: string }).data).getTime() - new Date((b as { data: string }).data).getTime();
                                  }
                                  return 0;
                                })
                                .map((ev, idx) => {
                                  if (typeof ev === "object" && ev !== null && "data" in ev && "status" in ev) {
                                    const evento = ev as { data: string; status: string; usuario_id?: string; comentario?: string };
                                    return (
                                      <li key={idx}>
                                        {new Date(evento.data).toLocaleDateString('pt-BR')} {new Date(evento.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -
                                        {(() => {
                                          switch (evento.status) {
                                            case 'pendente': return ' Solicitado';
                                            case 'aprovada': return ' Aprovado';
                                            case 'entregue': return ' Entregue na oficina';
                                            case 'em_orcamento': return ' Orçamento informado';
                                            case 'em_manutencao': return ' Em manutenção';
                                            case 'pronto_retirada': return ' Pronto para retirada';
                                            case 'retornado': return ' Retornado';
                                            case 'cancelada': return ' Cancelado';
                                            case 'rejeitada': return ' Rejeitado';
                                            default: return ` ${evento.status}`;
                                          }
                                        })()}
                                        {evento.usuario_id && historicoNomes[evento.usuario_id] ? ` por ${historicoNomes[evento.usuario_id]}` : ''}
                                        {evento.comentario ? ` - ${evento.comentario}` : ''}
                                      </li>
                                    );
                                  }
                                  return null;
                                })
                            ) : (
                              <li className="text-gray-400">Nenhum histórico</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4">
                      {/* Aprovar */}
                      {canAprovarManutencao && maintenance.status === 'pendente' && (
                        <button onClick={() => handleAprovar(maintenance.id, maintenance.oficina_id || '')} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                          <CheckCircleIcon className="h-5 w-5" /> Aprovar e Definir Oficina
                        </button>
                      )}
                      {/* Rejeitar */}
                      {canAprovarManutencao && maintenance.status === 'pendente' && (
                        <button onClick={() => handleRejeitar(maintenance.id)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-base font-semibold text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer">
                          <XCircleIcon className="h-5 w-5" /> Rejeitar Solicitação
                        </button>
                      )}
                      {/* Entregar na oficina */}
                      {canEntregarVeiculo && maintenance.status === 'aprovada' && (
                        <button onClick={() => handleEntregar(maintenance.id)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 text-base font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm cursor-pointer">
                          <ArrowPathIcon className="h-5 w-5" /> Entregar Veículo na Oficina
                        </button>
                      )}
                      {/* Informar orçamento */}
                      {canAprovarManutencao && maintenance.status === 'entregue' && (
                        <button onClick={() => setShowOrcamentoModal({ id: maintenance.id })} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-orange-600 text-base font-semibold text-white hover:bg-orange-700 transition-colors shadow-sm cursor-pointer">
                          <CurrencyDollarIcon className="h-5 w-5" /> Informar Orçamento da Oficina
                        </button>
                      )}
                      {/* Pronto para retirada */}
                      {canFinalizarManutencao && ['em_manutencao', 'in_progress'].includes(maintenance.status) && (
                        <button onClick={() => handleProntoRetirada(maintenance.id)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-base font-semibold text-white hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
                          <CheckCircleIcon className="h-5 w-5" /> Marcar Pronto para Retirada
                        </button>
                      )}
                      {/* Marcar como retornado */}
                      {canBuscarVeiculo && maintenance.status === 'pronto_retirada' && (
                        <button onClick={() => handleRetornado(maintenance.id)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-base font-semibold text-white hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
                          <ArrowPathIcon className="h-5 w-5" /> Confirmar Retirada do Veículo
                        </button>
                      )}
                      {/* Cancelar */}
                      {(canAprovarManutencao || canEntregarVeiculo) && !['cancelada', 'retornado'].includes(maintenance.status) && (
                        <button onClick={() => setShowOrcamentoModal({ id: maintenance.id })} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
                          <XMarkIcon className="h-5 w-5" /> Cancelar Manutenção
                        </button>
                      )}
                      {/* Iniciar Manutenção */}
                      {canFinalizarManutencao && maintenance.status === 'em_orcamento' && (
                        <button onClick={() => handleIniciarManutencao(maintenance.id)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 text-base font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm cursor-pointer">
                          <ArrowPathIcon className="h-5 w-5" /> Iniciar Manutenção na Oficina
                        </button>
                      )}
                      
                      {/* Botão de Editar - disponível até o encerramento */}
                      {maintenance.status !== 'retornado' && (
                        <button 
                          onClick={() => setShowEditModal({ maintenance })}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-yellow-600 text-base font-semibold text-white hover:bg-yellow-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <DocumentTextIcon className="h-5 w-5" /> Editar
                        </button>
                      )}
                      
                      <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
                        <DocumentTextIcon className="h-5 w-5" /> Ver Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal de Nova Manutenção */}
          {showNewMaintenanceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 animate-in fade-in duration-300 p-4">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header do Modal */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                      <PlusIcon className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Nova Manutenção</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewMaintenanceModal(false)}
                    disabled={createMaintenanceMutation.isPending}
                    className="h-8 w-8 p-0 hover:bg-gray-100/80 rounded-lg cursor-pointer"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                </div>

                {/* Conteúdo do Modal */}
                <div className="flex-1 overflow-y-auto">
                  <form id="nova-manutencao-form" onSubmit={handleNovaManutencaoSubmit} className="p-6 space-y-6">
                  {/* Campo Veículo */}
                  <div className="space-y-3">
                    <Label htmlFor="veiculo" className="text-sm font-medium text-gray-900">
                      Veículo <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="veiculo"
                        type="text"
                        placeholder="Digite a placa, modelo do veículo ou 'preventiva'"
                        value={novaManutencao.buscaVeiculo}
                        onChange={e => setNovaManutencao({ ...novaManutencao, buscaVeiculo: e.target.value, veiculo_id: '' })}
                        autoComplete="off"
                        required={!novaManutencao.veiculo_id}
                        disabled={createMaintenanceMutation.isPending}
                        className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                      {/* Lista de sugestões de veículos */}
                      {novaManutencao.buscaVeiculo && vehicles.length > 0 && !createMaintenanceMutation.isPending && (
                        <div className="absolute z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl mt-2 w-full max-h-48 overflow-y-auto shadow-xl">
                          {/* Opção especial para Manutenção Preventiva */}
                          {novaManutencao.buscaVeiculo.toLowerCase().includes('preventiva') && (
                            <div
                              className="px-4 py-3 hover:bg-green-50/80 cursor-pointer border-b border-gray-100/50 transition-colors bg-green-50/30"
                              onClick={() => {
                                // Redirecionar para página de preventiva
                                window.location.href = '/preventiva';
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-green-100 rounded-lg">
                                  <WrenchScrewdriverIcon className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">Manutenção Preventiva</div>
                                  <div className="text-sm text-gray-500">Sistema de manutenção por quilometragem</div>
                                  <div className="text-xs text-green-600">Clique para acessar</div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {vehicles.filter(v => {
                            // Filtrar por contrato do usuário - só mostrar veículos dos contratos que o usuário tem acesso
                            // ✅ CORREÇÃO: Usar permissões modulares em vez de hierarquia antiga
      const hasContratoAccess = hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS) || 
                              !v.contrato_id || 
                              userContratoIds.includes(v.contrato_id);
                            if (!hasContratoAccess) return false;

                            // Filtrar por busca (incluindo contrato)
                            return v.placa.toLowerCase().includes(novaManutencao.buscaVeiculo.toLowerCase()) ||
                              v.modelo.toLowerCase().includes(novaManutencao.buscaVeiculo.toLowerCase()) ||
                              (v.contrato?.nome && v.contrato.nome.toLowerCase().includes(novaManutencao.buscaVeiculo.toLowerCase()));
                          }).slice(0, 5).map(v => (
                            <div
                              key={v.id}
                              className="px-4 py-3 hover:bg-blue-50/80 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors"
                              onClick={() => setNovaManutencao({ ...novaManutencao, veiculo_id: String(v.id), buscaVeiculo: `${v.placa} - ${v.modelo}` })}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-100 rounded-lg">
                                  <TruckIcon className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{v.placa}</div>
                                  <div className="text-sm text-gray-500">{v.modelo}</div>
                                  {v.contrato?.nome && (
                                    <div className="text-xs text-blue-600">{v.contrato.nome}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campo Descrição */}
                  <div className="space-y-3">
                    <Label htmlFor="descricao" className="text-sm font-medium text-gray-900">
                      Descrição do Problema <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="descricao"
                      placeholder="Descreva detalhadamente o problema encontrado no veículo..."
                      value={novaManutencao.descricao}
                      onChange={e => setNovaManutencao({ ...novaManutencao, descricao: e.target.value })}
                      required
                      disabled={createMaintenanceMutation.isPending}
                      rows={4}
                      className="rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
                    />
                  </div>

                  {/* Campo Prioridade */}
                  <div className="space-y-3">
                    <Label htmlFor="prioridade" className="text-sm font-medium text-gray-900">
                      Prioridade
                    </Label>
                    <Select
                      value={novaManutencao.prioridade}
                      onValueChange={value => setNovaManutencao({ ...novaManutencao, prioridade: value })}
                      disabled={createMaintenanceMutation.isPending}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20">
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[60]">
                        <SelectItem value="baixa" className="flex items-center gap-2">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                            Baixa
                          </span>
                        </SelectItem>
                        <SelectItem value="normal" className="flex items-center gap-2">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            Normal
                          </span>
                        </SelectItem>
                        <SelectItem value="alta" className="flex items-center gap-2">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            Alta
                          </span>
                        </SelectItem>
                        <SelectItem value="urgente" className="flex items-center gap-2">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            Urgente
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campo de Upload de Imagens */}
                  <div className="space-y-3">
                    <MaintenanceImageUpload
                      maintenanceId={undefined} // Será definido após criação
                      existingImages={maintenanceImages}
                      onImagesChange={setMaintenanceImages}
                      onPendingImagesChange={setPendingImages}
                      maxImages={5}
                      maxSizeMB={10}
                    />
                  </div>
                  </form>
                </div>

                {/* Footer do Modal */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200/50 bg-gray-50/50 rounded-b-3xl">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewMaintenanceModal(false)}
                    disabled={createMaintenanceMutation.isPending}
                    className="rounded-xl border-gray-300 hover:bg-gray-50/80 cursor-pointer"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    form="nova-manutencao-form"
                    disabled={createMaintenanceMutation.isPending}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg cursor-pointer"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    {createMaintenanceMutation.isPending && (
                      <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {createMaintenanceMutation.isPending ? 'Criando...' : 'Criar Manutenção'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Orçamento */}
          {showOrcamentoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!orcamentoValor) return;
                  if (!user) return;
                  const maintenance = maintenances.find(m => m.id === showOrcamentoModal.id);
                  const historico = Array.isArray(maintenance?.historico) ? maintenance.historico : [];
                  const novoHistorico = [
                    ...historico,
                    {
                      status: 'em_orcamento',
                      data: new Date().toISOString(),
                      usuario_id: user.id,
                      comentario: 'Orçamento informado'
                    }
                  ];
                  await maintenanceService.update(showOrcamentoModal.id, {
                    status: 'em_orcamento',
                    custo_estimado: parseFloat(orcamentoValor),
                    servicos: orcamentoServicos,
                    anexos: orcamentoAnexos,
                    orcado_em: new Date().toISOString(),
                    historico: novoHistorico,
                    observacoes: orcamentoDescricao,
                    numero_orcamento: numeroOrcamento || undefined
                  });
                  notify('Orçamento informado com sucesso!', 'success');
                  queryClient.invalidateQueries({ queryKey: ['maintenances'] });
                  setShowOrcamentoModal(null);
                  setOrcamentoValor('');
                  setOrcamentoDescricao('');
                  setNumeroOrcamento('');
                  setOrcamentoServicos([]);
                  setOrcamentoAnexos([]);
                }}
                className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md"
              >
                <h2 className="text-xl font-bold mb-4">Informar Orçamento</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={orcamentoValor}
                    onChange={e => setOrcamentoValor(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Orçamento</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={numeroOrcamento}
                    onChange={e => setNumeroOrcamento(e.target.value)}
                    placeholder="Ex: ORC-2024-001 (opcional)"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do serviço</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={orcamentoDescricao}
                    onChange={e => setOrcamentoDescricao(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serviços</label>
                  {orcamentoServicos.map((serv, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Nome do serviço"
                        value={serv.nome}
                        onChange={e => setOrcamentoServicos(s => s.map((item, i) => i === idx ? { ...item, nome: e.target.value } : item))}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Valor (R$)"
                        value={serv.valor ?? ''}
                        onChange={e => setOrcamentoServicos(s => s.map((item, i) => i === idx ? { ...item, valor: parseFloat(e.target.value) } : item))}
                      />
                      <button type="button" onClick={() => setOrcamentoServicos(s => s.filter((_, i) => i !== idx))} className="text-red-500 font-bold">&times;</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setOrcamentoServicos(s => [...s, { nome: '', valor: undefined }])} className="text-blue-600 text-sm mt-1">+ Adicionar serviço</button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anexos</label>
                  <input
                    type="file"
                    multiple
                    onChange={async e => {
                      const files = e.target.files;
                      if (!files) return;
                      // Simulação: salvar nome e url local (em produção, fazer upload real)
                      const anexos = Array.from(files).map(f => ({
                        id: `temp-${Date.now()}-${Math.random()}`,
                        nome: f.name,
                        url: URL.createObjectURL(f),
                        tipo: f.type,
                        tamanho: f.size,
                        categoria: 'outros' as const,
                        criado_em: new Date().toISOString(),
                        criado_por: 'temp'
                      }));
                      setOrcamentoAnexos(a => [...a, ...anexos]);
                    }}
                  />
                  <ul className="mt-2 space-y-1">
                    {orcamentoAnexos.map((anexo, idx) => (
                      <li key={anexo.id || idx} className="flex items-center gap-2 text-blue-700">
                        <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="underline">{anexo.nome}</a>
                        <button type="button" onClick={() => setOrcamentoAnexos(a => a.filter((_, i) => i !== idx))} className="text-red-500 font-bold">&times;</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowOrcamentoModal(null)} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Iniciar Manutenção */}
          {showIniciarManutencaoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmarIniciarManutencao();
                }}
                className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md"
              >
                <h2 className="text-xl font-bold mb-4">Iniciar Manutenção</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número da Cotação</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={numeroCotacao}
                    onChange={e => setNumeroCotacao(e.target.value)}
                    placeholder="Ex: COT-2024-001 (opcional)"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowIniciarManutencaoModal(null);
                      setNumeroCotacao('');
                    }} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white cursor-pointer hover:bg-purple-700 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Iniciar Manutenção
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Pronto para Retirada */}
          {showProntoRetiradaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmarProntoRetirada();
                }}
                className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md"
              >
                <h2 className="text-xl font-bold mb-4">Pronto para Retirada</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Pedido</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={numeroPedido}
                    onChange={e => setNumeroPedido(e.target.value)}
                    placeholder="Ex: PED-2024-001 (opcional)"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowProntoRetiradaModal(null);
                      setNumeroPedido('');
                    }} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-green-600 text-white cursor-pointer hover:bg-green-700 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Marcar como Pronto
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Marcar como Retornado */}
          {showRetornadoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmarRetornado();
                }}
                className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md"
              >
                <h2 className="text-xl font-bold mb-4">Marcar como Retornado</h2>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número da NF</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={numeroNF}
                    onChange={e => setNumeroNF(e.target.value)}
                    placeholder="Ex: NF-2024-001 (opcional)"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento da NF</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={nfVencimento}
                    onChange={e => setNfVencimento(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo da NF</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    onChange={e => setNfArquivo(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos aceitos: PDF, JPG, PNG, GIF, DOC, DOCX (máx. 10MB)
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowRetornadoModal(null);
                      setNumeroNF('');
                      setNfVencimento('');
                      setNfArquivo(null);
                    }} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-green-600 text-white cursor-pointer hover:bg-green-700 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Marcar como Retornado
                  </button>
                </div>
              </form>
            </div>
          )}

          {showAprovarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form onSubmit={e => { e.preventDefault(); handleAprovarConfirm(); }} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-6">Aprovar Manutenção</h2>
                
                {/* Seleção do Tipo de Serviço */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Tipo de Serviço
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Serviço Interno */}
                    <div 
                      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                        tipoServico === 'interno' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => setTipoServico('interno')}
                    >
                      <div className="flex items-start space-x-3">
                        <WrenchScrewdriverIcon 
                          className={`h-6 w-6 ${
                            tipoServico === 'interno' ? 'text-green-600' : 'text-gray-400'
                          }`} 
                        />
                        <div className="flex-1">
                          <h3 className={`font-semibold ${
                            tipoServico === 'interno' ? 'text-green-700' : 'text-gray-900'
                          }`}>
                            Serviço Interno
                          </h3>
                          <p className="text-sm text-gray-600">
                            Feito pelos nossos mecânicos
                          </p>
                        </div>
                        {tipoServico === 'interno' && (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Serviço Externo */}
                    <div 
                      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                        tipoServico === 'externo' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => setTipoServico('externo')}
                    >
                      <div className="flex items-start space-x-3">
                        <BuildingOfficeIcon 
                          className={`h-6 w-6 ${
                            tipoServico === 'externo' ? 'text-blue-600' : 'text-gray-400'
                          }`} 
                        />
                        <div className="flex-1">
                          <h3 className={`font-semibold ${
                            tipoServico === 'externo' ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            Serviço Externo
                          </h3>
                          <p className="text-sm text-gray-600">
                            Feito por oficina terceirizada
                          </p>
                        </div>
                        {tipoServico === 'externo' && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campos Condicionais para Serviço Externo */}
                {tipoServico === 'externo' && (
                  <>
                    {/* Seleção de Oficina */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Oficina Externa</label>
                      <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
                        {oficinaSelecionada ? (
                          <>
                            <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                            <span className="flex-1 text-sm">
                              {workshops.find(w => w.id === oficinaSelecionada)?.nome || 'Oficina não encontrada'}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500 text-sm">Nenhuma oficina selecionada</span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWorkshopSelector(true)}
                        >
                          {oficinaSelecionada ? 'Alterar' : 'Selecionar'}
                        </Button>
                      </div>
                    </div>

                    {/* Custo Estimado */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custo Estimado</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">R$</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0,00"
                          value={custoEstimado}
                          onChange={(e) => setCustoEstimado(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAprovarModal(null)} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={tipoServico === 'externo' && (!oficinaSelecionada || !custoEstimado)} 
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Rejeitar Manutenção */}
          {showRejeitarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form onSubmit={e => { e.preventDefault(); handleRejeitarConfirm(); }} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Rejeitar Solicitação</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Ao rejeitar esta solicitação de manutenção, o solicitante será notificado. Por favor, informe o motivo da rejeição.
                </p>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Motivo da Rejeição *</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    value={motivoRejeicao}
                    onChange={e => setMotivoRejeicao(e.target.value)}
                    placeholder="Ex: Manutenção não necessária neste momento, veículo será substituído..."
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowRejeitarModal(null);
                      setMotivoRejeicao('');
                    }} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={!motivoRejeicao.trim()} 
                    className="px-4 py-2 rounded-lg bg-red-600 text-white cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Confirmar Rejeição
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Seletor de Oficina */}
          {showWorkshopSelector && (
            <WorkshopSelector
              workshops={workshops}
              selectedWorkshopId={oficinaSelecionada}
              onSelectWorkshop={(workshopId) => {
                setOficinaSelecionada(workshopId);
                setShowWorkshopSelector(false);
              }}
              onClose={() => setShowWorkshopSelector(false)}
            />
          )}

          {showEntregarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <form onSubmit={e => { e.preventDefault(); handleEntregarConfirm(); }} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Entregar na oficina</h2>
                <p className="mb-6">Confirma a entrega do veículo na oficina?</p>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowEntregarModal(null)} 
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white cursor-pointer hover:bg-purple-700 transition-colors"
                    style={{ pointerEvents: 'auto', zIndex: 100 }}
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Edição de Manutenção */}
          {showEditModal && (
            <MaintenanceEditModalNew
              maintenance={showEditModal.maintenance}
              isOpen={true}
              onClose={() => setShowEditModal(null)}
              onSave={handleSaveMaintenance}
            />
          )}
        </div>
      </div>
    </main>
    </>
  );
} 