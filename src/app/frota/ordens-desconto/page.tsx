'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discountOrderService } from '@/services/discountOrderService';
import { userService } from '@/services/userService';
import { locationService } from '@/services/locationService';
import { Base } from '@/types';
import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { MagnifyingGlassIcon, DocumentTextIcon, ArrowUpTrayIcon, PhotoIcon, PaperClipIcon, PencilIcon, TrashIcon, ClockIcon, CheckCircleIcon, XCircleIcon, DocumentArrowDownIcon, CloudArrowUpIcon, EyeIcon, ArrowDownTrayIcon, PhotoIcon as ImageIcon, DocumentTextIcon as FileTextIcon } from '@heroicons/react/24/outline';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { validarCPF } from '@/utils/cpfUtils';
import { supabase } from '@/lib/supabase';
import DiscountOrderFilesModal from '@/components/discount-orders/DiscountOrderFilesModal';
import BulkGenerationModal from '@/components/discount-orders/BulkGenerationModal';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useModularPermissions } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { TestemunhaAutocomplete } from '@/components/ui/TestemunhaAutocomplete';

import { vehicleService } from '@/services/vehicleService';
import { DiscountOrder } from '@/types/discountOrder';
import { exportarOrdensDescontoExcel } from '@/utils/ordensDescontoExcel';
import { User } from '@/types/index';

interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface UserWithCPF extends User {
  cpf?: string;
}

const statusOptions = [
  { key: 'all', label: 'Todos' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'assinada', label: 'Assinada' },
  { key: 'recusada', label: 'Recusada' },
];

export default function DiscountOrdersPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
      PERMISSION_CODES.VEICULOS.LISTAR_VEICULOS,
      PERMISSION_CODES.VEICULOS.DETALHES_VEICULO,
      PERMISSION_CODES.VEICULOS.GESTAO_CAMPO_FROTA,
      PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES
    ]}>
      <DiscountOrdersContent />
    </ProtectedRoute>
  );
}

