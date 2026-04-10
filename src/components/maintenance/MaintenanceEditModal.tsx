import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Maintenance, MaintenanceImage } from '@/types';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface MaintenanceEditModalProps {
  maintenance: Maintenance;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedMaintenance: Partial<Maintenance>) => Promise<void>;
}

const MaintenanceEditModal: React.FC<MaintenanceEditModalProps> = ({
  maintenance,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    numero_orcamento: maintenance.numero_orcamento || '',
    numero_cotacao: maintenance.numero_cotacao || '',
    numero_pedido: maintenance.numero_pedido || '',
    numero_nf: maintenance.numero_nf || '',
    nf_vencimento: maintenance.nf_vencimento || '',
    observacoes: maintenance.observacoes || ''
  });

  const [images, setImages] = useState<MaintenanceImage[]>(maintenance.imagens || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Atualizar formData quando maintenance mudar
  useEffect(() => {
    setFormData({
      numero_orcamento: maintenance.numero_orcamento || '',
      numero_cotacao: maintenance.numero_cotacao || '',
      numero_pedido: maintenance.numero_pedido || '',
      numero_nf: maintenance.numero_nf || '',
      nf_vencimento: maintenance.nf_vencimento || '',
      observacoes: maintenance.observacoes || ''
    });
    setImages(maintenance.imagens || []);
  }, [maintenance]);

  // Bloquear scroll da página quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      // Calcular largura do scrollbar antes de esconder
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // Aplicar estilos para prevenir shift do layout
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      // Restaurar estilos
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }

    // Cleanup quando componente desmontar
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    console.log('🔍 DEBUG - handleImageUpload chamada:', {
      filesCount: files.length,
      maintenanceId: maintenance.id
    });

    // Verificar se temos ID da manutenção
    if (!maintenance.id) {
      alert('Erro: ID da manutenção não encontrado. Não é possível fazer upload de imagens.');
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validar arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Tipo de arquivo não permitido: ${file.name}`);
        }

        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSizeBytes) {
          throw new Error(`Arquivo muito grande: ${file.name}`);
        }

        // Gerar caminho único
        const { data: filePath, error: pathError } = await supabase.rpc('generate_maintenance_image_path', {
          maintenance_id: maintenance.id,
          original_filename: file.name
        });

        if (pathError) {
          throw new Error(`Erro ao gerar caminho: ${pathError.message}`);
        }

        // Upload para storage
        const { error: uploadError } = await supabase.storage
          .from('manutencoes-imagens')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
          .from('manutencoes-imagens')
          .getPublicUrl(filePath);

        // Salvar no banco de dados
        const { data: imageData, error: dbError } = await supabase.rpc('add_maintenance_image', {
          p_maintenance_id: maintenance.id,
          p_url: urlData.publicUrl,
          p_nome_arquivo: file.name,
          p_tipo: file.type,
          p_tamanho: file.size
        });

        if (dbError) {
          throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
        }

        return {
          id: imageData,
          maintenance_id: maintenance.id,
          url: urlData.publicUrl,
          nome_arquivo: file.name,
          tipo: file.type,
          tamanho: file.size,
          criado_em: new Date().toISOString()
        };
      });

      const newImages = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...newImages]);
    } catch (error) {
      console.error('Erro ao fazer upload das imagens:', error);
      alert('Erro ao fazer upload das imagens. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      const { error } = await supabase.rpc('remove_maintenance_image', {
        p_image_id: imageId
      });

      if (error) {
        throw new Error(`Erro ao remover imagem: ${error.message}`);
      }

      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      alert('Erro ao remover imagem. Tente novamente.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        numero_orcamento: formData.numero_orcamento || undefined,
        numero_cotacao: formData.numero_cotacao || undefined,
        numero_pedido: formData.numero_pedido || undefined,
        numero_nf: formData.numero_nf || undefined,
        nf_vencimento: formData.nf_vencimento || undefined,
        observacoes: formData.observacoes || undefined,
        imagens: images
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold">Editar Manutenção</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={saving}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
          {/* Campos de Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número do Orçamento
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.numero_orcamento}
                onChange={(e) => handleInputChange('numero_orcamento', e.target.value)}
                placeholder="Ex: ORC-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número da Cotação
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.numero_cotacao}
                onChange={(e) => handleInputChange('numero_cotacao', e.target.value)}
                placeholder="Ex: COT-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número do Pedido
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.numero_pedido}
                onChange={(e) => handleInputChange('numero_pedido', e.target.value)}
                placeholder="Ex: PED-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número da NF
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.numero_nf}
                onChange={(e) => handleInputChange('numero_nf', e.target.value)}
                placeholder="Ex: NF-2024-001"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vencimento da NF
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.nf_vencimento}
                onChange={(e) => handleInputChange('nf_vencimento', e.target.value)}
              />
            </div>
          </div>

          {/* Campo de Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Upload de Imagens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagens da Manutenção
            </label>
            
            {/* Área de Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mb-4">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <PhotoIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Clique para adicionar imagens ou arraste aqui
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, GIF até 10MB cada
              </p>
            </div>

            {/* Lista de Imagens */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={image.url}
                        alt={image.nome_arquivo}
                        fill
                        className="object-cover"
                      />
                    </div>
                    
                    {/* Overlay com informações */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg">
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="truncate" title={image.nome_arquivo}>
                          {image.nome_arquivo}
                        </div>
                        <div>{formatFileSize(image.tamanho)}</div>
                      </div>
                    </div>

                    {/* Botão de remover */}
                    <button
                      onClick={() => handleRemoveImage(image.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remover imagem"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Status de Upload */}
            {uploading && (
              <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-blue-600">Fazendo upload das imagens...</span>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceEditModal;
