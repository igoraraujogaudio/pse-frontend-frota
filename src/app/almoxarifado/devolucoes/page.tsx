'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import {
  MagnifyingGlassIcon,
  PhotoIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { User } from '@/types/index';
import { DiscountOrder } from '@/types/discountOrder';

interface DiscountOrderWithJoins extends DiscountOrder {
  target_user?: { nome: string; matricula: string };
  created_by_user?: { nome: string };
}

interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}
import { discountOrderService } from '@/services/discountOrderService';
import { retesteService } from '@/services/retesteService';
import { teamService } from '@/services/teamService';
import { validarCPF } from '@/utils/cpfUtils';
import { TestemunhaAutocomplete } from '@/components/ui/TestemunhaAutocomplete';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

// Interface removed as it's not used in the current implementation

// Removido - função integrada abaixo

export default function DevolucoesPage() {
  const { user: currentUser, userContratoIds } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useNotification();

  // Estados
  const [activeTab, setActiveTab] = useState<'processar' | 'prefixo' | 'historico' | 'ordens'>('processar');
  const [showProcessarModal, setShowProcessarModal] = useState(false);
  const [searchFuncionario, setSearchFuncionario] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [searchItem, setSearchItem] = useState('');
  const [searchRecebedor, setSearchRecebedor] = useState('');
  const [ordensStatusFilter, setOrdensStatusFilter] = useState('all');
  const [ordensCurrentPage, setOrdensCurrentPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const ordensItemsPerPage = 20;
  const [selectedItems, setSelectedItems] = useState<Array<{ id: string; item_estoque_id?: string; nome?: string; item?: { nome: string; valor_unitario?: number }; quantidade: number; valor_unitario?: number; source: string }>>([]);
  const [condicaoDevolucao, setCondicaoDevolucao] = useState<'bom' | 'danificado' | 'reteste' | 'perdido' | 'desgaste'>('bom');
  const [observacoesDevolucao, setObservacoesDevolucao] = useState('');
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);
  const [gerarOrdemDesconto, setGerarOrdemDesconto] = useState(false);
  const [valorManualOrdem, setValorManualOrdem] = useState<number>(0);
  const [valoresItens, setValoresItens] = useState<{ [key: string]: number }>({});
  const [parcelas, setParcelas] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Refs e estados de erro para seletores de base
  const baseSelectorRef = useRef<HTMLSelectElement>(null);
  const baseSelectorPrefixoRef = useRef<HTMLSelectElement>(null);
  const [baseError, setBaseError] = useState(false);
  const [basePrefixoError, setBasePrefixoError] = useState(false);

  // Estados para modals de ordens de desconto
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DiscountOrderWithJoins | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadAction, setUploadAction] = useState<'assinado' | 'recusado' | null>(null);
  const [testemunhas, setTestemunhas] = useState({
    testemunha1_nome: '',
    testemunha1_cpf: '',
    testemunha2_nome: '',
    testemunha2_cpf: ''
  });

  // Estados para edição de ordem
  const [editingOrder, setEditingOrder] = useState<DiscountOrderWithJoins | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItems, setEditingItems] = useState<Array<{ id: string; item_estoque_id?: string; nome?: string; item?: { nome: string; valor_unitario?: number }; quantidade: number; valor_unitario?: number; source: string }>>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingBase, setEditingBase] = useState<string>('');
  const [editingSearchItem, setEditingSearchItem] = useState('');
  const [editingValores, setEditingValores] = useState<{ [key: string]: number }>({});
  const [editingObservacoes, setEditingObservacoes] = useState('');
  const [editingParcelas, setEditingParcelas] = useState<number>(1);

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
    outros_documentos: '',
  });

  // Estados para devolução por prefixo
  const [selectedEquipe, setSelectedEquipe] = useState<{ id: string; nome: string; prefixo?: string; operacao: string; base_id?: string } | null>(null);
  const [searchEquipe, setSearchEquipe] = useState('');
  const [searchItemEquipe, setSearchItemEquipe] = useState('');
  const [selectedEquipeItems, setSelectedEquipeItems] = useState<Array<{ id: string; item_estoque_id?: string; nome?: string; item?: { nome: string; valor_unitario?: number }; quantidade: number; valor_unitario?: number; source: string; quantidade_disponivel?: number; quantidade_em_uso?: number }>>([]);
  const [selectedFuncionariosDesconto, setSelectedFuncionariosDesconto] = useState<User[]>([]);
  const [searchFuncionarioDesconto, setSearchFuncionarioDesconto] = useState('');
  const [condicaoDevolucaoPrefixo, setCondicaoDevolucaoPrefixo] = useState<'bom' | 'danificado' | 'reteste' | 'perdido' | 'desgaste'>('bom');
  const [observacoesDevolucaoPrefixo, setObservacoesDevolucaoPrefixo] = useState('');
  const [evidenciaFilePrefixo, setEvidenciaFilePrefixo] = useState<File | null>(null);
  const [gerarOrdemDescontoPrefixo, setGerarOrdemDescontoPrefixo] = useState(false);
  const [valorManualOrdemPrefixo, setValorManualOrdemPrefixo] = useState<number>(0);
  const [valoresItensPrefixo, setValoresItensPrefixo] = useState<{ [key: string]: number }>({});
  const [parcelasPrefixo, setParcelasPrefixo] = useState<number>(1);
  const [selectedBasePrefixo, setSelectedBasePrefixo] = useState<string>('');



  // Inicializar valores dos itens quando são selecionados
  useEffect(() => {
    const novosValores: { [key: string]: number } = {};
    selectedItems.forEach(item => {
      const itemId = item.id || item.item_estoque_id;
      if (!itemId) return; // Skip if no ID found

      // Buscar valor direto do item_estoque
      const valorOriginal = item.valor_unitario || item.item?.valor_unitario || 0;
      const quantidade = item.quantidade || 1;

      // Only initialize new items, don't overwrite existing edited values
      if (!(itemId in valoresItens)) {
        novosValores[itemId] = valorOriginal * quantidade;
      }
    });

    // Only update if there are new values to add
    if (Object.keys(novosValores).length > 0) {
      setValoresItens(prev => ({ ...prev, ...novosValores }));
    }
  }, [selectedItems, valoresItens]);

  // Marcar automaticamente "Gerar ordem de desconto" quando condição for danificado/perdido
  useEffect(() => {
    if (condicaoDevolucao === 'danificado' || condicaoDevolucao === 'perdido') {
      setGerarOrdemDesconto(true);
    } else if (condicaoDevolucao === 'reteste') {
      setGerarOrdemDesconto(false);
    } else {
      setGerarOrdemDesconto(false);
    }
  }, [condicaoDevolucao, valoresItens]);

  // Calcular valor total baseado nos valores editáveis
  useEffect(() => {
    const valorTotal = Object.values(valoresItens).reduce((total, valor) => total + valor, 0);
    setValorManualOrdem(valorTotal);
  }, [valoresItens]);

  // Inicializar valores dos itens da equipe quando são selecionados
  useEffect(() => {
    const novosValores: { [key: string]: number } = {};
    selectedEquipeItems.forEach(item => {
      const itemId = item.id || item.item_estoque_id;
      if (!itemId) return;

      const valorOriginal = item.valor_unitario || item.item?.valor_unitario || 0;
      const quantidade = item.quantidade || 1;

      if (!(itemId in valoresItensPrefixo)) {
        novosValores[itemId] = valorOriginal * quantidade;
      }
    });

    if (Object.keys(novosValores).length > 0) {
      setValoresItensPrefixo(prev => ({ ...prev, ...novosValores }));
    }
  }, [selectedEquipeItems, valoresItensPrefixo]);

  // Calcular valor total baseado nos valores editáveis da equipe
  useEffect(() => {
    const valorTotal = Object.values(valoresItensPrefixo).reduce((total, valor) => total + valor, 0);
    setValorManualOrdemPrefixo(valorTotal);
  }, [valoresItensPrefixo]);

  // Marcar automaticamente "Gerar ordem de desconto" quando condição for danificado/perdido (prefixo)
  useEffect(() => {
    if (condicaoDevolucaoPrefixo === 'danificado' || condicaoDevolucaoPrefixo === 'perdido') {
      setGerarOrdemDescontoPrefixo(true);
    } else if (condicaoDevolucaoPrefixo === 'reteste') {
      setGerarOrdemDescontoPrefixo(false);
    } else {
      setGerarOrdemDescontoPrefixo(false);
    }
  }, [condicaoDevolucaoPrefixo, valoresItensPrefixo]);

  // Função para atualizar valor de um item específico
  const updateItemValue = (itemId: string, novoValor: number) => {
    setValoresItens(prev => ({
      ...prev,
      [itemId]: novoValor
    }));
  };

  // Query para todos os usuários ativos
  const {
    data: users = [],
    isLoading: usersLoading
  } = useQuery({
    queryKey: ['all_users'],
    queryFn: async () => {
      // Buscar todos os usuários ativos
      const { data: allUsers, error: usersError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('ativo', true)
        .in('status', ['ativo'])
        .order('nome');

      if (usersError) throw usersError;

      return allUsers || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Query para bases
  const {
    data: bases = []
  } = useQuery({
    queryKey: ['bases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bases')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query para inventário do funcionário selecionado
  const {
    data: inventarioFuncionario = [],
    isLoading: inventarioLoading
  } = useQuery({
    queryKey: ['inventario_funcionario', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return [];

      const { data, error } = await supabase
        .from('inventario_funcionario')
        .select(`
          *,
          item:itens_estoque!item_estoque_id(nome, codigo, categoria, valor_unitario)
        `)
        .eq('funcionario_id', selectedUser.id)
        .in('status', ['em_uso'])
        .order('data_entrega', { ascending: false });

      if (error) {
        console.error('Erro ao buscar inventário do funcionário:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedUser?.id && showProcessarModal,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  // Query para inventário do funcionário em edição
  useQuery({
    queryKey: ['inventario_funcionario', editingUser?.id],
    queryFn: async () => {
      if (!editingUser?.id) return [];

      const { data, error } = await supabase
        .from('inventario_funcionario')
        .select(`
          *,
          item:itens_estoque!item_estoque_id(nome, codigo, categoria, valor_unitario)
        `)
        .eq('funcionario_id', editingUser.id);

      if (error) {
        console.error('Erro ao buscar inventário do funcionário:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!editingUser?.id && showEditModal,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  // Query para itens da base em edição
  const {
    data: editingItensBase = []
  } = useQuery({
    queryKey: ['itens_base', editingBase],
    queryFn: async () => {
      if (!editingBase) return [];

      const { data, error } = await supabase
        .from('itens_estoque')
        .select('id, nome, codigo, categoria, quantidade, quantidade_atual, valor_unitario')
        .eq('base_id', editingBase)
        .order('nome');

      if (error) {
        console.error('Erro ao buscar itens da base:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!editingBase || showEditModal,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  // Query para itens da base selecionada
  const {
    data: itensBase = [],
    isLoading: itensBaseLoading
  } = useQuery({
    queryKey: ['itens_base', selectedBase],
    queryFn: async () => {
      if (!selectedBase) return [];

      const { data, error } = await supabase
        .from('itens_estoque')
        .select('*')
        .eq('base_id', selectedBase)
        .eq('status', 'ativo')
        .order('nome');

      if (error) {
        console.error('Erro ao buscar itens da base:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedBase && showProcessarModal,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Query para equipes (para devolução por prefixo)
  const {
    data: equipes = [],
    isLoading: equipesLoading
  } = useQuery({
    queryKey: ['equipes_devolucao', userContratoIds],
    queryFn: async () => {
      // Usar o serviço existente que já funciona
      const equipesData = await teamService.getAll();

      // Filtrar equipes por contratos do usuário
      const equipesFiltradasPorContrato = equipesData.filter(equipe => {
        if (!userContratoIds || userContratoIds.length === 0) return true
        return userContratoIds.includes(equipe.contrato_id || '')
      });

      console.log('🔍 Equipes carregadas:', {
        total: equipesData.length,
        filtradas: equipesFiltradasPorContrato.length,
        contratosUsuario: userContratoIds,
        todas: equipesData.map(e => ({ id: e.id, nome: e.nome, contrato_id: e.contrato_id }))
      });

      return equipesFiltradasPorContrato;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query para inventário da equipe selecionada
  const {
    data: inventarioEquipe = [],
    isLoading: inventarioEquipeLoading
  } = useQuery({
    queryKey: ['inventario_equipe', selectedEquipe?.id],
    queryFn: async () => {
      if (!selectedEquipe?.id) return [];

      const { data, error } = await supabase
        .from('inventario_equipe')
        .select(`
          *,
          item:itens_estoque!item_estoque_id(nome, codigo, categoria, valor_unitario)
        `)
        .eq('equipe_id', selectedEquipe.id)
        .eq('status', 'ativo')
        .order('data_entrega', { ascending: false });

      if (error) {
        console.error('Erro ao buscar inventário da equipe:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedEquipe?.id && activeTab === 'prefixo',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query para bases do contrato da equipe selecionada (para seletor de base individual)
  const {
    data: basesContratoPrefixo = []
  } = useQuery({
    queryKey: ['bases_contrato_prefixo', selectedEquipe?.id],
    queryFn: async () => {
      if (!selectedEquipe?.id) return [];

      const { data: equipeData, error: equipeError } = await supabase
        .from('equipes')
        .select('contrato_id')
        .eq('id', selectedEquipe.id)
        .single();

      if (equipeError || !equipeData?.contrato_id) return [];

      const { data, error } = await supabase
        .from('bases')
        .select('id, nome, codigo')
        .eq('contrato_id', equipeData.contrato_id)
        .eq('ativa', true)
        .order('nome');

      if (error) {
        console.error('Erro ao buscar bases do contrato:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedEquipe?.id && activeTab === 'prefixo',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query para itens de estoque da base selecionada (itens individuais)
  const {
    data: itensBaseEquipe = [],
    isLoading: itensBaseEquipeLoading
  } = useQuery({
    queryKey: ['itens_base_equipe', selectedBasePrefixo],
    queryFn: async () => {
      if (!selectedBasePrefixo) return [];

      const { data, error } = await supabase
        .from('itens_estoque')
        .select('*')
        .eq('base_id', selectedBasePrefixo)
        .eq('status', 'ativo')
        .order('nome');

      if (error) {
        console.error('Erro ao buscar itens da base da equipe:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedBasePrefixo && activeTab === 'prefixo',
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Query para funcionários ativos do contrato (para seleção de desconto)
  const {
    data: funcionariosEquipe = [],
    isLoading: funcionariosEquipeLoading
  } = useQuery({
    queryKey: ['funcionarios_contrato', userContratoIds],
    queryFn: async () => {
      if (!userContratoIds || userContratoIds.length === 0) return [];

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('ativo', true)
        .in('status', ['ativo'])
        .in('contrato_origem_id', userContratoIds)
        .order('nome');

      if (error) {
        console.error('Erro ao buscar funcionários do contrato:', error);
        return [];
      }

      return data || [];
    },
    enabled: activeTab === 'prefixo' && !!userContratoIds && userContratoIds.length > 0,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  // Query para histórico de devoluções recentes
  const {
    data: recentDevolucoes = [],
    isLoading: devolucoesLoading
  } = useQuery({
    queryKey: ['recent_devolucoes', userContratoIds],
    queryFn: async () => {
      // Buscar devoluções de funcionários
      const { data: funcData, error: funcError } = await supabase
        .from('historico_funcionarios')
        .select(`
          *,
          funcionario:usuarios!historico_funcionarios_funcionario_id_fkey(nome, matricula, contrato_origem_id),
          item:itens_estoque(nome, codigo, categoria),
          responsavel_devolucao_user:usuarios!historico_funcionarios_responsavel_devolucao_fkey(nome)
        `)
        .not('data_devolucao', 'is', null)
        .order('data_devolucao', { ascending: false })
        .limit(50);

      if (funcError) throw funcError;

      // Buscar devoluções de equipe (historico_equipe)
      const { data: equipeData, error: equipeError } = await supabase
        .from('historico_equipe')
        .select(`
          *,
          equipe:equipes!equipe_id(nome, prefixo, contrato_id),
          item:itens_estoque!itens_estoque_id(nome, codigo, categoria),
          responsavel:usuarios!responsavel_movimentacao_id(nome)
        `)
        .eq('tipo_movimentacao', 'devolucao')
        .order('data_movimentacao', { ascending: false })
        .limit(50);

      if (equipeError) {
        console.error('Erro ao buscar histórico de equipe:', equipeError);
      }

      // Filtrar devoluções de funcionários por contrato
      let filteredFunc = funcData || [];
      if (userContratoIds && userContratoIds.length > 0) {
        filteredFunc = filteredFunc.filter(d =>
          d.funcionario?.contrato_origem_id &&
          userContratoIds.includes(d.funcionario.contrato_origem_id)
        );
      }

      // Filtrar devoluções de equipe por contrato
      let filteredEquipe = equipeData || [];
      if (userContratoIds && userContratoIds.length > 0) {
        filteredEquipe = filteredEquipe.filter(d =>
          d.equipe?.contrato_id &&
          userContratoIds.includes(d.equipe.contrato_id)
        );
      }

      // Normalizar devoluções de equipe para o mesmo formato
      const equipeNormalized = filteredEquipe.map(d => ({
        ...d,
        id: d.id,
        data_devolucao: d.data_movimentacao,
        condicao_devolucao: d.condicao_movimentacao,
        observacoes_devolucao: d.observacoes_movimentacao,
        funcionario: { nome: `Equipe: ${d.equipe?.nome || 'N/A'}`, matricula: d.equipe?.prefixo || '' },
        item: d.item,
        responsavel_devolucao_user: d.responsavel,
        _source: 'equipe' as const,
      }));

      // Combinar e ordenar por data
      const combined = [
        ...filteredFunc.map(d => ({ ...d, _source: 'funcionario' as const })),
        ...equipeNormalized
      ].sort((a, b) => {
        const dateA = new Date(a.data_devolucao || 0).getTime();
        const dateB = new Date(b.data_devolucao || 0).getTime();
        return dateB - dateA;
      });

      return combined.slice(0, 15);
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
    enabled: !!userContratoIds,
  });

  // Query para ordens de desconto recentes
  const {
    data: ordensDesconto = []
  } = useQuery({
    queryKey: ['ordens_desconto_recentes_almoxarifado', userContratoIds, bases],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_orders')
        .select(`
          *,
          created_by_user:usuarios!created_by(nome),
          target_user:usuarios!target_user_id(nome, matricula)
        `)
        .eq('criado_por_setor', 'almoxarifado')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar por contratos do usuário usando as bases já carregadas
      let filtered = data || [];
      if (userContratoIds && userContratoIds.length > 0 && bases.length > 0) {
        const baseIdsDoUsuario = new Set(
          bases.filter(b => userContratoIds.includes(b.contrato_id)).map(b => b.id)
        );
        filtered = filtered.filter(ordem =>
          !ordem.base_id || baseIdsDoUsuario.has(ordem.base_id)
        );
      }

      return filtered;
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  // Query para estatísticas
  const {
    data: stats,
    isLoading: statsLoading
  } = useQuery({
    queryKey: ['devolucoes_stats'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

      // Devoluções do mês - buscar do histórico de funcionários
      const { data: devolucoesMes, error: error1 } = await supabase
        .from('historico_funcionarios')
        .select('id, condicao_devolucao')
        .not('data_devolucao', 'is', null)
        .gte('data_devolucao', inicioMes);

      // Itens em uso (inventário atual dos funcionários)
      const { data: itensEmUso, error: error2 } = await supabase
        .from('inventario_funcionario')
        .select('id');

      // Ordens de desconto geradas pelo almoxarifado (filtro simples temporário)
      const { data: ordensDesconto, error: error3 } = await supabase
        .from('discount_orders')
        .select('id')
        .gte('created_at', inicioMes)
        .is('placa', null); // Temporário: considera sem placa = almoxarifado até implementar criado_por_setor

      if (error1 || error2 || error3) {
        // Log individual dos erros para debug
        if (error1) {
          console.error('❌ Erro ao buscar devoluções do mês:', error1);
        }
        if (error2) {
          console.error('❌ Erro ao buscar itens em uso:', error2);
        }
        if (error3) {
          console.error('❌ Erro ao buscar ordens de desconto:', error3);
        }

        // Retornar dados padrão sem falhar completamente
        return {
          devolucoesMes: 0,
          itensEmUso: 0,
          ordensDesconto: 0,
          devolucoesPorCondicao: {}
        };
      }

      const devolucoesPorCondicao = (devolucoesMes || []).reduce((acc: Record<string, number>, item: { condicao_devolucao?: string }) => {
        const condicao = item.condicao_devolucao || 'sem_info';
        acc[condicao] = (acc[condicao] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        devolucoesMes: devolucoesMes?.length || 0,
        itensEmUso: itensEmUso?.length || 0,
        ordensDesconto: ordensDesconto?.length || 0,
        devolucoesPorCondicao
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Filtrar usuários com base na busca
  const filteredUsers = useMemo(() => {
    if (!searchFuncionario) return users;

    return users.filter(user =>
      user.nome.toLowerCase().includes(searchFuncionario.toLowerCase()) ||
      user.matricula?.toLowerCase().includes(searchFuncionario.toLowerCase()) ||
      user.cpf?.toLowerCase().includes(searchFuncionario.toLowerCase())
    );
  }, [users, searchFuncionario]);

  // Filtrar ordens de desconto com base na busca e status
  const filteredOrdensDesconto = useMemo(() => {
    return ordensDesconto.filter(ordem => {
      const status = ordem.recusado ? 'recusada' : (ordem.status === 'assinada' || ordem.status === 'assinado') ? 'assinada' : 'pendente';
      const matchesStatus = ordensStatusFilter === 'all' || status === ordensStatusFilter;
      const searchLower = searchRecebedor.toLowerCase();
      const matchesSearch = !searchRecebedor ||
        ordem.target_user?.nome?.toLowerCase().includes(searchLower) ||
        ordem.target_user?.matricula?.toLowerCase().includes(searchLower) ||
        ordem.created_by_user?.nome?.toLowerCase().includes(searchLower) ||
        ordem.descricao?.toLowerCase().includes(searchLower) ||
        ordem.valor_total?.toLocaleString('pt-BR').includes(searchLower);
      return matchesStatus && matchesSearch;
    });
  }, [ordensDesconto, searchRecebedor, ordensStatusFilter]);

  // Paginação das ordens
  const ordensTotalPages = Math.ceil(filteredOrdensDesconto.length / ordensItemsPerPage);
  const paginatedOrdensDesconto = filteredOrdensDesconto.slice(
    (ordensCurrentPage - 1) * ordensItemsPerPage,
    ordensCurrentPage * ordensItemsPerPage
  );

  // Calcular valores por status das ordens do almoxarifado
  const ordensValoresPorStatus = useMemo(() => {
    const pendentes = ordensDesconto.filter(o => !o.recusado && o.status !== 'assinada' && o.status !== 'assinado');
    const assinadas = ordensDesconto.filter(o => !o.recusado && (o.status === 'assinada' || o.status === 'assinado'));
    const rejeitadas = ordensDesconto.filter(o => o.recusado);
    return {
      pendente: { quantidade: pendentes.length, valorTotal: pendentes.reduce((s, o) => s + (o.valor_total || 0), 0) },
      assinada: { quantidade: assinadas.length, valorTotal: assinadas.reduce((s, o) => s + (o.valor_total || 0), 0) },
      rejeitada: { quantidade: rejeitadas.length, valorTotal: rejeitadas.reduce((s, o) => s + (o.valor_total || 0), 0) },
    };
  }, [ordensDesconto]);

  // Filtrar itens da base com base na busca
  const filteredItensBase = useMemo(() => {
    if (!searchItem) return itensBase;
    const search = searchItem.toLowerCase();
    return itensBase.filter(item =>
      (item.nome || '').toLowerCase().includes(search) ||
      (item.codigo || '').toLowerCase().includes(search) ||
      (item.categoria || '').toLowerCase().includes(search)
    );
  }, [itensBase, searchItem]);

  // Filtrar itens da base para edição
  const filteredEditingItensBase = useMemo(() => {
    if (!editingSearchItem) return editingItensBase;

    return editingItensBase.filter(item =>
      item.nome.toLowerCase().includes(editingSearchItem.toLowerCase()) ||
      item.codigo.toLowerCase().includes(editingSearchItem.toLowerCase()) ||
      item.categoria.toLowerCase().includes(editingSearchItem.toLowerCase())
    );
  }, [editingItensBase, editingSearchItem]);

  // Mutation para processar devolução
  const processarDevolucaoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || selectedItems.length === 0) {
        throw new Error('Selecione um funcionário e pelo menos um item');
      }

      console.log('🔄 Processando devoluções:', { selectedUser, selectedItems });

      const timestamp = new Date().toISOString();
      const resultados = [];

      // Processar cada item selecionado
      for (const itemSelecionado of selectedItems) {
        console.log('Processando item:', itemSelecionado);

        // Se o item veio do inventário do funcionário
        if (itemSelecionado.source === 'inventario') {
          // Buscar histórico original da entrega para pegar solicitante_original_id e base_id
          const { data: historicoOriginal } = await supabase
            .from('historico_funcionarios')
            .select('solicitante_original_id, base_id, data_entrega, responsavel_entrega')
            .eq('funcionario_id', selectedUser.id)
            .eq('item_id', itemSelecionado.item_estoque_id || itemSelecionado.id)
            .eq('tipo_movimentacao', 'entrega')
            .order('data_entrega', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Buscar base_id do item se não encontrou no histórico
          let baseIdParaSalvar = historicoOriginal?.base_id
          if (!baseIdParaSalvar) {
            const { data: itemEstoque } = await supabase
              .from('itens_estoque')
              .select('base_id')
              .eq('id', itemSelecionado.item_estoque_id || itemSelecionado.id)
              .maybeSingle()
            baseIdParaSalvar = itemEstoque?.base_id
          }

          // Primeiro criar registro no histórico de funcionários
          console.log('📝 Salvando no histórico_funcionarios:', {
            funcionario_id: selectedUser.id,
            item_estoque_id: itemSelecionado.item_estoque_id || itemSelecionado.id,
            quantidade: itemSelecionado.quantidade || 1,
            tipo_movimentacao: 'devolucao',
            data_devolucao: timestamp,
            condicao_devolucao: condicaoDevolucao,
            responsavel_devolucao: currentUser?.id,
            solicitante_original_id: historicoOriginal?.solicitante_original_id,
            base_id: baseIdParaSalvar
          });

          const { data: historicoInsercao, error: historicoError } = await supabase
            .from('historico_funcionarios')
            .insert({
              funcionario_id: selectedUser.id,
              item_id: itemSelecionado.item_estoque_id || itemSelecionado.id, // ✅ CORRIGIDO: usar item_id
              quantidade: itemSelecionado.quantidade || 1,
              tipo_movimentacao: 'devolucao',
              data_entrega: historicoOriginal?.data_entrega || '1900-01-01T00:00:00Z',
              data_devolucao: timestamp,
              condicao_entrega: 'usado_bom', // Assumindo que estava em bom estado antes
              condicao_devolucao: condicaoDevolucao,
              observacoes_devolucao: observacoesDevolucao || '',
              responsavel_entrega: historicoOriginal?.responsavel_entrega || currentUser?.id,
              responsavel_devolucao: currentUser?.id,
              solicitante_original_id: historicoOriginal?.solicitante_original_id, // ✅ Salvar solicitante_original_id
              base_id: baseIdParaSalvar, // ✅ Salvar base_id
              status: condicaoDevolucao === 'bom' ? 'devolvido' :
                condicaoDevolucao === 'desgaste' ? 'desgaste' :
                  condicaoDevolucao === 'danificado' ? 'danificado' :
                    condicaoDevolucao === 'reteste' ? 'reteste' : 'perdido'
            })
            .select()
            .single();

          if (historicoError) {
            console.error('❌ Erro ao salvar no histórico_funcionarios:', historicoError);
            throw historicoError;
          }

          console.log('✅ Registro salvo no histórico_funcionarios:', historicoInsercao);

          // Depois REMOVER o item do inventário (deletar completamente)
          const { error: deleteError } = await supabase
            .from('inventario_funcionario')
            .delete()
            .eq('id', itemSelecionado.id);

          if (deleteError) throw deleteError;

          resultados.push(historicoInsercao);

        } else {
          // Item vem da base - buscar histórico original ou base_id do item
          const { data: historicoOriginal } = await supabase
            .from('historico_funcionarios')
            .select('solicitante_original_id, base_id, data_entrega, responsavel_entrega')
            .eq('funcionario_id', selectedUser.id)
            .eq('item_id', itemSelecionado.id)
            .eq('tipo_movimentacao', 'entrega')
            .order('data_entrega', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Buscar base_id do item se não encontrou no histórico
          let baseIdParaSalvar = historicoOriginal?.base_id
          if (!baseIdParaSalvar) {
            const { data: itemEstoque } = await supabase
              .from('itens_estoque')
              .select('base_id')
              .eq('id', itemSelecionado.id)
              .maybeSingle()
            baseIdParaSalvar = itemEstoque?.base_id
          }

          // Item vem da base - criar registro direto no histórico de funcionários (não no inventário)
          console.log('📝 Salvando no histórico_funcionarios (item da base):', {
            funcionario_id: selectedUser.id,
            item_id: itemSelecionado.id, // ✅ CORRIGIDO
            quantidade: itemSelecionado.quantidade || 1,
            tipo_movimentacao: 'devolucao',
            data_devolucao: timestamp,
            condicao_devolucao: condicaoDevolucao,
            responsavel_devolucao: currentUser?.id,
            solicitante_original_id: historicoOriginal?.solicitante_original_id,
            base_id: baseIdParaSalvar
          });

          const { data: historicoInsercao, error: historicoError } = await supabase
            .from('historico_funcionarios')
            .insert({
              funcionario_id: selectedUser.id,
              item_id: itemSelecionado.id, // ✅ CORRIGIDO: usar item_id
              quantidade: itemSelecionado.quantidade || 1,
              tipo_movimentacao: 'devolucao',
              data_entrega: historicoOriginal?.data_entrega || '1900-01-01T00:00:00Z',
              data_devolucao: timestamp,
              condicao_entrega: 'usado_bom', // Assumindo que estava em bom estado antes
              condicao_devolucao: condicaoDevolucao,
              observacoes_devolucao: observacoesDevolucao || '',
              responsavel_entrega: historicoOriginal?.responsavel_entrega || currentUser?.id,
              responsavel_devolucao: currentUser?.id,
              solicitante_original_id: historicoOriginal?.solicitante_original_id, // ✅ Salvar solicitante_original_id
              base_id: baseIdParaSalvar, // ✅ Salvar base_id
              status: condicaoDevolucao === 'bom' ? 'devolvido' :
                condicaoDevolucao === 'desgaste' ? 'desgaste' :
                  condicaoDevolucao === 'danificado' ? 'danificado' :
                    condicaoDevolucao === 'reteste' ? 'reteste' : 'perdido'
            })
            .select()
            .single();

          if (historicoError) {
            console.error('❌ Erro ao salvar no histórico_funcionarios (item da base):', historicoError);
            throw historicoError;
          }

          console.log('✅ Registro salvo no histórico_funcionarios (item da base):', historicoInsercao);
          resultados.push(historicoInsercao);
        }

        // Se item em bom estado, retornar ao estoque
        if (condicaoDevolucao === 'bom') {
          const itemId = itemSelecionado.item_estoque_id || itemSelecionado.id;
          const quantidade = itemSelecionado.quantidade || 1;

          // Buscar estoque atual para calcular quantidade_anterior/quantidade_atual
          const { data: itemAtual, error: fetchError } = await supabase
            .from('itens_estoque')
            .select('estoque_atual')
            .eq('id', itemId)
            .single();

          if (fetchError) {
            console.error('Erro ao buscar estoque atual:', fetchError);
          }

          // Registrar movimentação - o trigger atualizar_estoque_automatico cuida de incrementar o estoque
          const quantidadeAnterior = itemAtual?.estoque_atual || 0;

          console.log('📦 Registrando movimentação de estoque:', {
            item_id: itemId,
            tipo: 'devolucao',
            quantidade: quantidade,
            destinatario_id: selectedUser.id,
            usuario_id: currentUser?.id,
            motivo: `Devolução - ${condicaoDevolucao}`
          });

          const { data: movimentacaoData, error: movimentacaoError } = await supabase
            .from('movimentacoes_estoque')
            .insert({
              item_id: itemId,
              tipo: 'devolucao',
              quantidade: quantidade,
              quantidade_anterior: quantidadeAnterior,
              quantidade_atual: quantidadeAnterior + quantidade,
              motivo: `Devolução - ${condicaoDevolucao}`,
              usuario_id: currentUser?.id,
              destinatario_id: selectedUser.id,
              observacoes: `Devolução do funcionário ${selectedUser.nome} (${selectedUser.matricula}). ${observacoesDevolucao || ''}`,
              criado_em: timestamp,
              atualizado_em: timestamp
            })
            .select()
            .single();

          if (movimentacaoError) {
            console.error('❌ Erro ao registrar movimentação de estoque:', movimentacaoError);
          } else {
            console.log('✅ Movimentação de estoque registrada:', movimentacaoData);
          }
        }

        // Se item reteste, criar reteste automático (NÃO volta ao estoque)
        // A RPC enviar_para_reteste_devolucao já registra a movimentação com tipo='reteste_entrada'
        // e NÃO incrementa o estoque. Não inserir movimentação manual aqui para evitar
        // que o trigger atualizar_estoque_automatico incremente o estoque indevidamente.
        if (condicaoDevolucao === 'reteste') {
          console.log('🔄 Criando reteste automático para item reteste...');

          const itemId = itemSelecionado.item_estoque_id || itemSelecionado.id;

          const retesteResult = await retesteService.criarRetesteAutomatico({
            item_estoque_id: itemId,
            funcionario_id: selectedUser.id,
            historico_funcionario_id: '',
            base_id: selectedBase,
            motivo_reteste: `Item para reteste na devolução - ${observacoesDevolucao || 'Sem observações'}`,
            responsavel_reteste: currentUser?.id || ''
          });

          if (!retesteResult.success) {
            throw new Error(retesteResult.message || 'Erro ao criar reteste automático');
          }

          console.log('✅ Reteste criado automaticamente:', retesteResult.reteste_id);
        }
      }

      // Gerar ordem de desconto se necessário
      if ((condicaoDevolucao === 'danificado' || condicaoDevolucao === 'perdido') && gerarOrdemDesconto) {
        console.log('📋 Gerando ordem de desconto automática...');

        const valorTotal = valorManualOrdem;

        // Gerar descrição detalhada com itens e quantidades
        const itensDetalhados = selectedItems.map(item => {
          const itemId = item.id || item.item_estoque_id;
          if (!itemId) return '';

          const nomeItem = item.nome || item.item?.nome;
          const quantidade = item.quantidade || 1;
          const valorItem = valoresItens[itemId] || 0;
          return `${nomeItem} (Qtd: ${quantidade}) - R$ ${valorItem % 1 === 0 ? valorItem.toString() : valorItem.toFixed(2)}`;
        }).filter(Boolean).join('; ');

        const descricaoCompleta = `Desconto automático por ${condicaoDevolucao === 'danificado' ? 'dano' : 'perda'} dos seguintes itens: ${itensDetalhados}`;

        const ordemDesconto = {
          created_by: currentUser?.id,
          target_user_id: selectedUser.id,
          valor_total: valorTotal,
          parcelas: parcelas,
          valor_parcela: parcelas > 1 ? valorTotal / parcelas : valorTotal,
          descricao: descricaoCompleta,
          base_id: selectedBase,
          cpf: selectedUser.cpf,
          observacoes_danos: observacoesDevolucao,
          tipo_documento: 'nf',
          documentos: ['NF'], // Marca automaticamente NF para ordens do almoxarifado
          data_geracao: new Date().toISOString().slice(0, 10), // Data atual no formato YYYY-MM-DD
          // criado_por_setor será identificado automaticamente pela API (baseado na lógica: sem placa + documentos != "Multa de Trânsito" = almoxarifado)
        };

        // Usar o serviço que gera o PDF automaticamente
        console.log('📋 Enviando dados para API de ordem de desconto:', ordemDesconto);

        const response = await fetch('/api/discount-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ordemDesconto),
        });

        console.log('📋 Response status:', response.status);
        console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro na API:', errorText);
          throw new Error(`Erro ao criar ordem de desconto: ${response.status} - ${errorText}`);
        }

        // Pegar o ID real da ordem criada
        const realOrderId = response.headers.get('X-Discount-Order-Id');
        const fileUrl = response.headers.get('X-Supabase-File-Url');

        console.log('📋 Order ID:', realOrderId);
        console.log('📋 File URL:', fileUrl);

        // Baixar e abrir o PDF
        const blob = await response.blob();
        console.log('📋 Blob size:', blob.size, 'type:', blob.type);

        const url = URL.createObjectURL(blob);
        console.log('📋 Object URL:', url);

        window.open(url, '_blank');

        console.log('✅ Ordem de desconto criada:', realOrderId);

        // 2. Fazer upload dos arquivos se houver
        if ((damageFiles.length > 0 || documentFiles.length > 0) && realOrderId) {
          console.log('📤 CHAMANDO uploadFilesToStorage...');
          console.log('🆔 ID da ordem criada:', realOrderId);
          const result = await uploadFilesToStorage(realOrderId);
          console.log('📤 Upload concluído:', result);
        }

        return {
          devolucoes: resultados,
          ordemDesconto: { id: realOrderId }
        };
      }

      return { devolucoes: resultados };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventario_funcionario', selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['recent_devolucoes'] });
      queryClient.invalidateQueries({ queryKey: ['devolucoes_stats'] });
      queryClient.invalidateQueries({ queryKey: ['itens_base', selectedBase] });
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_recentes_almoxarifado'] });
      setShowProcessarModal(false);
      resetForm();

      if (data.ordemDesconto) {
        notify(`${selectedItems.length} devolução(ões) processada(s) e ordem de desconto gerada com sucesso!`, 'success');
      } else {
        notify(`${selectedItems.length} devolução(ões) processada(s) com sucesso!`, 'success');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao processar devolução: ' + error.message, 'error');
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
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_recentes_almoxarifado'] });
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
      console.error('Erro no upload:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao enviar arquivo';
      notify(errorMessage, 'error');
    }
  });

  // Mutation para processar devolução por prefixo
  const processarDevolucaoPrefixoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEquipe || selectedEquipeItems.length === 0) {
        throw new Error('Selecione uma equipe e pelo menos um item');
      }

      if (gerarOrdemDescontoPrefixo && selectedFuncionariosDesconto.length === 0) {
        throw new Error('Selecione pelo menos um funcionário para receber o desconto');
      }

      console.log('🔄 Processando devolução por prefixo:', {
        selectedEquipe,
        selectedEquipeItems,
        selectedFuncionariosDesconto
      });

      const timestamp = new Date().toISOString();
      const resultados = [];

      // Processar cada item selecionado da equipe
      for (const itemSelecionado of selectedEquipeItems) {
        console.log('Processando item da equipe:', itemSelecionado);

        // Resolver o UUID real do item (itens da base têm id prefixado com "base_")
        const realItemId = itemSelecionado.item_estoque_id ||
          (itemSelecionado.id?.startsWith('base_') ? itemSelecionado.id.replace('base_', '') : itemSelecionado.id);
        const quantidade = itemSelecionado.quantidade || 1;
        const isBaseItem = itemSelecionado.source === 'base' || itemSelecionado.id?.startsWith('base_');

        // 1. REGISTRAR NO HISTÓRICO DA EQUIPE (historico_equipe)
        // tipo_movimentacao = 'devolucao', condicao_movimentacao = condição do item
        // Mapear condição da devolução pro check constraint de condicao_movimentacao (excelente, bom, regular, ruim, danificado)
        const condicaoMap: Record<string, string> = {
          'bom': 'bom',
          'desgaste': 'ruim',
          'danificado': 'danificado',
          'reteste': 'danificado',
          'perdido': 'danificado'
        };

        const { error: historicoEquipeError } = await supabase
          .from('historico_equipe')
          .insert({
            equipe_id: selectedEquipe.id,
            itens_estoque_id: realItemId,
            tipo_movimentacao: 'devolucao',
            responsavel_movimentacao_id: currentUser?.id,
            observacoes_movimentacao: `Devolução por prefixo (${selectedEquipe.prefixo || selectedEquipe.nome}) - Condição: ${condicaoDevolucaoPrefixo}. ${observacoesDevolucaoPrefixo || ''}`,
            quantidade: quantidade,
            data_movimentacao: timestamp,
            status: 'inativo',
            condicao_movimentacao: condicaoMap[condicaoDevolucaoPrefixo] || 'bom',
            criado_em: timestamp,
            atualizado_em: timestamp
          });

        if (historicoEquipeError) {
          console.error('❌ Erro ao salvar no historico_equipe:', historicoEquipeError);
        } else {
          console.log('✅ Registro salvo no historico_equipe');
        }

        // 2. REGISTRAR NO HISTÓRICO DE FUNCIONÁRIOS (apenas se tem funcionários selecionados para desconto)
        if (selectedFuncionariosDesconto.length > 0) {
          for (const funcionario of selectedFuncionariosDesconto) {
            const { data: historicoInsercao, error: historicoError } = await supabase
              .from('historico_funcionarios')
              .insert({
                funcionario_id: funcionario.id,
                item_id: realItemId,
                quantidade: quantidade,
                tipo_movimentacao: 'devolucao',
                data_entrega: '1900-01-01T00:00:00Z',
                data_devolucao: timestamp,
                condicao_entrega: 'usado_bom',
                condicao_devolucao: condicaoDevolucaoPrefixo,
                observacoes_devolucao: observacoesDevolucaoPrefixo || '',
                responsavel_entrega: currentUser?.id,
                responsavel_devolucao: currentUser?.id,
                status: condicaoDevolucaoPrefixo === 'bom' ? 'devolvido' :
                  condicaoDevolucaoPrefixo === 'desgaste' ? 'desgaste' :
                    condicaoDevolucaoPrefixo === 'danificado' ? 'danificado' :
                      condicaoDevolucaoPrefixo === 'reteste' ? 'reteste' : 'perdido'
              })
              .select()
              .single();

            if (historicoError) {
              console.error('❌ Erro ao salvar no histórico_funcionarios:', historicoError);
              throw historicoError;
            }

            resultados.push(historicoInsercao);
          }
        }

        // 3. MOVIMENTAÇÃO DE ESTOQUE - retornar ao estoque APENAS quando condição é bom
        if (condicaoDevolucaoPrefixo === 'bom') {
          // Buscar estoque atual
          const { data: itemAtual } = await supabase
            .from('itens_estoque')
            .select('estoque_atual')
            .eq('id', realItemId)
            .single();

          const quantidadeAnterior = itemAtual?.estoque_atual || 0;

          console.log('📦 Registrando movimentação de estoque (devolução prefixo):', {
            item_id: realItemId,
            tipo: 'devolucao',
            quantidade: quantidade,
            quantidade_anterior: quantidadeAnterior,
            quantidade_atual: quantidadeAnterior + quantidade
          });

          const { error: movimentacaoError } = await supabase
            .from('movimentacoes_estoque')
            .insert({
              item_id: realItemId,
              tipo: 'devolucao',
              quantidade: quantidade,
              quantidade_anterior: quantidadeAnterior,
              quantidade_atual: quantidadeAnterior + quantidade,
              motivo: `Devolução por prefixo (${selectedEquipe.prefixo || selectedEquipe.nome}) - ${condicaoDevolucaoPrefixo}`,
              usuario_id: currentUser?.id,
              observacoes: `Devolução da equipe ${selectedEquipe.nome} (${selectedEquipe.prefixo || 'sem prefixo'}). ${observacoesDevolucaoPrefixo || ''}`,
              criado_em: timestamp,
              atualizado_em: timestamp
            });

          if (movimentacaoError) {
            console.error('❌ Erro ao registrar movimentação de estoque:', movimentacaoError);
          } else {
            console.log('✅ Movimentação de estoque registrada');
          }
        }

        // 4. RETESTE - criar reteste automático (NÃO volta ao estoque)
        if (condicaoDevolucaoPrefixo === 'reteste') {
          console.log('🔄 Criando reteste automático para item de equipe:', realItemId);

          const retesteResult = await retesteService.criarRetesteAutomatico({
            item_estoque_id: realItemId,
            funcionario_id: selectedFuncionariosDesconto.length > 0 ? selectedFuncionariosDesconto[0].id : '',
            base_id: selectedBasePrefixo || selectedEquipe.base_id || '',
            motivo_reteste: `Item para reteste na devolução por prefixo - ${observacoesDevolucaoPrefixo || 'Sem observações'}`,
            responsavel_reteste: currentUser?.id || '',
            equipe_id: selectedEquipe.id,
            prefixo: selectedEquipe.prefixo || selectedEquipe.nome
          });

          if (!retesteResult.success) {
            throw new Error(retesteResult.message || 'Erro ao criar reteste automático para item de equipe');
          }

          console.log('✅ Reteste criado automaticamente para equipe:', retesteResult.reteste_id);
        }

        // 5. DEBITAR DO INVENTÁRIO DA EQUIPE (apenas para itens do inventário, não da base)
        if (!isBaseItem) {
          // Buscar quantidade real atual do inventário da equipe (não confiar no estado local)
          const { data: invAtual, error: invFetchError } = await supabase
            .from('inventario_equipe')
            .select('quantidade_total, quantidade_disponivel')
            .eq('id', itemSelecionado.id)
            .single();

          if (invFetchError) {
            console.error('❌ Erro ao buscar inventário atual da equipe:', invFetchError);
            throw invFetchError;
          }

          const qtdAtualReal = invAtual?.quantidade_total || invAtual?.quantidade_disponivel || 0;
          const novaQtdTotal = Math.max(0, qtdAtualReal - quantidade);
          const novoStatus = novaQtdTotal <= 0 ? 'inativo' : 'ativo';

          console.log('📉 Debitando do inventário da equipe:', {
            id: itemSelecionado.id,
            quantidade_atual_real: qtdAtualReal,
            quantidade_devolvida: quantidade,
            quantidade_nova: novaQtdTotal,
            status: novoStatus
          });

          const { error: updateError } = await supabase
            .from('inventario_equipe')
            .update({
              quantidade_total: novaQtdTotal,
              quantidade_disponivel: novaQtdTotal,
              quantidade_em_uso: 0,
              status: novoStatus,
              atualizado_em: timestamp
            })
            .eq('id', itemSelecionado.id);

          if (updateError) throw updateError;
        }
      }

      // Gerar ordens de desconto se necessário (NÃO gerar para reteste)
      let ordemDesconto = null;
      if (condicaoDevolucaoPrefixo !== 'reteste' && gerarOrdemDescontoPrefixo && selectedFuncionariosDesconto.length > 0) {
        // Se mais de um funcionário, gerar uma ordem para cada
        const itensDetalhados = selectedEquipeItems.map(item => {
          const itemKey = item.id || item.item_estoque_id;
          const nomeItem = item.nome || item.item?.nome;
          const quantidade = item.quantidade || 1;
          const valorItem = itemKey ? (valoresItensPrefixo[itemKey] || 0) : 0;
          return `${nomeItem} (Qtd: ${quantidade}) - R$ ${valorItem % 1 === 0 ? valorItem.toString() : valorItem.toFixed(2)}`;
        }).filter(Boolean).join('; ');

        const descricaoPrefixo = `Desconto automático por ${condicaoDevolucaoPrefixo === 'danificado' ? 'dano' : 'perda'} dos seguintes itens (Equipe: ${selectedEquipe.nome}): ${itensDetalhados}`;

        for (const funcionario of selectedFuncionariosDesconto) {
          const valorPorFuncionario = valorManualOrdemPrefixo / selectedFuncionariosDesconto.length;

          ordemDesconto = await discountOrderService.create({
            created_by: currentUser?.id,
            target_user_id: funcionario.id,
            valor_total: valorPorFuncionario,
            parcelas: parcelasPrefixo,
            descricao: descricaoPrefixo,
            observacoes_danos: observacoesDevolucaoPrefixo,
            criado_por_setor: 'almoxarifado',
            data_geracao: new Date().toISOString().slice(0, 10) // Data atual no formato YYYY-MM-DD
          });
        }
      }

      return { resultados, ordemDesconto };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventario_equipe', selectedEquipe?.id] });
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_recentes_almoxarifado'] });
      queryClient.invalidateQueries({ queryKey: ['recent_devolucoes'] });
      queryClient.invalidateQueries({ queryKey: ['devolucoes_stats'] });
      queryClient.invalidateQueries({ queryKey: ['itens_base'] });
      if (condicaoDevolucaoPrefixo === 'reteste') {
        queryClient.invalidateQueries({ queryKey: ['itens_reteste'] });
      }
      resetPrefixoForm();
      setActiveTab('historico');

      if (data.ordemDesconto) {
        notify(`${selectedEquipeItems.length} devolução(ões) por prefixo processada(s) e ${selectedFuncionariosDesconto.length} ordem(ns) de desconto gerada(s) com sucesso!`, 'success');
      } else {
        notify(`${selectedEquipeItems.length} devolução(ões) por prefixo processada(s) com sucesso!`, 'success');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao processar devolução por prefixo: ' + error.message, 'error');
    }
  });

  // Validate form before processing
  const validateForm = () => {
    if (!selectedUser || !currentUser || selectedItems.length === 0) {
      notify('Dados incompletos para processar devolução', 'error');
      return false;
    }

    // Validar base obrigatória quando gerar ordem de desconto
    if (gerarOrdemDesconto && !selectedBase) {
      setBaseError(true);
      baseSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notify('Selecione uma base/contrato para gerar a ordem de desconto', 'error');
      return false;
    }

    // Validações específicas
    if ((condicaoDevolucao === 'danificado' || condicaoDevolucao === 'reteste') && !observacoesDevolucao.trim()) {
      notify('Observações são obrigatórias para itens danificados ou para reteste', 'error');
      return false;
    }

    if (condicaoDevolucao === 'danificado' && !evidenciaFile) {
      notify('Evidência fotográfica é obrigatória para itens danificados', 'error');
      return false;
    }

    if (condicaoDevolucao === 'reteste' && !evidenciaFile) {
      notify('Evidência fotográfica é obrigatória para itens para reteste', 'error');
      return false;
    }

    return true;
  };

  // Validate form for prefixo devolution
  const validatePrefixoForm = () => {
    if (!selectedEquipe || !currentUser || selectedEquipeItems.length === 0) {
      notify('Dados incompletos para processar devolução por prefixo', 'error');
      return false;
    }

    if (gerarOrdemDescontoPrefixo && selectedFuncionariosDesconto.length === 0) {
      notify('Selecione pelo menos um funcionário para receber o desconto', 'error');
      return false;
    }

    // Validar base obrigatória quando gerar ordem de desconto por prefixo
    if (gerarOrdemDescontoPrefixo && !selectedBasePrefixo) {
      setBasePrefixoError(true);
      baseSelectorPrefixoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notify('Selecione uma base/contrato para gerar a ordem de desconto', 'error');
      return false;
    }

    // Validações específicas
    if ((condicaoDevolucaoPrefixo === 'danificado' || condicaoDevolucaoPrefixo === 'reteste') && !observacoesDevolucaoPrefixo.trim()) {
      notify('Observações são obrigatórias para itens danificados ou para reteste', 'error');
      return false;
    }

    if (condicaoDevolucaoPrefixo === 'danificado' && !evidenciaFilePrefixo) {
      notify('Evidência fotográfica é obrigatória para itens danificados', 'error');
      return false;
    }

    if (condicaoDevolucaoPrefixo === 'reteste' && !evidenciaFilePrefixo) {
      notify('Evidência fotográfica é obrigatória para itens para reteste', 'error');
      return false;
    }

    return true;
  };

  // Funções auxiliares
  const resetForm = () => {
    setSelectedUser(null);
    setSelectedBase('');
    setBaseError(false);
    setSelectedItems([]);
    setCondicaoDevolucao('bom');
    setObservacoesDevolucao('');
    setEvidenciaFile(null);
    setGerarOrdemDesconto(false);
    setPreviewUrl(null);
    setSearchFuncionario('');
    setSearchItem('');
    setParcelas(1);
    setValoresItens({});
    setDamageFiles([]);
    setDocumentFiles([]);
    setDocumentInfo({
      tipo_documento: 'nf',
      numero_documento: '',
      valor_documento: '',
      data_documento: '',
      observacoes_danos: '',
      outros_documentos: '',
    });
  };

  // Função para resetar formulário de prefixo
  const resetPrefixoForm = () => {
    setSelectedEquipe(null);
    setSelectedEquipeItems([]);
    setSelectedFuncionariosDesconto([]);
    setCondicaoDevolucaoPrefixo('bom');
    setObservacoesDevolucaoPrefixo('');
    setEvidenciaFilePrefixo(null);
    setGerarOrdemDescontoPrefixo(false);
    setSelectedBasePrefixo('');
    setBasePrefixoError(false);
    setSearchEquipe('');
    setSearchFuncionarioDesconto('');
    setParcelasPrefixo(1);
    setValoresItensPrefixo({});
  };

  // Funções de formatação de valor
  function formatarValor(valor: string) {
    if (!valor) return '';
    const num = Number(valor.replace(/\D/g, ''));
    if (isNaN(num) || valor === '') return '';
    return (num / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Funções de upload de arquivos
  const handleDamageFileSelect = (files: FileList) => {
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        notify(`Arquivo ${file.name} é muito grande. Máximo 50MB`, 'error');
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
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        notify(`Arquivo ${file.name} é muito grande. Máximo 50MB`, 'error');
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

          if (!filePath) {
            throw new Error('Erro ao gerar caminho do arquivo');
          }

          const { error: uploadError } = await supabase.storage
            .from('discount-orders-damages')
            .upload(filePath, file);

          if (uploadError) {
            console.error('❌ Erro no upload:', uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('discount-orders-damages')
            .getPublicUrl(filePath);

          uploadedDamages.push({
            name: file.name,
            url: publicUrl,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });

          console.log('✅ Upload concluído:', file.name);
        }
        console.log('✅ Todos os arquivos de danos foram enviados');
      } catch (error) {
        console.error('❌ Erro no upload de danos:', error);
        throw error;
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

          if (!filePath) {
            throw new Error('Erro ao gerar caminho do arquivo');
          }

          const { error: uploadError } = await supabase.storage
            .from('discount-orders-damages')
            .upload(filePath, file);

          if (uploadError) {
            console.error('❌ Erro no upload:', uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('discount-orders-damages')
            .getPublicUrl(filePath);

          uploadedDocuments.push({
            name: file.name,
            url: publicUrl,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });

          console.log('✅ Upload de documento concluído:', file.name);
        }
        console.log('✅ Todos os documentos foram enviados');
      } catch (error) {
        console.error('❌ Erro no upload de documentos:', error);
        throw error;
      } finally {
        setUploadingDocuments(false);
      }
    }

    return { uploadedDamages, uploadedDocuments };
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchFuncionario('');
  };

  const handleItemSelect = (item: { id: string; item_estoque_id?: string; nome?: string; item?: { nome: string; valor_unitario?: number }; quantidade?: number }, source: 'inventario' | 'base') => {
    const itemWithSource = { ...item, source, quantidade: 1 };
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id && i.source === source);
      if (exists) return prev;
      return [...prev, itemWithSource];
    });
  };

  const handleRemoveItem = (itemId: string, source: string) => {
    setSelectedItems(prev => prev.filter(i => !(i.id === itemId && i.source === source)));
    // Remover também o valor do item do objeto valoresItens
    setValoresItens(prev => {
      const novosValores = { ...prev };
      delete novosValores[itemId];
      return novosValores;
    });
  };

  const handleQuantityChange = (itemId: string, source: string, quantidade: number) => {
    setSelectedItems(prev => prev.map(item =>
      item.id === itemId && item.source === source
        ? { ...item, quantidade: Math.max(1, quantidade) }
        : item
    ));

    // Recalcular o valor do item quando a quantidade muda
    setSelectedItems(prev => {
      const item = prev.find(i => i.id === itemId && i.source === source);
      if (item) {
        const valorUnitario = item.valor_unitario || item.item?.valor_unitario || 0;
        const novoValor = valorUnitario * Math.max(1, quantidade);
        setValoresItens(prevValores => ({
          ...prevValores,
          [itemId]: novoValor
        }));
      }
      return prev;
    });
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        notify('Por favor, selecione apenas arquivos de imagem', 'error');
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        notify('Arquivo muito grande. Máximo 5MB', 'error');
        return;
      }

      setEvidenciaFile(file);

      // Criar preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, [notify]);


  function handleFileUpload(orderId: string, file: File) {
    // Abrir modal de confirmação em vez de fazer upload direto
    const order = ordensDesconto.find(o => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
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
  }

  function handleEditOrder(order: DiscountOrderWithJoins) {
    // Encontrar o usuário da ordem
    const usuario = users.find((u: User) => u.id === order.target_user_id);
    setEditingUser(usuario || null);

    // Definir a ordem de edição e abrir modal
    setEditingOrder(order);
    setEditingObservacoes(order.observacoes_danos || '');
    setEditingParcelas(order.parcelas || 1);
    setShowEditModal(true);

    // Para edição, vamos inicializar com os itens descritos na descrição da ordem
    // (já que não temos uma tabela separada de itens por ordem)
    const itensParsed = parseItemsFromDescription(order.descricao);
    setEditingItems([...itensParsed]);

    // Inicializar valores dos itens parseados
    const novosValores: { [key: string]: number } = {};
    itensParsed.forEach(item => {
      const itemId = item.id;
      if (itemId) {
        novosValores[itemId] = item.valor_unitario || 0;
      }
    });
    setEditingValores(novosValores);
  }

  // Função para cancelar/excluir ordem de desconto
  async function handleDeleteOrder(orderId: string) {
    if (!confirm('Tem certeza que deseja cancelar/excluir esta ordem de desconto?')) {
      return;
    }

    try {
      await discountOrderService.delete(orderId);
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_recentes_almoxarifado'] });
      notify('Ordem de desconto cancelada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao cancelar ordem de desconto:', error);
      notify('Erro ao cancelar ordem de desconto: ' + (error as Error).message, 'error');
    }
  }

  // Função para extrair itens da descrição da ordem
  function parseItemsFromDescription(descricao: string): Array<{ id: string; item_estoque_id?: string; nome?: string; item?: { nome: string; valor_unitario?: number }; quantidade: number; valor_unitario?: number; source: string }> {
    const itens = [];
    const regex = /([^(]+)\s*\(Qtd:\s*(\d+)\)\s*-\s*R\$\s*(\d+(?:\.\d+)?)/g;
    let match;
    let index = 0;

    while ((match = regex.exec(descricao)) !== null) {
      const nomeItem = match[1].trim();
      const quantidade = parseInt(match[2]);
      const valor = parseFloat(match[3]);

      itens.push({
        id: `item_${index++}`,
        nome: nomeItem,
        quantidade: quantidade,
        valor_unitario: valor,
        source: 'base' // Consideramos que vêm da base por padrão
      });
    }

    return itens;
  }

  // Função para salvar ordem editada
  async function handleSaveEditedOrder() {
    if (!editingOrder || !editingUser || editingItems.length === 0) {
      notify('Dados incompletos para salvar ordem', 'error');
      return;
    }

    try {
      const valorTotal = Object.values(editingValores).reduce((total, valor) => total + valor, 0);

      // Gerar descrição detalhada com itens e quantidades
      const itensDetalhados = editingItems.map(item => {
        const itemId = item.id || item.item_estoque_id;
        if (!itemId) return '';
        const nomeItem = item.nome || item.item?.nome;
        const quantidade = item.quantidade || 1;
        const valorItem = editingValores[itemId] || 0;
        return `${nomeItem} (Qtd: ${quantidade}) - R$ ${valorItem % 1 === 0 ? valorItem.toString() : valorItem.toFixed(2)}`;
      }).filter(Boolean).join('; ');

      const descricaoCompleta = `Desconto automático por dano/perda dos seguintes itens: ${itensDetalhados}`;

      // Atualizar a ordem
      const { error } = await supabase
        .from('discount_orders')
        .update({
          valor_total: valorTotal,
          parcelas: editingParcelas,
          valor_parcela: editingParcelas > 1 ? valorTotal / editingParcelas : valorTotal,
          descricao: descricaoCompleta,
          observacoes_danos: editingObservacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingOrder.id)
        .select()
        .single();

      if (error) throw error;

      // Regenerar PDF
      const response = await fetch('/api/discount-orders/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: editingOrder.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao regenerar PDF:', errorText);
        notify('Ordem atualizada, mas erro ao regenerar PDF', 'warning');
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        notify('Ordem atualizada e PDF regenerado com sucesso!', 'success');
      }

      // Fechar modal e limpar estados
      setShowEditModal(false);
      setEditingOrder(null);
      setEditingItems([]);
      setEditingUser(null);
      setEditingValores({});
      setEditingObservacoes('');
      setEditingParcelas(1);

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_recentes_almoxarifado'] });

    } catch (error) {
      console.error('Erro ao salvar ordem editada:', error);
      notify('Erro ao salvar ordem: ' + (error as Error).message, 'error');
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  function formatarDataBR(data: string | Date | undefined): string {
    if (!data || data === '-' || data === 'Invalid date') return 'Sem data';
    try {
      const match = typeof data === 'string' && data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      const d = new Date(data);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
      return 'Sem data';
    } catch { return 'Sem data'; }
  }

  // Funções de formatação de moeda
  const formatCurrencyInput = (value: number) => {
    if (value === 0) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };


  // Função para formatar valor para exibição (sempre com 2 casas decimais)
  const formatCurrencyDisplay = (value: number) => {
    if (value === 0) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };


  if (usersLoading || devolucoesLoading || statsLoading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  };
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.ALMOXARIFADO.PROCESSAR_DEVOLUCOES]}>
      <div className="bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Devoluções de Material</h1>
                <p className="mt-2 text-gray-600">Gerencie devoluções de EPIs e materiais com workflow automatizado</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <ChartBarIcon className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-green-50 p-3 rounded-lg">
                  <CheckBadgeIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Devoluções este mês</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.devolucoesMes || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <UserIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Itens em uso</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.itensEmUso || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-orange-50 p-3 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ordens de desconto</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.ordensDesconto || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="bg-red-50 p-3 rounded-lg">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Itens para reteste</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.devolucoesPorCondicao?.danificado || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-2">
              <nav className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setActiveTab('processar')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'processar'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Processar Devolução
                </button>
                <button
                  onClick={() => setActiveTab('prefixo')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'prefixo'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Devolução por Prefixo
                </button>
                <button
                  onClick={() => setActiveTab('historico')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'historico'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Histórico Recente
                </button>
                <button
                  onClick={() => setActiveTab('ordens')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'ordens'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Ordens de Desconto
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'processar' ? (
                <div className="text-center py-12">
                  <div className="bg-blue-50 rounded-full p-6 w-24 h-24 mx-auto mb-6">
                    <DocumentTextIcon className="h-12 w-12 text-blue-600 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Processar Devolução</h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    Selecione funcionário e itens para processar devoluções com geração automática de ordem de desconto
                  </p>
                  <button
                    onClick={() => setShowProcessarModal(true)}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-lg"
                  >
                    Iniciar Processo de Devolução
                  </button>
                </div>
              ) : null}

              {activeTab === 'prefixo' ? (
                <div>
                  {/* Passo 1: Selecionar Equipe */}
                  <div className="mb-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">1. Selecionar Equipe</h4>
                    {selectedEquipe ? (
                      <div className="flex items-center gap-3 p-3 border border-green-500 bg-green-50 rounded-lg max-w-md">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{selectedEquipe.nome}</div>
                          <div className="text-xs text-gray-500">{selectedEquipe.operacao}{selectedEquipe.prefixo ? ` • Prefixo: ${selectedEquipe.prefixo}` : ''}</div>
                        </div>
                        <button onClick={() => { setSelectedEquipe(null); setSelectedEquipeItems([]); setSelectedBasePrefixo(''); }} className="p-1 text-gray-400 hover:text-red-500"><XCircleIcon className="h-5 w-5" /></button>
                      </div>
                    ) : (
                      <div className="max-w-md">
                        <div className="relative mb-3">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="text" placeholder="Buscar equipe por nome..." value={searchEquipe} onChange={(e) => setSearchEquipe(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {equipesLoading ? (
                            <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div></div>
                          ) : equipes.filter(e => e.nome.toLowerCase().includes(searchEquipe.toLowerCase())).map((equipe) => (
                            <div key={equipe.id} onClick={() => { setSelectedEquipe({ id: equipe.id, nome: equipe.nome, prefixo: equipe.prefixo, operacao: equipe.operacao, base_id: equipe.base_id || undefined }); setSelectedBasePrefixo(equipe.base_id || ''); }} className="p-2 border border-gray-200 hover:border-green-300 hover:bg-green-50 rounded-lg cursor-pointer text-sm">
                              <div className="font-medium text-gray-900">{equipe.nome}</div>
                              <div className="text-xs text-gray-500">{equipe.operacao}{equipe.prefixo ? ` • ${equipe.prefixo}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedEquipe && (
                    <>
                      {/* Passo 2: Selecionar Itens */}
                      <div className="mb-6">
                        <h4 className="text-base font-semibold text-gray-900 mb-3">2. Selecionar Itens para Devolução</h4>

                        <div className="relative mb-3 max-w-md">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="text" placeholder="Buscar item..." value={searchItemEquipe} onChange={(e) => setSearchItemEquipe(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                        </div>

                        {/* Itens do Inventário da Equipe */}
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-600 mb-2">Inventário da Equipe</h5>
                          {inventarioEquipeLoading ? (
                            <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div></div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                              {inventarioEquipe.filter(item => {
                                const s = searchItemEquipe.toLowerCase();
                                return (item.item?.nome || '').toLowerCase().includes(s) || (item.item?.codigo || '').toLowerCase().includes(s);
                              }).map((item) => {
                                const isSelected = selectedEquipeItems.find(i => i.id === item.id);
                                const qtdTotal = item.quantidade_total || item.quantidade_disponivel || 0;
                                return (
                                  <div key={item.id} className={`p-2 border rounded-lg text-sm cursor-pointer transition-all ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'}`}
                                    onClick={() => {
                                      if (!isSelected) {
                                        setSelectedEquipeItems(prev => [...prev, { id: item.id, item_estoque_id: item.item_estoque_id, nome: item.item?.nome, item: item.item, quantidade: qtdTotal, valor_unitario: item.item?.valor_unitario, source: 'equipe', quantidade_disponivel: item.quantidade_disponivel, quantidade_em_uso: item.quantidade_em_uso }]);
                                      } else {
                                        setSelectedEquipeItems(prev => prev.filter(i => i.id !== item.id));
                                      }
                                    }}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">{item.item?.nome}</div>
                                        <div className="text-xs text-gray-500">{item.item?.codigo} • Qtd: {qtdTotal}</div>
                                      </div>
                                      {isSelected && <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 ml-2" />}
                                    </div>
                                  </div>
                                );
                              })}
                              {inventarioEquipe.length === 0 && <div className="col-span-full text-center py-4 text-gray-400 text-sm">Nenhum item no inventário desta equipe</div>}
                            </div>
                          )}
                        </div>

                        {/* Itens da Base */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-2">Itens da Base (avulsos)</h5>
                          <div className="mb-2 max-w-xs">
                            <select ref={baseSelectorPrefixoRef} value={selectedBasePrefixo} onChange={(e) => { setSelectedBasePrefixo(e.target.value); setBasePrefixoError(false); }} className={`w-full px-2 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${basePrefixoError ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-300'}`}>
                              <option value="">Selecionar base...</option>
                              {basesContratoPrefixo.map((base) => (<option key={base.id} value={base.id}>{base.nome}{base.codigo ? ` (${base.codigo})` : ''}</option>))}
                            </select>
                          </div>
                          {itensBaseEquipeLoading ? (
                            <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div></div>
                          ) : !selectedBasePrefixo ? (
                            <div className="text-sm text-gray-400">Selecione uma base acima</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                              {itensBaseEquipe.filter(item => {
                                const s = searchItemEquipe.toLowerCase();
                                return ((item.nome || '').toLowerCase().includes(s) || (item.codigo || '').toLowerCase().includes(s)) && !selectedEquipeItems.find(i => i.item_estoque_id === item.id);
                              }).map((item) => (
                                <div key={item.id} className="p-2 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-lg text-sm cursor-pointer transition-all"
                                  onClick={() => {
                                    if (!selectedEquipeItems.find(i => i.item_estoque_id === item.id)) {
                                      setSelectedEquipeItems(prev => [...prev, { id: `base_${item.id}`, item_estoque_id: item.id, nome: item.nome, item: { nome: item.nome, valor_unitario: item.valor_unitario }, quantidade: 1, valor_unitario: item.valor_unitario, source: 'base', quantidade_disponivel: item.estoque_atual }]);
                                    }
                                  }}>
                                  <div className="font-medium text-gray-900 truncate">{item.nome}</div>
                                  <div className="text-xs text-gray-500">{item.codigo} • Estoque: {item.estoque_atual}{item.valor_unitario > 0 ? ` • R$ ${item.valor_unitario.toFixed(2)}` : ''}</div>
                                </div>
                              ))}
                              {itensBaseEquipe.length === 0 && <div className="col-span-full text-center py-2 text-gray-400 text-sm">Nenhum item na base</div>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Itens Selecionados */}
                      {selectedEquipeItems.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-base font-semibold text-gray-900 mb-3">Itens Selecionados ({selectedEquipeItems.length})</h4>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                                  <th className="px-3 py-2 text-center font-medium text-gray-600 w-28">Quantidade</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Valor Unit.</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Subtotal</th>
                                  <th className="px-3 py-2 w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {selectedEquipeItems.map((item) => {
                                  const valorUnit = item.valor_unitario || item.item?.valor_unitario || 0;
                                  const qtd = item.quantidade || 1;
                                  const maxQtd = item.source === 'equipe' ? (item.quantidade_disponivel || item.quantidade || 9999) : 9999;
                                  return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-gray-900">{item.nome || item.item?.nome}</div>
                                        <div className="text-xs text-gray-400">{item.source === 'equipe' ? 'Inventário' : 'Base'} • Disponível: {item.quantidade_disponivel ?? '-'}</div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <input type="number" min={1} max={maxQtd} value={qtd} onChange={(e) => { const v = Math.max(1, Math.min(maxQtd, parseInt(e.target.value) || 1)); setSelectedEquipeItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: v } : i)); }} className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600">R$ {formatCurrencyDisplay(valorUnit)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-gray-900">R$ {formatCurrencyDisplay(valorUnit * qtd)}</td>
                                      <td className="px-3 py-2 text-center">
                                        <button onClick={() => setSelectedEquipeItems(prev => prev.filter(i => i.id !== item.id))} className="text-gray-400 hover:text-red-500"><XCircleIcon className="h-4 w-4" /></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Passo 3: Condição e Detalhes */}
                      {selectedEquipeItems.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-base font-semibold text-gray-900 mb-3">3. Condição e Detalhes</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Condição *</label>
                              <select value={condicaoDevolucaoPrefixo} onChange={(e) => setCondicaoDevolucaoPrefixo(e.target.value as 'bom' | 'danificado' | 'reteste' | 'perdido' | 'desgaste')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
                                <option value="bom">Bom Estado</option>
                                <option value="desgaste">Desgaste</option>
                                <option value="danificado">Danificado</option>
                                <option value="reteste">Para Reteste</option>
                                <option value="perdido">Perdido</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                              <textarea value={observacoesDevolucaoPrefixo} onChange={(e) => setObservacoesDevolucaoPrefixo(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" placeholder="Descreva a condição dos itens..." />
                            </div>
                          </div>

                          {/* Funcionários para Desconto (só aparece quando danificado/perdido) */}
                          {(condicaoDevolucaoPrefixo === 'danificado' || condicaoDevolucaoPrefixo === 'perdido') && gerarOrdemDescontoPrefixo && (
                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <h5 className="font-medium text-yellow-800 mb-3">Funcionários para Desconto</h5>
                              <div className="relative mb-3 max-w-md">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input type="text" placeholder="Buscar funcionário..." value={searchFuncionarioDesconto} onChange={(e) => setSearchFuncionarioDesconto(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm" />
                              </div>
                              {selectedFuncionariosDesconto.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {selectedFuncionariosDesconto.map((f) => (
                                    <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                      {f.nome} ({f.matricula})
                                      <button onClick={() => setSelectedFuncionariosDesconto(prev => prev.filter(x => x.id !== f.id))} className="hover:text-red-600"><XCircleIcon className="h-3.5 w-3.5" /></button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {funcionariosEquipeLoading ? (
                                  <div className="text-center py-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mx-auto"></div></div>
                                ) : funcionariosEquipe.filter(f => f.nome.toLowerCase().includes(searchFuncionarioDesconto.toLowerCase()) && !selectedFuncionariosDesconto.find(x => x.id === f.id)).slice(0, 10).map((f) => (
                                  <div key={f.id} onClick={() => setSelectedFuncionariosDesconto(prev => [...prev, f])} className="p-2 border border-gray-200 hover:border-yellow-300 hover:bg-yellow-50 rounded cursor-pointer text-sm">
                                    <span className="font-medium">{f.nome}</span> <span className="text-xs text-gray-500">{f.matricula}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Valores */}
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total</label>
                                  <input type="text" value={formatarValor(valorManualOrdemPrefixo.toString())} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setValorManualOrdemPrefixo(Number(v) / 100); }} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                                  <select value={parcelasPrefixo} onChange={(e) => setParcelasPrefixo(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm">
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botão de Processar */}
                      {selectedEquipeItems.length > 0 && (
                        <div className="flex justify-end pt-4 border-t">
                          <button
                            type="button"
                            disabled={processarDevolucaoPrefixoMutation.isPending || selectedEquipeItems.length === 0}
                            onClick={() => { if (validatePrefixoForm()) processarDevolucaoPrefixoMutation.mutate(); }}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center font-medium text-sm transition-colors"
                          >
                            {processarDevolucaoPrefixoMutation.isPending ? (
                              <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                            ) : (
                              `Processar ${selectedEquipeItems.length} Devolução(ões)`
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : null}

              {activeTab === 'historico' && (
                // Histórico de Devoluções
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Últimas Devoluções</h2>
                  <div className="space-y-4">
                    {recentDevolucoes.map((devolucao: Record<string, unknown> & { id: string; funcionario?: { nome: string; matricula?: string }; item?: { nome: string }; condicao_devolucao?: string; data_devolucao?: string; responsavel_devolucao_user?: { nome: string }; quantidade?: number; observacoes_devolucao?: string; _source?: string }) => (
                      <div key={devolucao.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                              <h3 className="font-semibold text-gray-900">{devolucao.funcionario?.nome}</h3>
                              {devolucao.funcionario?.matricula && <span className="text-sm text-gray-500">({devolucao.funcionario?.matricula})</span>}
                              {devolucao._source === 'equipe' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Prefixo</span>
                              )}
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${devolucao.condicao_devolucao === 'bom' ? 'bg-green-100 text-green-800' :
                                devolucao.condicao_devolucao === 'regular' ? 'bg-yellow-100 text-yellow-800' :
                                  devolucao.condicao_devolucao === 'danificado' ? 'bg-red-100 text-red-800' :
                                    devolucao.condicao_devolucao === 'reteste' || devolucao.condicao_devolucao === 'ruim' ? 'bg-orange-100 text-orange-800' :
                                      devolucao.condicao_devolucao === 'perdido' ? 'bg-gray-100 text-gray-800' :
                                        'bg-gray-100 text-gray-800'
                                }`}>
                                {devolucao.condicao_devolucao === 'reteste' ? 'Reteste' : devolucao.condicao_devolucao === 'ruim' ? 'Desgaste' : devolucao.condicao_devolucao || 'N/A'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{devolucao.item?.nome}</p>
                            <div className="flex items-center mt-2 text-xs text-gray-400">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              {formatDate(devolucao.data_devolucao || '')}
                              {devolucao.responsavel_devolucao_user?.nome && (
                                <span className="ml-3">
                                  por {devolucao.responsavel_devolucao_user.nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-600">
                              Qtd: {devolucao.quantidade}
                            </span>
                          </div>
                        </div>
                        {devolucao.observacoes_devolucao && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">{devolucao.observacoes_devolucao}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {recentDevolucoes.length === 0 && (
                      <div className="text-center py-12">
                        <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma devolução recente</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          As devoluções processadas aparecerão aqui
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'ordens' && (
                // Ordens de Desconto - Layout estilo Frota
                <div>
                  {/* Cards de resumo por status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div
                      className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${ordensStatusFilter === 'pendente' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:bg-gray-50'}`}
                      onClick={() => { setOrdensStatusFilter(ordensStatusFilter === 'pendente' ? 'all' : 'pendente'); setOrdensCurrentPage(1); }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${ordensStatusFilter === 'pendente' ? 'bg-yellow-100' : 'bg-yellow-50'}`}>
                              <ClockIcon className={`h-6 w-6 ${ordensStatusFilter === 'pendente' ? 'text-yellow-700' : 'text-yellow-600'}`} />
                            </div>
                            <h3 className={`text-lg font-semibold ${ordensStatusFilter === 'pendente' ? 'text-yellow-800' : 'text-gray-900'}`}>
                              Pendentes{ordensStatusFilter === 'pendente' && <span className="ml-2 text-sm">(ativo)</span>}
                            </h3>
                          </div>
                          <div className={`text-2xl font-bold mb-1 ${ordensStatusFilter === 'pendente' ? 'text-yellow-800' : 'text-yellow-700'}`}>{ordensValoresPorStatus.pendente.quantidade}</div>
                          <div className="text-sm text-gray-600">{ordensValoresPorStatus.pendente.quantidade === 1 ? 'ordem' : 'ordens'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${ordensStatusFilter === 'pendente' ? 'text-yellow-800' : 'text-yellow-700'}`}>R$ {ordensValoresPorStatus.pendente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">valor total</div>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${ordensStatusFilter === 'assinada' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                      onClick={() => { setOrdensStatusFilter(ordensStatusFilter === 'assinada' ? 'all' : 'assinada'); setOrdensCurrentPage(1); }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${ordensStatusFilter === 'assinada' ? 'bg-green-100' : 'bg-green-50'}`}>
                              <CheckCircleIcon className={`h-6 w-6 ${ordensStatusFilter === 'assinada' ? 'text-green-700' : 'text-green-600'}`} />
                            </div>
                            <h3 className={`text-lg font-semibold ${ordensStatusFilter === 'assinada' ? 'text-green-800' : 'text-gray-900'}`}>
                              Assinadas{ordensStatusFilter === 'assinada' && <span className="ml-2 text-sm">(ativo)</span>}
                            </h3>
                          </div>
                          <div className={`text-2xl font-bold mb-1 ${ordensStatusFilter === 'assinada' ? 'text-green-800' : 'text-green-700'}`}>{ordensValoresPorStatus.assinada.quantidade}</div>
                          <div className="text-sm text-gray-600">{ordensValoresPorStatus.assinada.quantidade === 1 ? 'ordem' : 'ordens'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${ordensStatusFilter === 'assinada' ? 'text-green-800' : 'text-green-700'}`}>R$ {ordensValoresPorStatus.assinada.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">valor total</div>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`bg-white rounded-xl shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${ordensStatusFilter === 'recusada' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50'}`}
                      onClick={() => { setOrdensStatusFilter(ordensStatusFilter === 'recusada' ? 'all' : 'recusada'); setOrdensCurrentPage(1); }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${ordensStatusFilter === 'recusada' ? 'bg-red-100' : 'bg-red-50'}`}>
                              <XCircleIcon className={`h-6 w-6 ${ordensStatusFilter === 'recusada' ? 'text-red-700' : 'text-red-600'}`} />
                            </div>
                            <h3 className={`text-lg font-semibold ${ordensStatusFilter === 'recusada' ? 'text-red-800' : 'text-gray-900'}`}>
                              Rejeitadas{ordensStatusFilter === 'recusada' && <span className="ml-2 text-sm">(ativo)</span>}
                            </h3>
                          </div>
                          <div className={`text-2xl font-bold mb-1 ${ordensStatusFilter === 'recusada' ? 'text-red-800' : 'text-red-700'}`}>{ordensValoresPorStatus.rejeitada.quantidade}</div>
                          <div className="text-sm text-gray-600">{ordensValoresPorStatus.rejeitada.quantidade === 1 ? 'ordem' : 'ordens'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${ordensStatusFilter === 'recusada' ? 'text-red-800' : 'text-red-700'}`}>R$ {ordensValoresPorStatus.rejeitada.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">valor total</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barra de busca */}
                  <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 max-w-md w-full">
                      <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Buscar por colaborador, criador, valor ou descrição..."
                        value={searchRecebedor}
                        onChange={e => { setSearchRecebedor(e.target.value); setOrdensCurrentPage(1); }}
                      />
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
                          <th className="px-4 py-2 text-left">Valor</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedOrdensDesconto.length === 0 ? (
                          <tr><td colSpan={6} className="text-center text-gray-400 py-6">Nenhuma ordem encontrada</td></tr>
                        ) : paginatedOrdensDesconto.map((ordem, idx) => {
                          const status = ordem.recusado ? 'recusada' : (ordem.status === 'assinada' || ordem.status === 'assinado') ? 'assinada' : 'pendente';
                          return (
                            <Fragment key={ordem.id}>
                              <tr
                                className={`cursor-pointer hover:bg-blue-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                onClick={() => setExpandedOrderId(prev => prev === ordem.id ? null : ordem.id)}
                              >
                                <td className="px-4 py-1.5 whitespace-nowrap text-center">{formatarDataBR(ordem.data_geracao || ordem.created_at)}</td>
                                <td className="px-4 py-1.5 font-medium whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{ordem.target_user?.nome || '-'}</span>
                                    {ordem.target_user?.matricula && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">{ordem.target_user.matricula}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 whitespace-nowrap"><span className="text-sm">{ordem.created_by_user?.nome || '-'}</span></td>
                                <td className="px-4 py-1.5 whitespace-nowrap text-center">R$ {ordem.valor_total ? ordem.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</td>
                                <td className="pl-4 pr-1 py-1.5 whitespace-nowrap text-center">
                                  {status === 'recusada' ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">Recusada</span>
                                  ) : status === 'assinada' ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-700">Assinada</span>
                                  ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-700">Pendente</span>
                                  )}
                                </td>
                                <td className="pl-0 pr-2 py-1 whitespace-nowrap text-center text-[10px] text-gray-400">{expandedOrderId === ordem.id ? '▲' : '▼'}</td>
                              </tr>
                              {expandedOrderId === ordem.id && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-3 bg-blue-50/40">
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                                      <div><span className="text-gray-500">Descrição:</span> <span className="text-gray-900">{ordem.descricao || '-'}</span></div>
                                      <div><span className="text-gray-500">Parcelas:</span> <span className="text-gray-900">{ordem.parcelas || 1}x</span></div>
                                      <div><span className="text-gray-500">Criado em:</span> <span className="text-gray-900">{formatarDataBR(ordem.created_at)}</span></div>
                                      {ordem.observacoes_danos && <div className="col-span-2"><span className="text-gray-500">Obs. danos:</span> <span className="text-gray-900">{ordem.observacoes_danos}</span></div>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                                      {(ordem.danos_evidencias_urls && ordem.danos_evidencias_urls.length > 0) && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-gray-500">Danos:</span>
                                          {ordem.danos_evidencias_urls.map((url: string, i: number) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-white text-blue-700 hover:bg-blue-50">
                                              <PhotoIcon className="h-3 w-3" /> {i + 1}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {(ordem.nf_os_documentos_urls && ordem.nf_os_documentos_urls.length > 0) && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-gray-500">NF/OS:</span>
                                          {ordem.nf_os_documentos_urls.map((url: string, i: number) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-white text-blue-700 hover:bg-blue-50">
                                              <PaperClipIcon className="h-3 w-3" /> {i + 1}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {ordem.recusado && (
                                      <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs">
                                        <span className="font-semibold text-red-700">Recusada</span>
                                      </div>
                                    )}
                                    {status === 'pendente' && (
                                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <button onClick={(e) => { e.stopPropagation(); handleEditOrder(ordem); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors">
                                          <PencilIcon className="h-3.5 w-3.5" /> Editar
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(ordem.id); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 transition-colors">
                                          <TrashIcon className="h-3.5 w-3.5" /> Cancelar
                                        </button>
                                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 cursor-pointer transition-colors">
                                          <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Upload Assinado
                                          <input type="file" accept="application/pdf" className="hidden" onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              if (file.size > 10 * 1024 * 1024) { notify('Arquivo muito grande. Máximo 10MB.', 'error'); return; }
                                              if (file.type !== 'application/pdf') { notify('Apenas arquivos PDF são aceitos.', 'error'); return; }
                                              handleFileUpload(ordem.id, file);
                                            }
                                          }} />
                                        </label>
                                        {ordem.arquivo_assinado_url && (
                                          <button onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              const res = await fetch(ordem.arquivo_assinado_url);
                                              const contentType = res.headers.get('content-type') || '';
                                              const blob = await res.blob();
                                              const blobType = contentType.includes('pdf') ? 'application/pdf' : 'text/html';
                                              const finalBlob = new Blob([blob], { type: blobType });
                                              const url = URL.createObjectURL(finalBlob);
                                              window.open(url, '_blank');
                                              setTimeout(() => URL.revokeObjectURL(url), 5000);
                                            } catch (err) { console.error('Erro ao abrir modelo:', err); notify('Erro ao abrir modelo', 'error'); }
                                          }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 text-green-700 text-xs font-medium hover:bg-green-50 transition-colors">
                                            <DocumentTextIcon className="h-3.5 w-3.5" /> Ver Modelo
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {(status === 'assinada' || status === 'recusada') && ordem.arquivo_assinado_url && (
                                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <a href={ordem.arquivo_assinado_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 transition-colors">
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
                  {ordensTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-6">
                      <span className="text-sm text-gray-600">Página {ordensCurrentPage} de {ordensTotalPages} • {filteredOrdensDesconto.length} ordens encontradas</span>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50" onClick={() => setOrdensCurrentPage(p => Math.max(1, p - 1))} disabled={ordensCurrentPage === 1}>Anterior</button>
                        <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50" onClick={() => setOrdensCurrentPage(p => Math.min(ordensTotalPages, p + 1))} disabled={ordensCurrentPage === ordensTotalPages}>Próxima</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Modal de Processar Devolução */}
        {showProcessarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto">
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">
                    Processar Devolução de Itens
                  </h3>
                  <button
                    onClick={() => setShowProcessarModal(false)}
                    className="text-blue-100 hover:text-white transition-colors"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Painel 1: Seleção de Funcionário */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">1. Selecionar Funcionário</h4>

                    {/* Busca de Funcionário */}
                    <div className="relative mb-4">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar funcionário..."
                        value={searchFuncionario}
                        onChange={(e) => setSearchFuncionario(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* Lista de Funcionários */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {usersLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      ) : filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all text-sm ${selectedUser?.id === user.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-white'
                            }`}
                        >
                          <div className="font-medium text-gray-900">{user.nome}</div>
                          <div className="text-xs text-gray-500">{user.matricula}</div>
                        </div>
                      ))}
                    </div>

                    {selectedUser && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                          <CheckCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
                          <div>
                            <div className="font-medium text-blue-900">{selectedUser.nome}</div>
                            <div className="text-sm text-blue-700">{selectedUser.matricula}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Painel 2: Seleção de Itens */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">2. Selecionar Itens</h4>

                    {selectedUser ? (
                      <div className="space-y-4">
                        {/* Inventário do Funcionário */}
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Inventário Atual</h5>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {inventarioLoading ? (
                              <div className="text-center py-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                              </div>
                            ) : inventarioFuncionario.length > 0 ? (
                              inventarioFuncionario.map((item) => (
                                <div
                                  key={`inv-${item.id}`}
                                  onClick={() => handleItemSelect(item, 'inventario')}
                                  className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-white text-xs"
                                >
                                  <div className="font-medium">{item.item?.nome}</div>
                                  <div className="text-gray-500">Qtd: {item.quantidade}</div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500 text-center py-2">
                                Nenhum item no inventário
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Seleção por Base */}
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">
                            Buscar por Base {gerarOrdemDesconto && <span className="text-red-500">*</span>}
                          </h5>
                          <select
                            ref={baseSelectorRef}
                            value={selectedBase}
                            onChange={(e) => { setSelectedBase(e.target.value); setBaseError(false); }}
                            className={`w-full p-2 border rounded text-sm mb-2 transition-all ${baseError ? 'border-red-500 ring-2 ring-red-500 animate-pulse' : 'border-gray-300'}`}
                          >
                            <option value="">Selecionar base...</option>
                            {bases.map((base) => (
                              <option key={base.id} value={base.id}>{base.nome}</option>
                            ))}
                          </select>

                          {selectedBase && (
                            <>
                              <input
                                type="text"
                                placeholder="Buscar item..."
                                value={searchItem}
                                onChange={(e) => setSearchItem(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm mb-2"
                              />
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {itensBaseLoading ? (
                                  <div className="text-center py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                                  </div>
                                ) : filteredItensBase.map((item) => (
                                  <div
                                    key={`base-${item.id}`}
                                    onClick={() => handleItemSelect(item, 'base')}
                                    className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-white text-xs"
                                  >
                                    <div className="font-medium">{item.nome}</div>
                                    <div className="text-gray-500">{item.codigo && <span>Cód: {item.codigo} | </span>}Estoque: {item.estoque_atual}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Selecione um funcionário primeiro
                      </div>
                    )}
                  </div>

                  {/* Painel 3: Itens Selecionados */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">3. Itens para Devolução</h4>

                    {selectedItems.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedItems.map((item, index) => {
                          const valorUnitario = item.valor_unitario || item.item?.valor_unitario || 0;
                          const quantidade = item.quantidade || 1;
                          const subtotal = valorUnitario * quantidade;

                          return (
                            <div key={`selected-${item.id}-${item.source}-${index}`} className="p-3 bg-white border border-gray-200 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">
                                    {item.nome || item.item?.nome}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.source === 'inventario' ? 'Do inventário' : 'Da base'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveItem(item.id, item.source)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex items-center space-x-2">
                                <label className="text-xs text-gray-600">Qtd:</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantidade}
                                  onChange={(e) => handleQuantityChange(item.id, item.source, parseInt(e.target.value))}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                />
                              </div>
                              <div className="mt-2 flex justify-between text-xs text-gray-600">
                                <span>Valor unit.: R$ {formatCurrencyDisplay(valorUnitario)}</span>
                                <span>Subtotal: R$ {formatCurrencyDisplay(subtotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Nenhum item selecionado
                      </div>
                    )}
                  </div>
                </div>

                {/* Formulário de Processamento */}
                {selectedItems.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (validateForm()) {
                        processarDevolucaoMutation.mutate();
                      }
                    }} className="space-y-6">
                      {/* Condição da Devolução */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-4">
                          Condição do Item *
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { value: 'bom', label: 'Bom Estado', color: 'green', icon: CheckBadgeIcon, description: 'Item em perfeitas condições - volta ao estoque' },
                            { value: 'desgaste', label: 'Desgaste', color: 'yellow', icon: ArrowPathIcon, description: 'Item com desgaste natural - não volta ao estoque' },
                            { value: 'danificado', label: 'Danificado', color: 'red', icon: ExclamationTriangleIcon, description: 'Item com danos sem recuperação - descartado' },
                            { value: 'reteste', label: 'Reteste', color: 'orange', icon: ExclamationTriangleIcon, description: 'Item para reteste - não volta ao estoque' },
                            { value: 'perdido', label: 'Perdido', color: 'gray', icon: XCircleIcon, description: 'Item perdido - não foi devolvido' }
                          ].map((opcao) => {
                            const IconComponent = opcao.icon;
                            return (
                              <label
                                key={opcao.value}
                                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${condicaoDevolucao === opcao.value
                                  ? opcao.color === 'green' ? 'border-green-500 bg-green-50 shadow-md' :
                                    opcao.color === 'yellow' ? 'border-yellow-500 bg-yellow-50 shadow-md' :
                                      opcao.color === 'red' ? 'border-red-500 bg-red-50 shadow-md' :
                                        'border-gray-500 bg-gray-50 shadow-md'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="condicao"
                                  value={opcao.value}
                                  checked={condicaoDevolucao === opcao.value}
                                  onChange={(e) => setCondicaoDevolucao(e.target.value as 'bom' | 'danificado' | 'reteste' | 'perdido' | 'desgaste')}
                                  className="sr-only"
                                />
                                <div className="flex items-center mb-2">
                                  <IconComponent className={`h-5 w-5 mr-2 ${condicaoDevolucao === opcao.value
                                    ? opcao.color === 'green' ? 'text-green-600' :
                                      opcao.color === 'yellow' ? 'text-yellow-600' :
                                        opcao.color === 'red' ? 'text-red-600' :
                                          'text-gray-600'
                                    : 'text-gray-400'
                                    }`} />
                                  <span className="font-semibold text-sm">{opcao.label}</span>
                                </div>
                                <p className="text-xs text-gray-500">{opcao.description}</p>
                                {condicaoDevolucao === opcao.value && (
                                  <div className="absolute top-2 right-2">
                                    <CheckCircleIcon className={`h-5 w-5 ${opcao.color === 'green' ? 'text-green-600' :
                                      opcao.color === 'yellow' ? 'text-yellow-600' :
                                        opcao.color === 'red' ? 'text-red-600' :
                                          'text-gray-600'
                                      }`} />
                                  </div>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Observações */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observações {(condicaoDevolucao === 'danificado' || condicaoDevolucao === 'reteste') && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <textarea
                          value={observacoesDevolucao}
                          onChange={(e) => setObservacoesDevolucao(e.target.value)}
                          placeholder="Descreva o estado do item, motivo da devolução, etc..."
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={condicaoDevolucao === 'danificado' || condicaoDevolucao === 'reteste'}
                        />
                      </div>

                      {/* Upload de Evidência */}
                      {(condicaoDevolucao === 'danificado' || condicaoDevolucao === 'reteste') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Evidência Fotográfica <span className="text-red-500">*</span>
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-gray-400 transition-colors">
                            <div className="text-center">
                              <div className="bg-gray-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
                                <PhotoIcon className="h-10 w-10 text-gray-400 mx-auto" />
                              </div>
                              <div>
                                <label className="cursor-pointer">
                                  <span className="mt-2 block text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                                    Clique para selecionar uma foto
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="sr-only"
                                  />
                                </label>
                                <p className="mt-2 text-xs text-gray-500">
                                  PNG, JPG, GIF, WebP até 5MB
                                </p>
                              </div>
                            </div>

                            {previewUrl ? (
                              <div className="mt-6 text-center">
                                <Image
                                  src={previewUrl}
                                  alt="Preview"
                                  width={160}
                                  height={160}
                                  className="mx-auto h-40 w-40 object-cover rounded-xl shadow-md border border-gray-200"
                                />
                                <p className="mt-2 text-xs text-green-600 font-medium">✓ Imagem carregada</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* Gerar Ordem de Desconto */}
                      {(condicaoDevolucao === 'danificado' || condicaoDevolucao === 'perdido') && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <div className="h-4 w-4 bg-blue-600 rounded flex items-center justify-center mr-2">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              ✅ Ordem de desconto será gerada automaticamente
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-600">
                            Uma ordem de desconto será criada automaticamente para cobrar o valor do(s) item(s) danificado(s)/perdido(s)
                          </p>

                          {gerarOrdemDesconto && selectedItems.length > 0 && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                💰 Valores dos Itens para Desconto
                              </label>
                              <div className="space-y-3">
                                {selectedItems.map(item => {
                                  const itemId = item.id || item.item_estoque_id;
                                  if (!itemId) return null;

                                  const nomeItem = item.nome || item.item?.nome;
                                  const quantidade = item.quantidade || 1;
                                  const valorEstoque = item.valor_unitario || item.item?.valor_unitario || 0;
                                  const valorAtual = valoresItens[itemId] || valorEstoque * quantidade;

                                  return (
                                    <div key={itemId} className="bg-white p-3 rounded border border-gray-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                          {nomeItem} (Qtd: {quantidade})
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">R$</span>
                                        <input
                                          type="text"
                                          value={formatCurrencyInput(valorAtual)}
                                          onChange={(e) => {
                                            const rawValue = e.target.value.replace(/\D/g, '').replace(/^0+/, '') || '0';
                                            if (rawValue === '0') {
                                              if (itemId) updateItemValue(itemId, 0);
                                              return;
                                            }
                                            if (itemId) updateItemValue(itemId, parseInt(rawValue) / 100);
                                          }}
                                          onFocus={(e) => {
                                            // Selecionar todo o texto para facilitar edição
                                            e.target.select();
                                          }}
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-mono"
                                          placeholder="0,00"
                                        />
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Valor estoque: R$ {formatCurrencyDisplay(valorEstoque * quantidade)}
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="border-t border-gray-300 pt-3 mt-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-700">Total:</span>
                                    <span className="text-lg font-bold text-green-600">
                                      R$ {formatCurrencyDisplay(valorManualOrdem)}
                                    </span>
                                  </div>
                                </div>

                                {/* Seleção de Parcelas */}
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">
                                      Parcelas
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="12"
                                      value={parcelas}
                                      onChange={(e) => setParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                    />
                                  </div>
                                  {parcelas > 1 && (
                                    <div className="text-xs text-blue-600">
                                      Valor por parcela: R$ {formatCurrencyDisplay(valorManualOrdem / parcelas)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-600">
                                Edite os valores individuais de cada item. O total será calculado automaticamente.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Seção de Informações do Documento NF/OS */}
                      <div className="border-t pt-4 mt-2">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <DocumentTextIcon className="h-4 w-4" />
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
                                    <span className="text-sm text-gray-700">{file.name}</span>
                                    <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDamageFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seção de Upload de Documentos NF/OS */}
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <DocumentTextIcon className="h-4 w-4" />
                          Documentos NF/OS ({documentFiles.length}/5)
                        </h4>
                        <div className="space-y-3">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            <div className="text-center">
                              <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-400" />
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
                                    <DocumentTextIcon className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm text-gray-700">{file.name}</span>
                                    <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDocumentFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Observações sobre os Documentos */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observações sobre os Documentos
                        </label>
                        <textarea
                          value={documentInfo.outros_documentos}
                          onChange={e => setDocumentInfo(prev => ({ ...prev, outros_documentos: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Descreva os documentos enviados..."
                        />
                      </div>

                      {/* Botões */}
                      <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                          type="button"
                          onClick={() => setShowProcessarModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={processarDevolucaoMutation.isPending || selectedItems.length === 0}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                        >
                          {processarDevolucaoMutation.isPending ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            `Processar ${selectedItems.length} Devolucao(oes)`
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Ordem */}
        {showEditModal && editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto">
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">
                    Editar Ordem de Desconto
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingOrder(null);
                      setEditingItems([]);
                      setEditingUser(null);
                      setEditingValores({});
                      setEditingParcelas(1);
                    }}
                    className="text-green-100 hover:text-white transition-colors"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEditedOrder();
                }}
                className="p-6 space-y-6"
              >
                {/* Informações da Ordem */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Informações da Ordem</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Funcionário *
                      </label>
                      <div className="text-sm text-gray-900">
                        {editingUser ? `${editingUser.nome} (${editingUser.matricula})` : 'Não encontrado'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status Atual
                      </label>
                      <div className="text-sm text-gray-900">{editingOrder.status}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor Atual
                      </label>
                      <div className="text-sm text-gray-900">
                        R$ {Object.values(editingValores).reduce((total, valor) => total + valor, 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seleção de Itens */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Itens da Ordem</h4>

                  {/* Base para seleção */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base para Busca de Itens *
                    </label>
                    <select
                      value={editingBase}
                      onChange={(e) => setEditingBase(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="">Selecione uma base</option>
                      {bases.map((base) => (
                        <option key={base.id} value={base.id}>
                          {base.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Busca de itens */}
                  {editingBase && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Buscar Itens
                      </label>
                      <input
                        type="text"
                        placeholder="Digite para buscar itens..."
                        value={editingSearchItem}
                        onChange={(e) => setEditingSearchItem(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}

                  {/* Lista de itens disponíveis */}
                  {editingBase && (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                      {filteredEditingItensBase.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.nome}</div>
                            <div className="text-sm text-gray-500">
                              {item.codigo} • {item.categoria} • Estoque: {item.quantidade_atual || 0}
                            </div>
                            <div className="text-sm font-medium text-green-600">
                              Valor: R$ {item.valor_unitario ? (item.valor_unitario % 1 === 0 ? item.valor_unitario.toString() : item.valor_unitario.toFixed(2)) : '0'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const novoItem = {
                                id: item.id,
                                nome: item.nome,
                                quantidade: 1,
                                valor_unitario: item.valor_unitario || 0,
                                source: 'base'
                              };
                              setEditingItems(prev => [...prev.filter(i => i.id !== item.id), novoItem]);

                              // Inicializar valor
                              setEditingValores(prev => ({
                                ...prev,
                                [item.id]: item.valor_unitario || 0
                              }));
                            }}
                            className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            Adicionar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inventário do funcionário */}
                  {editingUser && inventarioFuncionario.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-md font-medium text-gray-900">Itens do Inventário do Funcionário</h5>
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                        {inventarioFuncionario.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{item.item?.nome || 'Nome não encontrado'}</div>
                              <div className="text-sm text-gray-500">
                                Quantidade atual: {item.quantidade}
                              </div>
                              <div className="text-sm font-medium text-green-600">
                                Valor: R$ {(item.valor_unitario || item.item?.valor_unitario || 0) % 1 === 0 ?
                                  (item.valor_unitario || item.item?.valor_unitario || 0).toString() :
                                  (item.valor_unitario || item.item?.valor_unitario || 0).toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const novoItem = {
                                  id: item.item_estoque_id || item.id,
                                  item_estoque_id: item.item_estoque_id,
                                  nome: item.item?.nome,
                                  item: item.item,
                                  quantidade: item.quantidade || 1,
                                  valor_unitario: item.valor_unitario || item.item?.valor_unitario || 0,
                                  source: 'inventario'
                                };
                                setEditingItems(prev => [...prev.filter(i => i.id !== item.id), novoItem]);

                                // Inicializar valor
                                setEditingValores(prev => ({
                                  ...prev,
                                  [item.id]: (item.valor_unitario || item.item?.valor_unitario || 0) * (item.quantidade || 1)
                                }));
                              }}
                              className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Adicionar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Itens Selecionados */}
                  {editingItems.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Itens Selecionados</h5>
                      <div className="space-y-3">
                        {editingItems.map((item, index) => {
                          const itemId = item.id || item.item_estoque_id;
                          if (!itemId) return null;

                          const valorEstoque = item.valor_unitario || item.item?.valor_unitario || 0;
                          const quantidade = item.quantidade || 1;
                          const valorAtual = editingValores[itemId] || valorEstoque * quantidade;

                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.nome || item.item?.nome}</div>
                                <div className="text-sm text-gray-500">
                                  Origem: {item.source === 'inventario' ? 'Inventário' : 'Base'}
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-sm text-gray-700">
                                  Quantidade: {quantidade}
                                </div>
                                <div className="flex-1 max-w-20">
                                  <input
                                    type="text"
                                    value={formatCurrencyInput(valorAtual)}
                                    onChange={(e) => {
                                      const rawValue = e.target.value.replace(/\D/g, '');
                                      if (rawValue === '') {
                                        setEditingValores(prev => ({
                                          ...prev,
                                          [itemId]: 0
                                        }));
                                        return;
                                      }

                                      const numeroValor = parseInt(rawValue) / 100;
                                      setEditingValores(prev => ({
                                        ...prev,
                                        [itemId]: numeroValor
                                      }));
                                    }}
                                    onFocus={(e) => {
                                      // Selecionar todo o texto para facilitar edição
                                      e.target.select();
                                    }}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm"
                                    placeholder="0,00"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItems(prev => prev.filter((_, i) => i !== index));
                                    setEditingValores(prev => {
                                      const novos = { ...prev };
                                      delete novos[itemId];
                                      return novos;
                                    });
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t border-gray-300 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Total:</span>
                          <span className="text-lg font-bold text-green-600">
                            R$ {Object.values(editingValores).reduce((total, valor) => total + valor, 0).toString()}
                          </span>
                        </div>
                      </div>

                      {/* Seleção de Parcelas */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            Parcelas
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={editingParcelas}
                            onChange={(e) => setEditingParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </div>
                        {editingParcelas > 1 && (
                          <div className="text-xs text-blue-600">
                            Valor por parcela: R$ {formatCurrencyDisplay(Object.values(editingValores).reduce((total, valor) => total + valor, 0) / editingParcelas)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações sobre Danos/Danos
                  </label>
                  <textarea
                    value={editingObservacoes}
                    onChange={(e) => setEditingObservacoes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Descreva os danos ou motivo do desconto..."
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingOrder(null);
                      setEditingItems([]);
                      setEditingUser(null);
                      setEditingValores({});
                      setEditingParcelas(1);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editingItems.length === 0 || !editingUser}
                    className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Upload de Assinatura */}
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
                      <span className="font-medium">{selectedOrder.target_user?.nome || '-'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor:</span>
                    <p className="font-medium">R$ {(selectedOrder.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Descrição:</span>
                    <p className="font-medium">{selectedOrder.descricao}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium">{selectedOrder.status}</p>
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
                      uploadAction === 'recusado' ? 'Confirmar Recusa' : 'Selecione uma opção'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
