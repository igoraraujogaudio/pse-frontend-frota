'use client';

import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BulkDismissUpload from '@/components/BulkDismissUpload';
import BulkASOUpload from '@/components/BulkASOUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  PlusIcon, 
  PencilIcon, 
  UserMinusIcon, 
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { validarCPF, formatarCPF } from '@/utils/cpfUtils';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useFuncionarios, useBases, useContratos, useCreateFuncionario, useUpdateFuncionario } from '@/hooks/useFuncionarios';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { useAuth } from '@/contexts/AuthContext';

interface UsuarioContratoType {
  ativo: boolean;
  data_fim?: string;
  contrato_id: string;
}

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  cargo: string;
  posicao?: string;
  operacao: string;
  base_id?: string;
  contrato_id?: string;
  departamento?: string;
  status: string;
  nivel_acesso: string;
  criado_em: string;
  atualizado_em: string;
  base_nome?: string;
  contrato_nome?: string;
  // Campos de documentos
  cnh?: string;
  validade_cnh?: string;
  cnh_categoria?: string;
  data_ultimo_exame_aso?: string;
  data_agendamento_aso?: string;
  har_vencimento?: string;
}


interface DismissForm {
  usuario_id: string;
  data_demissao: string;
  tipo_demissao: string;
  observacoes: string;
}

interface InventoryBlockInfo {
  motivo: string;
  itens_pendentes: string[];
  total_itens: number;
  acao_necessaria: string;
  usuario_nome?: string;
}

interface CreateForm {
  nome: string;
  email: string;
  matricula: string;
  cpf: string;
  telefone: string;
  telefone_empresarial: string;
  cargo: string;
  operacao: string;
  base_id: string;
  contrato_id: string;
  senha: string;
  data_nascimento: string;
  data_admissao: string;
  cnh: string;
  validade_cnh: string;
  cnh_categoria: string;
  data_ultimo_exame_aso: string;
  data_agendamento_aso: string;
  validade_aso: string;
  har_vencimento: string;
}

interface EditForm {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf: string;
  telefone: string;
  cargo: string;
  operacao: string;
  base_id: string;
  contrato_id: string;
}


const TIPOS_DEMISSAO = [
  { value: 'sem_justa_causa', label: 'Sem Justa Causa' },
  { value: 'com_justa_causa', label: 'Com Justa Causa' },
  { value: 'pedido_demissao', label: 'Pedido de Demissão' },
  { value: 'aposentadoria', label: 'Aposentadoria' },
  { value: 'falecimento', label: 'Falecimento' },
  { value: 'outros', label: 'Outros' }
];

const OPERACOES = [
  'ALMOXARIFADO',
  'ASG',
  'COD',
  'COMERCIAL',
  'EMERGENCIA',
  'FATURAMENTO',
  'FROTA',
  'GERAL',
  'MONITORIA',
  'RH',
  'SEG TRAB',
  'TÉCNICA LM',
  'TÉCNICA LV'
];

