'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LinkIcon, 
  TableCellsIcon, 
  PlusIcon, 
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import type { ContratoSharePointConfig, ColumnMapping, ColumnMappingField, ColumnMappingValue, StatusMapping } from '@/config/contratos-sharepoint';
import { normalizeColumnMapping } from '@/config/contratos-sharepoint';
import { teamService } from '@/services/teamService';
import type { Team } from '@/types/team';
import { contratoService } from '@/services/contratoService';
import type { Contrato } from '@/types/contratos';

interface ConfigFromDB {
  id: string;
  contrato_nome: string;
  sharepoint_url: string;
  column_mapping: ColumnMapping;
  status_mapping?: StatusMapping;
  header_row?: number;
  sheet_name?: string;
  buscar_equipe_por_encarregado?: boolean;
  equipe_mapping?: ColumnMappingValue;
  equipes_fixas?: string[];
  created_at: string;
  updated_at: string;
}

export default function SharePointConfigPage() {
  const [configs, setConfigs] = useState<ConfigFromDB[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Estado para edição
  const [editingConfig, setEditingConfig] = useState<ContratoSharePointConfig | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [equipesContrato, setEquipesContrato] = useState<Team[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(false);

  // Campos obrigatórios do mapeamento
  const requiredFields: (keyof ColumnMapping)[] = [
    'dataExecucao',
    'numeroSOB',
    'responsavelExecucao',
    'valores',
    'status',
    'municipio',
  ];

  // Campos opcionais do mapeamento
  // NOTA: 'contrato' foi removido - o contrato é selecionado na interface, não vem da planilha
  const optionalFields: (keyof ColumnMapping)[] = [
    'logradouro', // Opcional: localização pode ser incompleta
    'bairro', // Opcional: localização pode ser incompleta
    'descricaoServico',
    'infoStatus',
    'tipoServico',
    'prioridade',
    'horInicObra',
    'horTermObra',
    'obs',
    'numeroEQ',
    'inicDeslig',
    'termDeslig',
    'tipoSGD',
    'numeroSGD',
    'anotacao',
    'apoio',
    'critico',
    'coordenada',
    'validade',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar contratos e configurações em paralelo
      const [contratosData, configsResponse] = await Promise.all([
        contratoService.getContratos(),
        fetch('/api/admin/sharepoint-config'),
      ]);

      const configsData = await configsResponse.json();
      
      if (configsData.success) {
        setConfigs(configsData.configs || []);
      } else {
        setMessage({ type: 'error', text: 'Erro ao carregar configurações' });
      }

      setContratos(contratosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    // Validação
    if (!selectedContratoId && isNew) {
      setMessage({ type: 'error', text: 'Selecione um contrato' });
      return;
    }

    if (!editingConfig.contratoNome || !editingConfig.sharePointUrl) {
      setMessage({ type: 'error', text: 'Preencha o contrato e a URL do SharePoint' });
      return;
    }

    // Validar se o contrato existe no banco
    const contratoSelecionado = contratos.find(c => c.id === selectedContratoId);
    if (isNew && !contratoSelecionado) {
      setMessage({ type: 'error', text: 'Contrato selecionado não encontrado' });
      return;
    }

    // Validar campos obrigatórios do mapeamento
    for (const field of requiredFields) {
      const mapping = getFieldMapping(field);
      if (!mapping.columns || mapping.columns.length === 0 || mapping.columns.every(c => !c.trim())) {
        setMessage({ type: 'error', text: `O campo "${field}" é obrigatório e deve ter pelo menos um nome de coluna` });
        return;
      }
    }

    // Remover campo "contrato" do columnMapping antes de salvar (não deve mais ser usado)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contrato: _, ...columnMappingSemContrato } = editingConfig.columnMapping;
    const configParaSalvar = {
      ...editingConfig,
      columnMapping: columnMappingSemContrato as ColumnMapping,
    };

    setSaving(true);
    try {
      const response = await fetch('/api/admin/sharepoint-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configParaSalvar),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Configuração salva com sucesso!' });
        setShowForm(false);
        setEditingConfig(null);
        setSelectedContratoId('');
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar configuração' });
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configuração' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contratoNome: string) => {
    if (!confirm(`Tem certeza que deseja remover a configuração do contrato "${contratoNome}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sharepoint-config?contrato=${encodeURIComponent(contratoNome)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuração removida com sucesso!' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao remover configuração' });
      }
    } catch (error) {
      console.error('Erro ao remover configuração:', error);
      setMessage({ type: 'error', text: 'Erro ao remover configuração' });
    }
  };

  const handleTest = async (contratoNome: string) => {
    setTesting(contratoNome);
    try {
      const response = await fetch(`/api/programacao/sync-sharepoint?contrato=${encodeURIComponent(contratoNome)}`);
      const data = await response.json();

      if (data.sharePointAccessible) {
        setMessage({ type: 'success', text: `✅ Conexão com SharePoint do contrato "${contratoNome}" está funcionando!` });
      } else {
        setMessage({ type: 'error', text: `❌ Não foi possível acessar o SharePoint do contrato "${contratoNome}"` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` });
    } finally {
      setTesting(null);
    }
  };

  const handleEdit = (config: ConfigFromDB) => {
    const contrato = contratos.find(c => c.nome === config.contrato_nome);
    
    // Remover campo "contrato" do columnMapping se existir (não deve mais ser usado)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contrato: _, ...columnMappingSemContrato } = config.column_mapping;
    
    setEditingConfig({
      contratoNome: config.contrato_nome,
      sharePointUrl: config.sharepoint_url,
      columnMapping: columnMappingSemContrato as ColumnMapping,
      statusMapping: config.status_mapping || {},
      headerRow: config.header_row || 1,
      sheetName: config.sheet_name,
      buscarEquipePorEncarregado: config.buscar_equipe_por_encarregado ?? true,
      equipeMapping: config.equipe_mapping,
      equipesFixas: config.equipes_fixas || [],
    });
    setSelectedContratoId(contrato?.id || '');
    setIsNew(false);
    setShowForm(true);
    
    // Carregar equipes do contrato (async, não bloqueia)
    if (contrato?.id) {
      loadEquipesContrato(contrato.id);
    }
  };

  const handleNew = () => {
    setEditingConfig({
      contratoNome: '',
      sharePointUrl: '',
      headerRow: 1,
      columnMapping: {
        dataExecucao: { columns: [] },
        numeroSOB: { columns: [] },
        responsavelExecucao: { columns: [] },
        valores: { columns: [] },
        status: { columns: [] },
            municipio: { columns: [] },
            // Campos opcionais
            logradouro: { columns: [] },
            bairro: { columns: [] },
          },
      statusMapping: {},
      buscarEquipePorEncarregado: true, // Padrão: buscar por encarregado
      equipesFixas: [], // Lista vazia inicialmente
    });
    setSelectedContratoId('');
    setIsNew(true);
    setShowForm(true);
    setEquipesContrato([]);
  };

  // Carregar equipes do contrato selecionado
  const loadEquipesContrato = async (contratoId: string) => {
    if (!contratoId) {
      setEquipesContrato([]);
      return;
    }

    setLoadingEquipes(true);
    try {
      // Buscar todas as equipes e filtrar por contrato
      const todasEquipes = await teamService.getAll();
      const equipesFiltradas = todasEquipes.filter(
        (equipe: Team) => equipe.contrato_id === contratoId && equipe.status === 'active'
      );
      setEquipesContrato(equipesFiltradas || []);
    } catch (error) {
      console.error('Erro ao carregar equipes do contrato:', error);
      setEquipesContrato([]);
    } finally {
      setLoadingEquipes(false);
    }
  };

  // Quando o contrato selecionado mudar, carregar equipes
  useEffect(() => {
    if (selectedContratoId && showForm) {
      loadEquipesContrato(selectedContratoId);
    } else {
      setEquipesContrato([]);
    }
  }, [selectedContratoId, showForm]);

  const handleContratoSelect = (contratoId: string) => {
    setSelectedContratoId(contratoId);
    const contrato = contratos.find(c => c.id === contratoId);
    if (contrato && editingConfig) {
      setEditingConfig({
        ...editingConfig,
        contratoNome: contrato.nome,
      });
    }
  };

  // Helper para normalizar campo de mapeamento
  const getFieldMapping = (field: keyof ColumnMapping): ColumnMappingField => {
    if (!editingConfig) {
      return { columns: [], separator: ' ', concatenate: false };
    }
    // Ignorar campo "contrato" se tentar acessá-lo (não deve mais existir)
    if (field === 'contrato') {
      return { columns: [], separator: ' ', concatenate: false };
    }
    const value = editingConfig.columnMapping[field];
    return normalizeColumnMapping(value || []);
  };

  // Atualizar campo de mapeamento completo
  const updateColumnMapping = (field: keyof ColumnMapping, mapping: ColumnMappingField) => {
    if (!editingConfig) return;
    
    setEditingConfig({
      ...editingConfig,
      columnMapping: {
        ...editingConfig.columnMapping,
        [field]: mapping,
      },
    });
  };

  const addColumnName = (field: keyof ColumnMapping) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    updateColumnMapping(field, {
      ...current,
      columns: [...current.columns, ''],
    });
  };

  const removeColumnName = (field: keyof ColumnMapping, index: number) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    updateColumnMapping(field, {
      ...current,
      columns: current.columns.filter((_, i) => i !== index),
    });
  };

  const updateColumnName = (field: keyof ColumnMapping, index: number, value: string) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    const updated = [...current.columns];
    updated[index] = value;
    updateColumnMapping(field, {
      ...current,
      columns: updated,
    });
  };

  const updateFieldLabel = (field: keyof ColumnMapping, label: string) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    updateColumnMapping(field, {
      ...current,
      label: label || undefined,
    });
  };

  const updateFieldSeparator = (field: keyof ColumnMapping, separator: string) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    updateColumnMapping(field, {
      ...current,
      separator: separator || ' ',
    });
  };

  const updateFieldConcatenate = (field: keyof ColumnMapping, concatenate: boolean) => {
    if (!editingConfig) return;
    const current = getFieldMapping(field);
    updateColumnMapping(field, {
      ...current,
      concatenate,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configurações SharePoint</h1>
          <p className="mt-2 text-gray-600">
            Gerencie URLs e mapeamentos de colunas das planilhas SharePoint por contrato
          </p>
        </div>

        {/* Mensagem */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' :
            message.type === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            <div className="flex items-center justify-between">
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Lista de Configurações */}
        {!showForm && (
          <>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Contratos Configurados</h2>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5" />
                Novo Contrato
              </button>
            </div>

            <div className="grid gap-6">
              {configs.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <TableCellsIcon className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="mt-4 text-gray-600">Nenhuma configuração encontrada</p>
                      <button
                        onClick={handleNew}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Criar primeira configuração
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                configs.map((config) => {
                  const contrato = contratos.find(c => c.nome === config.contrato_nome);
                  return (
                  <Card key={config.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{config.contrato_nome}</CardTitle>
                          <CardDescription className="mt-1">
                            {contrato ? (
                              <>
                                {contrato.codigo && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">{contrato.codigo}</span>}
                                <span className="text-xs">Status: {contrato.status}</span>
                                {' • '}
                              </>
                            ) : (
                              <span className="text-red-600 text-xs">⚠️ Contrato não encontrado na tabela contratos</span>
                            )}
                            Atualizado em {new Date(config.updated_at).toLocaleString('pt-BR')}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTest(config.contrato_nome)}
                            disabled={testing === config.contrato_nome}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                            title="Testar conexão"
                          >
                            {testing === config.contrato_nome ? (
                              <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            ) : (
                              <CheckCircleIcon className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(config)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.contrato_nome)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remover"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">URL do SharePoint</label>
                          <div className="mt-1 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-gray-400" />
                            <p className="text-sm text-gray-600 break-all">{config.sharepoint_url}</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Colunas Mapeadas</label>
                          <div className="mt-1 text-sm text-gray-600">
                            {Object.keys(config.column_mapping).length} campos configurados
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Formulário de Edição */}
        {showForm && editingConfig && (
          <Card>
            <CardHeader>
              <CardTitle>{isNew ? 'Nova Configuração' : `Editar: ${editingConfig.contratoNome}`}</CardTitle>
              <CardDescription>
                Configure a URL do SharePoint e o mapeamento de colunas para este contrato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contrato *
                  </label>
                  <select
                    value={selectedContratoId}
                    onChange={(e) => handleContratoSelect(e.target.value)}
                    disabled={!isNew}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecione um contrato...</option>
                    {contratos
                      .filter(c => c.status === 'ativo')
                      .map((contrato) => (
                        <option key={contrato.id} value={contrato.id}>
                          {contrato.nome} {contrato.codigo ? `(${contrato.codigo})` : ''}
                        </option>
                      ))}
                  </select>
                  {!isNew && (
                    <p className="mt-1 text-xs text-gray-500">
                      O contrato não pode ser alterado após a criação
                    </p>
                  )}
                  {selectedContratoId && (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Contrato selecionado: {editingConfig.contratoNome}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL do SharePoint *
                  </label>
                  <input
                    type="text"
                    value={editingConfig.sharePointUrl}
                    onChange={(e) => setEditingConfig({ ...editingConfig, sharePointUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://psvsrv-my.sharepoint.com/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cole a URL pública de compartilhamento da planilha
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Linha do Cabeçalho
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingConfig.headerRow || 1}
                    onChange={(e) => setEditingConfig({ ...editingConfig, headerRow: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Número da linha onde começam os cabeçalhos das colunas (padrão: 1). 
                    Use 4 se os cabeçalhos começarem na linha 4, por exemplo.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Aba da Planilha
                  </label>
                  <input
                    type="text"
                    value={editingConfig.sheetName || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, sheetName: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Deixe vazio para usar a primeira aba"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Nome da aba da planilha Excel a ser usada (ex: &quot;OBRAS&quot;). 
                    Deixe vazio para usar a primeira aba automaticamente.
                  </p>
                </div>
              </div>

              {/* Mapeamento de Colunas - Campos Obrigatórios */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campos Obrigatórios</h3>
                <div className="space-y-4">
                  {requiredFields.map((field) => {
                    const mapping = getFieldMapping(field);
                    return (
                    <div key={field} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {mapping.label || field} *
                        </label>
                        <input
                          type="text"
                          value={mapping.label || ''}
                          onChange={(e) => updateFieldLabel(field, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder={`Label customizado (ex: "Status da OS") - deixe vazio para usar "${field}"`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Nome que aparecerá no frontend (deixe vazio para usar o nome padrão)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={mapping.concatenate || false}
                            onChange={(e) => updateFieldConcatenate(field, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-sm text-gray-700">
                            Concatenar colunas (juntar valores de todas as colunas)
                          </label>
                        </div>
                        
                        {mapping.concatenate && (
                          <div className="mb-2">
                            <label className="block text-xs text-gray-600 mb-1">Separador:</label>
                            <input
                              type="text"
                              value={mapping.separator || ' '}
                              onChange={(e) => updateFieldSeparator(field, e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder=" "
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Caractere usado para separar as colunas concatenadas (ex: &quot; &quot;, &quot;, &quot;, &quot; - &quot;)
                            </p>
                          </div>
                        )}
                        
                        {mapping.columns.map((colName, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={colName}
                              onChange={(e) => updateColumnName(field, index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`Nome da coluna ${index + 1}`}
                            />
                            <button
                              onClick={() => removeColumnName(field, index)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addColumnName(field)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <PlusIcon className="h-4 w-4" />
                          {mapping.concatenate ? 'Adicionar coluna para concatenar' : 'Adicionar nome alternativo'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {mapping.concatenate 
                          ? 'Todas as colunas serão concatenadas na ordem listada'
                          : 'O sistema tentará encontrar a coluna usando qualquer um desses nomes (usa a primeira que encontrar)'}
                      </p>
                    </div>
                  )})}
                </div>
              </div>

              {/* Mapeamento de Colunas - Campos Opcionais */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campos Opcionais</h3>
                <div className="space-y-4">
                  {optionalFields.map((field) => {
                    const mapping = getFieldMapping(field);
                    return (
                    <div key={field} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {mapping.label || field}
                        </label>
                        <input
                          type="text"
                          value={mapping.label || ''}
                          onChange={(e) => updateFieldLabel(field, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder={`Label customizado (ex: "Status da OS") - deixe vazio para usar "${field}"`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Nome que aparecerá no frontend (deixe vazio para usar o nome padrão)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={mapping.concatenate || false}
                            onChange={(e) => updateFieldConcatenate(field, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-sm text-gray-700">
                            Concatenar colunas (juntar valores de todas as colunas)
                          </label>
                        </div>
                        
                        {mapping.concatenate && (
                          <div className="mb-2">
                            <label className="block text-xs text-gray-600 mb-1">Separador:</label>
                            <input
                              type="text"
                              value={mapping.separator || ' '}
                              onChange={(e) => updateFieldSeparator(field, e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder=" "
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Caractere usado para separar as colunas concatenadas (ex: &quot; &quot;, &quot;, &quot;, &quot; - &quot;)
                            </p>
                          </div>
                        )}
                        
                        {mapping.columns.map((colName, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={colName}
                              onChange={(e) => updateColumnName(field, index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`Nome da coluna ${index + 1}`}
                            />
                            <button
                              onClick={() => removeColumnName(field, index)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addColumnName(field)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <PlusIcon className="h-4 w-4" />
                          {mapping.concatenate ? 'Adicionar coluna para concatenar' : 'Adicionar nome de coluna'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {mapping.concatenate 
                          ? 'Todas as colunas serão concatenadas na ordem listada'
                          : 'O sistema tentará encontrar a coluna usando qualquer um desses nomes (usa a primeira que encontrar)'}
                      </p>
                    </div>
                  )})}
                </div>
              </div>

              {/* Configuração de Equipes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuração de Equipes</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure como o sistema deve buscar as equipes. Em Niterói, busca pelo encarregado. 
                  Em outros contratos, pode buscar diretamente pela coluna de equipe na planilha.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="buscarEquipePorEncarregado"
                      checked={editingConfig.buscarEquipePorEncarregado !== false}
                      onChange={(e) => setEditingConfig({ 
                        ...editingConfig, 
                        buscarEquipePorEncarregado: e.target.checked 
                      })}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="buscarEquipePorEncarregado" className="text-sm font-medium text-gray-700">
                      Buscar equipe pelo encarregado (padrão: Niterói)
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 ml-7">
                    Se marcado, busca a equipe pelo nome do encarregado no campo &quot;Responsável Execução&quot;. 
                    Se desmarcado, busca diretamente pela coluna de equipe na planilha.
                  </p>
                </div>

                {editingConfig.buscarEquipePorEncarregado === false && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mapeamento da Coluna de Equipe
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Defina qual coluna da planilha contém o nome da equipe
                      </p>
                      {(() => {
                        const equipeMapping = editingConfig.equipeMapping 
                          ? normalizeColumnMapping(editingConfig.equipeMapping)
                          : { columns: [], separator: ' ', concatenate: false };
                        return (
                          <div className="space-y-2">
                            {equipeMapping.columns.map((colName, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={colName}
                                  onChange={(e) => {
                                    const updated = [...equipeMapping.columns];
                                    updated[index] = e.target.value;
                                    setEditingConfig({
                                      ...editingConfig,
                                      equipeMapping: { ...equipeMapping, columns: updated }
                                    });
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Nome da coluna de equipe"
                                />
                                <button
                                  onClick={() => {
                                    const updated = equipeMapping.columns.filter((_, i) => i !== index);
                                    setEditingConfig({
                                      ...editingConfig,
                                      equipeMapping: { ...equipeMapping, columns: updated }
                                    });
                                  }}
                                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const equipeMapping = editingConfig.equipeMapping 
                                  ? normalizeColumnMapping(editingConfig.equipeMapping)
                                  : { columns: [], separator: ' ', concatenate: false };
                                setEditingConfig({
                                  ...editingConfig,
                                  equipeMapping: { ...equipeMapping, columns: [...equipeMapping.columns, ''] }
                                });
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Adicionar nome de coluna
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipes Fixas Permitidas
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Selecione quais equipes são permitidas para este contrato. 
                    Se buscar equipe diretamente da planilha, apenas essas equipes serão aceitas.
                    {!selectedContratoId && (
                      <span className="block mt-1 text-orange-600 font-medium">
                        ⚠️ Selecione um contrato para carregar as equipes disponíveis
                      </span>
                    )}
                  </p>
                  
                  {loadingEquipes ? (
                    <div className="text-sm text-gray-500 py-4">Carregando equipes...</div>
                  ) : equipesContrato.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4">
                      {selectedContratoId 
                        ? 'Nenhuma equipe encontrada para este contrato' 
                        : 'Selecione um contrato para ver as equipes disponíveis'}
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {equipesContrato.map((equipe) => {
                          const isSelected = editingConfig.equipesFixas?.includes(equipe.nome) || false;
                          return (
                            <label
                              key={equipe.id}
                              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentEquipes = editingConfig.equipesFixas || [];
                                  if (e.target.checked) {
                                    // Adicionar equipe
                                    if (!currentEquipes.includes(equipe.nome)) {
                                      setEditingConfig({
                                        ...editingConfig,
                                        equipesFixas: [...currentEquipes, equipe.nome]
                                      });
                                    }
                                  } else {
                                    // Remover equipe
                                    setEditingConfig({
                                      ...editingConfig,
                                      equipesFixas: currentEquipes.filter(eq => eq !== equipe.nome)
                                    });
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="flex-1 text-sm text-gray-700">
                                {equipe.nome}
                                {equipe.operacao && (
                                  <span className="text-xs text-gray-500 ml-2">({equipe.operacao})</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {editingConfig.equipesFixas && editingConfig.equipesFixas.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-600 mb-2">
                        Equipes selecionadas ({editingConfig.equipesFixas.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {editingConfig.equipesFixas.map((equipeNome, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            {equipeNome}
                            <button
                              onClick={() => {
                                const updated = editingConfig.equipesFixas?.filter((_, i) => i !== index) || [];
                                setEditingConfig({
                                  ...editingConfig,
                                  equipesFixas: updated
                                });
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <XCircleIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapeamento de Status Customizado */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mapeamento de Status Customizado</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Defina valores de status da planilha que devem ser mapeados para os códigos do sistema.
                  Exemplo: &quot;DESLIGAMENTO PROGRAMADO&quot; → PROG
                </p>
                <div className="space-y-3">
                  {editingConfig.statusMapping && Object.entries(editingConfig.statusMapping).filter(([key]) => key.trim()).length > 0 ? (
                    Object.entries(editingConfig.statusMapping).filter(([key]) => key.trim()).map(([planilhaStatus, sistemaStatus], index) => (
                    <div key={index} className="flex gap-2 items-center border border-gray-200 rounded-lg p-3">
                      <input
                        type="text"
                        value={planilhaStatus}
                        onChange={(e) => {
                          const newMapping = { ...editingConfig.statusMapping };
                          delete newMapping[planilhaStatus];
                          newMapping[e.target.value.toUpperCase()] = sistemaStatus;
                          setEditingConfig({ ...editingConfig, statusMapping: newMapping });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Status na planilha (ex: DESLIGAMENTO PROGRAMADO)"
                      />
                      <span className="text-gray-500">→</span>
                      <select
                        value={sistemaStatus}
                        onChange={(e) => {
                          const newMapping = { ...editingConfig.statusMapping };
                          newMapping[planilhaStatus] = e.target.value as 'PROG' | 'PANP' | 'EXEC' | 'CANC' | 'PARP';
                          setEditingConfig({ ...editingConfig, statusMapping: newMapping });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="PROG">PROG (Programada)</option>
                        <option value="EXEC">EXEC (Executada)</option>
                        <option value="CANC">CANC (Cancelada)</option>
                        <option value="PARP">PARP (Parcial Planejada)</option>
                        <option value="PANP">PANP (Parcial Não Planejada)</option>
                      </select>
                      <button
                        onClick={() => {
                          const newMapping = { ...editingConfig.statusMapping };
                          delete newMapping[planilhaStatus];
                          setEditingConfig({ ...editingConfig, statusMapping: newMapping });
                        }}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhum mapeamento customizado definido. O sistema usará o mapeamento padrão.</p>
                  )}
                  <button
                    onClick={() => {
                      if (!editingConfig.statusMapping) {
                        editingConfig.statusMapping = {};
                      }
                      const newMapping = { ...editingConfig.statusMapping };
                      newMapping['NOVO STATUS'] = 'PROG';
                      setEditingConfig({ ...editingConfig, statusMapping: newMapping });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Adicionar mapeamento de status
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Se não definir mapeamento customizado, o sistema usará o mapeamento padrão.
                  Status ignorados (ADIADO, ANTECIPADO, RETIRADO) sempre serão filtrados.
                </p>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingConfig(null);
                    setSelectedContratoId('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

