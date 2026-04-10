'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, X, Trash2, Edit, Plus, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDocumentRules, RuleReport } from '@/hooks/useVehicleDocumentRules';
import { useUserContracts } from '@/hooks/useUserContracts';
import { VehicleCompliancePreview } from '@/components/VehicleCompliancePreview';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { vehicleService } from '@/services/vehicleService';

// Tipos de documento disponíveis
const DOCUMENT_TYPES = [
  { value: 'crlv', label: 'CRLV' },
  { value: 'tacografo', label: 'Laudo Tacógrafo' },
  { value: 'fumaca', label: 'Laudo de Fumaça' },
  { value: 'eletrico', label: 'Laudo Elétrico' },
  { value: 'acustico', label: 'Laudo Acústico' },
  { value: 'aet', label: 'AET' },
  { value: 'apolice', label: 'Apólice' },
  { value: 'contrato_seguro', label: 'Contrato de Aluguel' }
];

// Tipos de veículo comuns - TODO: Use this for vehicle type filtering
// const VEHICLE_TYPES = [
//   'Passeio',
//   'Caminhão',
//   'Utilitário',
//   'Moto',
//   'Van',
//   'Ônibus',
//   'Caminhonete'
// ];

interface DocumentRuleFormData {
  id?: string;
  tipo_veiculo?: string[]; // múltiplos tipos de veículo
  prefixo_placa?: string;
  prefixos_placa?: string[]; // múltiplos prefixos
  placa_especifica?: string;
  contrato_id?: string;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  descricao: string;
  ativa: boolean;
}

interface Contract {
  id: string;
  nome: string;
  codigo: string;
  total_veiculos?: number;
}

