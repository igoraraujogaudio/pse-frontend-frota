"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Car,
  Search,
  Filter,
  Package,
  ArrowRight,
  Fingerprint,
  Shield
} from 'lucide-react';

import { baseService } from '@/services/baseService';
import { contratoService } from '@/services/contratoService';
import { supabase } from '@/lib/supabase';
import type { Base, Contrato } from '@/types/contratos';

interface BaseWithStats extends Base {
  totalUsuarios: number;
  totalEquipes: number;
  totalVeiculos: number;
}

export default function BasesManagementPage() {
  const [bases, setBases] = useState<BaseWithStats[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBase, setEditingBase] = useState<Base | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showVinculacaoDialog, setShowVinculacaoDialog] = useState(false);
  const [vinculandoItens, setVinculandoItens] = useState(false);
  const [baseSelecionadaVinculacao, setBaseSelecionadaVinculacao] = useState<string>('');
  const [togglingSESMT, setTogglingSESMT] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    cidade: '',
    estado: '',
    contrato_id: '',
    endereco: '',
    responsavel: '',
    telefone: '',
    email: '',
    ativa: true,
    habilitar_biometria_entrega: false,
    aprovar_sesmt_obrigatorio: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      console.log('🔍 DEBUG - Carregando dados...');

      // Teste direto com Supabase
      console.log('🔍 DEBUG - Testando conexão direta com Supabase...');

      // Teste 1: Contratos ativos
      const { data: contratosTest, error: contratosError } = await supabase
        .from('contratos')
        .select('*')
        .eq('status', 'ativo')
        .order('nome', { ascending: true });

      console.log('🔍 DEBUG - Teste direto contratos:', { data: contratosTest, error: contratosError });

      // Teste 2: Todas as bases
      const { data: todasBasesTest, error: todasBasesError } = await supabase
        .from('bases')
        .select('*')
        .order('nome', { ascending: true });

      console.log('🔍 DEBUG - Todas as bases:', { data: todasBasesTest, error: todasBasesError });

      // Teste 3: Bases com filtro boolean
      const { data: basesBooleanTest, error: basesBooleanError } = await supabase
        .from('bases')
        .select('*')
        .eq('ativa', true)
        .order('nome', { ascending: true });

      console.log('🔍 DEBUG - Bases filtro boolean:', { data: basesBooleanTest, error: basesBooleanError });

      // Teste 4: Bases com filtro string
      const { data: basesStringTest, error: basesStringError } = await supabase
        .from('bases')
        .select('*')
        .eq('ativa', 'true')
        .order('nome', { ascending: true });

      console.log('🔍 DEBUG - Bases filtro string:', { data: basesStringTest, error: basesStringError });



      // Agora usar os services
      console.log('🔍 DEBUG - Usando services...');

      const [basesData, contratosData] = await Promise.all([
        baseService.getBasesWithDetails(),
        contratoService.getContratosAtivos()
      ]);

      console.log('🔍 DEBUG - Bases carregadas via service:', basesData);
      console.log('🔍 DEBUG - Contratos carregados via service:', contratosData);

      setBases(basesData);
      setContratos(contratosData);

      console.log('🔍 DEBUG - Estado atualizado - Bases:', basesData.length, 'Contratos:', contratosData.length);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
      setMessage({ type: 'error', text: 'Erro ao carregar dados das bases' });
    } finally {
      setLoading(false);
    }
  };

  const filteredBases = bases.filter(base => {
    const matchesSearch = base.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      base.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      base.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      base.estado?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesContrato = selectedContrato === 'all' || base.contrato_id === selectedContrato;

    const matchesStatus = selectedStatus === 'all' ||
      (selectedStatus === 'ativa' && base.ativa) ||
      (selectedStatus === 'inativa' && !base.ativa);

    return matchesSearch && matchesContrato && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      cidade: '',
      estado: '',
      contrato_id: '',
      endereco: '',
      responsavel: '',
      telefone: '',
      email: '',
      ativa: true,
      habilitar_biometria_entrega: false,
      aprovar_sesmt_obrigatorio: true
    });
    setEditingBase(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (base: Base) => {
    setFormData({
      nome: base.nome || '',
      codigo: base.codigo || '',
      cidade: base.cidade || '',
      estado: base.estado || '',
      contrato_id: base.contrato_id || '',
      endereco: base.endereco || '',
      responsavel: base.responsavel || '',
      telefone: base.telefone || '',
      email: base.email || '',
      ativa: base.ativa,
      habilitar_biometria_entrega: (base as Base & { habilitar_biometria_entrega?: boolean }).habilitar_biometria_entrega || false,
      aprovar_sesmt_obrigatorio: base.aprovar_sesmt_obrigatorio ?? true
    });
    setEditingBase(base);
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.codigo) {
      setMessage({ type: 'error', text: 'Nome e código são obrigatórios' });
      return;
    }

    try {
      setSaving(true);

      // Debug logs
      console.log('🔍 DEBUG - Dados do formulário:', formData);
      console.log('🔍 DEBUG - Editando base:', editingBase);

      if (editingBase) {
        // Atualizar base existente
        console.log('🔄 Atualizando base existente...');
        const result = await baseService.updateBase(editingBase.id, formData);
        console.log('✅ Base atualizada:', result);
        setMessage({ type: 'success', text: 'Base atualizada com sucesso!' });
      } else {
        // Criar nova base
        console.log('🆕 Criando nova base...');
        const result = await baseService.createBase(formData);
        console.log('✅ Base criada:', result);
        setMessage({ type: 'success', text: 'Base criada com sucesso!' });
      }

      setShowCreateDialog(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('❌ Erro ao salvar base:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
      setMessage({ type: 'error', text: `Erro ao salvar base: ${(error as Error).message || 'Erro desconhecido'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (base: Base) => {
    if (!confirm(`Tem certeza que deseja excluir a base "${base.nome}"?`)) {
      return;
    }

    try {
      await baseService.deleteBase(base.id);
      setMessage({ type: 'success', text: 'Base excluída com sucesso!' });
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir base:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir base' });
    }
  };

  // Função para vincular todos os itens do catálogo a uma base
  const vincularTodosItensCatalogo = async (baseId: string) => {
    try {
      setVinculandoItens(true);

      // Buscar todos os itens do catálogo ativos
      const { data: itensCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('*')
        .eq('ativo', true);

      if (catalogoError) throw catalogoError;

      // Buscar itens já vinculados a esta base
      const { data: itensJaVinculados, error: vinculadosError } = await supabase
        .from('itens_estoque')
        .select('item_catalogo_id')
        .eq('base_id', baseId);

      if (vinculadosError) throw vinculadosError;

      const idsJaVinculados = new Set(itensJaVinculados?.map(item => item.item_catalogo_id) || []);

      // Filtrar apenas itens não vinculados
      const itensParaVincular = itensCatalogo?.filter(item => !idsJaVinculados.has(item.id)) || [];

      if (itensParaVincular.length === 0) {
        setMessage({ type: 'info', text: 'Todos os itens do catálogo já estão vinculados a esta base.' });
        return;
      }

      // Inserir todos os itens não vinculados
      const itensParaInserir = itensParaVincular.map(item => ({
        item_catalogo_id: item.id,
        base_id: baseId,
        codigo: item.codigo,
        nome: item.nome_inicial || item.nome, // Usar nome_inicial se existir
        estoque_atual: 0,
        estoque_minimo: 0,
        status: 'ativo',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('itens_estoque')
        .insert(itensParaInserir);

      if (insertError) throw insertError;

      setMessage({
        type: 'success',
        text: `${itensParaVincular.length} itens do catálogo foram vinculados à base com sucesso!`
      });

      setShowVinculacaoDialog(false);
      setBaseSelecionadaVinculacao('');

    } catch (error) {
      console.error('Erro ao vincular itens:', error);
      setMessage({ type: 'error', text: 'Erro ao vincular itens do catálogo. Tente novamente.' });
    } finally {
      setVinculandoItens(false);
    }
  };

  const handleToggleStatus = async (base: Base) => {
    try {
      await baseService.updateBase(base.id, { ativa: !base.ativa });
      setMessage({
        type: 'success',
        text: `Base ${!base.ativa ? 'ativada' : 'desativada'} com sucesso!`
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao alterar status da base:', error);
      setMessage({ type: 'error', text: 'Erro ao alterar status da base' });
    }
  };

  const handleToggleBiometric = async (base: Base) => {
    try {
      const currentValue = (base as Base & { habilitar_biometria_entrega?: boolean }).habilitar_biometria_entrega || false;
      await baseService.updateBase(base.id, { habilitar_biometria_entrega: !currentValue });
      setMessage({
        type: 'success',
        text: `Biometria na entrega ${!currentValue ? 'habilitada' : 'desabilitada'} com sucesso!`
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao alterar biometria da base:', error);
      setMessage({ type: 'error', text: 'Erro ao alterar configuração de biometria' });
    }
  };

  const handleToggleSESMT = async (base: Base) => {
    // Prevenir múltiplos cliques
    if (togglingSESMT.has(base.id)) {
      return;
    }

    try {
      setTogglingSESMT(prev => new Set(prev).add(base.id));
      const currentValue = base.aprovar_sesmt_obrigatorio ?? true;
      const newValue = !currentValue;

      await baseService.updateBase(base.id, { aprovar_sesmt_obrigatorio: newValue });

      setMessage({
        type: 'success',
        text: `Aprovação SESMT ${newValue ? 'obrigatória' : 'opcional'} para esta base!`
      });

      // Recarregar dados para atualizar o estado
      await loadData();
    } catch (error) {
      console.error('Erro ao alterar configuração SESMT da base:', error);
      setMessage({ type: 'error', text: 'Erro ao alterar configuração de aprovação SESMT' });
      // Recarregar mesmo em caso de erro para garantir estado consistente
      await loadData();
    } finally {
      setTogglingSESMT(prev => {
        const next = new Set(prev);
        next.delete(base.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando bases...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Bases</h1>
            <p className="text-muted-foreground">
              Gerencie as bases físicas dos contratos
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Base
          </Button>
        </div>
      </div>

      {message && (
        <Alert className={`mb-4 ${message.type === 'error' ? 'border-red-200' : message.type === 'success' ? 'border-green-200' : 'border-blue-200'}`}>
          {message.type === 'error' && <XCircle className="h-4 w-4" />}
          {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
          {message.type === 'info' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome, código, cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contrato-filter">Contrato</Label>
              <Select value={selectedContrato} onValueChange={setSelectedContrato}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratos</SelectItem>
                  {contratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome} ({contrato.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="inativa">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                <strong>{filteredBases.length}</strong> bases encontradas
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Bases */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBases.map(base => (
          <Card key={base.id} className={`${!base.ativa ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{base.nome}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={base.ativa ? 'default' : 'secondary'}>
                    {base.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <Switch
                    checked={base.ativa}
                    onCheckedChange={() => handleToggleStatus(base)}
                  />
                </div>
              </div>
              <CardDescription>
                <Badge variant="outline" className="text-xs">
                  {base.codigo}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Localização */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Localização</div>
                  <div className="text-sm">
                    {base.cidade && base.estado ? `${base.cidade}, ${base.estado}` : 'Não informada'}
                  </div>
                </div>

                {/* Contrato */}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Contrato</div>
                  <div className="text-sm">
                    {base.contrato ? (
                      <Badge variant="outline" className="text-xs">
                        {base.contrato.nome}
                      </Badge>
                    ) : 'Não vinculada'}
                  </div>
                </div>

                {/* Responsável */}
                {base.responsavel && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Responsável</div>
                    <div className="text-sm">{base.responsavel}</div>
                  </div>
                )}

                {/* Biometria na Entrega */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Biometria na Entrega</span>
                  </div>
                  <Switch
                    checked={(base as Base & { habilitar_biometria_entrega?: boolean }).habilitar_biometria_entrega || false}
                    onCheckedChange={() => handleToggleBiometric(base)}
                  />
                </div>

                {/* Aprovação SESMT Obrigatória */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Aprovação SESMT Obrigatória</span>
                  </div>
                  <Switch
                    checked={base.aprovar_sesmt_obrigatorio ?? true}
                    onCheckedChange={() => handleToggleSESMT(base)}
                    disabled={togglingSESMT.has(base.id)}
                  />
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-xs font-medium">{base.totalUsuarios}</div>
                    <div className="text-xs text-muted-foreground">Usuários</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-xs font-medium">{base.totalEquipes}</div>
                    <div className="text-xs text-muted-foreground">Equipes</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <Car className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-xs font-medium">{base.totalVeiculos}</div>
                    <div className="text-xs text-muted-foreground">Veículos</div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(base)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBaseSelecionadaVinculacao(base.id);
                      setShowVinculacaoDialog(true);
                    }}
                    className="text-blue-600 hover:text-blue-700"
                    title="Vincular todos os itens do catálogo"
                  >
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(base)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma base encontrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedContrato !== 'all' || selectedStatus !== 'all'
                ? 'Tente ajustar os filtros para encontrar bases.'
                : 'Comece criando uma nova base para o sistema.'
              }
            </p>
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova Base
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBase ? 'Editar Base' : 'Nova Base'}
            </DialogTitle>
            <DialogDescription>
              {editingBase
                ? 'Atualize as informações da base física.'
                : 'Crie uma nova base física para um contrato.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="contact">Contato & Endereço</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome da base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                      placeholder="Código único"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contrato">Contrato</Label>
                  <Select
                    value={formData.contrato_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, contrato_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                      placeholder="Cidade"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativa"
                      checked={formData.ativa}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativa: checked }))}
                    />
                    <Label htmlFor="ativa">Base ativa</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="habilitar_biometria_entrega"
                      checked={formData.habilitar_biometria_entrega}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, habilitar_biometria_entrega: checked }))}
                    />
                    <Label htmlFor="habilitar_biometria_entrega" className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4 text-green-600" />
                      Habilitar biometria na entrega
                    </Label>
                  </div>
                  {formData.habilitar_biometria_entrega && (
                    <p className="text-xs text-muted-foreground ml-8">
                      Todas as entregas nesta base requererão confirmação biométrica
                    </p>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="aprovar_sesmt_obrigatorio"
                      checked={formData.aprovar_sesmt_obrigatorio}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, aprovar_sesmt_obrigatorio: checked }))}
                    />
                    <Label htmlFor="aprovar_sesmt_obrigatorio" className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Aprovação SESMT obrigatória
                    </Label>
                  </div>
                  {!formData.aprovar_sesmt_obrigatorio && (
                    <p className="text-xs text-muted-foreground ml-8">
                      Quando desativado, apenas a aprovação do Almoxarifado será necessária para esta base
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div>
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Endereço completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="responsavel">Responsável</Label>
                    <Input
                      id="responsavel"
                      value={formData.responsavel}
                      onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
                      placeholder="Nome do responsável"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(xx) xxxxx-xxxx"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>


              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBase ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vinculação de Itens do Catálogo */}
      <Dialog open={showVinculacaoDialog} onOpenChange={setShowVinculacaoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Vincular Itens do Catálogo
            </DialogTitle>
            <DialogDescription>
              Esta ação irá vincular todos os itens do catálogo à base selecionada.
              Apenas itens não vinculados serão adicionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Esta ação irá criar registros de estoque para todos os itens do catálogo
                que ainda não estão vinculados à base &quot;{bases.find(b => b.id === baseSelecionadaVinculacao)?.nome}&quot;.
                Os itens serão criados com estoque inicial zero.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">O que será feito:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Buscar todos os itens ativos do catálogo
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Verificar quais já estão vinculados à base
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Criar registros de estoque para itens não vinculados
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Configurar estoque inicial como zero
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVinculacaoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vincularTodosItensCatalogo(baseSelecionadaVinculacao)}
              disabled={vinculandoItens}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {vinculandoItens && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Package className="mr-2 h-4 w-4" />
              Vincular Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
