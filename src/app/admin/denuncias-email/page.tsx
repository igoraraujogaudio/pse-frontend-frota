'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Mail, Plus, Trash2, Edit2, Save, X, User, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  status: string;
}

interface EmailDestinatario {
  id: string;
  email: string;
  nome: string | null;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  usuario_id?: string | null;
  usuario?: Usuario | null;
  email_final?: string;
}

export default function DenunciasEmailPage() {
  const [emails, setEmails] = useState<EmailDestinatario[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [tipoDestinatario, setTipoDestinatario] = useState<'email' | 'usuario'>('email');
  const [searchUsuario, setSearchUsuario] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    nome: '',
    descricao: '',
    usuario_id: ''
  });

  // Edit state
  const [editData, setEditData] = useState({
    email: '',
    nome: '',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    loadEmails();
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok && data.usuarios) {
        // Filtrar apenas usuários ativos com email e remover duplicatas
        interface UsuarioApi {
          id: string;
          nome: string;
          email: string;
          status: string;
        }
        const usuariosAtivos = (data.usuarios as UsuarioApi[])
          .filter((u) => u.status === 'ativo' && u.email)
          .map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            status: u.status
          }));
        
        // Remover duplicatas baseado no ID
        const usuariosUnicos = usuariosAtivos.filter((usuario: Usuario, index: number, self: Usuario[]) => 
          index === self.findIndex((u: Usuario) => u.id === usuario.id)
        );
        
        setUsuarios(usuariosUnicos);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const loadEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/denuncias/email-destinatarios');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar emails');
      }
      
      setEmails(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar emails');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      interface CreateEmailBody {
        nome: string | null;
        descricao: string | null;
        email?: string;
        usuario_id?: string;
      }
      const body: CreateEmailBody = {
        nome: formData.nome.trim() || null,
        descricao: formData.descricao.trim() || null
      };

      if (tipoDestinatario === 'usuario') {
        if (!formData.usuario_id) {
          setError('Selecione um usuário');
          setLoading(false);
          return;
        }
        body.usuario_id = formData.usuario_id;
      } else {
        if (!formData.email.trim()) {
          setError('Email é obrigatório');
          setLoading(false);
          return;
        }
        body.email = formData.email.trim();
      }

      const response = await fetch('/api/denuncias/email-destinatarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar email');
      }

      setSuccess(tipoDestinatario === 'usuario' ? 'Usuário adicionado com sucesso!' : 'Email adicionado com sucesso!');
      setFormData({ email: '', nome: '', descricao: '', usuario_id: '' });
      setTipoDestinatario('email');
      loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar email');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (email: EmailDestinatario) => {
    setEditingId(email.id);
    setEditData({
      email: email.email,
      nome: email.nome || '',
      descricao: email.descricao || '',
      ativo: email.ativo
    });
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch('/api/denuncias/email-destinatarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          email: editData.email.trim(),
          nome: editData.nome.trim() || null,
          descricao: editData.descricao.trim() || null,
          ativo: editData.ativo
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar email');
      }

      setSuccess('Email atualizado com sucesso!');
      setEditingId(null);
      loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar email');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ email: '', nome: '', descricao: '', ativo: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este email?')) {
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/denuncias/email-destinatarios?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao remover email');
      }

      setSuccess('Email removido com sucesso!');
      loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover email');
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (email: EmailDestinatario) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch('/api/denuncias/email-destinatarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: email.id,
          ativo: !email.ativo
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      setSuccess(`Email ${!email.ativo ? 'ativado' : 'desativado'} com sucesso!`);
      loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Emails de Denúncias</h1>
        <p className="text-gray-600">
          Configure os emails que receberão notificações quando uma nova denúncia for criada.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Adição */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Adicionar Email</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Destinatário <span className="text-red-500">*</span>
              </label>
              <Select value={tipoDestinatario} onValueChange={(value: 'email' | 'usuario') => {
                setTipoDestinatario(value);
                setFormData({ email: '', nome: '', descricao: '', usuario_id: '' });
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email Direto</SelectItem>
                  <SelectItem value="usuario">Usuário do Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoDestinatario === 'usuario' ? (
              <div>
                <label htmlFor="usuario_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Usuário <span className="text-red-500">*</span>
                </label>
                
                {/* Searchbox para buscar usuário */}
                <div className="mb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Buscar usuário por nome ou email..."
                      value={searchUsuario}
                      onChange={(e) => setSearchUsuario(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Lista filtrada de usuários */}
                {searchUsuario.trim() ? (
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {usuarios
                      .filter(u => 
                        u.nome.toLowerCase().includes(searchUsuario.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchUsuario.toLowerCase())
                      )
                      .map((usuario) => (
                        <div
                          key={usuario.id}
                          onClick={() => {
                            setFormData(prev => ({ 
                              ...prev, 
                              usuario_id: usuario.id,
                              nome: usuario.nome
                            }));
                            setSearchUsuario('');
                          }}
                          className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                            formData.usuario_id === usuario.id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{usuario.nome}</p>
                              <p className="text-xs text-gray-500">{usuario.email}</p>
                            </div>
                            {formData.usuario_id === usuario.id && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    {usuarios.filter(u => 
                      u.nome.toLowerCase().includes(searchUsuario.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchUsuario.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-sm text-gray-500">
                        Nenhum usuário encontrado
                      </div>
                    )}
                  </div>
                ) : (
                  <Select 
                    value={formData.usuario_id} 
                    onValueChange={(value) => {
                      const usuario = usuarios.find(u => u.id === value);
                      setFormData(prev => ({ 
                        ...prev, 
                        usuario_id: value,
                        nome: usuario?.nome || prev.nome
                      }));
                    }}
                    disabled={loadingUsuarios}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingUsuarios ? "Carregando usuários..." : "Selecione um usuário ou busque acima"} />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id}>
                          {usuario.nome} ({usuario.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {formData.usuario_id && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {usuarios.find(u => u.id === formData.usuario_id)?.nome}
                        </p>
                        <p className="text-xs text-blue-700">
                          {usuarios.find(u => u.id === formData.usuario_id)?.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, usuario_id: '', nome: '' }));
                          setSearchUsuario('');
                        }}
                        className="ml-auto text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="exemplo@email.com"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                Nome (opcional)
              </label>
              <Input
                id="nome"
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do destinatário"
              />
            </div>

            <div>
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Email do coordenador de denúncias"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Adicionar Email
            </Button>
          </form>
        </Card>

        {/* Lista de Emails */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Emails Cadastrados</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmails}
              disabled={loading}
            >
              <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {loading && emails.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Carregando emails...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhum email cadastrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {editingId === email.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <Input
                          value={editData.email}
                          onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                          type="email"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nome
                        </label>
                        <Input
                          value={editData.nome}
                          onChange={(e) => setEditData(prev => ({ ...prev, nome: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Descrição
                        </label>
                        <Textarea
                          value={editData.descricao}
                          onChange={(e) => setEditData(prev => ({ ...prev, descricao: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`ativo-${email.id}`}
                          checked={editData.ativo}
                          onChange={(e) => setEditData(prev => ({ ...prev, ativo: e.target.checked }))}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`ativo-${email.id}`} className="text-sm text-gray-700">
                          Ativo
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(email.id)}
                          disabled={loading}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={loading}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900">
                              {email.email_final || email.email}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                email.ativo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {email.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                            {email.usuario_id && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Usuário
                              </span>
                            )}
                          </div>
                          {email.usuario ? (
                            <p className="text-sm text-gray-600 mb-1">
                              <User className="h-3 w-3 inline mr-1" />
                              {email.usuario.nome} ({email.usuario.email})
                            </p>
                          ) : email.nome && (
                            <p className="text-sm text-gray-600 mb-1">{email.nome}</p>
                          )}
                          {email.descricao && (
                            <p className="text-xs text-gray-500">{email.descricao}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(email)}
                            disabled={loading}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAtivo(email)}
                            disabled={loading}
                            title={email.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {email.ativo ? (
                              <XCircle className="h-3 w-3 text-gray-500" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(email.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