function DiscountOrdersContent() {
  const { user: currentUser } = useAuth();
  const { hasPermission } = useModularPermissions();
  
  
  const queryClient = useQueryClient();
  const { notify } = useNotification();

  // Queries principais com configurações otimizadas
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders
  } = useQuery({
    queryKey: ['discount_orders'],
    queryFn: discountOrderService.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const {
    data: users = [],
    isLoading: usersLoading
  } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  const {
    data: bases = [],
    isLoading: basesLoading
  } = useQuery<Base[]>({
    queryKey: ['bases'],
    queryFn: locationService.getAll,
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
  });

  const {
    data: veiculos = [],
    isLoading: veiculosLoading
  } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => vehicleService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  });

  // Estados locais
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const [baseFilter, setBaseFilter] = useState(''); // Novo filtro de setor
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [placaAutocomplete, setPlacaAutocomplete] = useState('');
  const [showPlacaAutocomplete, setShowPlacaAutocomplete] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  // Linha expandida para ver detalhes/anexos inline
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Estados para modal de confirmação de upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DiscountOrder | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadAction, setUploadAction] = useState<'assinado' | 'recusado' | null>(null);
  const [testemunhas, setTestemunhas] = useState({
    testemunha1_nome: '',
    testemunha1_cpf: '',
    testemunha2_nome: '',
    testemunha2_cpf: ''
  });

  // Estados para sistema de upload de danos e documentos
  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [uploadingDamages, setUploadingDamages] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [documentInfo, setDocumentInfo] = useState({
    tipo_documento: 'nf' as 'nf' | 'os' | 'ambos',
    numero_documento: '',
    valor_documento: '',
    data_documento: '',
    observacoes_danos: '',
    observacoes_documentos: ''
  });

  // Estados para modal de anexos
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [selectedOrderForFiles, setSelectedOrderForFiles] = useState<DiscountOrder | null>(null);

  // Estados para edição e exclusão
  const [editingOrder, setEditingOrder] = useState<DiscountOrder | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<DiscountOrder | null>(null);
  
  // Estado para controlar aba ativa no modal de edição
  const [activeTab, setActiveTab] = useState<'damages' | 'documents'>('damages');

  // Estados para geração em massa
  const [showBulkGenerationModal, setShowBulkGenerationModal] = useState(false);

  // Função para exportar Excel com filtros atuais
  const handleExportExcel = () => {
    exportarOrdensDescontoExcel({
      ordens: filteredOrders,
      filtros: {
        setor: setorFilter,
        status: statusFilter,
        base: baseFilter,
        busca: search,
      },
      userMap,
      baseMap,
      userInfoMap,
    });
    notify('Excel gerado com sucesso!', 'success');
  };

  const itemsPerPage = 20;
  const placaInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    colaboradorBusca: '',
    target_user_id: '',
    nome_colaborador: '',
    matricula: '',
    cpf: '',
    data: new Date().toISOString().slice(0, 10),
    base_id: '',
    valor_total: '',
    parcelas: 1,
    valor_parcela: '',
    placa: '',
    descricao: '',
    auto_infracao: '',
    documentos: [] as string[],
    outros_documentos: '',
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Partial<DiscountOrder>) => {
      console.log('🔍 DEBUG - createMutation executando...');
      console.log('📤 Dados recebidos:', data);
      
      // 1. Criar a ordem primeiro
      const createdOrder = await discountOrderService.create({
        target_user_id: data.target_user_id,
        cpf: data.cpf,
        valor_total: Number(data.valor_total) / 100,
        parcelas: Number(data.parcelas),
        valor_parcela: data.parcelas && data.parcelas > 1 ? Number(data.valor_total) / 100 / Number(data.parcelas) : Number(data.valor_total) / 100,
        placa: data.placa,
        descricao: data.descricao,
        auto_infracao: data.auto_infracao,
        documentos: data.documentos,
        outros_documentos: data.outros_documentos,
        base_id: data.base_id,
        created_by: currentUser?.id || '',
        recusado: false,
        data_geracao: data.data,
        
        // ADICIONAR OS NOVOS CAMPOS AQUI TAMBÉM:
        tipo_documento: data.tipo_documento,
        numero_documento: data.numero_documento,
        valor_documento: data.valor_documento,
        data_documento: data.data_documento,
        observacoes_danos: data.observacoes_danos,
        observacoes_documentos: data.observacoes_documentos,
        danos_evidencias_urls: data.danos_evidencias_urls || [],
        nf_os_documentos_urls: data.nf_os_documentos_urls || []
      });

      // 2. Fazer upload dos arquivos se houver
      if (damageFiles.length > 0 || documentFiles.length > 0) {
        console.log('📤 CHAMANDO uploadFilesToStorage...');
        console.log('🆔 ID da ordem criada:', createdOrder.id);
        const result = await uploadFilesToStorage(createdOrder.id);
        console.log('✅ RESULTADO do uploadFilesToStorage:', result);
      } else {
        console.log('❌ Nenhum arquivo para upload');
      }

      // 3. Os novos campos já foram enviados na criação da ordem, não precisamos atualizar depois

      return createdOrder;
    },
    onSuccess: (data) => {
      console.log('🎉 createMutation onSuccess executado!');
      console.log('📊 Dados retornados:', data);
      // NÃO invalidar queries aqui - será feito após o upload dos arquivos
      setShowModal(false);
      resetFormData();
      notify('Ordem criada com sucesso!', 'success');
    },
    onError: (error: unknown) => {
      console.error('❌ createMutation onError executado!');
      console.error('🚨 Erro ao criar ordem:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao criar ordem';
      notify(errorMessage, 'error');
    }
  });

  // Mutation para upload de arquivo assinado
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      orderId,
      file,
      action,
      testemunhas
    }: {
      orderId: string;
      file: File;
      action: 'assinado' | 'recusado';
      testemunhas?: {
        testemunha1_nome: string;
        testemunha1_cpf: string;
        testemunha2_nome: string;
        testemunha2_cpf: string;
      };
    }) => {
      return await discountOrderService.uploadSignedFile(orderId, file, action, testemunhas);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
      setUploadingFile(null);
      setShowUploadModal(false);
      setSelectedOrder(null);
      setSelectedFile(null);
      setUploadAction(null);
      setTestemunhas({
        testemunha1_nome: '',
        testemunha1_cpf: '',
        testemunha2_nome: '',
        testemunha2_cpf: ''
      });

      const actionText = variables.action === 'assinado' ? 'assinado' : 'recusado';
      notify(`Arquivo ${actionText} enviado com sucesso!`, 'success');
    },
    onError: (error: unknown) => {
      setUploadingFile(null);
      console.error('Erro no upload:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao enviar arquivo';
      notify(errorMessage, 'error');
    }
  });

  // Mutation para editar ordem
  const editMutation = useMutation({
    mutationFn: async (data: Partial<DiscountOrder>) => {
      if (!editingOrder?.id) throw new Error('ID da ordem não encontrado');
      return await discountOrderService.update(editingOrder.id, data);
    },
            onSuccess: async (updatedOrder) => {
      try {
        // Aguardar um momento para garantir que o banco foi atualizado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Sempre regenerar PDF após edição para garantir dados atualizados
        if (editingOrder?.id) {
          console.log('🔄 Regenerando PDF para ordem:', editingOrder.id);
          console.log('📝 Dados atualizados:', updatedOrder);
          
          const res = await fetch('/api/discount-orders/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: editingOrder.id })
          });
          
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('❌ Erro na API de regeneração:', err);
            throw new Error(err.error || err.details || 'Falha ao regenerar PDF');
          }
          
          // Obter informações do header
          const pdfUrl = res.headers.get('X-Supabase-File-Url');
          console.log('✅ PDF regenerado com sucesso. URL:', pdfUrl);
          
          // Baixar e abrir o PDF em nova aba
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          
          // Invalidar a query para atualizar a interface com a nova URL
          queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
        }
      } catch (e) {
        console.error('❌ Erro ao regenerar PDF:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        notify(`Ordem atualizada, mas houve erro ao gerar o PDF: ${errorMessage}`, 'warning');
      } finally {
        queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
        setShowEditModal(false);
        setEditingOrder(null);
        resetFormData();
        notify('Ordem atualizada com sucesso!', 'success');
      }
    },
    onError: (error: unknown) => {
      console.error('Erro ao atualizar ordem:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao atualizar ordem';
      notify(errorMessage, 'error');
    }
  });

  // Mutation para excluir ordem
  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await discountOrderService.delete(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
      setShowDeleteModal(false);
      setOrderToDelete(null);
      notify('Ordem excluída com sucesso!', 'success');
    },
    onError: (error: unknown) => {
      console.error('Erro ao excluir ordem:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao excluir ordem';
      notify(errorMessage, 'error');
    }
  });

  // Computed values
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => { map[u.id] = u.nome; });
    return map;
  }, [users]);

  // Mapa de usuários com informações completas
  const userInfoMap = useMemo(() => {
    const map: Record<string, { nome: string; status: string; matricula?: string }> = {};
    users.forEach(u => { 
      map[u.id] = { 
        nome: u.nome, 
        status: u.status || 'ativo',
        matricula: u.matricula 
      }; 
    });
    return map;
  }, [users]);

  // Mapa de bases
  const baseMap = useMemo(() => {
    const map: Record<string, string> = {};
    bases.forEach(b => { map[b.id] = b.nome; });
    return map;
  }, [bases]);

  const placas = useMemo(() => {
    if (!veiculos || !Array.isArray(veiculos)) {
      return [];
    }
    return veiculos.map((veiculo: { placa: string }) => veiculo.placa).filter((placa: string) => placa && typeof placa === 'string');
  }, [veiculos]);

  const filteredOrders = useMemo(() => {
    // Filtrar ordens baseado nas permissões do usuário
    let basicFilteredArray = orders.filter(order => {
      // Permissão só para Frota
      if (hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
          !hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
        return order.criado_por_setor === 'frota';
      }
      // Permissão só para Almoxarifado 
      if (!hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
          hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
        return order.criado_por_setor === 'almoxarifado';
      }
      // Permissão para ambos - aplicar filtro manual
      return true;
    });

    // Aplicar filtro de setor apenas se o usuário tem permissão para ambos
    if (hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
        hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
      basicFilteredArray = basicFilteredArray.filter(order => {
        if (setorFilter === 'all') return true;
        return order.criado_por_setor === setorFilter;
      });
    }

    return basicFilteredArray.filter(order => {
      const status = order.recusado ? 'recusada' : order.data_assinatura ? 'assinada' : 'pendente';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesBase = !baseFilter || order.base_id === baseFilter;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        (userMap[order.target_user_id]?.toLowerCase().includes(searchLower)) ||
        (userInfoMap[order.target_user_id]?.matricula?.toLowerCase().includes(searchLower)) ||
        (userMap[order.created_by]?.toLowerCase().includes(searchLower)) ||
        (order.placa?.toLowerCase().includes(searchLower)) ||
        (order.descricao?.toLowerCase().includes(searchLower)) ||
        (order.valor_total?.toLocaleString('pt-BR').includes(searchLower));
      return matchesStatus && matchesBase && matchesSearch;
    });
  }, [orders, statusFilter, baseFilter, search, userMap, userInfoMap, setorFilter, hasPermission]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Autocomplete de colaborador
  const autocompleteResults = useMemo(() => {
    if (!form.colaboradorBusca) {
      return [];
    }
    const busca = form.colaboradorBusca.toLowerCase();
    return users.filter(u =>
      u.nome.toLowerCase().includes(busca) ||
      (u.matricula && u.matricula.toLowerCase().includes(busca))
    );
  }, [form.colaboradorBusca, users]);

  // Autocomplete de placa
  const placaOptions = useMemo(() => {
    if (!placaAutocomplete) {
      return [];
    }
    return placas.filter((p: string) => p.toLowerCase().includes(placaAutocomplete.toLowerCase()));
  }, [placaAutocomplete, placas]);

  // Funções auxiliares
  const resetFormData = () => {
    setForm({
      colaboradorBusca: '',
      target_user_id: '',
      nome_colaborador: '',
      matricula: '',
      cpf: '',
      data: new Date().toISOString().slice(0, 10),
      base_id: '',
      valor_total: '',
      parcelas: 1,
      valor_parcela: '',
      placa: '',
      descricao: '',
      auto_infracao: '',
      documentos: [],
      outros_documentos: '',
    });
    setCpfError('');
    setDamageFiles([]);
    setDocumentFiles([]);
    setDocumentInfo({
      tipo_documento: 'nf',
      numero_documento: '',
      valor_documento: '',
      data_documento: '',
      observacoes_danos: '',
      observacoes_documentos: ''
    });
  }

  // Funções para upload de danos e documentos
  const validateFile = (file: File, type: 'damage' | 'document'): string | null => {
    const allowedTypes = type === 'damage' 
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!allowedTypes.includes(file.type)) {
      return `Tipo de arquivo não permitido: ${file.type}`;
    }
    if (file.size > 52428800) { // 50MB
      return 'Arquivo muito grande. Máximo: 50MB';
    }
    return null;
  };

  const handleDamageFileSelect = (files: FileList) => {
    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    
    for (const file of newFiles) {
      const error = validateFile(file, 'damage');
      if (error) {
        notify(error, 'error');
        continue;
      }
      validFiles.push(file);
    }
    
    if (damageFiles.length + validFiles.length > 10) {
      notify('Máximo de 10 arquivos de danos permitidos', 'error');
      return;
    }
    
    setDamageFiles(prev => [...prev, ...validFiles]);
  };

  const handleDocumentFileSelect = (files: FileList) => {
    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    
    for (const file of newFiles) {
      const error = validateFile(file, 'document');
      if (error) {
        notify(error, 'error');
        continue;
      }
      validFiles.push(file);
    }
    
    if (documentFiles.length + validFiles.length > 5) {
      notify('Máximo de 5 documentos NF/OS permitidos', 'error');
      return;
    }
    
    setDocumentFiles(prev => [...prev, ...validFiles]);
  };

  const removeDamageFile = (index: number) => {
    setDamageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeDocumentFile = (index: number) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (orderId: string) => {
    console.log('🚀 INICIANDO uploadFilesToStorage para ordem:', orderId);
    console.log('📁 Arquivos de danos:', damageFiles.length);
    console.log('📄 Arquivos de documentos:', documentFiles.length);
    
    const uploadedDamages: FileInfo[] = [];
    const uploadedDocuments: FileInfo[] = [];

    // Upload damage files
    if (damageFiles.length > 0) {
      console.log('🔄 Iniciando upload de arquivos de danos...');
      setUploadingDamages(true);
      try {
        for (const file of damageFiles) {
          console.log('📤 Fazendo upload de:', file.name);
          
          const { data: filePath } = await supabase.rpc('generate_discount_order_file_path', {
            order_id: orderId,
            file_type: 'damage',
            original_filename: file.name
          });

          console.log('📂 Caminho gerado:', filePath);

          const { error: uploadError } = await supabase.storage
            .from('discount-orders-damages')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          console.log('✅ Upload realizado com sucesso');

          // Gerar URL pública para o arquivo
          const { data: urlData } = supabase.storage
            .from('discount-orders-damages')
            .getPublicUrl(filePath);

          // Corrigir URL malformada
          let correctedUrl = urlData.publicUrl;
          if (correctedUrl.includes(',https/')) {
            correctedUrl = correctedUrl.replace(',https/', 'https://');
          }
          if (correctedUrl.startsWith('@')) {
            correctedUrl = correctedUrl.substring(1);
          }

          console.log('🔗 URL original:', urlData.publicUrl);
          console.log('🔗 URL corrigida:', correctedUrl);

          const fileInfo = {
            name: file.name,
            url: correctedUrl, // URL corrigida
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          };

          uploadedDamages.push(fileInfo);
        }

        console.log('📊 Total de arquivos de danos enviados:', uploadedDamages.length);

        // Coletar URLs de danos para enviar via API
        if (uploadedDamages.length > 0) {
          const damageUrls = uploadedDamages.map(file => file.url);
          console.log('🔗 URLs de danos coletadas:', damageUrls);
        }
      } catch (error) {
        console.error('❌ Erro no upload de danos:', error);
        notify('Erro ao fazer upload dos arquivos de danos', 'error');
      } finally {
        setUploadingDamages(false);
      }
    }

    // Upload document files
    if (documentFiles.length > 0) {
      console.log('🔄 Iniciando upload de arquivos de documentos...');
      setUploadingDocuments(true);
      try {
        for (const file of documentFiles) {
          console.log('📤 Fazendo upload de documento:', file.name);
          
          const { data: filePath } = await supabase.rpc('generate_discount_order_file_path', {
            order_id: orderId,
            file_type: 'document',
            original_filename: file.name
          });

          console.log('📂 Caminho do documento gerado:', filePath);

          const { error: uploadError } = await supabase.storage
            .from('discount-orders-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          console.log('✅ Upload do documento realizado com sucesso');

          // Gerar URL pública para o arquivo
          const { data: urlData } = supabase.storage
            .from('discount-orders-documents')
            .getPublicUrl(filePath);

          // Corrigir URL malformada
          let correctedUrl = urlData.publicUrl;
          if (correctedUrl.includes(',https/')) {
            correctedUrl = correctedUrl.replace(',https/', 'https://');
          }
          if (correctedUrl.startsWith('@')) {
            correctedUrl = correctedUrl.substring(1);
          }

          console.log('🔗 URL original do documento:', urlData.publicUrl);
          console.log('🔗 URL corrigida do documento:', correctedUrl);

          const fileInfo = {
            name: file.name,
            url: correctedUrl, // URL corrigida
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          };

          uploadedDocuments.push(fileInfo);
        }

        console.log('📊 Total de documentos enviados:', uploadedDocuments.length);

        // Coletar URLs de documentos para enviar via API
        if (uploadedDocuments.length > 0) {
          const documentUrls = uploadedDocuments.map(file => file.url);
          console.log('🔗 URLs de documentos coletadas:', documentUrls);
        }
      } catch (error) {
        console.error('❌ Erro no upload de documentos:', error);
        notify('Erro ao fazer upload dos documentos NF/OS', 'error');
      } finally {
        setUploadingDocuments(false);
      }
    }

    // Atualizar URLs via API (mesmo padrão do PDF que funciona)
    if (uploadedDamages.length > 0 || uploadedDocuments.length > 0) {
      console.log('🔄 Chamando API para atualizar URLs (padrão do PDF)...');
      
      const damageUrls = uploadedDamages.map(file => file.url);
      const documentUrls = uploadedDocuments.map(file => file.url);
      
      try {
        const response = await fetch('/api/discount-orders/update-urls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            damageUrls: damageUrls.length > 0 ? damageUrls : null,
            documentUrls: documentUrls.length > 0 ? documentUrls : null,
          }),
        });

        if (!response.ok) {
          throw new Error('Erro na API');
        }

        const result = await response.json();
        console.log('✅ URLs atualizadas via API (igual ao PDF):', result);
        
        // Atualizar a lista de ordens APÓS salvar as URLs
        console.log('🔄 Atualizando lista de ordens APÓS API...');
        queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
        
      } catch (error) {
        console.error('❌ Erro ao chamar API:', error);
        notify('Arquivos enviados mas URLs não foram salvas', 'warning');
      }
    } else {
      // Se não há arquivos, atualizar lista normalmente
      console.log('🔄 Atualizando lista de ordens (sem arquivos)...');
      queryClient.invalidateQueries({ queryKey: ['discount_orders'] });
    }

    return { uploadedDamages, uploadedDocuments };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  function handleSelectColaborador(u: User) {
    setForm(f => ({
      ...f,
      target_user_id: u.id,
      nome_colaborador: u.nome,
      matricula: u.matricula ?? '',
      colaboradorBusca: u.nome + (u.matricula ? ` (${u.matricula})` : ''),
      // Buscar CPF da database se disponível, senão deixar vazio para o usuário preencher
      cpf: (u as UserWithCPF).cpf ? formatarCPF((u as UserWithCPF).cpf!) : '',
    }));
    setShowAutocomplete(false);
    
    // Limpar erro de CPF se houver
    if ((u as UserWithCPF).cpf) {
      setCpfError('');
    }
  }



  function formatarCPF(cpf: string) {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return cpf;
  }

  function formatarValor(valor: string) {
    if (!valor) return '';
    const num = Number(valor.replace(/\D/g, ''));
    if (isNaN(num) || valor === '') return '';
    return (num / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function handleFileUpload(orderId: string, file: File) {
    // Abrir modal de confirmação em vez de fazer upload direto
    setSelectedOrder(orders.find(o => o.id === orderId) || null);
    setSelectedFile(file);
    setShowUploadModal(true);
    setUploadAction(null);
    setTestemunhas({
      testemunha1_nome: '',
      testemunha1_cpf: '',
      testemunha2_nome: '',
      testemunha2_cpf: ''
    });
  }

  // Função para gerenciar upload de arquivos no modal de edição
  const handleFileUploadInEdit = async (event: React.ChangeEvent<HTMLInputElement>, type: 'damages' | 'documents') => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !editingOrder) return;

    try {
      const uploadedUrls: string[] = [];
      
      for (const file of files) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${editingOrder.id}_${type}_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `discount-orders/${editingOrder.id}/${fileName}`;

        const { error } = await supabase.storage
          .from('pse-files')
          .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('pse-files')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      // Atualizar as URLs na ordem
      const currentUrls = type === 'damages' 
        ? editingOrder.danos_evidencias_urls || []
        : editingOrder.nf_os_documentos_urls || [];
      
      const updatedUrls = [...currentUrls, ...uploadedUrls];

      // Atualizar o estado local
      setEditingOrder(prev => prev ? {
        ...prev,
        [type === 'damages' ? 'danos_evidencias_urls' : 'nf_os_documentos_urls']: updatedUrls
      } : null);

      // Salvar no banco de dados
      const { error } = await supabase
        .from('discount_orders')
        .update({
          [type === 'damages' ? 'danos_evidencias_urls' : 'nf_os_documentos_urls']: updatedUrls
        })
        .eq('id', editingOrder.id);

      if (error) throw error;

      notify(`${files.length} arquivo(s) adicionado(s) com sucesso!`, 'success');
      
      // Limpar o input
      event.target.value = '';
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      notify('Erro ao fazer upload dos arquivos', 'error');
    }
  };

  // Função para excluir anexo individual
  const handleDeleteAttachment = async (orderId: string, type: 'damages' | 'documents', index: number) => {
    if (!editingOrder) return;

    try {
      const response = await fetch('/api/discount-orders/delete-attachment', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          type,
          index
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir anexo');
      }

      const result = await response.json();

      // Atualizar o estado local
      setEditingOrder(prev => prev ? {
        ...prev,
        [type === 'damages' ? 'danos_evidencias_urls' : 'nf_os_documentos_urls']: result.updatedUrls
      } : null);

      notify('Anexo excluído com sucesso!', 'success');
      
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      notify('Erro ao excluir anexo', 'error');
    }
  };



  // Event handlers
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.autocomplete-container')) {
      setShowAutocomplete(false);
      setShowPlacaAutocomplete(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Loading states
  const isLoading = ordersLoading || usersLoading || basesLoading || veiculosLoading;

  // Calcular valores por status (usar filteredOrders para manter consistência com filtros de permissão)
  const valoresPorStatus = useMemo(() => {
    // Primeiro aplicar os filtros de permissão
    let basicFilteredArray = orders.filter(order => {
      // Permissão só para Frota
      if (hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
          !hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
        return order.criado_por_setor === 'frota';
      }
      // Permissão só para Almoxarifado 
      if (!hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
          hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
        return order.criado_por_setor === 'almoxarifado';
      }
      // Permissão para ambos - aplicar filtro manual
      return true;
    });

    // Aplicar filtro de setor apenas se o usuário tem permissão para ambos
    if (hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
        hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) {
      basicFilteredArray = basicFilteredArray.filter(order => {
        if (setorFilter === 'all') return true;
        return order.criado_por_setor === setorFilter;
      });
    }

    const pendentes = basicFilteredArray.filter(order => {
      const status = order.recusado ? 'recusada' : order.status === 'assinada' ? 'assinada' : 'pendente';
      return status === 'pendente';
    });
    
    const assinadas = basicFilteredArray.filter(order => {
      const status = order.recusado ? 'recusada' : order.status === 'assinada' ? 'assinada' : 'pendente';
      return status === 'assinada';
    });
    
    const rejeitadas = basicFilteredArray.filter(order => {
      const status = order.recusado ? 'recusada' : order.status === 'assinada' ? 'assinada' : 'pendente';
      return status === 'recusada';
    });

    return {
      pendente: {
        quantidade: pendentes.length,
        valorTotal: pendentes.reduce((sum, order) => sum + (order.valor_total || 0), 0)
      },
      assinada: {
        quantidade: assinadas.length,
        valorTotal: assinadas.reduce((sum, order) => sum + (order.valor_total || 0), 0)
      },
      rejeitada: {
        quantidade: rejeitadas.length,
        valorTotal: rejeitadas.reduce((sum, order) => sum + (order.valor_total || 0), 0)
      }
    };
  }, [orders, setorFilter, hasPermission]);

  // Função robusta para formatar datas
  function formatarDataBR(data: string | Date | undefined): string {
    if (!data || data === '-' || data === 'Invalid date') return 'Sem data';
    try {
      // Extrai só a parte da data (YYYY-MM-DD)
      const match = typeof data === 'string' && data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        // Monta manualmente no formato brasileiro
        return `${match[3]}/${match[2]}/${match[1]}`;
      }
      // fallback para outros formatos
      const d = new Date(data);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR');
      }
      return 'Sem data';
    } catch {
      return 'Sem data';
    }
  }

  // Função para converter data para formato YYYY-MM-DD (para input type="date")
  function converterParaFormatoInput(data: string | Date | undefined): string {
    if (!data) return new Date().toISOString().slice(0, 10);
    try {
      // Se já está no formato YYYY-MM-DD, extrai apenas isso
      const match = typeof data === 'string' && data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      // Converte de outros formatos
      const d = new Date(data);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return new Date().toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  return (
    <div role="main" className="max-w-screen-2xl mx-auto py-10 px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold">Ordens de Desconto da Frota</h1>
        <div className="flex gap-2">
          <button
            onClick={() => refetchOrders()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
            disabled={ordersLoading}
          >
            {ordersLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
            onClick={handleExportExcel}
            disabled={ordersLoading || filteredOrders.length === 0}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Exportar Excel
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition"
            onClick={() => setShowBulkGenerationModal(true)}
            disabled={ordersLoading}
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Download Massa
          </button>
          <button
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            onClick={() => setShowModal(true)}
          >
            + Nova Ordem
          </button>
        </div>
      </div>

      {/* Cards de Valores por Status - Filtros Clicáveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card Pendentes */}
        <div 
          className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'pendente' 
              ? 'ring-2 ring-yellow-500 bg-yellow-50' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => {
            setStatusFilter(statusFilter === 'pendente' ? 'all' : 'pendente');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${
                  statusFilter === 'pendente' ? 'bg-yellow-100' : 'bg-yellow-50'
                }`}>
                  <ClockIcon className={`h-6 w-6 ${
                    statusFilter === 'pendente' ? 'text-yellow-700' : 'text-yellow-600'
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold ${
                  statusFilter === 'pendente' ? 'text-yellow-800' : 'text-gray-900'
                }`}>
                  Pendentes
                  {statusFilter === 'pendente' && <span className="ml-2 text-sm">(ativo)</span>}
                </h3>
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                statusFilter === 'pendente' ? 'text-yellow-800' : 'text-yellow-700'
              }`}>
                {valoresPorStatus.pendente.quantidade}
              </div>
              <div className="text-sm text-gray-600">
                {valoresPorStatus.pendente.quantidade === 1 ? 'ordem' : 'ordens'}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold ${
                statusFilter === 'pendente' ? 'text-yellow-800' : 'text-yellow-700'
              }`}>
                R$ {valoresPorStatus.pendente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500">valor total</div>
            </div>
          </div>
        </div>

        {/* Card Assinadas */}
        <div 
          className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'assinada' 
              ? 'ring-2 ring-green-500 bg-green-50' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => {
            setStatusFilter(statusFilter === 'assinada' ? 'all' : 'assinada');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${
                  statusFilter === 'assinada' ? 'bg-green-100' : 'bg-green-50'
                }`}>
                  <CheckCircleIcon className={`h-6 w-6 ${
                    statusFilter === 'assinada' ? 'text-green-700' : 'text-green-600'
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold ${
                  statusFilter === 'assinada' ? 'text-green-800' : 'text-gray-900'
                }`}>
                  Assinadas
                  {statusFilter === 'assinada' && <span className="ml-2 text-sm">(ativo)</span>}
                </h3>
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                statusFilter === 'assinada' ? 'text-green-800' : 'text-green-700'
              }`}>
                {valoresPorStatus.assinada.quantidade}
              </div>
              <div className="text-sm text-gray-600">
                {valoresPorStatus.assinada.quantidade === 1 ? 'ordem' : 'ordens'}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold ${
                statusFilter === 'assinada' ? 'text-green-800' : 'text-green-700'
              }`}>
                R$ {valoresPorStatus.assinada.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500">valor total</div>
            </div>
          </div>
        </div>

        {/* Card Rejeitadas */}
        <div 
          className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'recusada' 
              ? 'ring-2 ring-red-500 bg-red-50' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => {
            setStatusFilter(statusFilter === 'recusada' ? 'all' : 'recusada');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${
                  statusFilter === 'recusada' ? 'bg-red-100' : 'bg-red-50'
                }`}>
                  <XCircleIcon className={`h-6 w-6 ${
                    statusFilter === 'recusada' ? 'text-red-700' : 'text-red-600'
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold ${
                  statusFilter === 'recusada' ? 'text-red-800' : 'text-gray-900'
                }`}>
                  Rejeitadas
                  {statusFilter === 'recusada' && <span className="ml-2 text-sm">(ativo)</span>}
                </h3>
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                statusFilter === 'recusada' ? 'text-red-800' : 'text-red-700'
              }`}>
                {valoresPorStatus.rejeitada.quantidade}
              </div>
              <div className="text-sm text-gray-600">
                {valoresPorStatus.rejeitada.quantidade === 1 ? 'ordem' : 'ordens'}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold ${
                statusFilter === 'recusada' ? 'text-red-800' : 'text-red-700'
              }`}>
                R$ {valoresPorStatus.rejeitada.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500">valor total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar por colaborador, criador, placa, valor ou descrição..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filtro de Setor - só exibe quando usuário tem permissão para ambos */}
          {(hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) && 
            hasPermission(PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES)) && (
            <select
              className="px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={setorFilter}
              onChange={e => { setSetorFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Todos os setores</option>
              <option value="frota">Frota</option>
              <option value="almoxarifado">Almoxarifado</option>
            </select>
          )}
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            {statusOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={baseFilter}
            onChange={e => { setBaseFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todas as bases</option>
            {bases.map(base => (
              <option key={base.id} value={base.id}>{base.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Data</th>
              <th className="px-4 py-2 text-left">Colaborador</th>
              <th className="px-4 py-2 text-left">Criador</th>
              <th className="px-4 py-2 text-left">Base</th>
              <th className="px-4 py-2 text-left">Placa</th>
              <th className="px-4 py-2 text-left">Valor</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Anexos</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={9} className="text-center text-gray-400 py-6">Carregando...</td></tr>
            ) : ordersError ? (
              <tr><td colSpan={9} className="text-center text-red-400 py-6">Erro ao carregar dados</td></tr>
            ) : paginatedOrders.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-gray-400 py-6">Nenhuma ordem encontrada</td></tr>
            ) : paginatedOrders.map((order, idx) => {
              const status = order.recusado ? 'recusada' : order.data_assinatura ? 'assinada' : 'pendente';
              return (
                <Fragment key={order.id}>
                <tr
                  className={`cursor-pointer hover:bg-blue-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  onClick={() => setExpandedOrderId(prev => prev === order.id ? null : order.id)}
                >
                  <td className="px-4 py-1.5 whitespace-nowrap text-center">{
                    order.data_geracao && order.data_geracao !== '-' && order.data_geracao !== 'Invalid date'
                      ? formatarDataBR(order.data_geracao)
                      : 'Sem data'
                  }</td>
                  <td className="px-4 py-1.5 font-medium whitespace-nowrap">
                    {userInfoMap[order.target_user_id] ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{userInfoMap[order.target_user_id].nome}</span>
                        {userInfoMap[order.target_user_id].matricula && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">
                            {userInfoMap[order.target_user_id].matricula}
                          </span>
                        )}
                        {userInfoMap[order.target_user_id].status === 'demitido' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
                            Demitido
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    {userInfoMap[order.created_by] ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{userInfoMap[order.created_by].nome}</span>
                        {userInfoMap[order.created_by].matricula && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">
                            {userInfoMap[order.created_by].matricula}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap text-center">
                    {order.base_id && baseMap[order.base_id] ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                        {baseMap[order.base_id]}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap text-center">{order.placa || '-'}</td>
                  <td className="px-4 py-1.5 whitespace-nowrap text-center">R$ {order.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="pl-4 pr-1 py-1.5 whitespace-nowrap text-center">
                    {status === 'recusada' ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">Recusada</span>
                    ) : status === 'assinada' ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-700">Assinada</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-700">Pendente</span>
                    )}
                  </td>
                  <td className="pl-4 pr-1 py-1.5 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">D: {order.danos_evidencias_urls?.length || 0}</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">NF/OS: {order.nf_os_documentos_urls?.length || 0}</span>
                    </div>
                  </td>
                  <td className="pl-0 pr-2 py-1 whitespace-nowrap text-center text-[10px] text-gray-400">
                    {expandedOrderId === order.id ? '▲' : '▼'}
                  </td>
                </tr>
                {expandedOrderId === order.id && (
                  <tr>
                    <td colSpan={9} className="px-4 py-3 bg-blue-50/40">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                        <div><span className="text-gray-500">Descrição:</span> <span className="text-gray-900">{order.descricao || '-'}</span></div>
                        {order.auto_infracao && <div><span className="text-gray-500">Auto de Infração:</span> <span className="text-gray-900">{order.auto_infracao}</span></div>}
                        <div><span className="text-gray-500">Placa:</span> <span className="text-gray-900">{order.placa || '-'}</span></div>
                        <div><span className="text-gray-500">Documento:</span> <span className="text-gray-900">{order.tipo_documento || '-'} {order.numero_documento ? `#${order.numero_documento}` : ''}</span></div>
                        <div><span className="text-gray-500">Valor doc:</span> <span className="text-gray-900">{order.valor_documento ? `R$ ${order.valor_documento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</span></div>
                        <div><span className="text-gray-500">Data doc:</span> <span className="text-gray-900">{order.data_documento || '-'}</span></div>
                        <div><span className="text-gray-500">Criado por:</span> <span className="text-gray-900">{userMap[order.created_by] || '-'}</span></div>
                        {order.observacoes_danos && <div className="col-span-2"><span className="text-gray-500">Obs. danos:</span> <span className="text-gray-900">{order.observacoes_danos}</span></div>}
                        {order.observacoes_documentos && <div className="col-span-2"><span className="text-gray-500">Obs. docs:</span> <span className="text-gray-900">{order.observacoes_documentos}</span></div>}
                      </div>

                      {/* Anexos inline */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        {(order.danos_evidencias_urls && order.danos_evidencias_urls.length > 0) && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Danos:</span>
                            {order.danos_evidencias_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-white text-blue-700 hover:bg-blue-50">
                                <PhotoIcon className="h-3 w-3" /> {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                        {(order.nf_os_documentos_urls && order.nf_os_documentos_urls.length > 0) && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">NF/OS:</span>
                            {order.nf_os_documentos_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-white text-blue-700 hover:bg-blue-50">
                                <PaperClipIcon className="h-3 w-3" /> {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recusada info */}
                      {order.recusado && (
                        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs">
                          <span className="font-semibold text-red-700">Recusada</span>
                          <span className="text-gray-600 ml-3">T1: {order.testemunha1_nome || '-'} ({order.testemunha1_cpf || '-'})</span>
                          <span className="text-gray-600 ml-3">T2: {order.testemunha2_nome || '-'} ({order.testemunha2_cpf || '-'})</span>
                        </div>
                      )}

                      {/* Ações */}
                          {status === 'pendente' && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingOrder(order);
                                  const u = users.find(uu => uu.id === order.target_user_id);
                                  const nome = u?.nome || userMap[order.target_user_id] || '';
                                  const matricula = u?.matricula || '';
                                  const colaboradorBusca = nome + (matricula ? ` (${matricula})` : '');
                                  setForm({
                                    colaboradorBusca,
                                    target_user_id: order.target_user_id,
                                    nome_colaborador: nome,
                                    matricula,
                                    cpf: order.cpf || '',
                                    data: converterParaFormatoInput(order.data_geracao),
                                    base_id: order.base_id || '',
                                    valor_total: (order.valor_total * 100).toString(),
                                    parcelas: order.parcelas || 1,
                                    valor_parcela: order.valor_parcela ? (order.valor_parcela * 100).toString() : '',
                                    placa: order.placa || '',
                                    descricao: order.descricao || '',
                                    auto_infracao: order.auto_infracao || '',
                                    documentos: order.documentos || [],
                                    outros_documentos: order.outros_documentos || '',
                                  });
                                  setDocumentInfo({
                                    tipo_documento: order.tipo_documento || 'nf',
                                    numero_documento: order.numero_documento || '',
                                    valor_documento: order.valor_documento ? (order.valor_documento * 100).toString() : '',
                                    data_documento: converterParaFormatoInput(order.data_documento),
                                    observacoes_danos: order.observacoes_danos || '',
                                    observacoes_documentos: order.observacoes_documentos || '',
                                  });
                                  setShowEditModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors"
                              >
                                <PencilIcon className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOrderToDelete(order); setShowDeleteModal(true); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 transition-colors"
                              >
                                <TrashIcon className="h-3.5 w-3.5" /> Excluir
                              </button>
                              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 cursor-pointer transition-colors">
                                <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Upload Assinado
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 10 * 1024 * 1024) { notify('Arquivo muito grande. Máximo 10MB.', 'error'); return; }
                                      if (file.type !== 'application/pdf') { notify('Apenas arquivos PDF são aceitos.', 'error'); return; }
                                      handleFileUpload(order.id, file);
                                    }
                                  }}
                                  disabled={uploadingFile === order.id}
                                />
                              </label>
                              {order.arquivo_assinado_url && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const res = await fetch(order.arquivo_assinado_url!);
                                      const contentType = res.headers.get('content-type') || '';
                                      const blob = await res.blob();
                                      const blobType = contentType.includes('pdf') ? 'application/pdf' : 'text/html';
                                      const finalBlob = new Blob([blob], { type: blobType });
                                      const url = URL.createObjectURL(finalBlob);
                                      window.open(url, '_blank');
                                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                                    } catch (err) { console.error('Erro ao abrir modelo:', err); }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 text-green-700 text-xs font-medium hover:bg-green-50 transition-colors"
                                >
                                  <DocumentTextIcon className="h-3.5 w-3.5" /> Ver Modelo
                                </button>
                              )}
                            </div>
                          )}
                          {(status === 'assinada' || status === 'recusada') && order.arquivo_assinado_url && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                              <a
                                href={order.arquivo_assinado_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 transition-colors"
                              >
                                <DocumentTextIcon className="h-3.5 w-3.5" /> Ver Documento
                              </a>
                            </div>
                          )}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages} • {filteredOrders.length} ordens encontradas
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >Anterior</button>
            <button
              className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >Próxima</button>
          </div>
        </div>
      )}

      {/* Modal de criação */}
      {showModal && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2 pt-6 pb-10 px-8 relative border border-blue-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl" onClick={() => setShowModal(false)} aria-label="Fechar modal">×</button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-blue-50 rounded-full w-10 h-10">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Nova Ordem de Desconto</h3>
            </div>

            <form className="flex flex-col gap-4" onSubmit={e => {
              e.preventDefault();
              if (!form.target_user_id) {
                notify('Selecione um colaborador', 'error');
                return;
              }
              if (!form.cpf) {
                notify('Preencha o CPF', 'error');
                return;
              }
              if (!form.matricula) {
                notify('Matrícula é obrigatória', 'error');
                return;
              }
              if (!form.data) {
                notify('Selecione uma data', 'error');
                return;
              }
              if (!form.valor_total) {
                notify('Preencha o valor total', 'error');
                return;
              }
              if (!form.parcelas) {
                notify('Defina o número de parcelas', 'error');
                return;
              }
              if (!form.descricao) {
                notify('Preencha a descrição', 'error');
                return;
              }
              if (!validarCPF(form.cpf)) {
                setCpfError('CPF inválido');
                return;
              }
              setCpfError('');

              console.log('🚀 INICIANDO SUBMIT...');
              console.log('📁 Arquivos de danos:', damageFiles.length);
              console.log('📄 Arquivos de documentos:', documentFiles.length);
              console.log('📋 Dados do formulário:', {
                target_user_id: form.target_user_id,
                cpf: form.cpf,
                valor_total: form.valor_total,
                parcelas: form.parcelas,
                tipo_documento: documentInfo.tipo_documento,
                numero_documento: documentInfo.numero_documento,
                valor_documento: documentInfo.valor_documento,
                data_documento: documentInfo.data_documento,
                observacoes_danos: documentInfo.observacoes_danos,
                observacoes_documentos: documentInfo.observacoes_documentos
              });

              createMutation.mutate({
                target_user_id: form.target_user_id,
                cpf: form.cpf,
                valor_total: Number(form.valor_total),
                parcelas: form.parcelas,
                valor_parcela: form.parcelas > 1 ? Number(form.valor_total) / Number(form.parcelas) : Number(form.valor_total),
                placa: form.placa,
                descricao: form.descricao,
                auto_infracao: form.documentos.includes('Multa de Trânsito') ? form.auto_infracao || undefined : undefined,
                documentos: form.documentos,
                outros_documentos: form.outros_documentos,
                base_id: form.base_id,
                created_by: currentUser?.id || '',
                recusado: false,
                data: form.data,
                
                // ADICIONAR OS NOVOS CAMPOS:
                tipo_documento: documentInfo.tipo_documento,
                numero_documento: documentInfo.numero_documento || undefined,
                valor_documento: documentInfo.valor_documento ? parseFloat(documentInfo.valor_documento.replace(/\D/g, '')) / 100 : undefined,
                data_documento: documentInfo.data_documento || undefined,
                observacoes_danos: documentInfo.observacoes_danos || undefined,
                observacoes_documentos: documentInfo.observacoes_documentos || undefined,
                
                // Inicializar arrays vazios para as URLs dos anexos
                danos_evidencias_urls: [],
                nf_os_documentos_urls: []
              });
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Colaborador</label>
                  <div className="relative autocomplete-container">
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      value={form.colaboradorBusca}
                      onChange={e => {
                        setForm(f => ({ ...f, colaboradorBusca: e.target.value, target_user_id: '', nome_colaborador: '', matricula: '' }));
                        setShowAutocomplete(true);
                      }}
                      placeholder="Buscar por nome ou matrícula..."
                      autoComplete="off"
                      required
                      onFocus={() => setShowAutocomplete(true)}
                    />
                    {showAutocomplete && autocompleteResults.length > 0 && (
                      <ul className="absolute left-0 z-20 bg-white border border-gray-200 rounded-lg mt-1 max-w-md w-full min-w-[200px] max-h-48 overflow-y-auto shadow-lg">
                        {autocompleteResults.map(u => (
                          <li
                            key={u.id}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => handleSelectColaborador(u)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{u.nome}</span>
                                {u.matricula && <span className="text-gray-500 ml-1">({u.matricula})</span>}
                              </div>
                              {u.status === 'demitido' && (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                  Demitido
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">CPF</label>
                  <input
                    type="text"
                    className={`rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${cpfError ? 'border-red-500' : ''}`}
                    value={form.cpf}
                    onChange={e => {
                      const formattedCPF = formatarCPF(e.target.value);
                      setForm(f => ({ ...f, cpf: formattedCPF }));
                      if (formattedCPF.replace(/\D/g, '').length === 11) {
                        if (!validarCPF(formattedCPF)) {
                          setCpfError('CPF inválido');
                        } else {
                          setCpfError('');
                        }
                      } else {
                        setCpfError('');
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value && e.target.value.replace(/\D/g, '').length === 11) {
                        if (!validarCPF(e.target.value)) {
                          setCpfError('CPF inválido');
                        } else {
                          setCpfError('');
                        }
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                  {cpfError && <span className="text-xs text-red-500 mt-1">{cpfError}</span>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Matrícula</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.matricula}
                    readOnly
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Data</label>
                  <input
                    type="date"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Base</label>
                  <select
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.base_id}
                    onChange={e => setForm(f => ({ ...f, base_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione uma base</option>
                    {bases.map((base: Base) => (
                      <option key={base.id} value={base.id}>
                        {base.nome} {base.cidade && base.estado ? `(${base.cidade} - ${base.estado})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Valor Total</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formatarValor(form.valor_total)}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setForm(f => ({ ...f, valor_total: raw }));
                    }}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Parcelas</label>
                  <input
                    type="number"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.parcelas}
                    onChange={e => setForm(f => ({ ...f, parcelas: Number(e.target.value) }))}
                    min={1}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Placa do Veículo</label>
                  <div className="relative autocomplete-container">
                    <input
                      ref={placaInputRef}
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.placa}
                      onChange={e => {
                        setPlacaAutocomplete(e.target.value);
                        setForm(f => ({ ...f, placa: e.target.value }));
                        setShowPlacaAutocomplete(true);
                      }}
                      onFocus={() => setShowPlacaAutocomplete(true)}
                      placeholder="Digite ou selecione a placa (opcional)"
                      autoComplete="off"
                    />
                    {showPlacaAutocomplete && placaOptions.length > 0 && (
                      <ul className="absolute left-0 z-20 bg-white border border-gray-200 rounded-lg mt-1 max-w-md w-full min-w-[200px] max-h-48 overflow-y-auto shadow-lg">
                        {placaOptions.map((p: string) => (
                          <li
                            key={p}
                            className="px-3 py-1 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => {
                              setForm(f => ({ ...f, placa: p }));
                              setPlacaAutocomplete('');
                              setShowPlacaAutocomplete(false);
                            }}
                          >{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 col-span-2">
                  <label className="text-xs font-semibold text-gray-700">Documentos Comprobatórios</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 items-center w-full">
                    {[
                      { label: 'Multa', value: 'Multa de Trânsito' },
                      { label: 'B.O. Policial', value: 'Boletim de Ocorrência Policial' },
                      { label: 'Relatório Seg.', value: 'Relatório do Setor de Segurança' },
                      { label: 'Laudo', value: 'Laudo Pericial' },
                      { label: 'NF', value: 'NF' },
                      { label: 'RPS', value: 'RPS' },
                      { label: 'Outros', value: 'Outros' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-xs whitespace-nowrap min-w-[110px] truncate" title={opt.value}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={form.documentos.includes(opt.value)}
                          onChange={e => {
                            if (e.target.checked) {
                              setForm(f => ({ ...f, documentos: [...f.documentos, opt.value] }));
                            } else {
                              setForm(f => ({ ...f, documentos: f.documentos.filter(d => d !== opt.value) }));
                            }
                          }}
                        />
                        <span className="text-gray-700 truncate">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {form.documentos.includes('Outros') && (
                    <input
                      type="text"
                      className="mt-1 rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Descreva outros documentos..."
                      value={form.outros_documentos}
                      onChange={e => setForm(f => ({ ...f, outros_documentos: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-700">Descrição</label>
                <textarea
                  className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o motivo do desconto..."
                  required
                />
              </div>

              {/* Auto de Infração - visível apenas quando Multa de Trânsito está selecionada */}
              {form.documentos.includes('Multa de Trânsito') && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Auto de Infração</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.auto_infracao}
                    onChange={e => setForm(f => ({ ...f, auto_infracao: e.target.value }))}
                    placeholder="Número do auto de infração..."
                  />
                </div>
              )}

              {/* Seção de Informações do Documento NF/OS */}
              <div className="border-t pt-4 mt-2">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <PaperClipIcon className="h-4 w-4" />
                  Informações do Documento (Opcional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Tipo de Documento</label>
                    <select
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.tipo_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, tipo_documento: e.target.value as 'nf' | 'os' | 'ambos' }))}
                    >
                      <option value="nf">Nota Fiscal</option>
                      <option value="os">Ordem de Serviço</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Número do Documento</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.numero_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, numero_documento: e.target.value }))}
                      placeholder="Ex: NF-001234 ou OS-005678"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Valor do Documento</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formatarValor(documentInfo.valor_documento)}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setDocumentInfo(prev => ({ ...prev, valor_documento: raw }));
                      }}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Data do Documento</label>
                    <input
                      type="date"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.data_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, data_documento: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Seção de Upload de Evidências de Danos */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <PhotoIcon className="h-4 w-4" />
                  Evidências de Danos ({damageFiles.length}/10)
                </h4>
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="text-center">
                      <PhotoIcon className="mx-auto h-8 w-8 text-gray-400" />
                      <div className="mt-2">
                        <label htmlFor="damage-files" className="cursor-pointer">
                          <span className="text-sm font-medium text-gray-900">
                            {uploadingDamages ? 'Enviando...' : 'Clique para selecionar fotos/documentos de danos'}
                          </span>
                          <span className="block text-xs text-gray-500 mt-1">
                            JPG, PNG, WebP, PDF até 50MB (máx. 10 arquivos)
                          </span>
                        </label>
                        <input
                          id="damage-files"
                          type="file"
                          className="sr-only"
                          multiple
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={e => e.target.files && handleDamageFileSelect(e.target.files)}
                          disabled={uploadingDamages || damageFiles.length >= 10}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {damageFiles.length > 0 && (
                    <div className="space-y-2">
                      {damageFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                          <div className="flex items-center space-x-2">
                            <PhotoIcon className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDamageFile(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Observações sobre os Danos</label>
                    <textarea
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      value={documentInfo.observacoes_danos}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, observacoes_danos: e.target.value }))}
                      placeholder="Descreva os danos evidenciados..."
                    />
                  </div>
                </div>
              </div>

              {/* Seção de Upload de Documentos NF/OS */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <PaperClipIcon className="h-4 w-4" />
                  Documentos NF/OS ({documentFiles.length}/5)
                </h4>
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="text-center">
                      <PaperClipIcon className="mx-auto h-8 w-8 text-gray-400" />
                      <div className="mt-2">
                        <label htmlFor="document-files" className="cursor-pointer">
                          <span className="text-sm font-medium text-gray-900">
                            {uploadingDocuments ? 'Enviando...' : 'Clique para selecionar documentos NF/OS'}
                          </span>
                          <span className="block text-xs text-gray-500 mt-1">
                            JPG, PNG, WebP, PDF, DOC, DOCX até 50MB (máx. 5 arquivos)
                          </span>
                        </label>
                        <input
                          id="document-files"
                          type="file"
                          className="sr-only"
                          multiple
                          accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={e => e.target.files && handleDocumentFileSelect(e.target.files)}
                          disabled={uploadingDocuments || documentFiles.length >= 5}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {documentFiles.length > 0 && (
                    <div className="space-y-2">
                      {documentFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                          <div className="flex items-center space-x-2">
                            <PaperClipIcon className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocumentFile(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Observações sobre os Documentos</label>
                    <textarea
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      value={documentInfo.observacoes_documentos}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, observacoes_documentos: e.target.value }))}
                      placeholder="Informações adicionais sobre os documentos..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-6 pt-2">
                <button
                  type="button"
                  className="px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  onClick={() => setShowModal(false)}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Salvando...' : 'Criar Ordem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmação de upload */}
      {showUploadModal && selectedOrder && selectedFile && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2 pt-6 pb-10 px-8 relative border border-blue-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedOrder(null);
                setSelectedFile(null);
                setUploadAction(null);
              }}
              aria-label="Fechar modal"
            >×</button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-blue-50 rounded-full w-10 h-10">
                <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Confirmar Upload</h3>
              <p className="text-sm text-gray-600 text-center">Arquivo: {selectedFile.name}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Detalhes da Ordem</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Colaborador:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{userInfoMap[selectedOrder.target_user_id]?.nome || '-'}</span>
                    {userInfoMap[selectedOrder.target_user_id]?.status === 'demitido' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        Demitido
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Valor:</span>
                  <p className="font-medium">R$ {selectedOrder.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span className="text-gray-600">Descrição:</span>
                  <p className="font-medium">{selectedOrder.descricao}</p>
                </div>
                {selectedOrder.auto_infracao && (
                  <div>
                    <span className="text-gray-600">Auto de Infração:</span>
                    <p className="font-medium">{selectedOrder.auto_infracao}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Placa:</span>
                  <p className="font-medium">{selectedOrder.placa || '-'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-3 block">O que aconteceu com esta ordem?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadAction"
                      value="assinado"
                      checked={uploadAction === 'assinado'}
                      onChange={(e) => setUploadAction(e.target.value as 'assinado' | 'recusado')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Foi assinada pelo colaborador</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadAction"
                      value="recusado"
                      checked={uploadAction === 'recusado'}
                      onChange={(e) => setUploadAction(e.target.value as 'assinado' | 'recusado')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm">Foi recusada pelo colaborador</span>
                  </label>
                </div>
              </div>

              {/* Formulário de testemunhas - só aparece se foi recusado */}
              {uploadAction === 'recusado' && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h4 className="font-semibold text-red-900 mb-3">Informações das Testemunhas</h4>
                  <p className="text-sm text-red-700 mb-4">Para recusas, é necessário informar duas testemunhas que presenciaram a recusa.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TestemunhaAutocomplete
                      value={testemunhas.testemunha1_nome}
                      onChange={(value) => setTestemunhas(t => ({ ...t, testemunha1_nome: value }))}
                      cpfValue={testemunhas.testemunha1_cpf}
                      onCpfChange={(cpf) => setTestemunhas(t => ({ ...t, testemunha1_cpf: cpf }))}
                      label="1ª Testemunha"
                      placeholder="Digite para buscar testemunha..."
                      required
                    />
                    <TestemunhaAutocomplete
                      value={testemunhas.testemunha2_nome}
                      onChange={(value) => setTestemunhas(t => ({ ...t, testemunha2_nome: value }))}
                      cpfValue={testemunhas.testemunha2_cpf}
                      onCpfChange={(cpf) => setTestemunhas(t => ({ ...t, testemunha2_cpf: cpf }))}
                      label="2ª Testemunha"
                      placeholder="Digite para buscar testemunha..."
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-6 pt-2">
              <button
                type="button"
                className="px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedOrder(null);
                  setSelectedFile(null);
                  setUploadAction(null);
                }}
                disabled={uploadFileMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`px-6 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 disabled:opacity-50 ${uploadAction === 'assinado'
                  ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                  : uploadAction === 'recusado'
                    ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                onClick={() => {
                  if (!uploadAction) {
                    notify('Selecione se foi assinado ou recusado', 'error');
                    return;
                  }

                  if (uploadAction === 'recusado') {
                    // Validações para recusa
                    if (!testemunhas.testemunha1_nome || !testemunhas.testemunha1_cpf) {
                      notify('Preencha os dados da 1ª testemunha', 'error');
                      return;
                    }
                    if (!testemunhas.testemunha2_nome || !testemunhas.testemunha2_cpf) {
                      notify('Preencha os dados da 2ª testemunha', 'error');
                      return;
                    }
                    if (!validarCPF(testemunhas.testemunha1_cpf)) {
                      notify('CPF da 1ª testemunha é inválido', 'error');
                      return;
                    }
                    if (!validarCPF(testemunhas.testemunha2_cpf)) {
                      notify('CPF da 2ª testemunha é inválido', 'error');
                      return;
                    }
                  }

                  setUploadingFile(selectedOrder.id);
                  uploadFileMutation.mutate({
                    orderId: selectedOrder.id,
                    file: selectedFile,
                    action: uploadAction,
                    testemunhas: uploadAction === 'recusado' ? testemunhas : undefined
                  });
                }}
                disabled={uploadFileMutation.isPending || !uploadAction}
              >
                {uploadFileMutation.isPending ? 'Enviando...' :
                  uploadAction === 'assinado' ? 'Confirmar Assinatura' :
                    uploadAction === 'recusado' ? 'Confirmar Recusa' :
                      'Selecione uma opção'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de anexos */}
      {showFilesModal && selectedOrderForFiles && (
        <DiscountOrderFilesModal
          isOpen={showFilesModal}
          onClose={() => {
            setShowFilesModal(false);
            setSelectedOrderForFiles(null);
          }}
          orderId={selectedOrderForFiles.id}
          orderNumber={selectedOrderForFiles.id}
        />
      )}

      {/* Modal de Edição */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-2 pt-6 pb-10 px-8 relative border border-blue-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => {
                setShowEditModal(false);
                setEditingOrder(null);
                resetFormData();
              }}
              aria-label="Fechar modal"
            >×</button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-blue-50 rounded-full w-10 h-10">
                <PencilIcon className="h-5 w-5 text-blue-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Editar Ordem de Desconto</h3>
              <p className="text-sm text-gray-600 text-center">ID: {editingOrder.id}</p>
            </div>

            {/* Formulário de edição - reutiliza o mesmo formulário */}
            <form onSubmit={e => {
              e.preventDefault();
              editMutation.mutate({
                target_user_id: form.target_user_id,
                cpf: form.cpf,
                valor_total: Number(form.valor_total) / 100,
                parcelas: form.parcelas,
                valor_parcela: form.parcelas > 1 ? Number(form.valor_total) / 100 / Number(form.parcelas) : Number(form.valor_total) / 100,
                placa: form.placa,
                descricao: form.descricao,
                auto_infracao: form.documentos.includes('Multa de Trânsito') ? form.auto_infracao || undefined : undefined,
                documentos: form.documentos,
                outros_documentos: form.outros_documentos,
                data_geracao: form.data,
                tipo_documento: documentInfo.tipo_documento,
                numero_documento: documentInfo.numero_documento || undefined,
                valor_documento: documentInfo.valor_documento ? parseFloat(documentInfo.valor_documento.replace(/\D/g, '')) / 100 : undefined,
                data_documento: documentInfo.data_documento || undefined,
                observacoes_danos: documentInfo.observacoes_danos || undefined,
                observacoes_documentos: documentInfo.observacoes_documentos || undefined,
              });
            }}>
              {/* Reutilizar o mesmo formulário do modal de criação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {/* Colaborador */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Colaborador</label>
                  <div className="relative autocomplete-container">
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      value={form.colaboradorBusca}
                      onChange={e => {
                        setForm(f => ({ ...f, colaboradorBusca: e.target.value, target_user_id: '', nome_colaborador: '', matricula: '' }));
                        setShowAutocomplete(true);
                      }}
                      placeholder="Buscar por nome ou matrícula..."
                      autoComplete="off"
                      required
                      onFocus={() => setShowAutocomplete(true)}
                    />
                    {showAutocomplete && autocompleteResults.length > 0 && (
                      <ul className="absolute left-0 z-20 bg-white border border-gray-200 rounded-lg mt-1 max-w-md w-full min-w-[200px] max-h-48 overflow-y-auto shadow-lg">
                        {autocompleteResults.map(u => (
                          <li
                            key={u.id}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => handleSelectColaborador(u)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{u.nome}</span>
                                {u.matricula && <span className="text-gray-500 ml-1">({u.matricula})</span>}
                              </div>
                              {u.status === 'demitido' && (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                  Demitido
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* CPF */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">CPF</label>
                  <input
                    type="text"
                    className={`rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${cpfError ? 'border-red-500' : ''}`}
                    value={form.cpf}
                    onChange={e => {
                      const formattedCPF = formatarCPF(e.target.value);
                      setForm(f => ({ ...f, cpf: formattedCPF }));
                      if (formattedCPF.replace(/\D/g, '').length === 11) {
                        if (!validarCPF(formattedCPF)) {
                          setCpfError('CPF inválido');
                        } else {
                          setCpfError('');
                        }
                      } else {
                        setCpfError('');
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                  {cpfError && <span className="text-xs text-red-500 mt-1">{cpfError}</span>}
                </div>

                {/* Matrícula */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Matrícula</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.matricula}
                    readOnly
                  />
                </div>

                {/* Data */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Data</label>
                  <input
                    type="date"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    required
                  />
                </div>

                {/* Base */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Base</label>
                  <select
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.base_id}
                    onChange={e => setForm(f => ({ ...f, base_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione uma base</option>
                    {bases.map((base: Base) => (
                      <option key={base.id} value={base.id}>{base.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Valor Total */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Valor Total</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.valor_total}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '');
                      setForm(f => ({ ...f, valor_total: value }));
                    }}
                    placeholder="0,00"
                    required
                  />
                </div>

                {/* Parcelas */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.parcelas}
                    onChange={e => setForm(f => ({ ...f, parcelas: Number(e.target.value) }))}
                    required
                  />
                </div>

                {/* Placa */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-700">Placa (opcional)</label>
                  <div className="relative">
                    <input
                      ref={placaInputRef}
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      value={form.placa}
                      onChange={e => {
                        const value = e.target.value.toUpperCase();
                        setForm(f => ({ ...f, placa: value }));
                        if (value.length >= 2) {
                          setPlacaAutocomplete(value);
                          setShowPlacaAutocomplete(true);
                        } else {
                          setShowPlacaAutocomplete(false);
                        }
                      }}
                      placeholder="ABC1234"
                      maxLength={7}
                      onFocus={() => {
                        if (form.placa.length >= 2) {
                          setShowPlacaAutocomplete(true);
                        }
                      }}
                    />
                    {showPlacaAutocomplete && placas.length > 0 && (
                      <ul className="absolute left-0 z-20 bg-white border border-gray-200 rounded-lg mt-1 max-w-md w-full min-w-[200px] max-h-48 overflow-y-auto shadow-lg">
                        {placas.filter(placa => placa.toLowerCase().includes(form.placa.toLowerCase())).map((placa, index) => (
                          <li
                            key={index}
                            className="px-3 py-1 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => {
                              setForm(f => ({ ...f, placa }));
                              setShowPlacaAutocomplete(false);
                              placaInputRef.current?.blur();
                            }}
                          >
                            {placa}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">Descrição</label>
                  <textarea
                    className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Descreva o motivo do desconto..."
                    required
                  />
                </div>

                {/* Auto de Infração - visível apenas quando Multa de Trânsito está selecionada */}
                {form.documentos.includes('Multa de Trânsito') && (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Auto de Infração</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.auto_infracao}
                      onChange={e => setForm(f => ({ ...f, auto_infracao: e.target.value }))}
                      placeholder="Número do auto de infração..."
                    />
                  </div>
                )}

                {/* Documentos Comprobatórios */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">Documentos Comprobatórios</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['Multa de Trânsito', 'Boletim de Ocorrência Policial', 'Relatório do Setor de Segurança', 'Laudo Pericial', 'NF', 'RPS', 'Outros'].map(doc => (
                      <label key={doc} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.documentos.includes(doc)}
                          onChange={e => {
                            if (e.target.checked) {
                              setForm(f => ({ ...f, documentos: [...f.documentos, doc] }));
                            } else {
                              setForm(f => ({ ...f, documentos: f.documentos.filter(d => d !== doc) }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{doc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Outros Documentos */}
                {form.documentos.includes('Outros') && (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Especificar Outros Documentos</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.outros_documentos}
                      onChange={e => setForm(f => ({ ...f, outros_documentos: e.target.value }))}
                      placeholder="Descreva outros documentos..."
                    />
                  </div>
                )}
              </div>

              {/* Seção de Documentos e Danos */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Informações dos Documentos e Danos</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tipo de Documento */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Tipo de Documento</label>
                    <select
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.tipo_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, tipo_documento: e.target.value as 'nf' | 'os' | 'ambos' }))}
                    >
                      <option value="nf">NF (Nota Fiscal)</option>
                      <option value="os">OS (Ordem de Serviço)</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>

                  {/* Número do Documento */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Número do Documento</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.numero_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, numero_documento: e.target.value }))}
                      placeholder="Número da NF ou OS..."
                    />
                  </div>

                  {/* Valor do Documento */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Valor do Documento</label>
                    <input
                      type="text"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.valor_documento}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '');
                        setDocumentInfo(prev => ({ ...prev, valor_documento: value }));
                      }}
                      placeholder="0,00"
                    />
                  </div>

                  {/* Data do Documento */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700">Data do Documento</label>
                    <input
                      type="date"
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={documentInfo.data_documento}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, data_documento: e.target.value }))}
                    />
                  </div>

                  {/* Observações de Danos */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Observações sobre os Danos</label>
                    <textarea
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      value={documentInfo.observacoes_danos}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, observacoes_danos: e.target.value }))}
                      placeholder="Descreva os danos observados..."
                    />
                  </div>

                  {/* Observações dos Documentos */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Observações sobre os Documentos</label>
                    <textarea
                      className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      value={documentInfo.observacoes_documentos}
                      onChange={e => setDocumentInfo(prev => ({ ...prev, observacoes_documentos: e.target.value }))}
                      placeholder="Informações adicionais sobre os documentos..."
                    />
                  </div>
                </div>
              </div>

              {/* Seção de Anexos e Evidências */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Anexos e Evidências</h4>
                
                {/* Tabs para diferentes tipos de anexos */}
                <div className="flex border-b mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('damages')}
                    className={`px-4 py-2 font-medium text-sm ${
                      activeTab === 'damages'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Evidências de Danos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className={`px-4 py-2 font-medium text-sm ${
                      activeTab === 'documents'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Documentos NF/OS
                  </button>
                </div>

                {/* Conteúdo das tabs */}
                <div className="space-y-4">
                  {activeTab === 'damages' && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-800 mb-3">Evidências de Danos Existentes</h5>
                      {editingOrder?.danos_evidencias_urls && editingOrder.danos_evidencias_urls.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          {editingOrder.danos_evidencias_urls.map((url, index) => {
                            const fileName = url.split('/').pop() || 'Arquivo';
                            const extension = fileName.split('.').pop()?.toLowerCase();
                            const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
                            
                            return (
                              <div key={index} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex items-center space-x-2 mb-2">
                                  {isImage ? (
                                    <ImageIcon className="w-4 h-4 text-blue-500" />
                                  ) : (
                                    <FileTextIcon className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="text-xs font-medium truncate flex-1">
                                    {fileName}
                                  </span>
                                </div>
                                <div className="flex space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => window.open(url, '_blank')}
                                    className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                                  >
                                    <EyeIcon className="w-3 h-3" />
                                    <span>Ver</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = fileName;
                                      a.click();
                                    }}
                                    className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                  >
                                    <ArrowDownTrayIcon className="w-3 h-3" />
                                    <span>Baixar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(editingOrder.id, 'damages', index)}
                                    className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                  >
                                    <TrashIcon className="w-3 h-3" />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg mb-4">
                          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">Nenhuma evidência de dano anexada</p>
                        </div>
                      )}
                      
                      {/* Upload de novas evidências */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <div className="text-center">
                          <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Adicionar novas evidências de danos</p>
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => handleFileUploadInEdit(e, 'damages')}
                            className="hidden"
                            id="damage-upload"
                          />
                          <label
                            htmlFor="damage-upload"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
                          >
                            <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                            Selecionar Arquivos
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'documents' && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-800 mb-3">Documentos NF/OS Existentes</h5>
                      {editingOrder?.nf_os_documentos_urls && editingOrder.nf_os_documentos_urls.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          {editingOrder.nf_os_documentos_urls.map((url, index) => {
                            const fileName = url.split('/').pop() || 'Arquivo';
                            const extension = fileName.split('.').pop()?.toLowerCase();
                            const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
                            
                            return (
                              <div key={index} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex items-center space-x-2 mb-2">
                                  {isImage ? (
                                    <ImageIcon className="w-4 h-4 text-blue-500" />
                                  ) : (
                                    <FileTextIcon className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="text-xs font-medium truncate flex-1">
                                    {fileName}
                                  </span>
                                </div>
                                <div className="flex space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => window.open(url, '_blank')}
                                    className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                                  >
                                    <EyeIcon className="w-3 h-3" />
                                    <span>Ver</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = fileName;
                                      a.click();
                                    }}
                                    className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                  >
                                    <ArrowDownTrayIcon className="w-3 h-3" />
                                    <span>Baixar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(editingOrder.id, 'documents', index)}
                                    className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                  >
                                    <TrashIcon className="w-3 h-3" />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg mb-4">
                          <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">Nenhum documento NF/OS anexado</p>
                        </div>
                      )}
                      
                      {/* Upload de novos documentos */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <div className="text-center">
                          <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Adicionar novos documentos NF/OS</p>
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => handleFileUploadInEdit(e, 'documents')}
                            className="hidden"
                            id="document-upload"
                          />
                          <label
                            htmlFor="document-upload"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
                          >
                            <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                            Selecionar Arquivos
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center gap-6 pt-2">
                <button
                  type="button"
                  className="px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  onClick={() => {
                                      setShowEditModal(false);
                  setEditingOrder(null);
                  resetFormData();
                  }}
                  disabled={editMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? 'Salvando...' : 'Atualizar Ordem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && orderToDelete && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 pt-6 pb-10 px-8 relative border border-red-100 flex flex-col gap-6">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => {
                setShowDeleteModal(false);
                setOrderToDelete(null);
              }}
              aria-label="Fechar modal"
            >×</button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-red-50 rounded-full w-10 h-10">
                <TrashIcon className="h-5 w-5 text-red-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Confirmar Exclusão</h3>
              <p className="text-sm text-gray-600 text-center">Esta ação não pode ser desfeita</p>
            </div>

            <div className="text-center">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja excluir a ordem de desconto <strong>ID: {orderToDelete.id}</strong>?
              </p>
              <p className="text-sm text-gray-500">
                Colaborador: <strong>
                  {userInfoMap[orderToDelete.target_user_id]?.nome || 'N/A'}
                  {userInfoMap[orderToDelete.target_user_id]?.status === 'demitido' && (
                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                      Demitido
                    </span>
                  )}
                </strong><br />
                Valor: <strong>R$ {orderToDelete.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>

            <div className="flex justify-center gap-6 pt-2">
              <button
                type="button"
                className="px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => {
                  setShowDeleteModal(false);
                  setOrderToDelete(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                onClick={() => {
                  if (orderToDelete) {
                    deleteMutation.mutate(orderToDelete.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Geração em Massa */}
      {showBulkGenerationModal && (
        <BulkGenerationModal
          isOpen={showBulkGenerationModal}
          onClose={() => setShowBulkGenerationModal(false)}
          orders={orders}
          users={users}
        />
      )}
    </div>
  );
} 