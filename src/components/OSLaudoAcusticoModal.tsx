import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DocumentTextIcon, ArrowUpTrayIcon, PlusIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { LaudoAcusticoOS, VehicleDocument } from '@/types';
import { useNotification } from '@/contexts/NotificationContext';

interface OSLaudoAcusticoModalProps {
  open: boolean;
  onClose: () => void;
  documento: VehicleDocument;
  onSuccess?: () => void;
}

export function OSLaudoAcusticoModal({
  open,
  onClose,
  documento,
  onSuccess
}: OSLaudoAcusticoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [numeroOS, setNumeroOS] = useState('');
  const [descricao, setDescricao] = useState('');
  const [uploading, setUploading] = useState(false);
  const [osLaudos, setOsLaudos] = useState<LaudoAcusticoOS[]>([]);
  const [loading, setLoading] = useState(false);
  const { notify } = useNotification();

  const loadOSLaudos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/laudo-acustico-os?documentoId=${documento.id}`);
      const result = await response.json();

      if (response.ok) {
        setOsLaudos(result.data || []);
      } else {
        console.error('Erro ao carregar OS:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar OS:', error);
    } finally {
      setLoading(false);
    }
  }, [documento.id]);

  // Carregar OS existentes quando o modal abrir
  useEffect(() => {
    if (open && documento.id) {
      loadOSLaudos();
    }
  }, [open, documento.id, loadOSLaudos]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0] || !numeroOS.trim()) {
      notify('Selecione um arquivo e informe o número da OS', 'error');
      return;
    }

    try {
      setUploading(true);
      const file = fileInputRef.current.files[0];

      // Criar FormData para enviar para a API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentoId', documento.id);
      formData.append('numeroOS', numeroOS.trim());
      if (descricao.trim()) {
        formData.append('descricao', descricao.trim());
      }

      // Enviar para a API route
      const response = await fetch('/api/laudo-acustico-os', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro no upload');
      }

      setOsLaudos(prev => [result.data, ...prev]);
      setNumeroOS('');
      setDescricao('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      notify('OS adicionada com sucesso!', 'success');
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error('Erro ao fazer upload da OS:', error);
      notify(`Erro ao fazer upload da OS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteOS(osId: string) {
    if (!confirm('Tem certeza que deseja excluir esta OS?')) return;

    try {
      const response = await fetch(`/api/laudo-acustico-os?id=${osId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir OS');
      }

      setOsLaudos(prev => prev.filter(os => os.id !== osId));
      notify('OS excluída com sucesso!', 'success');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao excluir OS:', error);
      notify('Erro ao excluir OS', 'error');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative bg-white/90 backdrop-blur-xl shadow-2xl rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold focus:outline-none z-10"
          aria-label="Fechar"
        >
          ×
        </button>
        
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <DocumentTextIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                OS do Laudo Acústico
              </h3>
              <p className="text-sm text-gray-600">
                Gerenciar Ordens de Serviço de reparo
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Formulário para adicionar nova OS */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <PlusIcon className="h-5 w-5 text-blue-600" />
              Adicionar Nova OS
            </h4>
            
            <form className="space-y-4" onSubmit={handleUpload}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número da OS *
                  </label>
                  <input
                    type="text"
                    value={numeroOS}
                    onChange={e => setNumeroOS(e.target.value)}
                    className="block w-full text-sm text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    placeholder="Ex: OS-2025-001"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arquivo PDF *
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="block w-full text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
                    accept=".pdf"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="block w-full text-sm text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  placeholder="Descrição opcional da OS de reparo..."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 flex items-center gap-2"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {uploading ? 'Enviando...' : 'Adicionar OS'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de OS existentes */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              OS Cadastradas ({osLaudos.length})
            </h4>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p>Carregando OS...</p>
              </div>
            ) : osLaudos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhuma OS cadastrada ainda</p>
                <p className="text-sm">Adicione a primeira OS usando o formulário acima</p>
              </div>
            ) : (
              <div className="space-y-3">
                {osLaudos.map((os) => (
                  <div key={os.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900">{os.numero_os}</span>
                      </div>
                      {os.descricao && (
                        <p className="text-sm text-gray-600 mb-2">{os.descricao}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Adicionada em {new Date(os.criado_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <a
                        href={os.url_arquivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Visualizar OS"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteOS(os.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir OS"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}