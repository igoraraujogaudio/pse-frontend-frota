'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Loader2, 
  Edit, 
  Trash2, 
  Phone,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface WhatsAppNumber {
  id: string;
  numero: string;
  nome: string | null;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export default function DenunciasWhatsAppPage() {
  const [numeros, setNumeros] = useState<WhatsAppNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    numero: '',
    nome: '',
    descricao: '',
    ativo: true
  });

  // Carregar números
  const loadNumeros = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/denuncias/whatsapp-numeros');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar números');
      }
      
      setNumeros(data.numeros || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar números');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNumeros();
  }, []);

  // Limpar formulário
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      numero: '',
      nome: '',
      descricao: '',
      ativo: true
    });
  };

  // Iniciar edição
  const handleEdit = (numero: WhatsAppNumber) => {
    setEditingId(numero.id);
    setFormData({
      numero: numero.numero,
      nome: numero.nome || '',
      descricao: numero.descricao || '',
      ativo: numero.ativo
    });
  };

  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    if (!formData.numero.trim()) {
      setError('Número é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = '/api/denuncias/whatsapp-numeros';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar número');
      }

      setSuccess(data.message || 'Número salvo com sucesso!');
      resetForm();
      await loadNumeros();
      
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar número');
    } finally {
      setLoading(false);
    }
  };

  // Deletar
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este número?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/denuncias/whatsapp-numeros?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar número');
      }

      setSuccess('Número removido com sucesso!');
      await loadNumeros();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar número');
    } finally {
      setLoading(false);
    }
  };

  // Formatar número para exibição
  const formatNumber = (numero: string): string => {
    // Se começar com 55 (Brasil), formatar como (XX) XXXXX-XXXX
    if (numero.startsWith('55') && numero.length === 13) {
      const ddd = numero.substring(2, 4);
      const parte1 = numero.substring(4, 9);
      const parte2 = numero.substring(9);
      return `+55 (${ddd}) ${parte1}-${parte2}`;
    }
    return numero;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Configuração de WhatsApp - Denúncias
        </h1>
        <p className="text-gray-600">
          Gerencie os números de WhatsApp que receberão notificações de denúncias
        </p>
      </div>

      {/* Mensagens */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Formulário */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? 'Editar Número' : 'Adicionar Novo Número'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="numero">Número de WhatsApp *</Label>
            <Input
              id="numero"
              placeholder="5511999999999"
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Formato: código do país + DDD + número (ex: 5511999999999)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome/Identificação</Label>
            <Input
              id="nome"
              placeholder="Ex: Supervisor João"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição opcional do destinatário"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              disabled={loading}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              disabled={loading}
            />
            <Label htmlFor="ativo" className="cursor-pointer">
              Número ativo (receberá notificações)
            </Label>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={loading || !formData.numero.trim()}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {editingId ? 'Atualizar' : 'Adicionar'}
          </Button>
          
          {editingId && (
            <Button
              onClick={resetForm}
              disabled={loading}
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </Card>

      {/* Lista de Números */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Números Configurados</h2>
        
        {loading && numeros.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : numeros.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhum número configurado ainda.</p>
            <p className="text-sm">Adicione um número acima para começar a receber notificações.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {numeros.map((numero) => (
              <div
                key={numero.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {formatNumber(numero.numero)}
                    </span>
                    {numero.ativo ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  
                  {numero.nome && (
                    <p className="text-sm text-gray-600 mb-1">{numero.nome}</p>
                  )}
                  
                  {numero.descricao && (
                    <p className="text-xs text-gray-500">{numero.descricao}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEdit(numero)}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    onClick={() => handleDelete(numero.id)}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Informações */}
      <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Informações</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Os números ativos receberão notificações sempre que uma nova denúncia for criada</li>
          <li>• Números inativos não receberão notificações, mas permanecerão no sistema</li>
          <li>• O formato do número deve ser internacional (ex: 5511999999999 para Brasil)</li>
          <li>• Certifique-se de que a Evolution API está configurada corretamente</li>
        </ul>
      </Card>
    </div>
  );
}
