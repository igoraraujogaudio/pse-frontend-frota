'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  CalendarIcon, 
  UserIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  BuildingOfficeIcon, 
  IdentificationIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/dateUtils';
import { useFuncionario, useContratos, useUpdateFuncionario } from '@/hooks/useFuncionarios';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { FuncionarioCompleto } from '@/types';

// Extended interface to include all properties that might be present
interface FuncionarioWithAllProperties extends FuncionarioCompleto {
  data_nascimento?: string;
  telefone_empresarial?: string;
  data_admissao?: string;
  validade_aso?: string;
  email_pessoal?: string;
}


export default function FuncionarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [funcionarioId, setFuncionarioId] = useState<string>('');
  const [editData, setEditData] = useState<Partial<FuncionarioWithAllProperties>>({});
  const { hasPermission } = useModularPermissions();

  // React Query hooks
  const { data: funcionario, isLoading: loading, error } = useFuncionario(funcionarioId);
  const { data: contratos = [] } = useContratos();
  const updateFuncionarioMutation = useUpdateFuncionario();

  useEffect(() => {
    const initializePage = async () => {
      const resolvedParams = await params;
      setFuncionarioId(resolvedParams.id);
      
      // Verificar se deve abrir em modo de edição
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('edit') === 'true') {
        setIsEditing(true);
      }
    };
    
    initializePage();
  }, [params]);

  useEffect(() => {
    if (funcionario) {
      setEditData(funcionario);
    }
  }, [funcionario]);

  const handleSave = async () => {
    if (!funcionarioId) return;

    updateFuncionarioMutation.mutate(
      { id: funcionarioId, data: editData },
      {
        onSuccess: () => {
          setIsEditing(false);
        }
      }
    );
  };

  const handleCancel = () => {
    setEditData(funcionario || {});
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {

    const labels = {
      'VIGENTE': 'Vigente',
      'NO_PRAZO': 'No Prazo',
      'VENCENDO': 'Vencendo',
      'ATENCAO': 'Atenção',
      'VENCIDO': 'Vencido',
      'VENCIDA': 'Vencida',
      'SEM_CNH': 'Sem CNH',
      'SEM_ASO': 'Sem ASO',
      'SEM_HAR': 'Sem HAR',
      'AGENDADO': 'Agendado',
      'AGENDADO_PROXIMO': 'Agendado - Próximo',
      'AGENDADO_VENCENDO': 'Agendado - Vencendo'
    };

    const icons = {
      'VIGENTE': '✅',
      'NO_PRAZO': '✅',
      'VENCENDO': '⚠️',
      'ATENCAO': '🚨',
      'VENCIDO': '🚨',
      'VENCIDA': '🚨',
      'SEM_CNH': '❌',
      'SEM_ASO': '❌',
      'SEM_HAR': '❌',
      'AGENDADO': '📅',
      'AGENDADO_PROXIMO': '⚠️',
      'AGENDADO_VENCENDO': '🚨'
    };

    const baseClasses = {
      'VIGENTE': 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'NO_PRAZO': 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'VENCENDO': 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'ATENCAO': 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'VENCIDO': 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'VENCIDA': 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'SEM_CNH': 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 text-sm font-semibold shadow-sm',
      'SEM_ASO': 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 text-sm font-semibold shadow-sm',
      'SEM_HAR': 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 text-sm font-semibold shadow-sm',
      'AGENDADO': 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'AGENDADO_PROXIMO': 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200',
      'AGENDADO_VENCENDO': 'bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200'
    };

    return (
      <Badge className={baseClasses[status as keyof typeof baseClasses] || 'bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 text-sm font-semibold shadow-sm'}>
        <div className="flex items-center gap-1.5">
          <span>{icons[status as keyof typeof icons] || '❓'}</span>
          {labels[status as keyof typeof labels] || status}
        </div>
      </Badge>
    );
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDateTime = (dateTimeString: string | undefined) => {
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
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (error || !funcionario) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error?.message || 'Funcionário não encontrado'}</p>
          <Button 
            onClick={() => router.back()} 
            className="mt-4"
            variant="outline"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button 
                onClick={() => router.back()} 
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg backdrop-blur-sm">
                  {funcionario.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-bold">{funcionario.nome}</h1>
                    {funcionario.operacao && (
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
                        <span className="text-white font-semibold text-sm">
                          {funcionario.operacao}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-blue-100 text-lg mt-1">Matrícula: {funcionario.matricula}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button 
                    onClick={handleSave} 
                    disabled={updateFuncionarioMutation.isPending}
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    {updateFuncionarioMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button 
                    onClick={handleCancel} 
                    variant="outline"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              ) : (
                hasPermission(PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS) && (
                  <Button 
                    onClick={() => setIsEditing(true)}
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Informações Básicas */}
        <Card className="bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-blue-800">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              Informações Pessoais e Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-semibold text-gray-700">Nome Completo</Label>
                {isEditing ? (
                  <Input
                    id="nome"
                    value={editData.nome || ''}
                    onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{funcionario.nome}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="matricula" className="text-sm font-semibold text-gray-700">Matrícula</Label>
                {isEditing ? (
                  <Input
                    id="matricula"
                    value={editData.matricula || ''}
                    onChange={(e) => setEditData({ ...editData, matricula: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{funcionario.matricula}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold text-gray-700">CPF</Label>
                {isEditing ? (
                  <Input
                    id="cpf"
                    value={editData.cpf || ''}
                    onChange={(e) => setEditData({ ...editData, cpf: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg text-gray-900">{funcionario.cpf ? formatCPF(funcionario.cpf) : 'Não informado'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_nascimento" className="text-sm font-semibold text-gray-700">Data de Nascimento</Label>
                {isEditing ? (
                  <DateInput
                    id="data_nascimento"
                    value={editData.data_nascimento || ''}
                    onChange={(value) => setEditData({ ...editData, data_nascimento: value })}
                    placeholder="DD/MM/AAAA"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg text-gray-900">{(funcionario as FuncionarioWithAllProperties).data_nascimento ? formatDate((funcionario as FuncionarioWithAllProperties).data_nascimento!) : 'Não informado'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-gray-700">Status</Label>
                {isEditing ? (
                  <Select
                    value={editData.status || ''}
                    onValueChange={(value) => setEditData({ ...editData, status: value })}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    <Badge className={
                      funcionario.status === 'ativo' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg' :
                      funcionario.status === 'suspenso' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg' :
                      'bg-gradient-to-r from-gray-500 to-slate-600 text-white border-0 px-3 py-1.5 text-sm font-semibold shadow-lg'
                    }>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        {funcionario.status === 'ativo' ? 'Ativo' : 
                         funcionario.status === 'suspenso' ? 'Suspenso' : funcionario.status}
                      </div>
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Campos de Contato */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg flex items-center gap-2 text-gray-900">
                    <EnvelopeIcon className="h-4 w-4 text-blue-500" />
                    {funcionario.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_pessoal" className="text-sm font-semibold text-gray-700">Email Pessoal</Label>
                {isEditing ? (
                  <Input
                    id="email_pessoal"
                    type="email"
                    value={editData.email_pessoal || ''}
                    onChange={(e) => setEditData({ ...editData, email_pessoal: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg flex items-center gap-2 text-gray-900">
                    <EnvelopeIcon className="h-4 w-4 text-blue-500" />
                    {(funcionario as FuncionarioWithAllProperties).email_pessoal || 'Não informado'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-sm font-semibold text-gray-700">Telefone Pessoal</Label>
                {isEditing ? (
                  <Input
                    id="telefone"
                    value={editData.telefone || ''}
                    onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg flex items-center gap-2 text-gray-900">
                    <PhoneIcon className="h-4 w-4 text-blue-500" />
                    {funcionario.telefone || 'Não informado'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone_empresarial" className="text-sm font-semibold text-gray-700">Telefone Empresarial</Label>
                {isEditing ? (
                  <Input
                    id="telefone_empresarial"
                    value={editData.telefone_empresarial || ''}
                    onChange={(e) => setEditData({ ...editData, telefone_empresarial: e.target.value })}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg flex items-center gap-2 text-gray-900">
                    <PhoneIcon className="h-4 w-4 text-blue-500" />
                    {(funcionario as FuncionarioWithAllProperties).telefone_empresarial || 'Não informado'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações Profissionais */}
        <Card className="bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-indigo-800">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              Informações Profissionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cargo" className="text-sm font-semibold text-gray-700">Cargo</Label>
                {isEditing ? (
                  <Input
                    id="cargo"
                    value={editData.cargo || ''}
                    onChange={(e) => setEditData({ ...editData, cargo: e.target.value })}
                    className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{funcionario.cargo}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="operacao" className="text-sm font-semibold text-gray-700">Operação</Label>
                {isEditing ? (
                  <Input
                    id="operacao"
                    value={editData.operacao || ''}
                    onChange={(e) => setEditData({ ...editData, operacao: e.target.value })}
                    className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg text-gray-900">{funcionario.operacao || 'Não informado'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contrato_id" className="text-sm font-semibold text-gray-700">Contrato</Label>
                {isEditing ? (
                  <Select
                    value={editData.contrato_id || ''}
                    onValueChange={(value) => setEditData({ ...editData, contrato_id: value })}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl">
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratos.map((contrato) => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-lg text-gray-900">{funcionario.contrato?.nome || 'Não informado'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_admissao" className="text-sm font-semibold text-gray-700">Data de Admissão</Label>
                {isEditing ? (
                  <DateInput
                    id="data_admissao"
                    value={editData.data_admissao || ''}
                    onChange={(value) => setEditData({ ...editData, data_admissao: value })}
                    placeholder="DD/MM/AAAA"
                    className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                  />
                ) : (
                  <p className="text-lg text-gray-900">{(funcionario as FuncionarioWithAllProperties).data_admissao ? formatDate((funcionario as FuncionarioWithAllProperties).data_admissao!) : 'Não informado'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentos e Vencimentos */}
        <Card className="bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-emerald-800">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                <IdentificationIcon className="h-5 w-5 text-white" />
              </div>
              Documentos e Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 p-6">
            {/* CNH */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">🚗</span>
                  </div>
                  <h4 className="font-semibold text-lg text-gray-900">CNH - Carteira Nacional de Habilitação</h4>
                </div>
                {getStatusBadge(funcionario.vencimentos.cnh.status)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <Label htmlFor="cnh" className="text-sm font-semibold text-gray-700">Número</Label>
                  {isEditing ? (
                    <Input
                      id="cnh"
                      value={editData.cnh || ''}
                      onChange={(e) => setEditData({ ...editData, cnh: e.target.value })}
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.cnh || 'Não informado'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnh_categoria" className="text-sm font-semibold text-gray-700">Categoria</Label>
                  {isEditing ? (
                    <Input
                      id="cnh_categoria"
                      value={editData.cnh_categoria || ''}
                      onChange={(e) => setEditData({ ...editData, cnh_categoria: e.target.value })}
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.cnh_categoria || 'Não informado'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validade_cnh" className="text-sm font-semibold text-gray-700">Validade</Label>
                  {isEditing ? (
                    <DateInput
                      id="validade_cnh"
                      value={editData.validade_cnh || ''}
                      onChange={(value) => setEditData({ ...editData, validade_cnh: value })}
                      placeholder="DD/MM/AAAA"
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.vencimentos.cnh.data_vencimento ? formatDate(funcionario.vencimentos.cnh.data_vencimento) : 'Não informado'}</p>
                  )}
                </div>
              </div>
              {funcionario.vencimentos.cnh.dias_vencimento !== null && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {funcionario.vencimentos.cnh.dias_vencimento > 0 
                    ? `${funcionario.vencimentos.cnh.dias_vencimento} dias para vencer`
                    : funcionario.vencimentos.cnh.dias_vencimento === 0
                    ? 'Vence hoje'
                    : `${Math.abs(funcionario.vencimentos.cnh.dias_vencimento)} dias vencido`
                  }
                </p>
              )}
            </div>

            <Separator className="my-6" />

            {/* ASO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">🏥</span>
                  </div>
                  <h4 className="font-semibold text-lg text-gray-900">ASO - Atestado de Saúde Ocupacional</h4>
                </div>
                {getStatusBadge(funcionario.vencimentos.aso.status)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <Label htmlFor="data_ultimo_exame_aso" className="text-sm font-semibold text-gray-700">Último ASO</Label>
                  {isEditing ? (
                    <DateInput
                      id="data_ultimo_exame_aso"
                      value={editData.data_ultimo_exame_aso || ''}
                      onChange={(value) => setEditData({ ...editData, data_ultimo_exame_aso: value })}
                      placeholder="DD/MM/AAAA"
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.vencimentos.aso.data_ultimo ? formatDate(funcionario.vencimentos.aso.data_ultimo) : 'Não informado'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_agendamento_aso" className="text-sm font-semibold text-gray-700">Próximo Agendamento</Label>
                  {isEditing ? (
                    <Input
                      id="data_agendamento_aso"
                      type="datetime-local"
                      value={editData.data_agendamento_aso ? editData.data_agendamento_aso.slice(0, 16) : ''}
                      onChange={(e) => setEditData({ ...editData, data_agendamento_aso: e.target.value })}
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.vencimentos.aso.data_agendamento ? formatDateTime(funcionario.vencimentos.aso.data_agendamento) : 'Não informado'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validade_aso" className="text-sm font-semibold text-gray-700">Validade ASO</Label>
                  {isEditing ? (
                    <DateInput
                      id="validade_aso"
                      value={editData.validade_aso || ''}
                      onChange={(value) => setEditData({ ...editData, validade_aso: value })}
                      placeholder="DD/MM/AAAA"
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.vencimentos.aso.data_vencimento ? formatDate(funcionario.vencimentos.aso.data_vencimento) : 'Não calculada'}</p>
                  )}
                </div>
              </div>
              {funcionario.vencimentos.aso.dias_vencimento !== null && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {funcionario.vencimentos.aso.dias_vencimento > 0 
                    ? `${funcionario.vencimentos.aso.dias_vencimento} dias para vencer`
                    : funcionario.vencimentos.aso.dias_vencimento === 0
                    ? 'Vence hoje'
                    : `${Math.abs(funcionario.vencimentos.aso.dias_vencimento)} dias vencido`
                  }
                </p>
              )}
            </div>

            <Separator className="my-6" />

            {/* HAR */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⚡</span>
                  </div>
                  <h4 className="font-semibold text-lg text-gray-900">HAR - Homologação de Aptidão para Risco</h4>
                </div>
                {getStatusBadge(funcionario.vencimentos.har.status)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4 text-sm">
                <div className="space-y-2">
                  <Label htmlFor="har_vencimento" className="text-sm font-semibold text-gray-700">Vencimento</Label>
                  {isEditing ? (
                    <DateInput
                      id="har_vencimento"
                      value={editData.har_vencimento || ''}
                      onChange={(value) => setEditData({ ...editData, har_vencimento: value })}
                      placeholder="DD/MM/AAAA"
                      className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    />
                  ) : (
                    <p className="text-gray-900">{funcionario.vencimentos.har.data_vencimento ? formatDate(funcionario.vencimentos.har.data_vencimento) : 'Não informado'}</p>
                  )}
                </div>
              </div>
              {funcionario.vencimentos.har.dias_vencimento !== null && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {funcionario.vencimentos.har.dias_vencimento > 0 
                    ? `${funcionario.vencimentos.har.dias_vencimento} dias para vencer`
                    : funcionario.vencimentos.har.dias_vencimento === 0
                    ? 'Vence hoje'
                    : `${Math.abs(funcionario.vencimentos.har.dias_vencimento)} dias vencido`
                  }
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card className="bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-gray-800">
              <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Criado em</Label>
                <p className="text-gray-900">{formatDate(funcionario.criado_em)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Última atualização</Label>
                <p className="text-gray-900">{formatDate(funcionario.atualizado_em)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
