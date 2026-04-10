'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  UserPlus, 
  Eye, 
  FileSpreadsheet,
  Users,
  Download,
  UserMinus,
  Briefcase,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { formatarCPF } from '@/utils/cpfUtils';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useFuncionarios, useContratos, useCreateFuncionario, useDismissFuncionario } from '@/hooks/useFuncionarios';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cargo: string;
  operacao: string;
  status: string;
  contrato_id?: string;
  contrato_nome?: string;
  base_nome?: string;
  validade_cnh?: string;
  data_ultimo_exame_aso?: string;
  har_vencimento?: string;
  cpf?: string;
  telefone?: string;
  data_nascimento?: string;
  data_admissao?: string;
  cnh?: string;
  cnh_categoria?: string;
  data_agendamento_aso?: string;
}

export default function FuncionariosPage() {
  const router = useRouter();
  const { hasPermission } = useModularPermissions();
  const { userContratos, hasContratoAccess } = useUnifiedPermissions();
  const { user } = useAuth();
  
  const { data: funcionarios = [], isLoading } = useFuncionarios();
  const { data: contratos = [] } = useContratos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterContrato, setFilterContrato] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [exportando, setExportando] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null);
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editData, setEditData] = useState<Partial<Funcionario>>({});
  const [createForm, setCreateForm] = useState({
    nome: '',
    email: '',
    matricula: '',
    cpf: '',
    telefone: '',
    cargo: '',
    operacao: '',
    contrato_id: '',
    email_pessoal: '',
  });
  
  const createFuncionarioMutation = useCreateFuncionario();
  const dismissFuncionarioMutation = useDismissFuncionario();
  const [cargosExistentes, setCargosExistentes] = useState<string[]>([]);

  // Carregar cargos existentes para o searchbox
  useEffect(() => {
    fetch('/api/cargos').then(res => res.json()).then(data => {
      const nomes = (data.cargos || []).map((c: { nome: string }) => c.nome).filter(Boolean);
      setCargosExistentes([...new Set(nomes)] as string[]);
    }).catch(() => {});
  }, []);

  const [dismissForm, setDismissForm] = useState({
    data_demissao: new Date().toISOString().split('T')[0],
    tipo_demissao: 'sem_justa_causa',
    observacoes: ''
  });
  const [itensPendentes, setItensPendentes] = useState<Array<{ nome: string; codigo: string; quantidade: number; categoria: string }>>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [warningForm, setWarningForm] = useState({
    tipo: '',
    motivo: '',
    descricao: '',
    data_ocorrencia: new Date().toISOString().split('T')[0],
    base_id: '',
    periodo_suspensao: '',
    data_inicio_suspensao: '',
    data_retorno_conclusoes: ''
  });

  // Contratos permitidos
  const contratosPermitidos = useMemo(() => {
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      return contratos;
    }
    const contratoIds = (userContratos || [])
      .filter((uc: { ativo: boolean; data_fim?: string }) => uc.ativo && (!uc.data_fim || new Date(uc.data_fim) >= new Date()))
      .map((uc: { contrato_id: string }) => uc.contrato_id);
    return contratos.filter(c => contratoIds.includes(c.id));
  }, [contratos, userContratos, user]);

  // Funcionários filtrados
  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((f: Funcionario) => {
      const matchesSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           f.matricula.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesContrato = (() => {
        if (filterContrato === 'todos') {
          if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) return true;
          if (!f.contrato_id) return false;
          return hasContratoAccess(f.contrato_id);
        }
        return f.contrato_id === filterContrato;
      })();
      
      return matchesSearch && matchesContrato;
    });
  }, [funcionarios, searchTerm, filterContrato, user, hasContratoAccess]);

  // Paginação
  const totalPages = Math.ceil(filteredFuncionarios.length / ITEMS_PER_PAGE);
  const paginatedFuncionarios = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFuncionarios.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFuncionarios, currentPage]);

  // Exportar para Excel
  const exportarFuncionariosExcel = async () => {
    try {
      setExportando(true);
      
      const dadosExcel = filteredFuncionarios.map((f: Funcionario) => ({
        'Nome': f.nome || '',
        'Matrícula': f.matricula || '',
        'CPF': f.cpf ? formatarCPF(f.cpf) : '',
        'Email': f.email || '',
        'Telefone': f.telefone || '',
        'Cargo': f.cargo || '',
        'Operação': f.operacao || '',
        'Base': f.base_nome || '',
        'Contrato': f.contrato_nome || '',
        'Status': f.status || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      
      const colWidths = [
        { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
      
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      let nomeArquivo = `Funcionarios_${dataAtual}`;
      
      if (filterContrato !== 'todos') {
        const contratoNome = contratos.find(c => c.id === filterContrato)?.nome || '';
        nomeArquivo += `_${contratoNome.replace(/\s+/g, '_')}`;
      }
      
      if (searchTerm) {
        nomeArquivo += `_${searchTerm.substring(0, 10)}`;
      }
      
      nomeArquivo += '.xlsx';
      
      XLSX.writeFile(wb, nomeArquivo);
      toast.success(`Relatório exportado! (${filteredFuncionarios.length} funcionários)`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setExportando(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ativo') {
      return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  const getDocStatus = (date: string | undefined) => {
    if (!date) return <Badge variant="outline" className="text-xs">Sem info</Badge>;
    
    const hoje = new Date();
    const venc = new Date(date);
    const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dias < 0) return <Badge variant="destructive" className="text-xs">Vencido</Badge>;
    if (dias <= 30) return <Badge className="bg-orange-500 text-xs">Vencendo</Badge>;
    return <Badge className="bg-green-500 text-xs">OK</Badge>;
  };

  const handleWarning = (f: Funcionario, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFuncionario(f);
    setWarningModalOpen(true);
  };

  const handleSubmitWarning = async () => {
    if (!selectedFuncionario || !warningForm.tipo || !warningForm.motivo || !warningForm.descricao || !warningForm.data_ocorrencia || !warningForm.base_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validações específicas por tipo
    if (warningForm.tipo === 'suspensao') {
      if (!warningForm.periodo_suspensao || !warningForm.data_inicio_suspensao) {
        toast.error('Para suspensão, informe o período e data de início');
        return;
      }
    }

    if (warningForm.tipo === 'falta_grave') {
      if (!warningForm.data_retorno_conclusoes) {
        toast.error('Para falta grave, informe a data de retorno das conclusões');
        return;
      }
    }

    try {
      const response = await fetch('/api/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedFuncionario.id,
          tipo_aviso: warningForm.tipo,
          motivo: warningForm.motivo,
          observacoes: warningForm.descricao,
          data_ocorrencia: warningForm.data_ocorrencia,
          base_id: warningForm.base_id,
          periodo_suspensao: warningForm.periodo_suspensao ? parseInt(warningForm.periodo_suspensao) : undefined,
          data_inicio_suspensao: warningForm.data_inicio_suspensao || undefined,
          data_retorno_conclusoes: warningForm.data_retorno_conclusoes || undefined
        })
      });

      if (!response.ok) throw new Error('Erro ao criar advertência');

      toast.success('Advertência criada com sucesso!');
      setWarningModalOpen(false);
      setWarningForm({ 
        tipo: '',
        motivo: '',
        descricao: '',
        data_ocorrencia: new Date().toISOString().split('T')[0],
        base_id: '',
        periodo_suspensao: '',
        data_inicio_suspensao: '',
        data_retorno_conclusoes: ''
      });
      setSelectedFuncionario(null);
    } catch (error) {
      console.error('Erro ao criar advertência:', error);
      toast.error('Erro ao criar advertência');
    }
  };

  const handleCreateFuncionario = async () => {
    // Validações obrigatórias
    if (!createForm.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!createForm.matricula.trim()) {
      toast.error('Matrícula é obrigatória');
      return;
    }
    if (!createForm.email.trim()) {
      toast.error('Email é obrigatório');
      return;
    }
    if (!createForm.cpf.trim()) {
      toast.error('CPF é obrigatório');
      return;
    }
    if (!createForm.cargo.trim()) {
      toast.error('Cargo é obrigatório');
      return;
    }
    if (!createForm.operacao.trim()) {
      toast.error('Operação é obrigatória');
      return;
    }
    if (!createForm.contrato_id.trim()) {
      toast.error('Contrato é obrigatório');
      return;
    }

    const apiData = {
      nome: createForm.nome,
      email: createForm.email,
      matricula: createForm.matricula,
      cpf: createForm.cpf,
      telefone: createForm.telefone,
      cargo: createForm.cargo,
      posicao: '',
      operacao: createForm.operacao,
      contrato_id: createForm.contrato_id,
      senha: 'PSE2025',
      deve_mudar_senha: true,
      email_pessoal: createForm.email_pessoal || undefined
    };

    createFuncionarioMutation.mutate(apiData, {
      onSuccess: () => {
        setCreateModalOpen(false);
        setCreateForm({
          nome: '',
          email: '',
          matricula: '',
          cpf: '',
          telefone: '',
          cargo: '',
          operacao: '',
          contrato_id: '',
          email_pessoal: '',
        });
        router.refresh();
      }
    });
  };

  const handleDismiss = async (f: Funcionario, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFuncionario(f);
    setDismissForm({
      data_demissao: new Date().toISOString().split('T')[0],
      tipo_demissao: 'sem_justa_causa',
      observacoes: ''
    });
    setItensPendentes([]);
    setDismissModalOpen(true);

    // Buscar itens do inventário do funcionário
    setLoadingItens(true);
    try {
      const { data, error } = await supabase
        .from('inventario_funcionario')
        .select('quantidade, item_estoque:itens_estoque!item_estoque_id(nome, codigo, categoria)')
        .eq('funcionario_id', f.id)
        .eq('status', 'em_uso');

      if (!error && data && data.length > 0) {
        setItensPendentes(data.map((item: Record<string, unknown>) => ({
          nome: (item.item_estoque as Record<string, unknown>)?.nome as string || 'Item desconhecido',
          codigo: (item.item_estoque as Record<string, unknown>)?.codigo as string || '-',
          quantidade: (item.quantidade as number) || 1,
          categoria: (item.item_estoque as Record<string, unknown>)?.categoria as string || '-'
        })));
      }
    } catch (err) {
      console.error('Erro ao buscar itens do inventário:', err);
    } finally {
      setLoadingItens(false);
    }
  };

  const handleSubmitDismiss = async () => {
    if (!selectedFuncionario) return;

    dismissFuncionarioMutation.mutate({
      usuario_id: selectedFuncionario.id,
      data_demissao: dismissForm.data_demissao,
      tipo_demissao: dismissForm.tipo_demissao,
      observacoes: dismissForm.observacoes
    }, {
      onSuccess: () => {
        setDismissModalOpen(false);
        setSelectedFuncionario(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard 
      requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR]}
      fallbackMessage="Você não tem permissão para visualizar funcionários."
    >
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Funcionários</h1>
            <p className="text-sm text-gray-600">Gerencie os funcionários da empresa</p>
          </div>
          <div className="flex gap-1.5 items-center flex-wrap justify-end">
            <Button 
              variant="outline"
              size="sm"
              onClick={exportarFuncionariosExcel}
              disabled={exportando || filteredFuncionarios.length === 0}
              className="h-8 px-2 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => router.push('/users/dismissed')}
              disabled={!hasPermission(PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS)}
              className="h-8 px-2 text-xs"
            >
              <UserMinus className="h-3.5 w-3.5 mr-1.5" />
              Demitidos
            </Button>
            <Button 
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              disabled={!hasPermission(PERMISSION_CODES.FUNCIONARIOS.CRIAR)}
              className="h-8 px-2 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Novo Funcionário
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, matrícula..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Select value={filterContrato} onValueChange={(v) => { setFilterContrato(v); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os Contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Contratos</SelectItem>
                  {contratosPermitidos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contador */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{filteredFuncionarios.length} funcionário(s)</span>
        </div>

        {/* Lista - Formato Tabela */}
        <Card>
          <CardContent className="p-0">
            {filteredFuncionarios.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhum funcionário encontrado
                </h3>
                <p className="text-sm text-gray-600">
                  Ajuste os filtros ou cadastre um novo funcionário
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {paginatedFuncionarios.map((f: Funcionario) => (
                  <div 
                    key={f.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/funcionarios/${f.id}`)}
                  >
                    {/* Avatar + Nome */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                        {f.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate">{f.nome}</div>
                        <div className="text-xs text-gray-500">{f.matricula}</div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      {getStatusBadge(f.status)}
                    </div>

                    {/* Cargo */}
                    <div className="hidden md:block w-52 flex-shrink-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{f.cargo}</div>
                      <div className="text-xs text-gray-500 truncate">{f.operacao}</div>
                    </div>

                    {/* Documentos */}
                    <div className="hidden lg:flex gap-3 flex-shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500">CNH</span>
                        {getDocStatus(f.validade_cnh)}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500">ASO</span>
                        {getDocStatus(f.data_ultimo_exame_aso)}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500">HAR</span>
                        {getDocStatus(f.har_vencimento)}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {f.status === 'ativo' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          onClick={(e) => handleWarning(f, e)}
                          title="Advertência"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      )}
                      {f.status === 'ativo' && hasPermission(PERMISSION_CODES.FUNCIONARIOS.DEMITIR) && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleDismiss(f, e)}
                          title="Demitir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFuncionario(f);
                          setDetailsModalOpen(true);
                        }}
                        title="Ver Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        {/* Modal de Detalhes do Funcionário */}
        <Dialog open={detailsModalOpen} onOpenChange={(open) => {
          setDetailsModalOpen(open);
          if (!open) {
            setIsEditingInModal(false);
            setEditData({});
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-2xl">Detalhes do Funcionário</DialogTitle>
                  <DialogDescription>
                    {selectedFuncionario && (
                      <span className="text-base">
                        <strong>{selectedFuncionario.nome}</strong> - {selectedFuncionario.matricula}
                      </span>
                    )}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  {isEditingInModal ? (
                    <>
                      <Button 
                        size="sm"
                        onClick={async () => {
                          if (!selectedFuncionario) return;
                          try {
                            const response = await fetch(`/api/users/${selectedFuncionario.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(editData)
                            });
                            if (!response.ok) throw new Error('Erro ao salvar');
                            toast.success('Alterações salvas!');
                            setIsEditingInModal(false);
                            window.location.reload();
                          } catch {
                            toast.error('Erro ao salvar alterações');
                          }
                        }}
                      >
                        Salvar
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsEditingInModal(false);
                          setEditData(selectedFuncionario || {});
                        }}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      {selectedFuncionario && hasPermission(PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS) && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingInModal(true);
                            setEditData(selectedFuncionario);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      {selectedFuncionario?.status === 'ativo' && (
                        <Button 
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-600"
                          onClick={() => {
                            setDetailsModalOpen(false);
                            setWarningModalOpen(true);
                          }}
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Advertência
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogHeader>

            {selectedFuncionario && (
              <div className="space-y-6 py-4">
                {/* Informações Pessoais */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-800">
                    <Users className="h-5 w-5" />
                    Informações Pessoais e Contato
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div>
                      <Label className="text-xs text-gray-600">Nome Completo</Label>
                      {isEditingInModal ? (
                        <Input value={editData.nome || ''} onChange={(e) => setEditData({ ...editData, nome: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-semibold text-gray-900">{selectedFuncionario.nome}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Matrícula</Label>
                      {isEditingInModal ? (
                        <Input value={editData.matricula || ''} onChange={(e) => setEditData({ ...editData, matricula: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-semibold text-gray-900">{selectedFuncionario.matricula}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">CPF</Label>
                      {isEditingInModal ? (
                        <Input value={editData.cpf || ''} onChange={(e) => setEditData({ ...editData, cpf: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium text-gray-900">{selectedFuncionario.cpf ? formatarCPF(selectedFuncionario.cpf) : 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedFuncionario.status)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Email</Label>
                      {isEditingInModal ? (
                        <Input type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium text-gray-900">{selectedFuncionario.email}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Telefone</Label>
                      {isEditingInModal ? (
                        <Input value={editData.telefone || ''} onChange={(e) => setEditData({ ...editData, telefone: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium text-gray-900">{selectedFuncionario.telefone || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Informações Profissionais */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-800">
                    <Briefcase className="h-5 w-5" />
                    Informações Profissionais
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <div>
                      <Label className="text-xs text-gray-600">Cargo</Label>
                      {isEditingInModal ? (
                        <Input value={editData.cargo || ''} onChange={(e) => setEditData({ ...editData, cargo: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-semibold text-gray-900">{selectedFuncionario.cargo}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Operação</Label>
                      {isEditingInModal ? (
                        <Input value={editData.operacao || ''} onChange={(e) => setEditData({ ...editData, operacao: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-semibold text-gray-900">{selectedFuncionario.operacao}</p>
                      )}
                    </div>
                    {(selectedFuncionario.contrato_nome || isEditingInModal) && (
                      <div>
                        <Label className="text-xs text-gray-600">Contrato</Label>
                        {isEditingInModal ? (
                          <Select value={editData.contrato_id || ''} onValueChange={(v) => setEditData({ ...editData, contrato_id: v })}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {contratosPermitidos.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.contrato_nome}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Documentos e Vencimentos */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-800">
                    <FileSpreadsheet className="h-5 w-5" />
                    Documentos e Vencimentos
                  </h3>
                  
                  {/* CNH */}
                  <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🚗</span>
                        <h4 className="font-semibold text-blue-900">CNH</h4>
                      </div>
                      {getDocStatus(selectedFuncionario.validade_cnh)}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <Label className="text-xs text-blue-700">Validade</Label>
                        {isEditingInModal ? (
                          <Input type="date" value={editData.validade_cnh || ''} onChange={(e) => setEditData({ ...editData, validade_cnh: e.target.value })} className="mt-1" />
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.validade_cnh ? new Date(selectedFuncionario.validade_cnh).toLocaleDateString('pt-BR') : 'Não informado'}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Categoria</Label>
                        {isEditingInModal ? (
                          <Input value={editData.cnh_categoria || ''} onChange={(e) => setEditData({ ...editData, cnh_categoria: e.target.value })} className="mt-1" />
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.cnh_categoria || 'Não informado'}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Número</Label>
                        {isEditingInModal ? (
                          <Input value={editData.cnh || ''} onChange={(e) => setEditData({ ...editData, cnh: e.target.value })} className="mt-1" />
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.cnh || 'Não informado'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ASO */}
                  <div className="mb-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏥</span>
                        <h4 className="font-semibold text-purple-900">ASO</h4>
                      </div>
                      {getDocStatus(selectedFuncionario.data_ultimo_exame_aso)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-xs text-purple-700">Último Exame</Label>
                        {isEditingInModal ? (
                          <Input type="date" value={editData.data_ultimo_exame_aso || ''} onChange={(e) => setEditData({ ...editData, data_ultimo_exame_aso: e.target.value })} className="mt-1" />
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.data_ultimo_exame_aso ? new Date(selectedFuncionario.data_ultimo_exame_aso).toLocaleDateString('pt-BR') : 'Não informado'}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-purple-700">Agendamento</Label>
                        {isEditingInModal ? (
                          <Input type="datetime-local" value={editData.data_agendamento_aso ? String(editData.data_agendamento_aso).slice(0, 16) : ''} onChange={(e) => setEditData({ ...editData, data_agendamento_aso: e.target.value })} className="mt-1" />
                        ) : (
                          <p className="font-medium text-gray-900">{selectedFuncionario.data_agendamento_aso ? new Date(selectedFuncionario.data_agendamento_aso).toLocaleString('pt-BR') : 'Não agendado'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* HAR */}
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <h4 className="font-semibold text-indigo-900">HAR</h4>
                      </div>
                      {getDocStatus(selectedFuncionario.har_vencimento)}
                    </div>
                    <div className="text-sm">
                      <Label className="text-xs text-indigo-700">Vencimento</Label>
                      {isEditingInModal ? (
                        <Input type="date" value={editData.har_vencimento || ''} onChange={(e) => setEditData({ ...editData, har_vencimento: e.target.value })} className="mt-1" />
                      ) : (
                        <p className="font-medium text-gray-900">{selectedFuncionario.har_vencimento ? new Date(selectedFuncionario.har_vencimento).toLocaleDateString('pt-BR') : 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDetailsModalOpen(false);
                  setSelectedFuncionario(null);
                  setIsEditingInModal(false);
                  setEditData({});
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Advertência */}
        <Dialog open={warningModalOpen} onOpenChange={setWarningModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Advertência</DialogTitle>
              <DialogDescription>
                {selectedFuncionario && (
                  <span>
                    Funcionário: <strong>{selectedFuncionario.nome}</strong> - {selectedFuncionario.matricula}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Advertência *</Label>
                  <Select 
                    value={warningForm.tipo} 
                    onValueChange={(value) => setWarningForm({ ...warningForm, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="advertencia">Advertência</SelectItem>
                      <SelectItem value="suspensao">Suspensão</SelectItem>
                      <SelectItem value="falta_grave">Falta Grave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="motivo">Motivo *</Label>
                  <Select 
                    value={warningForm.motivo} 
                    onValueChange={(value) => setWarningForm({ ...warningForm, motivo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="atraso">Atraso</SelectItem>
                      <SelectItem value="falta">Falta</SelectItem>
                      <SelectItem value="comportamento">Comportamento Inadequado</SelectItem>
                      <SelectItem value="negligencia">Negligência</SelectItem>
                      <SelectItem value="insubordinacao">Insubordinação</SelectItem>
                      <SelectItem value="epi">Não uso de EPI</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data_ocorrencia">Data da Ocorrência *</Label>
                  <Input
                    id="data_ocorrencia"
                    type="date"
                    value={warningForm.data_ocorrencia}
                    onChange={(e) => setWarningForm({ ...warningForm, data_ocorrencia: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="base_id">Base *</Label>
                  <Select 
                    value={warningForm.base_id} 
                    onValueChange={(value) => setWarningForm({ ...warningForm, base_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a base" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {selectedFuncionario?.base_nome && (
                        <SelectItem value={selectedFuncionario.base_nome}>
                          {selectedFuncionario.base_nome}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {warningForm.tipo === 'suspensao' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="periodo_suspensao">Período de Suspensão (dias) *</Label>
                    <Input
                      id="periodo_suspensao"
                      type="number"
                      min="1"
                      placeholder="Número de dias"
                      value={warningForm.periodo_suspensao}
                      onChange={(e) => setWarningForm({ ...warningForm, periodo_suspensao: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_inicio_suspensao">Data de Início da Suspensão *</Label>
                    <Input
                      id="data_inicio_suspensao"
                      type="date"
                      value={warningForm.data_inicio_suspensao}
                      onChange={(e) => setWarningForm({ ...warningForm, data_inicio_suspensao: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {warningForm.tipo === 'falta_grave' && (
                <div>
                  <Label htmlFor="data_retorno_conclusoes">Data de Retorno das Conclusões *</Label>
                  <Input
                    id="data_retorno_conclusoes"
                    type="date"
                    value={warningForm.data_retorno_conclusoes}
                    onChange={(e) => setWarningForm({ ...warningForm, data_retorno_conclusoes: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="descricao">Descrição/Observações *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva detalhadamente a ocorrência..."
                  value={warningForm.descricao}
                  onChange={(e) => setWarningForm({ ...warningForm, descricao: e.target.value })}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setWarningModalOpen(false);
                  setWarningForm({ 
                    tipo: '',
                    motivo: '',
                    descricao: '',
                    data_ocorrencia: new Date().toISOString().split('T')[0],
                    base_id: '',
                    periodo_suspensao: '',
                    data_inicio_suspensao: '',
                    data_retorno_conclusoes: ''
                  });
                  setSelectedFuncionario(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmitWarning}
                disabled={!warningForm.tipo || !warningForm.descricao}
              >
                Criar Advertência
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Demissão */}
        <Dialog open={dismissModalOpen} onOpenChange={(open) => {
          if (!open) {
            setDismissModalOpen(false);
            setSelectedFuncionario(null);
            setItensPendentes([]);
            setDismissForm({
              data_demissao: new Date().toISOString().split('T')[0],
              tipo_demissao: 'sem_justa_causa',
              observacoes: ''
            });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demitir Funcionário</DialogTitle>
              <DialogDescription>
                {selectedFuncionario && `Confirme os dados da demissão de ${selectedFuncionario.nome}`}
              </DialogDescription>
            </DialogHeader>

            {/* Aviso de itens pendentes no inventário */}
            {loadingItens && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                Verificando inventário...
              </div>
            )}
            {!loadingItens && itensPendentes.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Funcionário possui {itensPendentes.length} {itensPendentes.length === 1 ? 'item' : 'itens'} no inventário
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      A demissão será bloqueada até que todos os itens sejam devolvidos.
                    </p>
                  </div>
                </div>
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-red-700 border-b border-red-200">
                        <th className="pb-1 pr-2">Item</th>
                        <th className="pb-1 pr-2">Código</th>
                        <th className="pb-1 pr-2">Qtd</th>
                        <th className="pb-1">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensPendentes.map((item, idx) => (
                        <tr key={idx} className="border-b border-red-100 last:border-0">
                          <td className="py-1 pr-2 text-red-800">{item.nome}</td>
                          <td className="py-1 pr-2 text-red-700">{item.codigo}</td>
                          <td className="py-1 pr-2 text-red-700">{item.quantidade}</td>
                          <td className="py-1 text-red-700">{item.categoria}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <Label htmlFor="dismiss-data">Data da Demissão *</Label>
                <Input
                  id="dismiss-data"
                  type="date"
                  value={dismissForm.data_demissao}
                  onChange={(e) => setDismissForm({ ...dismissForm, data_demissao: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dismiss-tipo">Tipo de Demissão *</Label>
                <Select value={dismissForm.tipo_demissao} onValueChange={(value) => setDismissForm({ ...dismissForm, tipo_demissao: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="sem_justa_causa">Sem Justa Causa</SelectItem>
                    <SelectItem value="com_justa_causa">Com Justa Causa</SelectItem>
                    <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                    <SelectItem value="aposentadoria">Aposentadoria</SelectItem>
                    <SelectItem value="falecimento">Falecimento</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dismiss-observacoes">Observações</Label>
                <Textarea
                  id="dismiss-observacoes"
                  value={dismissForm.observacoes}
                  onChange={(e) => setDismissForm({ ...dismissForm, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDismissModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Tem certeza que deseja demitir este funcionário? Esta ação não pode ser desfeita.')) {
                    handleSubmitDismiss();
                  }
                }}
              >
                Confirmar Demissão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Criar Funcionário */}
        <Dialog open={createModalOpen} onOpenChange={(open) => {
          if (!open) {
            setCreateModalOpen(false);
            setCreateForm({
              nome: '',
              email: '',
              matricula: '',
              cpf: '',
              telefone: '',
              cargo: '',
              operacao: '',
              contrato_id: '',
              email_pessoal: '',
            });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Funcionário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo funcionário
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-nome">Nome Completo *</Label>
                  <Input
                    id="create-nome"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="create-matricula">Matrícula *</Label>
                  <Input
                    id="create-matricula"
                    value={createForm.matricula}
                    onChange={(e) => {
                      const mat = e.target.value;
                      setCreateForm({ ...createForm, matricula: mat, email: mat ? `${mat}@pse.srv.br` : '' });
                    }}
                    placeholder="Matrícula"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-email">Email (auto)</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="Preenchido pela matrícula"
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="create-cpf">CPF *</Label>
                  <Input
                    id="create-cpf"
                    value={createForm.cpf}
                    onChange={(e) => setCreateForm({ ...createForm, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-telefone">Telefone</Label>
                  <Input
                    id="create-telefone"
                    value={createForm.telefone}
                    onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-email-pessoal">Email Pessoal</Label>
                  <Input
                    id="create-email-pessoal"
                    type="email"
                    value={createForm.email_pessoal}
                    onChange={(e) => setCreateForm({ ...createForm, email_pessoal: e.target.value })}
                    placeholder="email.pessoal@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-cargo">Cargo *</Label>
                  <Input
                    id="create-cargo"
                    list="cargos-list"
                    value={createForm.cargo}
                    onChange={(e) => setCreateForm({ ...createForm, cargo: e.target.value })}
                    placeholder="Digite ou selecione um cargo"
                  />
                  <datalist id="cargos-list">
                    {cargosExistentes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="create-operacao">Operação *</Label>
                  <Input
                    id="create-operacao"
                    value={createForm.operacao}
                    onChange={(e) => setCreateForm({ ...createForm, operacao: e.target.value })}
                    placeholder="Ex: Operacional"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="create-contrato">Contrato *</Label>
                <Select value={createForm.contrato_id} onValueChange={(value) => {
                  setCreateForm({ ...createForm, contrato_id: value });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contrato" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {contratosPermitidos.map((contrato) => (
                      <SelectItem key={contrato.id} value={contrato.id}>
                        {contrato.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-gray-500">Senha padrão: PSE2025 (será alterada no primeiro login)</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateFuncionario} disabled={createFuncionarioMutation.isPending}>
                {createFuncionarioMutation.isPending ? 'Criando...' : 'Criar Funcionário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