// Memoized FuncionarioCard component
const FuncionarioCard = memo(({ 
  funcionario, 
  index, 
  router, 
  getStatusBadge, 
  getDocumentStatus, 
  getASOStatus, 
  getASOExpirationDate,
  formatDate, 
  formatDateTime, 
  openDismissModal, 
  openWarningModal, 
  hasPermission, 
  PERMISSION_CODES 
}: {
  funcionario: Funcionario;
  index: number;
  router: { push: (path: string) => void };
  getStatusBadge: (status: string) => React.ReactElement;
  getDocumentStatus: (dataVencimento: string | undefined, tipo: 'cnh' | 'aso' | 'har') => { status: string; label: string; className: string; icon: string };
  getASOStatus: (funcionario: Funcionario) => { status: string; label: string; className: string; icon: string };
  getASOExpirationDate: (dataUltimoExame: string) => string;
  formatDate: (dateString: string | undefined) => string;
  formatDateTime: (dateTimeString: string | undefined) => string;
  openDismissModal: (funcionario: Funcionario) => void;
  openWarningModal: (funcionario: Funcionario) => void;
  hasPermission: (permission: string) => boolean;
  PERMISSION_CODES: Record<string, Record<string, string>>;
}) => (
  <Card 
    key={`funcionario-${funcionario.id}-${index}`}
    className="cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm border-0 shadow-xl hover:shadow-blue-200/50 group"
    onClick={() => router.push(`/funcionarios/${funcionario.id}`)}
  >
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div className="space-y-5 flex-1">
          {/* Header do Funcionário */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
              {funcionario.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">{funcionario.nome}</h3>
              <p className="text-gray-600 font-medium">{funcionario.matricula}</p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(funcionario.status)}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Botão Ver Detalhes - Bem visível */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push(`/funcionarios/${funcionario.id}`)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <EyeIcon className="h-4 w-4 mr-1" />
                  Ver Detalhes
                </Button>
                {hasPermission(PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/funcionarios/${funcionario.id}?edit=true`)}
                    className="bg-white/90 hover:bg-blue-50 border-blue-200 text-blue-700 hover:text-blue-800 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                )}
                {funcionario.status === 'ativo' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWarningModal(funcionario)}
                    className="bg-yellow-500/10 hover:bg-yellow-50 border-yellow-200 text-yellow-700 hover:text-yellow-800 shadow-sm hover:shadow-md transition-all duration-200"
                    title="Medida Disciplinar"
                  >
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  </Button>
                )}
                {funcionario.status === 'ativo' && hasPermission(PERMISSION_CODES.FUNCIONARIOS.DEMITIR) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDismissModal(funcionario)}
                    className="bg-red-500/10 hover:bg-red-50 border-red-200 text-red-700 hover:text-red-800 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <UserMinusIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/30 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs">💼</span>
                </div>
                <p className="text-sm font-semibold text-blue-700">Cargo</p>
              </div>
              <p className="text-gray-900 font-medium">{funcionario.cargo}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/30 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs">🏢</span>
                </div>
                <p className="text-sm font-semibold text-purple-700">Operação</p>
              </div>
              <p className="text-gray-900 font-medium">{funcionario.operacao}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-200/30 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs">📄</span>
                </div>
                <p className="text-sm font-semibold text-indigo-700">Contrato</p>
              </div>
              <p className="text-gray-900 font-medium">{funcionario.contrato_nome || 'Não informado'}</p>
            </div>
          </div>
          
          {/* Informações Adicionais */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {funcionario.operacao && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="font-medium text-gray-600">Operação:</span> 
                <span className="text-gray-900">{funcionario.operacao}</span>
              </div>
            )}
            {funcionario.base_nome && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                <span className="font-medium text-gray-600">Base:</span> 
                <span className="text-gray-900">{funcionario.base_nome}</span>
              </div>
            )}
          </div>
          
          {/* Seção de Documentos */}
          <div className="mt-6 pt-6 border-t border-gray-200/50">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📋</span>
              </div>
              Documentos e Vencimentos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CNH */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/30 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">🚗</span>
                    </div>
                    <span className="font-semibold text-blue-800 text-sm">CNH</span>
                  </div>
                  {funcionario.cnh && (
                    <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded-md">{funcionario.cnh}</span>
                  )}
                </div>
                {funcionario.validade_cnh && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className={getDocumentStatus(funcionario.validade_cnh, 'cnh').className}
                      >
                        <span className="mr-1">{getDocumentStatus(funcionario.validade_cnh, 'cnh').icon}</span>
                        {getDocumentStatus(funcionario.validade_cnh, 'cnh').label}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 font-medium">
                      {formatDate(funcionario.validade_cnh)}
                    </p>
                  </div>
                )}
              </div>
              
              {/* ASO */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/30 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">🏥</span>
                    </div>
                    <span className="font-semibold text-purple-800 text-sm">ASO</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {funcionario.data_ultimo_exame_aso && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className={getASOStatus(funcionario).className}
                        >
                          <span className="mr-1">{getASOStatus(funcionario).icon}</span>
                          {getASOStatus(funcionario).label}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 font-medium">
                        Último: {formatDate(funcionario.data_ultimo_exame_aso)}
                      </p>
                      {funcionario.data_ultimo_exame_aso && (
                        <p className="text-xs text-purple-600 font-medium">
                          Vence: {formatDate(getASOExpirationDate(funcionario.data_ultimo_exame_aso))}
                        </p>
                      )}
                    </div>
                  )}
                  {funcionario.data_agendamento_aso && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className={getASOStatus(funcionario).className}
                        >
                          <span className="mr-1">{getASOStatus(funcionario).icon}</span>
                          {getASOStatus(funcionario).label}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 font-medium">
                        Agendado: {formatDateTime(funcionario.data_agendamento_aso)}
                      </p>
                    </div>
                  )}
                  {!funcionario.data_ultimo_exame_aso && !funcionario.data_agendamento_aso && (
                    <div className="flex items-center gap-2">
                      <span className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                        <span className="mr-1">❌</span>
                        Sem ASO
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* HAR */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-200/30 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">⚡</span>
                    </div>
                    <span className="font-semibold text-indigo-800 text-sm">HAR</span>
                  </div>
                </div>
                {funcionario.har_vencimento && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className={getDocumentStatus(funcionario.har_vencimento, 'har').className}
                      >
                        <span className="mr-1">{getDocumentStatus(funcionario.har_vencimento, 'har').icon}</span>
                        {getDocumentStatus(funcionario.har_vencimento, 'har').label}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600 font-medium">
                      {formatDate(funcionario.har_vencimento)}
                    </p>
                  </div>
                )}
                {!funcionario.har_vencimento && (
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                      <span className="mr-1">❌</span>
                      Sem HAR
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
));

FuncionarioCard.displayName = 'FuncionarioCard';

const CARGOS_PADRONIZADOS = [
  'ANALISTA DE FROTA',
  'ASSISTENTE ADM',
  'AUXILIAR ADMINISTRATIVO',
  'AUXILIAR DE ALMOXARIFE',
  'AUXILIAR DE RECOLHA',
  'AUXILIAR DE TRIAGEM',
  'AUXILIAR SERVIÇOS GERAIS',
  'COORD.DE OPERACOES',
  'COORDENADOR ADMINISTRATIVO',
  'COORDENADOR DE OPERAÇÕES',
  'ELETRICISTA',
  'ELETRICISTA DE INSTALAÇÕES',
  'ELETRICISTA LINHA VIVA',
  'ELETROTECNICO I',
  'ENCARREGADO',
  'ENCARREGADO DE PODA',
  'ENCARREGADO DE PODA I',
  'ENCARREGADO LINHA MORTA',
  'ENCARREGADO LM',
  'ENCARREGADO LV',
  'ENCARREGADO TURMA L.V.',
  'ENGENHEIRO SEGURANCA TRABALHO',
  'ESTAGIARIO(A)',
  'GERENTE',
  'INST. ELETRICO B- PODADOR',
  'INSTALADOR ELETRICO A',
  'INSTALADOR ELETRICO B',
  'LIDER DE ALMOXARIFADO',
  'LIDER DE FROTA',
  'LIDER EMERGENCIA',
  'LIDER OPERACIONAL',
  'LIDER PLAN.FATURAMENTO',
  'MOTORISTA',
  'MOTORISTA DE RECOLHA',
  'MOTORISTA OPERADOR GUINDAUTO',
  'PROGRAMADOR CCBT',
  'SUPERVISOR',
  'SUPERVISOR (A) DE CADASTRO',
  'SUPERVISOR (A) DE RH',
  'SUPERVISOR DE CCBT',
  'SUPERVISOR DE OBRAS',
  'SUPERVISOR DE RH/DP',
  'SUPERVISOR DE SUPORTE',
  'SUPERVISOR OPERACIONAL',
  'TECNICO DE SEGURANCA TRABALHO',
  'TECNICO EM MEIO AMBIENTE'
];


export default function FuncionariosPage() {
  const router = useRouter();
  const { hasPermission } = useModularPermissions();
  const { userContratos, hasContratoAccess } = useUnifiedPermissions();
  const { user } = useAuth();
  
  // React Query hooks
  const { data: funcionarios = [], isLoading: loadingFuncionarios } = useFuncionarios();
  const { data: bases = [] } = useBases();
  const { data: contratos = [] } = useContratos();
  const createFuncionarioMutation = useCreateFuncionario();
  const updateFuncionarioMutation = useUpdateFuncionario();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterContrato, setFilterContrato] = useState('todos');
  const [activeAction, setActiveAction] = useState<'create' | 'edit' | 'dismiss' | 'manage_cargos' | null>(null);
  const [exportando, setExportando] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    nome: '',
    email: '',
    matricula: '',
    cpf: '',
    telefone: '',
    telefone_empresarial: '',
    cargo: '',
    operacao: '',
    base_id: '',
    contrato_id: '',
    senha: '',
    data_nascimento: '',
    data_admissao: '',
    cnh: '',
    validade_cnh: '',
    cnh_categoria: '',
    data_ultimo_exame_aso: '',
    data_agendamento_aso: '',
    validade_aso: '',
    har_vencimento: ''
  });
  const [editForm, setEditForm] = useState<EditForm>({
    id: '',
    nome: '',
    email: '',
    matricula: '',
    cpf: '',
    telefone: '',
    cargo: '',
    operacao: '',
    base_id: '',
    contrato_id: ''
  });
  const [dismissForm, setDismissForm] = useState<DismissForm>({
    usuario_id: '',
    data_demissao: new Date().toISOString().split('T')[0],
    tipo_demissao: 'sem_justa_causa',
    observacoes: ''
  });
  const [cpfError, setCpfError] = useState('');
  const [cargos, setCargos] = useState<{ id: string; nome: string; nivel_acesso: string; ativo: boolean; perfil_acesso_id?: string; perfis_acesso?: { id: string; codigo: string; nome: string; nivel_hierarquia: number; cor: string } }[]>([]);
  const [perfisAcesso] = useState<{ id: string; codigo: string; nome: string; nivel_hierarquia: number; cor: string }[]>([]);
  const [cargoForm, setCargoForm] = useState({ nome: '', nivel_acesso: 'operacao', perfil_acesso_id: '' });
  const [editingCargo, setEditingCargo] = useState<{ id: string; nome: string; nivel_acesso: string; perfil_acesso_id?: string } | null>(null);
  const [inventoryBlockInfo, setInventoryBlockInfo] = useState<InventoryBlockInfo | null>(null);

  // Carregar cargos quando o componente for montado
  useEffect(() => {
    loadCargos();
  }, []);

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
    
    // Verificar se o contrato tem bases associadas
    const contratoSelecionado = contratos.find(c => c.id === createForm.contrato_id);
    const temBases = contratoSelecionado && bases.some(b => b.contrato_id === createForm.contrato_id);
    
    // Base é obrigatória apenas se o contrato tiver bases associadas
    if (temBases && !createForm.base_id.trim()) {
      toast.error('Base é obrigatória para este contrato');
      return;
    }
    if (!createForm.senha.trim()) {
      toast.error('Senha é obrigatória');
      return;
    }

    // Validação do CPF
    if (createForm.cpf && !validarCPF(createForm.cpf)) {
      toast.error('CPF inválido');
      return;
    }

    // ✅ CORREÇÃO: Buscar o perfil_acesso_id do cargo selecionado
    const cargoSelecionado = cargos.find(c => c.nome === createForm.cargo);
    const perfilAcessoId = cargoSelecionado?.perfil_acesso_id || '';

    // Mapear os dados do formulário para o formato esperado pela API
    const apiData = {
      nome: createForm.nome,
      email: createForm.email,
      matricula: createForm.matricula,
      cpf: createForm.cpf,
      telefone: createForm.telefone,
      telefone_empresarial: createForm.telefone_empresarial,
      cargo: createForm.cargo,
      posicao: '', // Campo obrigatório na API mas não usado no formulário
      operacao: createForm.operacao,
      contrato_id: createForm.contrato_id,
      senha: createForm.senha,
      base_id: createForm.base_id,
      data_nascimento: createForm.data_nascimento,
      data_admissao: createForm.data_admissao,
      cnh: createForm.cnh,
      validade_cnh: createForm.validade_cnh,
      cnh_categoria: createForm.cnh_categoria,
      data_ultimo_exame_aso: createForm.data_ultimo_exame_aso,
      data_agendamento_aso: createForm.data_agendamento_aso,
      validade_aso: createForm.validade_aso,
      har_vencimento: createForm.har_vencimento,
      perfil_acesso_id: perfilAcessoId // ✅ CORREÇÃO: Enviar o perfil_acesso_id do cargo
    };

    createFuncionarioMutation.mutate(apiData, {
      onSuccess: () => {
        setActiveAction(null);
        setCreateForm({
          nome: '',
          email: '',
          matricula: '',
          cpf: '',
          telefone: '',
          telefone_empresarial: '',
          cargo: '',
          operacao: '',
          base_id: '',
          contrato_id: '',
          senha: '',
          data_nascimento: '',
          data_admissao: '',
          cnh: '',
          validade_cnh: '',
          cnh_categoria: '',
          data_ultimo_exame_aso: '',
          data_agendamento_aso: '',
          validade_aso: '',
          har_vencimento: ''
        });
        setCpfError('');
      }
    });
  };

  const handleEditFuncionario = async () => {
    updateFuncionarioMutation.mutate(
      { id: editForm.id, data: editForm },
      {
        onSuccess: () => {
          setActiveAction(null);
          setEditForm({
            id: '',
            nome: '',
            email: '',
            matricula: '',
            cpf: '',
            telefone: '',
            cargo: '',
            operacao: '',
            base_id: '',
            contrato_id: ''
          });
        }
      }
    );
  };

  const handleDismissFuncionario = async () => {
    try {
      const response = await fetch('/api/users/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dismissForm)
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Se for erro de inventário, abrir modal com os itens
        if (error.error === 'Demissão bloqueada' && error.itens_pendentes) {
          // Buscar o nome do funcionário
          const funcionario = funcionarios.find(f => f.id === dismissForm.usuario_id);
          
          setInventoryBlockInfo({
            motivo: error.motivo || 'Funcionário possui itens no inventário',
            itens_pendentes: error.itens_pendentes || [],
            total_itens: error.total_itens || 0,
            acao_necessaria: error.acao_necessaria || 'O funcionário deve devolver todos os itens do inventário antes da demissão',
            usuario_nome: funcionario?.nome || 'Funcionário'
          });
          
          // Fechar modal de demissão
          setActiveAction(null);
          return;
        }
        
        throw new Error(error.error || 'Erro ao demitir funcionário');
      }

      toast.success('Funcionário demitido com sucesso!');
      setActiveAction(null);
      setDismissForm({
        usuario_id: '',
        data_demissao: new Date().toISOString().split('T')[0],
        tipo_demissao: 'sem_justa_causa',
        observacoes: ''
      });
      await loadCargos();
    } catch (error) {
      console.error('Erro ao demitir funcionário:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao demitir funcionário');
    }
  };


  const loadCargos = async () => {
    try {
      const response = await fetch('/api/cargos');
      if (!response.ok) throw new Error('Erro ao carregar cargos');
      
      const data = await response.json();
      setCargos(data.cargos || []);
    } catch (error) {
      console.error('Erro ao carregar cargos:', error);
    }
  };


  const handleCreateCargo = async () => {
    if (!cargoForm.nome.trim()) {
      toast.error('Nome do cargo é obrigatório');
      return;
    }

    try {
      const response = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cargoForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar cargo');
      }

      toast.success('Cargo criado com sucesso!');
      setCargoForm({ nome: '', nivel_acesso: 'operacao', perfil_acesso_id: '' });
      await loadCargos();
    } catch (error) {
      console.error('Erro ao criar cargo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar cargo');
    }
  };

  const handleUpdateCargo = async () => {
    if (!editingCargo) return;

    try {
      const response = await fetch(`/api/cargos/${editingCargo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel_acesso: editingCargo.nivel_acesso,
          perfil_acesso_id: editingCargo.perfil_acesso_id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar cargo');
      }

      toast.success('Cargo atualizado com sucesso!');
      setEditingCargo(null);
      await loadCargos();
    } catch (error) {
      console.error('Erro ao atualizar cargo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar cargo');
    }
  };

  const handleDeleteCargo = async (cargoId: string) => {
    if (!confirm('Tem certeza que deseja desativar este cargo?')) return;

    try {
      const response = await fetch(`/api/cargos/${cargoId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao desativar cargo');
      }

      toast.success('Cargo desativado com sucesso!');
      await loadCargos();
    } catch (error) {
      console.error('Erro ao desativar cargo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao desativar cargo');
    }
  };

  // Função para exportar funcionários para Excel
  const exportarFuncionariosExcel = async () => {
    try {
      setExportando(true);
      
      // Preparar dados para Excel
      const dadosExcel = filteredFuncionarios.map(funcionario => ({
        'Nome': funcionario.nome || '',
        'Matrícula': funcionario.matricula || '',
        'CPF': funcionario.cpf ? formatarCPF(funcionario.cpf) : '',
        'Email': funcionario.email || '',
        'Telefone': funcionario.telefone || '',
        'Cargo': funcionario.cargo || '',
        'Operação': funcionario.operacao || '',
        'Base': funcionario.base_nome || '',
        'Contrato': funcionario.contrato_nome || '',
        'Status': funcionario.status || '',
        'Nível de Acesso': funcionario.nivel_acesso || '',
        'Data de Criação': funcionario.criado_em ? 
          new Date(funcionario.criado_em).toLocaleDateString('pt-BR') : '',
        'Última Atualização': funcionario.atualizado_em ? 
          new Date(funcionario.atualizado_em).toLocaleDateString('pt-BR') : '',
        'CNH': funcionario.cnh || '',
        'Validade CNH': funcionario.validade_cnh ? 
          new Date(funcionario.validade_cnh).toLocaleDateString('pt-BR') : '',
        'Categoria CNH': funcionario.cnh_categoria || '',
        'Último Exame ASO': funcionario.data_ultimo_exame_aso ? 
          new Date(funcionario.data_ultimo_exame_aso).toLocaleDateString('pt-BR') : '',
        'Agendamento ASO': funcionario.data_agendamento_aso ? 
          new Date(funcionario.data_agendamento_aso).toLocaleDateString('pt-BR') : '',
        'HAR Vencimento': funcionario.har_vencimento ? 
          new Date(funcionario.har_vencimento).toLocaleDateString('pt-BR') : ''
      }));

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 25 }, // Nome
        { wch: 12 }, // Matrícula
        { wch: 15 }, // CPF
        { wch: 30 }, // Email
        { wch: 15 }, // Telefone
        { wch: 20 }, // Cargo
        { wch: 20 }, // Operação
        { wch: 20 }, // Base
        { wch: 20 }, // Contrato
        { wch: 12 }, // Status
        { wch: 15 }, // Nível de Acesso
        { wch: 15 }, // Data de Criação
        { wch: 15 }, // Última Atualização
        { wch: 15 }, // CNH
        { wch: 15 }, // Validade CNH
        { wch: 12 }, // Categoria CNH
        { wch: 15 }, // Último Exame ASO
        { wch: 15 }, // Agendamento ASO
        { wch: 15 }  // HAR Vencimento
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
      
      // Gerar nome do arquivo com data e filtros
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      let nomeArquivo = `Funcionarios_${dataAtual}`;
      
      if (filterStatus !== 'todos') {
        nomeArquivo += `_${filterStatus.toUpperCase()}`;
      }
      
      if (filterContrato !== 'todos') {
        const contratoNome = contratos.find(c => c.id === filterContrato)?.nome || '';
        nomeArquivo += `_${contratoNome.replace(/\s+/g, '_')}`;
      }
      
      if (searchTerm) {
        nomeArquivo += `_${searchTerm.substring(0, 10)}`;
      }
      
      nomeArquivo += '.xlsx';
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      toast.success(`Relatório de funcionários exportado com sucesso! (${filteredFuncionarios.length} funcionários)`);
    } catch (error) {
      console.error('Erro ao exportar funcionários:', error);
      toast.error('Erro ao exportar relatório de funcionários');
    } finally {
      setExportando(false);
    }
  };

  const openDismissModal = useCallback((funcionario: Funcionario) => {
    setDismissForm({
      usuario_id: funcionario.id,
      data_demissao: new Date().toISOString().split('T')[0],
      tipo_demissao: 'sem_justa_causa',
      observacoes: ''
    });
    setActiveAction('dismiss');
  }, []);

  const openWarningModal = useCallback((funcionario: Funcionario) => {
    // Redireciona para a página de avisos com o funcionário pré-selecionado
    router.push(`/avisos?funcionario=${funcionario.id}&nome=${encodeURIComponent(funcionario.nome)}&matricula=${funcionario.matricula}&cargo=${encodeURIComponent(funcionario.cargo)}&base_id=${funcionario.base_id}`);
  }, [router]);

  const handleMatriculaChange = useCallback((value: string) => {
    setCreateForm(prev => ({
      ...prev,
      matricula: value,
      email: value ? `${value}@pse.srv.br` : prev.email
    }));
  }, []);

  const handleEmailChange = useCallback((value: string) => {
    setCreateForm(prev => ({ ...prev, email: value }));
  }, []);



  // Computed values
  const isLoading = loadingFuncionarios;

  // Memoized filtered funcionarios
  // Contratos permitidos para o usuário
  const contratosPermitidos = useMemo(() => {
    // Admin e Diretor têm acesso a todos os contratos
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      return contratos;
    }
    
    // Outros usuários apenas aos contratos que têm permissão
    const contratoIdsPermitidos = ((userContratos || []) as UsuarioContratoType[])
      .filter((uc) => uc.ativo && (!uc.data_fim || new Date(uc.data_fim) >= new Date()))
      .map((uc) => uc.contrato_id);
    
    return contratos.filter(c => contratoIdsPermitidos.includes(c.id));
  }, [contratos, userContratos, user]);

  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter(funcionario => {
    const matchesSearch = funcionario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         funcionario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         funcionario.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'todos' || funcionario.status === filterStatus;
    
    // Filtro de contrato - apenas mostrar funcionários dos contratos permitidos
    const matchesContrato = (() => {
      // Se não filtrou por contrato específico, verificar se o funcionário tem contrato permitido
      if (filterContrato === 'todos') {
        // Admin e Diretor veem todos
        if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
          return true;
        }
        // Outros usuários apenas funcionários dos contratos permitidos
        if (!funcionario.contrato_id) return false;
        return hasContratoAccess(funcionario.contrato_id);
      }
      // Se filtrou por contrato específico, verificar se corresponde
      return funcionario.contrato_id === filterContrato;
    })();
    
    return matchesSearch && matchesStatus && matchesContrato;
  });
  }, [funcionarios, searchTerm, filterStatus, filterContrato, user, hasContratoAccess]);

  // Memoized status badge function
  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'ativo':
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Ativo
            </div>
          </Badge>
        );
      case 'inativo':
        return (
          <Badge className="bg-gradient-to-r from-gray-500 to-slate-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Inativo
            </div>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            {status}
            </div>
          </Badge>
        );
    }
  }, []);

  // Memoized document status function
  const getDocumentStatus = useCallback((dataVencimento: string | undefined, tipo: 'cnh' | 'aso' | 'har') => {
    if (!dataVencimento) return { 
      status: 'SEM_DOCUMENTO', 
      label: 'Sem documento', 
      className: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm',
      icon: '❌'
    };
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diasVencimento = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    // Regras específicas por tipo de documento
    if (tipo === 'aso') {
      // ASO: alerta em 30 dias, vencendo em 60 dias
      if (diasVencimento < 0) {
        return {
          status: 'VENCIDO',
          label: 'Vencido',
          className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '🚨'
        };
      } else if (diasVencimento <= 30) {
        return {
          status: 'ATENCAO',
          label: 'Atenção',
          className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '🚨'
        };
      } else if (diasVencimento <= 60) {
        return {
          status: 'VENCENDO',
          label: 'Vencendo',
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '⚠️'
        };
      } else {
        return {
          status: 'NO_PRAZO',
          label: 'No Prazo',
          className: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '✅'
        };
      }
    } else {
      // CNH e HAR: alerta em 30 dias
      if (diasVencimento < 0) {
        return { 
          status: 'VENCIDO', 
          label: 'Vencido', 
          className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '🚨'
        };
      } else if (diasVencimento <= 30) {
        return { 
          status: 'VENCENDO', 
          label: 'Vencendo', 
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '⚠️'
        };
      } else {
        return { 
          status: 'VIGENTE', 
          label: 'Vigente', 
          className: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '✅'
        };
      }
    }
  }, []);

  // Helper function to calculate ASO expiration date
  const getASOExpirationDate = useCallback((dataUltimoExame: string) => {
    const dataUltimoASO = new Date(dataUltimoExame);
    const dataVencimentoASO = new Date(dataUltimoASO.getTime() + (365 * 24 * 60 * 60 * 1000));
    return dataVencimentoASO.toISOString().split('T')[0];
  }, []);

  // Memoized ASO status function
  const getASOStatus = useCallback((funcionario: Funcionario) => {
    const hoje = new Date();
    
    // Se tem agendamento próximo (hoje ou passou)
    if (funcionario.data_agendamento_aso) {
      const agendamento = new Date(funcionario.data_agendamento_aso);
      const diasAgendamento = Math.ceil((agendamento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasAgendamento <= 0) {
        return { 
          status: 'AGENDADO_VENCENDO', 
          label: 'Agendado - Vencendo', 
          className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '🚨'
        };
      } else if (diasAgendamento <= 7) {
        return { 
          status: 'AGENDADO_PROXIMO', 
          label: 'Agendado - Próximo', 
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '⚠️'
        };
      } else {
        return { 
          status: 'AGENDADO', 
          label: 'Agendado', 
          className: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
          icon: '📅'
        };
      }
    }
    
    // Se não tem agendamento, verifica validade do ASO
    if (funcionario.data_ultimo_exame_aso) {
      return getDocumentStatus(getASOExpirationDate(funcionario.data_ultimo_exame_aso), 'aso');
    }
    
    // Fallback: se não tem validade_aso, calcula baseado no último exame
    if (funcionario.data_ultimo_exame_aso) {
      return getDocumentStatus(getASOExpirationDate(funcionario.data_ultimo_exame_aso), 'aso');
    }
    
    return { 
      status: 'SEM_DOCUMENTO', 
      label: 'Sem ASO', 
      className: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm',
      icon: '❌'
    };
  }, [getDocumentStatus, getASOExpirationDate]);

  // Memoized format functions
  const formatDate = useCallback((dateString: string | undefined) => {
    if (!dateString) return 'Não informado';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  }, []);

  const formatDateTime = useCallback((dateTimeString: string | undefined) => {
    if (!dateTimeString) return 'Não informado';
    try {
      return new Date(dateTimeString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando funcionários...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard 
      requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR]}
      fallbackMessage="Você não tem permissão para visualizar funcionários."
    >
      <div className="space-y-6">
        {/* Header Moderno */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Funcionários</h1>
            <p className="text-blue-100 text-lg">Gerencie todos os funcionários da empresa</p>
          </div>
          <div className="flex gap-3">
          {hasPermission(PERMISSION_CODES.FUNCIONARIOS.CRIAR) && (
            <Button 
              variant="outline"
              onClick={() => router.push('/funcionarios/bulk-upload')}
              className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload em Lote
            </Button>
          )}
          {hasPermission(PERMISSION_CODES.FUNCIONARIOS.DEMITIR_BULK) && (
            <BulkDismissUpload onUploadComplete={() => {}} />
          )}
          <BulkASOUpload onSuccess={() => window.location.reload()} />
          <Button 
            variant="outline"
            onClick={exportarFuncionariosExcel}
            disabled={exportando || filteredFuncionarios.length === 0}
            className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          <Button 
            variant="secondary"
            onClick={() => window.open('/users/dismissed', '_blank')}
            className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
            disabled={!hasPermission(PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS)}
          >
            <UserMinusIcon className="h-4 w-4" />
            Funcionários Demitidos
          </Button>
          {hasPermission(PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS) && (
            <Button 
              variant="outline"
              onClick={() => setActiveAction('manage_cargos')}
              className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
            >
              <PencilIcon className="h-4 w-4" />
              Gerenciar Cargos
            </Button>
          )}
          <Button 
            onClick={() => setActiveAction('create')}
            className="flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
            disabled={!hasPermission(PERMISSION_CODES.FUNCIONARIOS.CRIAR)}
          >
            <PlusIcon className="h-4 w-4" />
            Novo Funcionário
          </Button>
        </div>
      </div>
      </div>

      {/* Filtros Modernos */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm font-semibold text-gray-700 mb-2 block">
                Buscar Funcionário
              </Label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Digite nome, matrícula ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                />
              </div>
            </div>
            <div className="w-64">
              <Label htmlFor="contrato" className="text-sm font-semibold text-gray-700 mb-2 block">
                Contrato
              </Label>
              <Select value={filterContrato} onValueChange={setFilterContrato}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Contratos</SelectItem>
                  {contratosPermitidos.map((contrato) => (
                    <SelectItem key={`filter-contrato-${contrato.id}`} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="status" className="text-sm font-semibold text-gray-700 mb-2 block">
                Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador de Funcionários */}
      {filteredFuncionarios.length > 0 && (
        <div className="flex items-center justify-between px-4">
          <p className="text-sm text-gray-600">
            Exibindo <span className="font-bold text-blue-600">{filteredFuncionarios.length}</span> funcionário(s)
            {filterContrato !== 'todos' && (
              <span className="ml-2">
                do contrato <span className="font-semibold text-purple-600">
                  {contratosPermitidos.find(c => c.id === filterContrato)?.nome}
                </span>
              </span>
            )}
          </p>
        </div>
      )}

      {/* Lista de Funcionários */}
      <div className="grid gap-6">
        {filteredFuncionarios.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum funcionário encontrado</h3>
                  {contratosPermitidos.length === 0 && user && !['admin', 'diretor'].includes(user.nivel_acesso) ? (
                    <p className="text-gray-600">
                      Você não tem permissão para visualizar funcionários. <br />
                      Entre em contato com o administrador para solicitar acesso aos contratos.
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      {searchTerm || filterStatus !== 'todos' || filterContrato !== 'todos'
                        ? 'Tente ajustar os filtros de busca.'
                        : 'Não há funcionários cadastrados no sistema.'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredFuncionarios.map((funcionario, index) => (
            <FuncionarioCard
              key={`funcionario-${funcionario.id}-${index}`}
              funcionario={funcionario}
              index={index}
              router={router}
              getStatusBadge={getStatusBadge}
              getDocumentStatus={getDocumentStatus}
              getASOStatus={getASOStatus}
              getASOExpirationDate={getASOExpirationDate}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              openDismissModal={openDismissModal}
              openWarningModal={openWarningModal}
              hasPermission={hasPermission}
              PERMISSION_CODES={PERMISSION_CODES}
            />
          ))
        )}
      </div>

      {/* Modal de Criar Funcionário */}
      {hasPermission(PERMISSION_CODES.FUNCIONARIOS.CRIAR) && (
        <Dialog open={activeAction === 'create'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo funcionário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-blue-800">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="create-nome">Nome *</Label>
              <Input
                id="create-nome"
                value={createForm.nome}
                onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                placeholder="Nome completo"
                required
              />
            </div>
            <div>
              <Label htmlFor="create-matricula">Matrícula *</Label>
              <Input
                id="create-matricula"
                value={createForm.matricula}
                onChange={(e) => handleMatriculaChange(e.target.value)}
                placeholder="Número da matrícula"
                required
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="create-cpf">CPF *</Label>
              <Input
                id="create-cpf"
                value={createForm.cpf}
                onChange={(e) => {
                  const formattedCPF = formatarCPF(e.target.value);
                  setCreateForm({ ...createForm, cpf: formattedCPF });
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
                onBlur={(e) => {
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
                className={cpfError ? 'border-red-500' : ''}
              />
              {cpfError && <span className="text-xs text-red-500 mt-1">{cpfError}</span>}
            </div>
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
              <Label htmlFor="create-cargo">Cargo *</Label>
              <Select value={createForm.cargo} onValueChange={(value) => setCreateForm({ ...createForm, cargo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos.filter(c => c.ativo).map((cargo) => (
                    <SelectItem key={`create-cargo-${cargo.id}`} value={cargo.nome}>
                      {cargo.nome} {cargo.perfis_acesso ? `(${cargo.perfis_acesso.nome})` : `(${cargo.nivel_acesso})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-operacao">Operação *</Label>
              <Select value={createForm.operacao} onValueChange={(value) => setCreateForm({ ...createForm, operacao: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent>
                  {OPERACOES.map((operacao) => (
                    <SelectItem key={`create-operacao-${operacao}`} value={operacao}>
                      {operacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-contrato">Contrato *</Label>
              <Select value={createForm.contrato_id} onValueChange={(value) => {
                setCreateForm({ ...createForm, contrato_id: value, base_id: '' }); // Limpar base quando trocar contrato
              }} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratosPermitidos.map((contrato) => (
                    <SelectItem key={`create-contrato-${contrato.id}`} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-base">
                Base {(() => {
                  // Verificar se o contrato selecionado tem bases associadas
                  const contratoSelecionado = contratos.find(c => c.id === createForm.contrato_id);
                  const temBases = contratoSelecionado && bases.some(b => b.contrato_id === createForm.contrato_id);
                  return temBases ? '*' : '';
                })()}
              </Label>
              <Select 
                value={createForm.base_id} 
                onValueChange={(value) => setCreateForm({ ...createForm, base_id: value })}
                disabled={!createForm.contrato_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!createForm.contrato_id ? "Selecione um contrato primeiro" : "Selecione uma base"} />
                </SelectTrigger>
                <SelectContent>
                  {bases
                    .filter(base => base.contrato_id === createForm.contrato_id)
                    .map((base) => (
                    <SelectItem key={`create-base-${base.id}`} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-senha">Senha *</Label>
              <Input
                id="create-senha"
                type="password"
                value={createForm.senha}
                onChange={(e) => setCreateForm({ ...createForm, senha: e.target.value })}
                placeholder="Senha inicial"
              />
            </div>
          </div>
        </div>

        {/* Informações Pessoais */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-purple-800">Informações Pessoais</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="create-data-nascimento">Data de Nascimento</Label>
              <DateInput
                id="create-data-nascimento"
                value={createForm.data_nascimento}
                onChange={(value) => setCreateForm({ ...createForm, data_nascimento: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <Label htmlFor="create-data-admissao">Data de Admissão</Label>
              <DateInput
                id="create-data-admissao"
                value={createForm.data_admissao}
                onChange={(value) => setCreateForm({ ...createForm, data_admissao: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <Label htmlFor="create-telefone-empresarial">Telefone Empresarial</Label>
              <Input
                id="create-telefone-empresarial"
                value={createForm.telefone_empresarial}
                onChange={(e) => setCreateForm({ ...createForm, telefone_empresarial: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-emerald-800">Documentos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="create-cnh">CNH</Label>
              <Input
                id="create-cnh"
                value={createForm.cnh}
                onChange={(e) => setCreateForm({ ...createForm, cnh: e.target.value })}
                placeholder="Número da CNH"
              />
            </div>
            <div>
              <Label htmlFor="create-validade-cnh">Validade CNH</Label>
              <DateInput
                id="create-validade-cnh"
                value={createForm.validade_cnh}
                onChange={(value) => setCreateForm({ ...createForm, validade_cnh: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <Label htmlFor="create-cnh-categoria">Categoria CNH</Label>
              <Select value={createForm.cnh_categoria} onValueChange={(value) => setCreateForm({ ...createForm, cnh_categoria: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Motocicleta</SelectItem>
                  <SelectItem value="B">B - Carro</SelectItem>
                  <SelectItem value="C">C - Caminhão</SelectItem>
                  <SelectItem value="D">D - Ônibus</SelectItem>
                  <SelectItem value="E">E - Carreta</SelectItem>
                  <SelectItem value="AB">AB - Moto e Carro</SelectItem>
                  <SelectItem value="AC">AC - Moto e Caminhão</SelectItem>
                  <SelectItem value="AD">AD - Moto e Ônibus</SelectItem>
                  <SelectItem value="AE">AE - Moto e Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ASO */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-orange-800">ASO - Atestado de Saúde Ocupacional</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="create-data-ultimo-exame-aso">Data do Último Exame</Label>
              <DateInput
                id="create-data-ultimo-exame-aso"
                value={createForm.data_ultimo_exame_aso}
                onChange={(value) => setCreateForm({ ...createForm, data_ultimo_exame_aso: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <Label htmlFor="create-data-agendamento-aso">Data do Próximo Agendamento</Label>
              <Input
                id="create-data-agendamento-aso"
                type="datetime-local"
                value={createForm.data_agendamento_aso}
                onChange={(e) => setCreateForm({ ...createForm, data_agendamento_aso: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="create-validade-aso">Validade ASO</Label>
              <DateInput
                id="create-validade-aso"
                value={createForm.validade_aso}
                onChange={(value) => setCreateForm({ ...createForm, validade_aso: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
          </div>
        </div>

        {/* HAR */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-indigo-800">HAR - Homologação de Aptidão para Risco</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="create-har-vencimento">Vencimento HAR</Label>
              <DateInput
                id="create-har-vencimento"
                value={createForm.har_vencimento}
                onChange={(value) => setCreateForm({ ...createForm, har_vencimento: value })}
                placeholder="DD/MM/AAAA"
              />
            </div>
          </div>
        </div>
      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFuncionario}>
              Criar Funcionário
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Editar Funcionário */}
      {hasPermission(PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS) && (
        <Dialog open={activeAction === 'edit'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
            <DialogDescription>
              Edite as informações do funcionário
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-nome">Nome *</Label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="edit-matricula">Matrícula *</Label>
              <Input
                id="edit-matricula"
                value={editForm.matricula}
                onChange={(e) => setEditForm({ ...editForm, matricula: e.target.value })}
                placeholder="Número da matrícula"
              />
            </div>
            <div>
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
                value={editForm.cpf}
                onChange={(e) => {
                  const formattedCPF = formatarCPF(e.target.value);
                  setEditForm({ ...editForm, cpf: formattedCPF });
                }}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div>
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="edit-cargo">Cargo *</Label>
              <Select value={editForm.cargo} onValueChange={(value) => setEditForm({ ...editForm, cargo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_PADRONIZADOS.map((cargo) => (
                    <SelectItem key={`edit-cargo-${cargo}`} value={cargo}>
                      {cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-operacao">Operação *</Label>
              <Select value={editForm.operacao} onValueChange={(value) => setEditForm({ ...editForm, operacao: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent>
                  {OPERACOES.map((operacao) => (
                    <SelectItem key={`edit-operacao-${operacao}`} value={operacao}>
                      {operacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-contrato">Contrato</Label>
              <Select value={editForm.contrato_id} onValueChange={(value) => {
                setEditForm({ ...editForm, contrato_id: value, base_id: '' }); // Limpar base quando trocar contrato
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((contrato) => (
                    <SelectItem key={`edit-contrato-${contrato.id}`} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-base">Base</Label>
              <Select 
                value={editForm.base_id} 
                onValueChange={(value) => setEditForm({ ...editForm, base_id: value })}
                disabled={!editForm.contrato_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!editForm.contrato_id ? "Selecione um contrato primeiro" : "Selecione uma base"} />
                </SelectTrigger>
                <SelectContent>
                  {bases
                    .filter(base => base.contrato_id === editForm.contrato_id)
                    .map((base) => (
                    <SelectItem key={`edit-base-${base.id}`} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditFuncionario}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Demitir Funcionário */}
      {hasPermission(PERMISSION_CODES.FUNCIONARIOS.DEMITIR) && (
        <Dialog open={activeAction === 'dismiss'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demitir Funcionário</DialogTitle>
            <DialogDescription>
              Confirme os dados da demissão
            </DialogDescription>
          </DialogHeader>
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
                <SelectContent>
                  {TIPOS_DEMISSAO.map((tipo) => (
                    <SelectItem key={`dismiss-tipo-${tipo.value}`} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
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
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (confirm('Tem certeza que deseja demitir este funcionário? Esta ação não pode ser desfeita.')) {
                  handleDismissFuncionario();
                }
              }}
            >
              Demitir Funcionário
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Bloqueio por Inventário */}
      <Dialog open={!!inventoryBlockInfo} onOpenChange={(open) => !open && setInventoryBlockInfo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Demissão Bloqueada</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  {inventoryBlockInfo?.usuario_nome} possui itens no inventário
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Mensagem Principal */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">
                {inventoryBlockInfo?.motivo}
              </p>
            </div>

            {/* Lista de Itens Pendentes */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                  {inventoryBlockInfo?.total_itens}
                </span>
                Itens Pendentes de Devolução
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {inventoryBlockInfo?.itens_pendentes.map((item, index) => (
                    <li key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 font-semibold text-sm">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Ação Necessária */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                ✅ O que fazer?
              </h4>
              <p className="text-sm text-blue-800">
                {inventoryBlockInfo?.acao_necessaria}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setInventoryBlockInfo(null)}
              className="w-full"
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciar Cargos */}
      {hasPermission(PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS) && (
        <Dialog open={activeAction === 'manage_cargos'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Cargos</DialogTitle>
            <DialogDescription>
              Gerencie os cargos disponíveis no sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Formulário para criar novo cargo */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Adicionar Novo Cargo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cargo-nome">Nome do Cargo *</Label>
                  <Input
                    id="cargo-nome"
                    value={cargoForm.nome}
                    onChange={(e) => setCargoForm({ ...cargoForm, nome: e.target.value })}
                    placeholder="Ex: Analista de Frota"
                  />
                </div>
                <div>
                  <Label htmlFor="cargo-perfil">Perfil de Acesso *</Label>
                  <Select 
                    value={cargoForm.perfil_acesso_id} 
                    onValueChange={(value) => {
                      const perfil = perfisAcesso.find(p => p.id === value);
                      setCargoForm({ 
                        ...cargoForm, 
                        perfil_acesso_id: value,
                        nivel_acesso: perfil?.codigo || 'operacao'
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um perfil de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfisAcesso.map((perfil) => (
                        <SelectItem key={perfil.id} value={perfil.id}>
                          {perfil.nome} (Nível {perfil.nivel_hierarquia})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleCreateCargo} className="w-full">
                  Adicionar Cargo
                </Button>
              </div>
            </div>

            {/* Lista de cargos existentes */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Cargos Existentes</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {cargos.map((cargo) => (
                  <div key={cargo.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{cargo.nome}</div>
                      <div className="text-sm text-gray-500">
                        {cargo.perfis_acesso ? (
                          <>
                            Perfil: {cargo.perfis_acesso.nome} (Nível {cargo.perfis_acesso.nivel_hierarquia})
                          </>
                        ) : (
                          `Nível: ${cargo.nivel_acesso}`
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCargo({ 
                          id: cargo.id, 
                          nome: cargo.nome, 
                          nivel_acesso: cargo.nivel_acesso,
                          perfil_acesso_id: cargo.perfil_acesso_id
                        })}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCargo(cargo.id)}
                      >
                        <UserMinusIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Editar Cargo */}
      {editingCargo && (
        <Dialog open={editingCargo !== null} onOpenChange={(open) => !open && setEditingCargo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cargo</DialogTitle>
            <DialogDescription>
              Edite as informações do cargo
            </DialogDescription>
          </DialogHeader>
          
          {editingCargo && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-cargo-nome">Nome do Cargo</Label>
                <Input
                  id="edit-cargo-nome"
                  value={editingCargo.nome}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">O nome do cargo não pode ser alterado</p>
              </div>
              <div>
                <Label htmlFor="edit-cargo-perfil">Perfil de Acesso *</Label>
                <Select 
                  value={editingCargo.perfil_acesso_id || ''} 
                  onValueChange={(value) => {
                    const perfil = perfisAcesso.find(p => p.id === value);
                    setEditingCargo({ 
                      ...editingCargo, 
                      perfil_acesso_id: value,
                      nivel_acesso: perfil?.codigo || editingCargo.nivel_acesso
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil de acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfisAcesso.map((perfil) => (
                      <SelectItem key={perfil.id} value={perfil.id}>
                        {perfil.nome} (Nível {perfil.nivel_hierarquia})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCargo(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCargo}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}
      </div>
    </PermissionGuard>
  );
}
