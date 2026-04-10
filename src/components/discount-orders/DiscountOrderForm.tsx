'use client';

import React, { useState } from 'react';
import FileUploadComponent from './FileUploadComponent';

interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface FormData {
  tipo_documento: 'nf' | 'os' | 'ambos';
  numero_documento: string;
  valor_documento: number;
  data_documento: string;
  observacoes_danos: string;
  observacoes_documentos: string;
  danos_evidencias: FileInfo[];
  nf_os_documentos: FileInfo[];
}

interface DiscountOrderFormProps {
  orderId?: string;
  initialData?: {
    danos_evidencias?: FileInfo[];
    nf_os_documentos?: FileInfo[];
    tipo_documento?: 'nf' | 'os' | 'ambos';
    numero_documento?: string;
    valor_documento?: number;
    data_documento?: string;
    observacoes_danos?: string;
    observacoes_documentos?: string;
  };
  onSave?: (data: FormData) => void;
  disabled?: boolean;
}

const DiscountOrderForm: React.FC<DiscountOrderFormProps> = ({
  orderId,
  initialData,
  onSave,
  disabled = false
}) => {
  const [formData, setFormData] = useState({
    tipo_documento: initialData?.tipo_documento || 'nf',
    numero_documento: initialData?.numero_documento || '',
    valor_documento: initialData?.valor_documento || 0,
    data_documento: initialData?.data_documento || '',
    observacoes_danos: initialData?.observacoes_danos || '',
    observacoes_documentos: initialData?.observacoes_documentos || ''
  });

  const [damageFiles, setDamageFiles] = useState<FileInfo[]>(initialData?.danos_evidencias || []);
  const [documentFiles, setDocumentFiles] = useState<FileInfo[]>(initialData?.nf_os_documentos || []);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    const data = {
      ...formData,
      danos_evidencias: damageFiles,
      nf_os_documentos: documentFiles
    };
    onSave?.(data);
  };

  if (!orderId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800">
          É necessário salvar a ordem de desconto antes de fazer upload de arquivos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Informações do Documento */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Informações do Documento
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Documento
            </label>
            <select
              value={formData.tipo_documento}
              onChange={(e) => handleInputChange('tipo_documento', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="nf">Nota Fiscal</option>
              <option value="os">Ordem de Serviço</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número do Documento
            </label>
            <input
              type="text"
              value={formData.numero_documento}
              onChange={(e) => handleInputChange('numero_documento', e.target.value)}
              disabled={disabled}
              placeholder="Ex: NF-001234 ou OS-005678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor do Documento (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor_documento}
              onChange={(e) => handleInputChange('valor_documento', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data do Documento
            </label>
            <input
              type="date"
              value={formData.data_documento}
              onChange={(e) => handleInputChange('data_documento', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Upload de Evidências de Danos */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <FileUploadComponent
          orderId={orderId}
          fileType="damage"
          title="Evidências de Danos"
          description="Faça upload de fotos e documentos que comprovem os danos ocorridos"
          existingFiles={damageFiles}
          onFilesChange={setDamageFiles}
          maxFiles={10}
          disabled={disabled}
        />
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações sobre os Danos
          </label>
          <textarea
            value={formData.observacoes_danos}
            onChange={(e) => handleInputChange('observacoes_danos', e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Descreva os danos evidenciados..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* Upload de Documentos NF/OS */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <FileUploadComponent
          orderId={orderId}
          fileType="document"
          title="Documentos NF/OS"
          description="Faça upload da Nota Fiscal ou Ordem de Serviço relacionada aos danos"
          existingFiles={documentFiles}
          onFilesChange={setDocumentFiles}
          maxFiles={5}
          disabled={disabled}
        />
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações sobre os Documentos
          </label>
          <textarea
            value={formData.observacoes_documentos}
            onChange={(e) => handleInputChange('observacoes_documentos', e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Informações adicionais sobre os documentos..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo dos Arquivos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-md border">
            <h4 className="font-medium text-gray-900">Evidências de Danos</h4>
            <p className="text-sm text-gray-600 mt-1">
              {damageFiles.length} arquivo(s) anexado(s)
            </p>
            {damageFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {damageFiles.map((file, index) => (
                  <li key={index} className="text-xs text-gray-500 truncate">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="bg-white p-4 rounded-md border">
            <h4 className="font-medium text-gray-900">Documentos NF/OS</h4>
            <p className="text-sm text-gray-600 mt-1">
              {documentFiles.length} arquivo(s) anexado(s)
            </p>
            {documentFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {documentFiles.map((file, index) => (
                  <li key={index} className="text-xs text-gray-500 truncate">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      {!disabled && (
        <div className="flex justify-end space-x-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Salvar Alterações
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscountOrderForm;