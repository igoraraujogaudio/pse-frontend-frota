'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, 
  FileText, 
  Image as ImageIcon, 
  AlertCircle, 
  Eye, 
  Download
} from 'lucide-react';

interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface DiscountOrderData {
  id: string;
  numero?: string;
  danos_evidencias?: FileInfo[];
  nf_os_documentos?: FileInfo[];
  tipo_documento?: 'nf' | 'os' | 'ambos';
  numero_documento?: string;
  valor_documento?: number;
  data_documento?: string;
  observacoes_danos?: string;
  observacoes_documentos?: string;
}

interface DiscountOrderFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber?: string;
  mode?: 'view' | 'edit';
  onSave?: (data: Partial<DiscountOrderData>) => void;
}

const DiscountOrderFilesModal: React.FC<DiscountOrderFilesModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'damages' | 'documents'>('damages');
  
  const [orderData, setOrderData] = useState<DiscountOrderData>({
    id: orderId,
    danos_evidencias: [],
    nf_os_documentos: [],
    tipo_documento: 'nf',
    numero_documento: '',
    valor_documento: 0,
    data_documento: '',
    observacoes_danos: '',
    observacoes_documentos: ''
  });

  // Carregar dados da ordem
  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId]);

  const loadOrderData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('discount_orders')
        .select(`
          id,
          numero,
          danos_evidencias_urls,
          nf_os_documentos_urls,
          tipo_documento,
          numero_documento,
          valor_documento,
          data_documento,
          observacoes_danos,
          observacoes_documentos
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Converter URLs para objetos FileInfo
      const damageFiles = (data.danos_evidencias_urls || []).map((url: string) => {
        const fileName = url.split('/').pop() || 'Arquivo';
        const extension = fileName.split('.').pop()?.toLowerCase();
        return {
          name: fileName,
          url: url,
          type: extension === 'pdf' ? 'application/pdf' : 
                ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '') ? `image/${extension}` :
                extension === 'doc' ? 'application/msword' :
                extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                'application/octet-stream',
          size: 0,
          uploadedAt: new Date().toISOString()
        };
      });

      const documentFiles = (data.nf_os_documentos_urls || []).map((url: string) => {
        const fileName = url.split('/').pop() || 'Arquivo';
        const extension = fileName.split('.').pop()?.toLowerCase();
        return {
          name: fileName,
          url: url,
          type: extension === 'pdf' ? 'application/pdf' : 
                ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '') ? `image/${extension}` :
                extension === 'doc' ? 'application/msword' :
                extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                'application/octet-stream',
          size: 0,
          uploadedAt: new Date().toISOString()
        };
      });

      setOrderData({
        ...data,
        danos_evidencias: damageFiles,
        nf_os_documentos: documentFiles
      });

      // Os arquivos já estão prontos para uso

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            Arquivos da Ordem {orderNumber || orderData.numero}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Informações do Documento */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Informações do Documento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {orderData.tipo_documento === 'nf' ? 'Nota Fiscal' : 
                     orderData.tipo_documento === 'os' ? 'Ordem de Serviço' : 
                     orderData.tipo_documento === 'ambos' ? 'NF e OS' : 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Documento</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {orderData.numero_documento || 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Documento</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {orderData.valor_documento ? `R$ ${orderData.valor_documento.toFixed(2)}` : 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do Documento</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {orderData.data_documento ? new Date(orderData.data_documento).toLocaleDateString('pt-BR') : 'Não informado'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações dos Danos</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border min-h-[2.5rem]">
                    {orderData.observacoes_danos || 'Nenhuma observação'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações dos Documentos</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border min-h-[2.5rem]">
                    {orderData.observacoes_documentos || 'Nenhuma observação'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex border-b mb-6">
              <button
                onClick={() => setActiveTab('damages')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'damages'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Evidências de Danos ({orderData.danos_evidencias?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'documents'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Documentos NF/OS ({orderData.nf_os_documentos?.length || 0})
              </button>
            </div>

            <div className="space-y-4">
              {activeTab === 'damages' && (
                <div>
                  {orderData.danos_evidencias?.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                      <p className="text-gray-500 text-lg font-medium mb-2">Nenhuma evidência de dano anexada</p>
                      <p className="text-gray-400 text-sm">Os arquivos de evidência de danos aparecerão aqui quando forem anexados</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orderData.danos_evidencias?.map((file, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            {file.type.startsWith('image/') ? (
                              <ImageIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />
                            ) : (
                              <FileText className="w-5 h-5 text-red-500" aria-label="Documento" />
                            )}
                            <span className="text-sm font-medium truncate">
                              {file.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            {file.size > 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Tamanho não disponível'}
                          </p>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                if (file.type.startsWith('image/')) {
                                  // Para imagens, abrir em modal de preview
                                  window.open(file.url, '_blank');
                                } else {
                                  // Para documentos, abrir normalmente
                                  window.open(file.url, '_blank');
                                }
                              }}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                            >
                              <Eye className="w-4 h-4" />
                              <span>{file.type.startsWith('image/') ? 'Ver' : 'Abrir'}</span>
                            </button>
                            <button
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = file.url;
                                a.download = file.name;
                                a.click();
                              }}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                            >
                              <Download className="w-4 h-4" />
                              <span>Baixar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  {orderData.nf_os_documentos?.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                      <p className="text-gray-500 text-lg font-medium mb-2">Nenhum documento NF/OS anexado</p>
                      <p className="text-gray-400 text-sm">Os documentos NF/OS aparecerão aqui quando forem anexados</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orderData.nf_os_documentos?.map((file, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            {file.type.startsWith('image/') ? (
                              <ImageIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />
                            ) : (
                              <FileText className="w-5 h-5 text-red-500" aria-label="Documento" />
                            )}
                            <span className="text-sm font-medium truncate">
                              {file.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            {file.size > 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Tamanho não disponível'}
                          </p>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                if (file.type.startsWith('image/')) {
                                  // Para imagens, abrir em modal de preview
                                  window.open(file.url, '_blank');
                                } else {
                                  // Para documentos, abrir normalmente
                                  window.open(file.url, '_blank');
                                }
                              }}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                            >
                              <Eye className="w-4 h-4" />
                              <span>{file.type.startsWith('image/') ? 'Ver' : 'Abrir'}</span>
                            </button>
                            <button
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = file.url;
                                a.download = file.name;
                                a.click();
                              }}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                            >
                              <Download className="w-4 h-4" />
                              <span>Baixar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscountOrderFilesModal;