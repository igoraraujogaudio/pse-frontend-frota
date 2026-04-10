'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  EnvelopeIcon, 
  PlusIcon, 
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { contratoService } from '@/services/contratoService';
import { userService } from '@/services/userService';
import type { Contrato } from '@/types/contratos';
import type { User } from '@/types';
import { useNotification } from '@/contexts/NotificationContext';

interface EmailDesconto {
  id: string;
  contrato_id?: string;
  codigo_contrato?: string;
  email: string;
  usuario_id?: string;
  ativo: boolean;
  tipo: 'especifico' | 'geral';
  observacoes?: string;
  contrato?: {
    id: string;
    nome: string;
    codigo: string;
  };
  usuario?: {
    id: string;
    nome: string;
    email: string;
    matricula?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export default function EmailsDescontoPage() {
  const { notify } = useNotification();
  const [emails, setEmails] = useState<EmailDesconto[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Estado para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailDesconto | null>(null);
  const [formData, setFormData] = useState({
    contrato_id: '',
    codigo_contrato: '',
    email: '',
    usuario_id: '',
    ativo: true,
    tipo: 'especifico' as 'especifico' | 'geral',
    observacoes: ''
  });

  // Filtros
  const [filtroContrato, setFiltroContrato] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Busca de usuários
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emailsRes, contratosData, usuariosData] = await Promise.all([
        fetch('/api/admin/emails-desconto'),
        contratoService.getContratos(),
        userService.getAll()
      ]);

      if (emailsRes.ok) {
        const emailsData = await emailsRes.json();
        if (emailsData.success) {
          setEmails(emailsData.emails || []);
        } else {
          const errorMsg = emailsData.error || emailsData.details || 'Erro ao carregar emails';
          setMessage({ type: 'error', text: errorMsg });
          console.error('❌ Erro na resposta:', emailsData);
        }
      } else {
        const errorData = await emailsRes.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.details || 'Erro ao carregar emails';
        setMessage({ type: 'error', text: errorMsg });
        console.error('❌ Erro HTTP:', emailsRes.status, errorData);
      }

      setContratos(contratosData || []);
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.email && !formData.usuario_id) {
      notify('Informe um email ou selecione um usuário', 'error');
      return;
    }

    // Validar se tipo específico tem contrato
    if (formData.tipo === 'especifico' && !formData.contrato_id) {
      notify('Selecione um contrato para emails específicos', 'error');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/admin/emails-desconto';
      const method = editingEmail ? 'PUT' : 'POST';
      
      // Preparar body: limpar contrato_id e codigo_contrato se tipo é geral
      const bodyData: {
        contrato_id?: string;
        codigo_contrato?: string;
        email?: string;
        usuario_id?: string;
        ativo: boolean;
        tipo: 'especifico' | 'geral';
        observacoes?: string;
        id?: string;
      } = {
        ativo: formData.ativo,
        tipo: formData.tipo
      };

      // Adicionar campos apenas se preenchidos
      if (formData.tipo === 'geral') {
        // Para tipo geral, não enviar contrato_id nem codigo_contrato
      } else {
        if (formData.contrato_id) {
          bodyData.contrato_id = formData.contrato_id;
        }
        if (formData.codigo_contrato) {
          bodyData.codigo_contrato = formData.codigo_contrato;
        }
      }

      if (formData.email) {
        bodyData.email = formData.email;
      }
      if (formData.usuario_id) {
        bodyData.usuario_id = formData.usuario_id;
      }
      if (formData.observacoes) {
        bodyData.observacoes = formData.observacoes;
      }

      const body = editingEmail
        ? { ...bodyData, id: editingEmail.id }
        : bodyData;

      console.log('📤 Enviando dados:', body);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      console.log('📥 Resposta recebida:', { status: response.status, data });

      if (response.ok && data.success) {
        notify(
          editingEmail ? 'Email atualizado com sucesso' : 'Email cadastrado com sucesso',
          'success'
        );
        setShowForm(false);
        setEditingEmail(null);
        resetForm();
        loadData();
      } else {
        // Mostrar mensagem de erro mais específica
        const errorMessage = data.error || data.details || 'Erro ao salvar email';
        console.error('❌ Erro ao salvar email:', { 
          error: data.error, 
          details: data.details, 
          code: data.code 
        });
        notify(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar email (catch):', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar email';
      notify(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este email?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/emails-desconto?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notify('Email removido com sucesso', 'success');
        loadData();
      } else {
        notify(data.error || 'Erro ao remover email', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover email:', error);
      notify('Erro ao remover email', 'error');
    }
  };

  const handleEdit = (email: EmailDesconto) => {
    setEditingEmail(email);
    setFormData({
      contrato_id: email.contrato_id || '',
      codigo_contrato: email.codigo_contrato || '',
      email: email.email,
      usuario_id: email.usuario_id || '',
      ativo: email.ativo,
      tipo: email.tipo,
      observacoes: email.observacoes || ''
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingEmail(null);
    resetForm();
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      contrato_id: '',
      codigo_contrato: '',
      email: '',
      usuario_id: '',
      ativo: true,
      tipo: 'especifico',
      observacoes: ''
    });
  };

  const handleSelectUser = (usuario: User) => {
    setFormData({
      ...formData,
      usuario_id: usuario.id,
      email: usuario.email || ''
    });
    setShowUserSearch(false);
    setUserSearchTerm('');
  };

  const handleContratoChange = (contratoId: string) => {
    const contrato = contratos.find(c => c.id === contratoId);
    setFormData({
      ...formData,
      contrato_id: contratoId,
      codigo_contrato: contrato?.codigo || ''
    });
  };

  // Filtrar emails
  const filteredEmails = emails.filter(email => {
    if (filtroContrato && email.contrato_id !== filtroContrato) return false;
    if (filtroTipo && email.tipo !== filtroTipo) return false;
    if (filtroAtivo && String(email.ativo) !== filtroAtivo) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        email.email.toLowerCase().includes(term) ||
        email.contrato?.nome.toLowerCase().includes(term) ||
        email.contrato?.codigo.toLowerCase().includes(term) ||
        email.usuario?.nome.toLowerCase().includes(term) ||
        email.observacoes?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Filtrar usuários para busca
  const filteredUsuarios = usuarios.filter(usuario => {
    if (!userSearchTerm) return false;
    const term = userSearchTerm.toLowerCase();
    return (
      usuario.nome.toLowerCase().includes(term) ||
      usuario.email?.toLowerCase().includes(term) ||
      usuario.matricula?.toLowerCase().includes(term)
    );
  }).slice(0, 10); // Limitar a 10 resultados

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Emails de Ordem de Desconto</h1>
          <p className="text-gray-600 mt-1">
            Configure os emails que receberão notificações de ordens de desconto por contrato
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Novo Email
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Email, contrato, usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrato
              </label>
              <select
                value={filtroContrato}
                onChange={(e) => setFiltroContrato(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {contratos.map((contrato) => (
                  <option key={contrato.id} value={contrato.id}>
                    {contrato.nome} ({contrato.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="especifico">Específico</option>
                <option value="geral">Geral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filtroAtivo}
                onChange={(e) => setFiltroAtivo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Emails */}
      <Card>
        <CardHeader>
          <CardTitle>Emails Cadastrados ({filteredEmails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmails.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum email encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contrato</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Usuário</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.map((email) => (
                    <tr key={email.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                          <span className="font-medium">{email.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {email.contrato ? (
                          <div className="flex items-center gap-2">
                            <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{email.contrato.nome}</div>
                              <div className="text-sm text-gray-500">{email.contrato.codigo}</div>
                            </div>
                          </div>
                        ) : email.tipo === 'geral' ? (
                          <span className="text-gray-500 italic">Geral (todos os contratos)</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {email.usuario ? (
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{email.usuario.nome}</div>
                              {email.usuario.matricula && (
                                <div className="text-sm text-gray-500">Mat: {email.usuario.matricula}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            email.tipo === 'geral'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {email.tipo === 'geral' ? 'Geral' : 'Específico'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {email.ativo ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircleIcon className="w-5 h-5" />
                            Ativo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircleIcon className="w-5 h-5" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(email)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(email.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remover"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingEmail ? 'Editar Email' : 'Novo Email'}
              </CardTitle>
              <CardDescription>
                Configure o email que receberá notificações de ordens de desconto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Email
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="especifico"
                      checked={formData.tipo === 'especifico'}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'especifico' | 'geral' })}
                    />
                    <span>Específico (apenas do contrato)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="geral"
                      checked={formData.tipo === 'geral'}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'especifico' | 'geral', contrato_id: '', codigo_contrato: '' })}
                    />
                    <span>Geral (recebe todos os contratos)</span>
                  </label>
                </div>
              </div>

              {formData.tipo === 'especifico' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contrato *
                  </label>
                  <select
                    value={formData.contrato_id}
                    onChange={(e) => handleContratoChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um contrato</option>
                    {contratos.map((contrato) => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.nome} ({contrato.codigo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserSearch(!showUserSearch)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <UserIcon className="w-5 h-5" />
                    Buscar Usuário
                  </button>
                </div>

                {showUserSearch && (
                  <div className="mt-2 border border-gray-200 rounded-lg p-4 bg-white shadow-lg">
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Digite nome, email ou matrícula..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {userSearchTerm && (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredUsuarios.length === 0 ? (
                          <div className="text-sm text-gray-500 p-2">Nenhum usuário encontrado</div>
                        ) : (
                          filteredUsuarios.map((usuario) => (
                            <button
                              key={usuario.id}
                              type="button"
                              onClick={() => handleSelectUser(usuario)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded transition-colors"
                            >
                              <div className="font-medium">{usuario.nome}</div>
                              <div className="text-sm text-gray-500">
                                {usuario.email} {usuario.matricula && `• Mat: ${usuario.matricula}`}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-gray-700">Ativo</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Observações opcionais..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingEmail(null);
                    resetForm();
                    setShowUserSearch(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : editingEmail ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