export function FleetDocumentRulesContent() {
  const { hasPermission } = useModularPermissions();
  const { rules, isLoading, error, createRule, updateRule, deleteRule, isCreating, isUpdating, isDeleting } = useDocumentRules();
  const { data: contracts = [] } = useUserContracts();
  
  // Verificações de permissão específicas
  const canManageRules = hasPermission(PERMISSION_CODES.LAUDOS.GERENCIAR_LAUDOS);
  const canViewRules = hasPermission(PERMISSION_CODES.LAUDOS.VISUALIZAR_LAUDOS);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingVehicleTypes, setIsLoadingVehicleTypes] = useState(false);
  const [selectedContract, setSelectedContract] = useState<string>('all');
  const [currentContract, setCurrentContract] = useState<Contract | null>(null);
  const [contractVehicles, setContractVehicles] = useState<{ placa: string }[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [plateSearchOpen, setPlateSearchOpen] = useState(false);
  const [plateSearchTerm, setPlateSearchTerm] = useState('');
  
  // Sistema de notificação usando estado React
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    
    // Auto-hide após 3 segundos
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };
  
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleReport | null>(null);
  const [formData, setFormData] = useState<DocumentRuleFormData>({
    documentos_obrigatorios: [],
    documentos_opcionais: [],
    descricao: '',
    ativa: true,
    tipo_veiculo: [] // Inicializar array vazio
  });
  const [prefixosInputValue, setPrefixosInputValue] = useState<string>('');

  // ✅ CORREÇÃO: Auto-selecionar contrato quando carregados
  useEffect(() => {
    if (contracts.length > 0) {
      console.log('📋 Contratos carregados:', contracts);
      
      // ✅ CORREÇÃO: Auto-selecionar contrato se usuário tem apenas um
      if (contracts.length === 1) {
        setCurrentContract(contracts[0]);
        setSelectedContract(contracts[0].id);
        // Auto-selecionar contrato no formulário também
        setFormData(prev => ({
          ...prev,
          contrato_id: contracts[0].id
        }));
      } else if (contracts.length > 1) {
        setCurrentContract(null);
        setSelectedContract('all');
      }
    }
  }, [contracts]);
    
  // Carregar tipos de veículo
  useEffect(() => {
    const loadVehicleTypes = async () => {
      setIsLoadingVehicleTypes(true);
      try {
        const response = await fetch('/api/admin/vehicle-types');
        if (response.ok) {
          const data = await response.json();
          setVehicleTypes(data.tipos || []);
        }
      } catch (err) {
        console.error('Erro ao carregar tipos de veículo:', err);
      } finally {
        setIsLoadingVehicleTypes(false);
      }
    };

    loadVehicleTypes();
  }, []);

  // Carregar veículos do contrato selecionado
  useEffect(() => {
    const loadContractVehicles = async () => {
      if (!formData.contrato_id) {
        setContractVehicles([]);
        setFormData(prev => ({ ...prev, placa_especifica: undefined }));
        return;
      }

      setIsLoadingVehicles(true);
      try {
        const vehicles = await vehicleService.getByContrato(formData.contrato_id);
        setContractVehicles(vehicles.map(v => ({ placa: v.placa })));
        // Se a placa selecionada não está na lista de veículos do novo contrato, limpar
        if (formData.placa_especifica && !vehicles.find(v => v.placa === formData.placa_especifica)) {
          setFormData(prev => ({ ...prev, placa_especifica: undefined }));
        }
      } catch (err) {
        console.error('Erro ao carregar veículos do contrato:', err);
        setContractVehicles([]);
        setFormData(prev => ({ ...prev, placa_especifica: undefined }));
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    loadContractVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.contrato_id]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plateSearchOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('#placa_especifica') && !target.closest('.placa-dropdown-container')) {
          setPlateSearchOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [plateSearchOpen]);

  // Filtrar regras baseado no contrato selecionado
  const filteredRules = rules?.filter(rule => {
    console.log('🔍 Filtrando regra:', {
      ruleId: rule.id,
      ruleContratoId: rule.contrato_id,
      selectedContract,
      criterio: rule.criterio,
      valor_criterio: rule.valor_criterio
    });
    
    // Se "Todos" está selecionado, mostrar todas as regras
    if (selectedContract === 'all') {
      console.log('✅ Mostrando regra (Todos selecionado):', rule.id);
      return true; // Mostra todas as regras
    }
    
    // ✅ CORREÇÃO: Toda regra DEVE ter contrato_id - se não tem, é erro
    if (!rule.contrato_id) {
      console.error('❌ ERRO: Regra sem contrato_id encontrada:', rule.id);
      return false; // Não mostrar regras sem contrato
    }
    
    // Se um contrato específico está selecionado, mostrar apenas regras desse contrato
    const matches = rule.contrato_id === selectedContract;
    console.log(`${matches ? '✅' : '❌'} Regra ${rule.id} - Contrato: ${rule.contrato_id} vs Selecionado: ${selectedContract} = ${matches}`);
    return matches;
  }) || [];
  
  console.log('📊 Resultado do filtro:', {
    totalRules: rules?.length || 0,
    selectedContract,
    filteredCount: filteredRules.length,
    filteredRules: filteredRules.map(r => ({ id: r.id, contrato_id: r.contrato_id, criterio: r.criterio }))
  });


  const resetForm = () => {
    setFormData({
      documentos_obrigatorios: [],
      documentos_opcionais: [],
      descricao: '',
      ativa: true,
      tipo_veiculo: [] // Resetar array
    });
    setPrefixosInputValue('');
    setEditingRule(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (rule: RuleReport) => {
    setEditingRule(rule);
    
    // ✅ CORREÇÃO: Buscar dados completos da regra para edição
    const loadRuleDetails = async () => {
      try {
        const response = await fetch(`/api/admin/document-rules/${rule.id}`);
        if (response.ok) {
          const data = await response.json();
          const fullRule = data.rule;
          
          console.log('📋 Dados completos da regra para edição:', fullRule);
          
          setFormData({
            id: rule.id,
            tipo_veiculo: fullRule.tipo_veiculo || undefined,
            prefixo_placa: fullRule.prefixo_placa || undefined,
            prefixos_placa: fullRule.prefixos_placa || undefined,
            placa_especifica: fullRule.placa_especifica || undefined,
            contrato_id: fullRule.contrato_id || undefined,
            documentos_obrigatorios: fullRule.documentos_obrigatorios || [],
            documentos_opcionais: fullRule.documentos_opcionais || [],
            descricao: fullRule.descricao || '',
            ativa: fullRule.ativa !== false
          });
          setPrefixosInputValue(fullRule.prefixos_placa?.join(', ') || '');
        } else {
          // Fallback para dados básicos se não conseguir carregar detalhes
          console.warn('⚠️ Não foi possível carregar detalhes da regra, usando dados básicos');
          setFormData({
            id: rule.id,
            tipo_veiculo: rule.criterio === 'Tipo de Veículo' ? rule.valor_criterio.split(', ') : undefined,
            prefixo_placa: rule.criterio === 'Prefixo de Placa' ? rule.valor_criterio : undefined,
            prefixos_placa: rule.criterio === 'Múltiplos Prefixos de Placa' ? 
              rule.valor_criterio.split(', ') : undefined,
            placa_especifica: rule.criterio === 'Placa Específica' ? rule.valor_criterio : undefined,
            contrato_id: rule.contrato_id || undefined,
            documentos_obrigatorios: rule.documentos_obrigatorios || [],
            documentos_opcionais: rule.documentos_opcionais || [],
            descricao: rule.descricao || '',
            ativa: true
          });
        }
      } catch (error) {
        console.error('❌ Erro ao carregar detalhes da regra:', error);
        // Fallback para dados básicos
        setFormData({
          id: rule.id,
          tipo_veiculo: rule.criterio === 'Tipo de Veículo' ? rule.valor_criterio.split(', ') : undefined,
          prefixo_placa: rule.criterio === 'Prefixo de Placa' ? rule.valor_criterio : undefined,
          prefixos_placa: rule.criterio === 'Múltiplos Prefixos de Placa' ? 
            rule.valor_criterio.split(', ') : undefined,
          placa_especifica: rule.criterio === 'Placa Específica' ? rule.valor_criterio : undefined,
          contrato_id: rule.contrato_id || undefined,
          documentos_obrigatorios: rule.documentos_obrigatorios || [],
          documentos_opcionais: rule.documentos_opcionais || [],
          descricao: rule.descricao || '',
          ativa: true
        });
        setPrefixosInputValue(rule.criterio === 'Múltiplos Prefixos de Placa' ? rule.valor_criterio : '');
        setPrefixosInputValue(rule.criterio === 'Múltiplos Prefixos de Placa' ? rule.valor_criterio : '');
      }
    };
    
    loadRuleDetails();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que pelo menos um documento obrigatório foi selecionado
    if (!formData.documentos_obrigatorios || formData.documentos_obrigatorios.length === 0) {
      showNotification('É obrigatório selecionar pelo menos um documento obrigatório', 'error');
      return;
    }
    
    // Validar que pelo menos um critério foi especificado
    const hasCriteria = 
      formData.placa_especifica ||
      formData.prefixo_placa ||
      (formData.prefixos_placa && formData.prefixos_placa.length > 0) ||
      (formData.tipo_veiculo && formData.tipo_veiculo.length > 0);
    
    if (!hasCriteria) {
      showNotification('É obrigatório especificar pelo menos um critério (placa, prefixo ou tipo de veículo)', 'error');
      return;
    }
    
    // ✅ CORREÇÃO: Contrato é SEMPRE obrigatório - não existe regra sem contrato
    if (!formData.contrato_id) {
      showNotification('É obrigatório selecionar um contrato para a regra. Toda regra deve ter um contrato específico.', 'error');
      return;
    }
    
    // Validar prefixo único (deve ter 3 caracteres)
    if (formData.prefixo_placa && formData.prefixo_placa.length !== 3) {
      showNotification('Prefixo de placa deve ter exatamente 3 caracteres', 'error');
      return;
    }
    
    // Validar múltiplos prefixos (cada um deve ter 3 caracteres)
    if (formData.prefixos_placa && formData.prefixos_placa.length > 0) {
      const invalidPrefixes = formData.prefixos_placa.filter(prefix => prefix.length !== 3);
      if (invalidPrefixes.length > 0) {
        showNotification(`Todos os prefixos devem ter exatamente 3 caracteres. Prefixos inválidos: ${invalidPrefixes.join(', ')}`, 'error');
        return;
      }
    }
    
    console.log('🔍 Criando/Editando regra:', {
      contrato_id: formData.contrato_id,
      criterio: formData.placa_especifica ? 'Placa Específica' : 
               formData.prefixos_placa?.length ? 'Múltiplos Prefixos' :
               formData.prefixo_placa ? 'Prefixo Único' :
               formData.tipo_veiculo?.length ? 'Tipo de Veículo' : 'Nenhum',
      documentos_obrigatorios: formData.documentos_obrigatorios,
      documentos_opcionais: formData.documentos_opcionais
    });
    
    try {
      if (editingRule) {
        await updateRule({ ...formData, id: editingRule.id });
        showNotification('Regra atualizada com sucesso!', 'success');
      } else {
        await createRule(formData);
        showNotification('Regra criada com sucesso!', 'success');
      }
      setShowModal(false);
      resetForm();
    } catch (error: unknown) {
      showNotification((error instanceof Error ? error.message : 'Erro desconhecido') || 'Erro ao salvar regra', 'error');
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta regra?')) {
      try {
        await deleteRule(ruleId);
        showNotification('Regra excluída com sucesso!', 'success');
      } catch (error: unknown) {
        showNotification((error instanceof Error ? error.message : 'Erro desconhecido') || 'Erro ao excluir regra', 'error');
      }
    }
  };

  const toggleDocument = (docType: string, list: 'obrigatorios' | 'opcionais') => {
    const field = list === 'obrigatorios' ? 'documentos_obrigatorios' : 'documentos_opcionais';
    const currentList = formData[field];
    const otherField = list === 'obrigatorios' ? 'documentos_opcionais' : 'documentos_obrigatorios';
    const otherList = formData[otherField];

    if (currentList.includes(docType)) {
      // Remover da lista atual
      setFormData({
        ...formData,
        [field]: currentList.filter(d => d !== docType)
      });
    } else {
      // Adicionar à lista atual e remover da outra (se existir)
      setFormData({
        ...formData,
        [field]: [...currentList, docType],
        [otherField]: otherList.filter(d => d !== docType)
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Carregando regras...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-600">Erro ao carregar regras: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regras de Documentação - Frota</h1>
          <p className="text-gray-600">Configure quais documentos são obrigatórios por contrato específico</p>
        </div>
        <div className="flex gap-2">
          {canViewRules && (
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/admin/vehicle-rules-search'}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Pesquisar por Placa
            </Button>
          )}
          {canManageRules && (
            <Button onClick={openCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          )}
        </div>
      </div>

      {/* Seletor de Contrato */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="contract-selector" className="text-sm font-medium">
              Filtrar por Contrato:
            </Label>
            <Select value={selectedContract} onValueChange={(value) => {
              setSelectedContract(value);
              if (value === 'all') {
                setCurrentContract(null);
              } else {
                const contract = contracts.find(c => c.id === value);
                setCurrentContract(contract || null);
              }
            }}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione um contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Contratos</SelectItem>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.nome} ({contract.codigo}) - {contract.total_veiculos} veículos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentContract && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Contrato atual:</span>
                <Badge variant="outline" className="font-medium">
                  {currentContract.nome}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{filteredRules.length}</p>
                <p className="text-sm text-gray-600">Regras Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {filteredRules.reduce((sum, rule) => sum + (Number(rule.total_veiculos_afetados) || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Veículos Afetados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {contracts.length}
                </p>
                <p className="text-sm text-gray-600">Contratos Acessíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Regras */}
      <Card>
        <CardHeader>
          <CardTitle>Regras Configuradas</CardTitle>
          <CardDescription>
            Regras são aplicadas por prioridade: Placa Específica → Contrato → Tipo de Veículo → Múltiplos Prefixos → Prefixo Único
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma regra configurada para seus contratos</p>
              {canManageRules && (
                <Button onClick={openCreateModal} variant="outline" className="mt-4">
                  Criar primeira regra
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          rule.criterio === 'Placa Específica' ? 'default' :
                          rule.criterio === 'Contrato Específico' ? 'destructive' :
                          rule.criterio === 'Tipo de Veículo' ? 'secondary' :
                          rule.criterio === 'Múltiplos Prefixos de Placa' ? 'outline' : 'outline'
                        }>
                          {rule.criterio}
                        </Badge>
                        <span className="font-medium">{rule.valor_criterio}</span>
                        <span className="text-sm text-gray-500">
                          ({Number(rule.total_veiculos_afetados) || 0} veículos)
                        </span>
                      </div>
                      
                      {/* Informação do Contrato */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">Contrato:</span>
                        {rule.contrato_id ? (
                          <Badge variant="outline" className="text-xs">
                            {contracts.find(c => c.id === rule.contrato_id)?.nome || 'Contrato não encontrado'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Todos os contratos
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{rule.descricao}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm text-gray-700 mb-2">Documentos Obrigatórios</h4>
                          <div className="flex flex-wrap gap-1">
                            {rule.documentos_obrigatorios.map(doc => (
                              <Badge key={doc} variant="destructive" className="text-xs">
                                {DOCUMENT_TYPES.find(t => t.value === doc)?.label || doc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-gray-700 mb-2">Documentos Opcionais</h4>
                          <div className="flex flex-wrap gap-1">
                            {rule.documentos_opcionais.map(doc => (
                              <Badge key={doc} variant="outline" className="text-xs">
                                {DOCUMENT_TYPES.find(t => t.value === doc)?.label || doc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {canManageRules && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criar/Editar Regra */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Documentação'}
            </DialogTitle>
            <DialogDescription>
              Configure quais documentos são obrigatórios ou opcionais para veículos
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Critério da Regra */}
            <div className="space-y-4">
              <h3 className="font-medium">Critério da Regra</h3>
              <p className="text-sm text-gray-600">
                Configure o critério da regra (tipo de veículo, prefixos, etc.)
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contrato_id">Contrato *</Label>
                  <Select
                    value={formData.contrato_id || 'all'}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      contrato_id: value === 'all' ? undefined : value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contracts.map(contract => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.nome} ({contract.total_veiculos} veículos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Contrato é obrigatório para todas as regras
                  </p>
                </div>

                <div>
                  <Label htmlFor="placa_especifica">Placa Específica (opcional)</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="placa_especifica"
                        type="text"
                        placeholder={!formData.contrato_id ? 'Selecione um contrato primeiro' : 'Digite para buscar a placa...'}
                        value={plateSearchOpen ? plateSearchTerm : formData.placa_especifica || ''}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setPlateSearchTerm(value);
                          if (!plateSearchOpen) setPlateSearchOpen(true);
                          // Auto-select se exatamente uma placa corresponder
                          const filtered = contractVehicles.filter(v => v.placa.startsWith(value));
                          if (filtered.length === 1 && filtered[0].placa === value) {
                            setFormData({ ...formData, placa_especifica: value });
                            setPlateSearchOpen(false);
                            setPlateSearchTerm('');
                          } else {
                            setFormData({ ...formData, placa_especifica: undefined });
                          }
                        }}
                        onFocus={() => {
                          if (formData.contrato_id && !isLoadingVehicles) {
                            setPlateSearchOpen(true);
                            setPlateSearchTerm('');
                          }
                        }}
                        disabled={!formData.contrato_id || isLoadingVehicles}
                        className="pl-10 pr-10"
                      />
                      {formData.placa_especifica && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, placa_especifica: undefined });
                            setPlateSearchTerm('');
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </div>
                    {plateSearchOpen && formData.contrato_id && !isLoadingVehicles && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto placa-dropdown-container">
                        {contractVehicles.filter(v => 
                          v.placa.toLowerCase().includes(plateSearchTerm.toLowerCase())
                        ).length > 0 ? (
                          contractVehicles
                            .filter(v => v.placa.toLowerCase().includes(plateSearchTerm.toLowerCase()))
                            .map(vehicle => (
                              <button
                                key={vehicle.placa}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, placa_especifica: vehicle.placa });
                                  setPlateSearchOpen(false);
                                  setPlateSearchTerm('');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors border-b last:border-b-0"
                              >
                                <div className="font-medium">{vehicle.placa}</div>
                              </button>
                            ))
                        ) : (
                          <div className="px-3 py-4 text-center text-gray-500">
                            Nenhuma placa encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {!formData.contrato_id 
                      ? 'Selecione um contrato primeiro' 
                      : isLoadingVehicles 
                      ? 'Carregando placas...' 
                      : `Digite para buscar uma placa (${contractVehicles.length} disponíveis)`}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prefixo_placa">Prefixo de Placa (opcional)</Label>
                  <Input
                    id="prefixo_placa"
                    placeholder="Ex: ABC"
                    value={formData.prefixo_placa || ''}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().trim();
                      setFormData({
                        ...formData,
                        prefixo_placa: value || undefined
                      });
                    }}
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Para todas as placas que começam com este prefixo (3 caracteres)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="prefixos_placa">Múltiplos Prefixos (opcional)</Label>
                  <input
                    id="prefixos_placa"
                    type="text"
                    placeholder="Ex: ABC, DEF, GHI"
                    value={prefixosInputValue}
                    onChange={(e) => {
                      // Permitir digitação livre - apenas atualizar o valor do input
                      const value = e.target.value;
                      setPrefixosInputValue(value);
                      
                      // Processar e atualizar formData apenas se houver conteúdo válido
                      if (!value || value.trim() === '') {
                        setFormData({
                          ...formData,
                          prefixos_placa: undefined
                        });
                        return;
                      }
                      
                      // Processar prefixos: separar por vírgula, converter para maiúsculas, remover espaços e filtrar vazios
                      const prefixos = value
                        .split(',')
                        .map(p => p.trim().toUpperCase())
                        .filter(p => p.length > 0);
                      
                      setFormData({
                        ...formData,
                        prefixos_placa: prefixos.length > 0 ? prefixos : undefined
                      });
                    }}
                    onBlur={() => {
                      // Ao sair do campo, garantir que o valor está formatado corretamente
                      if (prefixosInputValue) {
                        const prefixos = prefixosInputValue
                          .split(',')
                          .map(p => p.trim().toUpperCase())
                          .filter(p => p.length > 0);
                        setPrefixosInputValue(prefixos.join(', '));
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separados por vírgula (ex: ABC, DEF, GHI)
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo_veiculo">Tipos de Veículo (opcional)</Label>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">
                      ✨ Selecione tipos específicos para refinar a regra
                    </p>
                    
                    {isLoadingVehicleTypes ? (
                      <div className="text-sm text-gray-500">Carregando tipos de modelo...</div>
                    ) : (
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                        {vehicleTypes.map(type => (
                          <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.tipo_veiculo?.includes(type.value) || false}
                              onChange={(e) => {
                                const currentTypes = formData.tipo_veiculo || [];
                                const newTypes = e.target.checked
                                  ? [...currentTypes, type.value]
                                  : currentTypes.filter(t => t !== type.value);
                                
                                setFormData({
                                  ...formData,
                                  tipo_veiculo: newTypes
                                });
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {formData.tipo_veiculo && formData.tipo_veiculo.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">Selecionados ({formData.tipo_veiculo.length}):</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.tipo_veiculo.map(tipo => (
                            <Badge key={tipo} variant="secondary" className="text-xs">
                              {tipo}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    tipo_veiculo: formData.tipo_veiculo?.filter(t => t !== tipo)
                                  });
                                }}
                                className="ml-1 text-gray-500 hover:text-red-500"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="space-y-4">
              <h3 className="font-medium">Configuração de Documentos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-red-700">Documentos Obrigatórios</h4>
                  <div className="space-y-2">
                    {DOCUMENT_TYPES.map(docType => (
                      <div key={docType.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`obr-${docType.value}`}
                          checked={formData.documentos_obrigatorios.includes(docType.value)}
                          onCheckedChange={() => toggleDocument(docType.value, 'obrigatorios')}
                        />
                        <Label htmlFor={`obr-${docType.value}`} className="text-sm">
                          {docType.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-blue-700">Documentos Opcionais</h4>
                  <div className="space-y-2">
                    {DOCUMENT_TYPES.map(docType => (
                      <div key={docType.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`opt-${docType.value}`}
                          checked={formData.documentos_opcionais.includes(docType.value)}
                          onCheckedChange={() => toggleDocument(docType.value, 'opcionais')}
                        />
                        <Label htmlFor={`opt-${docType.value}`} className="text-sm">
                          {docType.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o propósito desta regra..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
              />
            </div>

            {/* Preview da Regra */}
            <VehicleCompliancePreview 
              rulePreview={
                formData.contrato_id ? {
                  contrato_id: formData.contrato_id,
                  tipo_veiculo: formData.tipo_veiculo,
                  documentos_obrigatorios: formData.documentos_obrigatorios,
                  documentos_opcionais: formData.documentos_opcionais
                } : undefined
              }
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating || isUpdating || !formData.documentos_obrigatorios?.length || !formData.contrato_id}
              >
                {isCreating || isUpdating ? 'Salvando...' : (editingRule ? 'Atualizar' : 'Criar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toast de Notificação */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
