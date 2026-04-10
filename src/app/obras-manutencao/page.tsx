'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObrasManutencaoService } from '@/services/obrasManutencaoService';
import { ObraHistoricoService } from '@/services/obraHistoricoService';
import { ObraManutencao, StatusObra, CreateObraManutencaoDTO, STATUS_COLORS as TYPE_STATUS_COLORS, STATUS_LABELS as TYPE_STATUS_LABELS } from '@/types/obras-manutencao';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, MapPin, Calendar, DollarSign, FileText, Trash2, Edit, Plus, Search, Eye, X, ChevronLeft } from 'lucide-react';
import { ObraDetalhesModal } from '@/components/ObraDetalhesModal';
import { ImportPlanilhaObra, MaterialImportRow, MaoDeObraImportRow } from '@/components/ImportPlanilhaObra';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';

const STATUS_COLORS = TYPE_STATUS_COLORS;
const STATUS_LABELS = TYPE_STATUS_LABELS;

const SETORES = [
  'Obra',
  'Manutenção'
];

export default function ObrasManutencaoPage() {
  const { user } = useAuth();
  
  const [obras, setObras] = useState<ObraManutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cadastro');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [bases, setBases] = useState<Array<{ id: string; nome: string }>>([]);
  const basesMap = useMemo(() => new Map(bases.map(b => [b.id, b.nome])), [bases]);
  const getBaseNome = (idOrNome: string) => basesMap.get(idOrNome) || idOrNome;
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [kanbanSearch, setKanbanSearch] = useState('');

  
  const [formData, setFormData] = useState<CreateObraManutencaoDTO>({
    numeroProjeto: '',
    valorProjetado: 0,
    setor: '',
    base: '',
    quantidadePoste: 0,
    metrosCondutor: 0,
    quantidadeTrafo: 0,
    dataInicio: '',
    dataFim: '',
    status: StatusObra.CADASTRADA,
    regulatorio: false,
    projetoRevisado: false,
    enderecoObra: '',
    bairro: '',
    municipio: '',
    latitude: '',
    longitude: '',
    observacoes: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [valorDisplay, setValorDisplay] = useState<string>('');
  const [selectedObra, setSelectedObra] = useState<ObraManutencao | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [materiaisImport, setMateriaisImport] = useState<MaterialImportRow[]>([]);
  const [maoDeObraImport, setMaoDeObraImport] = useState<MaoDeObraImportRow[]>([]);

  useEffect(() => {
    loadObras();
    loadBases();
  }, []);

  const loadBases = async () => {
    try {
      const { data, error } = await supabase
        .from('bases')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      setBases(data || []);
    } catch (error) {
      console.error('Erro ao carregar bases:', error);
    }
  };

  const loadObras = async () => {
    try {
      setLoading(true);
      const data = await ObrasManutencaoService.getAll();
      setObras(data);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let obraId: string | undefined;

      if (editingId) {
        await ObrasManutencaoService.update({ ...formData, id: editingId });
        obraId = editingId;
        ObraHistoricoService.addLog({
          obraId: editingId,
          tipo: 'edicao',
          descricao: 'Dados da obra atualizados',
          usuarioId: user?.id ?? null,
          usuarioNome: user?.nome ?? null,
          metadata: {
            numeroProjeto: formData.numeroProjeto,
            status: formData.status,
            municipio: formData.municipio,
            setor: formData.setor,
          },
        }).catch(() => {});
      } else {
        const created = await ObrasManutencaoService.create(formData);
        obraId = created.id;
        if (obraId) {
          ObraHistoricoService.addLog({
            obraId,
            tipo: 'criacao',
            descricao: `Obra cadastrada por ${user?.nome ?? 'usuário desconhecido'}`,
            statusNovo: formData.status,
            usuarioId: user?.id ?? null,
            usuarioNome: user?.nome ?? null,
            metadata: {
              numeroProjeto: formData.numeroProjeto,
              status: formData.status,
              municipio: formData.municipio,
              bairro: formData.bairro,
              enderecoObra: formData.enderecoObra,
              setor: formData.setor,
              base: formData.base,
              valorProjetado: formData.valorProjetado,
              dataInicio: formData.dataInicio,
              dataFim: formData.dataFim,
            },
          }).catch(() => {});
        }
      }

      if (obraId) {
        const naoEncontrados: string[] = [];

        // Importar materiais da planilha (somente existentes no catálogo)
        if (materiaisImport.length > 0) {
          for (const mat of materiaisImport) {
            try {
              const existentes = await MateriaisService.search(mat.numeroMaterial, CONTRATO_GOIAS);
              const encontrado = existentes.find(m => m.numeroMaterial === mat.numeroMaterial);
              if (encontrado) {
                await MateriaisService.addMaterialToObra({
                  obraId,
                  materialId: encontrado.id!,
                  quantidade: mat.quantidade,
                });
              } else {
                naoEncontrados.push(`Material: ${mat.numeroMaterial}`);
              }
            } catch (err) {
              console.error('Erro ao importar material:', mat.numeroMaterial, err);
            }
          }
        }

        // Importar mão de obra da planilha (somente existentes no catálogo)
        if (maoDeObraImport.length > 0) {
          for (const mo of maoDeObraImport) {
            try {
              const existentes = await MaoDeObraService.search(mo.codigoNovo, CONTRATO_GOIAS);
              const encontrado = existentes.find(m => m.codigoNovo === mo.codigoNovo);
              if (encontrado) {
                await MaoDeObraService.addMaoDeObraToObra({
                  obraId,
                  maoDeObraId: encontrado.id!,
                  quantidade: mo.quantidade,
                  valorUnitario: encontrado.valorUnitario,
                });
              } else {
                naoEncontrados.push(`Mão de Obra: ${mo.codigoNovo}`);
              }
            } catch (err) {
              console.error('Erro ao importar mão de obra:', mo.codigoNovo, err);
            }
          }
        }

        if (naoEncontrados.length > 0) {
          alert(`Os seguintes itens não foram encontrados no catálogo e foram ignorados:\n\n${naoEncontrados.join('\n')}`);
        }
      }
      
      resetForm();
      loadObras();
      setActiveTab('listagem');
    } catch (error) {
      console.error('Erro ao salvar obra:', error);
      alert('Erro ao salvar obra. Tente novamente.');
    }
  };

  const handleEdit = (obra: ObraManutencao) => {
    setValorDisplay(obra.valorProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setFormData({
      numeroProjeto: obra.numeroProjeto,
      valorProjetado: obra.valorProjetado,
      setor: obra.setor,
      base: obra.base,
      quantidadePoste: obra.quantidadePoste,
      metrosCondutor: obra.metrosCondutor,
      quantidadeTrafo: obra.quantidadeTrafo,
      dataInicio: obra.dataInicio,
      dataFim: obra.dataFim,
      status: obra.status,
      regulatorio: obra.regulatorio,
      projetoRevisado: obra.projetoRevisado,
      enderecoObra: obra.enderecoObra,
      bairro: obra.bairro,
      municipio: obra.municipio,
      latitude: obra.latitude,
      longitude: obra.longitude,
      observacoes: obra.observacoes,
    });
    setEditingId(obra.id || null);
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta obra?')) return;
    
    try {
      await ObrasManutencaoService.delete(id);
      loadObras();
    } catch (error) {
      console.error('Erro ao excluir obra:', error);
      alert('Erro ao excluir obra. Tente novamente.');
    }
  };

  const resetForm = () => {
    setValorDisplay('');
    setFormData({
      numeroProjeto: '',
      valorProjetado: 0,
      setor: '',
      base: '',
      quantidadePoste: 0,
      metrosCondutor: 0,
      quantidadeTrafo: 0,
      dataInicio: '',
      dataFim: '',
      status: StatusObra.CADASTRADA,
      regulatorio: false,
      projetoRevisado: false,
      enderecoObra: '',
      bairro: '',
      municipio: '',
      latitude: '',
      longitude: '',
      observacoes: '',
    });
    setEditingId(null);
    setSelectedFiles([]);
    setMateriaisImport([]);
    setMaoDeObraImport([]);
  };

  const handleViewDetails = (obra: ObraManutencao) => {
    setSelectedObra(obra);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedObra(null);
  };

  const filteredObras = obras.filter(obra => {
    const matchesSearch = 
      obra.numeroProjeto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.enderecoObra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.municipio.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || obra.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full px-4 py-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Obras e Manutenção</h1>
              <p className="text-xs text-gray-500">Programação e controle</p>
            </div>
          </div>

          <TabsList className="h-9">
            <TabsTrigger value="cadastro" className="flex items-center gap-1.5 text-xs px-3 h-7">
              <Plus className="h-3.5 w-3.5" />
              {editingId ? 'Editar' : 'Cadastro'}
            </TabsTrigger>
            <TabsTrigger value="listagem" className="flex items-center gap-1.5 text-xs px-3 h-7">
              <FileText className="h-3.5 w-3.5" />
              Listagem
            </TabsTrigger>
            <TabsTrigger value="orcamento" className="flex items-center gap-1.5 text-xs px-3 h-7">
              <DollarSign className="h-3.5 w-3.5" />
              Carteira
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cadastro">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Editar Obra' : 'Nova Obra/Manutenção'}</CardTitle>
              <CardDescription>
                Preencha os dados da obra ou manutenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numeroProjeto">Número do Projeto *</Label>
                    <Input
                      id="numeroProjeto"
                      value={formData.numeroProjeto}
                      onChange={(e) => setFormData({ ...formData, numeroProjeto: e.target.value })}
                      required
                      placeholder="Ex: PROJ-2024-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valorProjetado">Valor Projetado *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                      <Input
                        id="valorProjetado"
                        type="text"
                        value={valorDisplay}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value === '') {
                            setValorDisplay('');
                            setFormData({ ...formData, valorProjetado: 0 });
                            return;
                          }
                          const numValue = parseFloat(value) / 100;
                          setFormData({ ...formData, valorProjetado: numValue });
                          setValorDisplay(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }}
                        required
                        placeholder="0,00"
                        className="pl-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="setor">Setor *</Label>
                    <Select value={formData.setor} onValueChange={(value) => setFormData({ ...formData, setor: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {SETORES.map((setor) => (
                          <SelectItem key={setor} value={setor}>
                            {setor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="base">Base *</Label>
                    <Select value={formData.base} onValueChange={(value) => setFormData({ ...formData, base: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a base" />
                      </SelectTrigger>
                      <SelectContent>
                        {bases.map((base) => (
                          <SelectItem key={base.id} value={base.id}>
                            {base.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidadePoste">Quantidade de Poste</Label>
                    <Input
                      id="quantidadePoste"
                      type="text"
                      inputMode="numeric"
                      value={formData.quantidadePoste || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, quantidadePoste: parseInt(value) || 0 });
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metrosCondutor">Metros de Condutor</Label>
                    <Input
                      id="metrosCondutor"
                      type="text"
                      inputMode="decimal"
                      value={formData.metrosCondutor || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setFormData({ ...formData, metrosCondutor: parseFloat(value) || 0 });
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidadeTrafo">Quantidade de Trafo</Label>
                    <Input
                      id="quantidadeTrafo"
                      type="text"
                      inputMode="numeric"
                      value={formData.quantidadeTrafo || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, quantidadeTrafo: parseInt(value) || 0 });
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data de Início *</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={formData.dataInicio}
                      onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dataFim">Data de Fim *</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={formData.dataFim}
                      onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as StatusObra })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={StatusObra.CADASTRADA}>Cadastro</SelectItem>
                      <SelectItem value={StatusObra.VIABILIDADE}>Viabilidade</SelectItem>
                      <SelectItem value={StatusObra.PROGRAMACAO}>Programação</SelectItem>
                      <SelectItem value={StatusObra.EXECUCAO}>Execução</SelectItem>
                      <SelectItem value={StatusObra.APROVACAO_MEDICAO}>Aprovação de Medição</SelectItem>
                      <SelectItem value={StatusObra.MEDICAO}>Medição</SelectItem>
                      <SelectItem value={StatusObra.ENCERRAMENTO}>Encerramento</SelectItem>
                      <SelectItem value={StatusObra.FATURAMENTO}>Faturamento</SelectItem>
                      <SelectItem value={StatusObra.PAUSADA}>Pausada</SelectItem>
                      <SelectItem value={StatusObra.CANCELADA}>Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">Classificação</Label>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.regulatorio}
                          onChange={(e) => setFormData({ ...formData, regulatorio: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900">Regulatório</span>
                          <p className="text-xs text-gray-500">Obra com exigências regulatórias</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.projetoRevisado}
                          onChange={(e) => setFormData({ ...formData, projetoRevisado: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900">Projeto Revisado</span>
                          <p className="text-xs text-gray-500">Projeto passou por revisão</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="anexos" className="text-sm font-medium text-gray-700">Anexar Arquivos</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                      <input
                        id="anexos"
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setSelectedFiles(files);
                        }}
                        className="hidden"
                      />
                      <label htmlFor="anexos" className="cursor-pointer">
                        <div className="text-center">
                          <FileText className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm font-medium text-gray-900">Clique para selecionar arquivos</p>
                          <p className="mt-1 text-xs text-gray-500">ou arraste e solte aqui</p>
                        </div>
                      </label>
                      {selectedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <span className="truncate flex-1">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enderecoObra">Endereço da Obra *</Label>
                  <Input
                    id="enderecoObra"
                    value={formData.enderecoObra}
                    onChange={(e) => setFormData({ ...formData, enderecoObra: e.target.value })}
                    required
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      placeholder="Nome do bairro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipio">Município</Label>
                    <Input
                      id="municipio"
                      value={formData.municipio}
                      onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                      placeholder="Nome do município"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="-22.9068"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="-43.1729"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais sobre a obra..."
                    rows={4}
                  />
                </div>

                <ImportPlanilhaObra
                  materiaisImport={materiaisImport}
                  setMateriaisImport={setMateriaisImport}
                  maoDeObraImport={maoDeObraImport}
                  setMaoDeObraImport={setMaoDeObraImport}
                />

                <div className="flex gap-3 justify-end pt-4 border-t">
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingId ? 'Atualizar Obra' : 'Cadastrar Obra'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listagem">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Obras Cadastradas</CardTitle>
                  <CardDescription>
                    {filteredObras.length} obra(s) encontrada(s)
                  </CardDescription>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar obras..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value={StatusObra.CADASTRADA}>Cadastro</SelectItem>
                      <SelectItem value={StatusObra.VIABILIDADE}>Viabilidade</SelectItem>
                      <SelectItem value={StatusObra.PROGRAMACAO}>Programação</SelectItem>
                      <SelectItem value={StatusObra.EXECUCAO}>Execução</SelectItem>
                      <SelectItem value={StatusObra.APROVACAO_MEDICAO}>Aprovação de Medição</SelectItem>
                      <SelectItem value={StatusObra.MEDICAO}>Medição</SelectItem>
                      <SelectItem value={StatusObra.ENCERRAMENTO}>Encerramento</SelectItem>
                      <SelectItem value={StatusObra.FATURAMENTO}>Faturamento</SelectItem>
                      <SelectItem value={StatusObra.PAUSADA}>Pausada</SelectItem>
                      <SelectItem value={StatusObra.CANCELADA}>Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Carregando obras...</p>
                </div>
              ) : filteredObras.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhuma obra encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Município</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredObras.map((obra) => (
                        <TableRow key={obra.id}>
                          <TableCell className="font-medium">{obra.numeroProjeto}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="max-w-xs truncate">{obra.enderecoObra}</span>
                            </div>
                          </TableCell>
                          <TableCell>{obra.municipio || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-gray-400" />
                              {obra.valorProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(obra.dataInicio).toLocaleDateString('pt-BR')} - {new Date(obra.dataFim).toLocaleDateString('pt-BR')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[obra.status]}>
                              {STATUS_LABELS[obra.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(obra)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(obra)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(obra.id!)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcamento" className="mt-0">
          {(() => {
            const kanbanColumns = [
              { key: 'cadastradas', label: 'Cadastradas', status: StatusObra.CADASTRADA, color: 'bg-blue-500', border: 'border-blue-500' },
              { key: 'viabilidade', label: 'Viabilidade', status: StatusObra.VIABILIDADE, color: 'bg-yellow-500', border: 'border-yellow-500' },
              { key: 'programacao', label: 'Programação', status: StatusObra.PROGRAMACAO, color: 'bg-orange-500', border: 'border-orange-500' },
              { key: 'execucao', label: 'Execução', status: StatusObra.EXECUCAO, color: 'bg-emerald-500', border: 'border-emerald-500' },
              { key: 'aprovacao_medicao', label: 'Aprovação de Medição', status: StatusObra.APROVACAO_MEDICAO, color: 'bg-purple-500', border: 'border-purple-500' },
              { key: 'medicao', label: 'Medição', status: StatusObra.MEDICAO, color: 'bg-indigo-500', border: 'border-indigo-500' },
              { key: 'encerramento', label: 'Encerramento', status: StatusObra.ENCERRAMENTO, color: 'bg-slate-500', border: 'border-slate-500' },
              { key: 'faturamento', label: 'Faturamento', status: StatusObra.FATURAMENTO, color: 'bg-teal-500', border: 'border-teal-500' },
            ];

            const expandedCol = expandedColumn ? kanbanColumns.find(c => c.key === expandedColumn) : null;

            // ===== MODO EXPANDIDO =====
            if (expandedCol) {
              const colObras = obras.filter(o => o.status === expandedCol.status);
              const q = kanbanSearch.toLowerCase();
              const filtered = q
                ? colObras.filter(o =>
                    o.numeroProjeto?.toLowerCase().includes(q) ||
                    o.municipio?.toLowerCase().includes(q) ||
                    o.enderecoObra?.toLowerCase().includes(q) ||
                    o.bairro?.toLowerCase().includes(q) ||
                    o.setor?.toLowerCase().includes(q) ||
                    getBaseNome(o.base)?.toLowerCase().includes(q) ||
                    String(o.valorProjetado ?? '').includes(q)
                  )
                : colObras;

              const totalValor = filtered.reduce((s, o) => s + (o.valorProjetado || 0), 0);

              return (
                <div className="flex flex-col min-h-[calc(100vh-200px)]">
                  {/* Header expandido */}
                  <div className={`${expandedCol.color} text-white px-4 py-3 flex items-center gap-3`}>
                    <button
                      onClick={() => { setExpandedColumn(null); setKanbanSearch(''); }}
                      className="hover:bg-white/20 rounded-full p-1 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex-1">
                      <h2 className="font-bold text-base">{expandedCol.label}</h2>
                      <p className="text-white/80 text-xs">{filtered.length} obra(s) · Total: R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <button
                      onClick={() => { setExpandedColumn(null); setKanbanSearch(''); }}
                      className="hover:bg-white/20 rounded-full p-1 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Searchbox */}
                  <div className="bg-white border-b px-4 py-2">
                    <div className="relative max-w-lg">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Pesquisar por projeto, município, endereço, bairro, setor, base, valor..."
                        value={kanbanSearch}
                        onChange={e => setKanbanSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                        autoFocus
                      />
                      {kanbanSearch && (
                        <button onClick={() => setKanbanSearch('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista compacta */}
                  <div className="flex-1 bg-white overflow-y-auto">
                    {filtered.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">{kanbanSearch ? 'Nenhuma obra encontrada para essa busca' : 'Nenhuma obra nesta etapa'}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {filtered.map(obra => (
                          <div
                            key={obra.id}
                            className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleViewDetails(obra)}
                          >
                            {/* Projeto */}
                            <div className="w-36 shrink-0">
                              <span className="font-semibold text-sm text-gray-900">{obra.numeroProjeto}</span>
                              <div className="flex gap-1 mt-0.5">
                                {obra.regulatorio && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-medium">Reg</span>}
                                {obra.projetoRevisado && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-medium">Rev</span>}
                              </div>
                            </div>

                            {/* Localização */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 text-xs text-gray-700">
                                <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="truncate font-medium">{obra.municipio}{obra.bairro ? ` · ${obra.bairro}` : ''}</span>
                              </div>
                              {obra.enderecoObra && (
                                <p className="text-[11px] text-gray-400 truncate mt-0.5 pl-4">{obra.enderecoObra}</p>
                              )}
                            </div>

                            {/* Setor · Base */}
                            <div className="w-32 shrink-0 text-xs text-gray-500 hidden md:block">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-gray-300 shrink-0" />
                                <span className="truncate">{obra.setor}</span>
                              </div>
                              <span className="pl-4 text-[11px] text-gray-400">{getBaseNome(obra.base)}</span>
                            </div>

                            {/* Datas */}
                            <div className="w-28 shrink-0 text-[11px] text-gray-400 hidden lg:block">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>{obra.dataInicio ? new Date(obra.dataInicio).toLocaleDateString('pt-BR') : '-'}</span>
                              </div>
                              {obra.dataFim && <p className="pl-4">{new Date(obra.dataFim).toLocaleDateString('pt-BR')}</p>}
                            </div>

                            {/* Técnico */}
                            <div className="w-24 shrink-0 text-[11px] text-gray-400 hidden xl:block">
                              <span>{obra.quantidadePoste} postes</span>
                              <p>{obra.quantidadeTrafo} trafos</p>
                            </div>

                            {/* Valor */}
                            <div className="w-28 shrink-0 text-right">
                              <span className="text-sm font-bold text-green-700">
                                R$ {(obra.valorProjetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ===== MODO NORMAL (Kanban) =====
            return (
              <div className="grid grid-cols-8 border border-gray-200 min-h-[calc(100vh-200px)]">
                {kanbanColumns.map((col) => {
                  const colObras = obras.filter(o => o.status === col.status);
                  return (
                    <div key={col.key} className="bg-gray-50 border-r border-gray-200 last:border-r-0 flex flex-col">
                      <div
                        className={`${col.color} text-white text-xs font-semibold px-2 py-1.5 flex items-center justify-between cursor-pointer hover:brightness-90 transition-all select-none`}
                        onClick={() => { setExpandedColumn(col.key); setKanbanSearch(''); }}
                        title="Clique para expandir"
                      >
                        <span className="truncate">{col.label}</span>
                        <span className="bg-white/30 rounded-full px-1.5 text-[10px] ml-1">{colObras.length}</span>
                      </div>
                      <div className="p-1 space-y-1 flex-1 overflow-y-auto">
                        {colObras.map((obra) => (
                          <div
                            key={obra.id}
                            className="bg-white border border-gray-200 rounded px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[11px] transition-colors"
                            onClick={() => handleViewDetails(obra)}
                          >
                            <div className="font-semibold text-gray-900">{obra.numeroProjeto}</div>
                            <div className="text-gray-500">{obra.dataInicio ? new Date(obra.dataInicio).toLocaleDateString('pt-BR') : '-'}</div>
                            <div className="font-medium text-green-700">R$ {(obra.valorProjetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <ObraDetalhesModal 
        obra={selectedObra}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStatusChange={() => {
          loadObras();
        }}
        basesMap={basesMap}
      />
    </div>
  );
}
