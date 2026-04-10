import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MaintenanceImage } from '@/types';
import { XMarkIcon, PhotoIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface MaintenanceImageUploadProps {
  maintenanceId?: string;
  existingImages?: MaintenanceImage[];
  onImagesChange?: (images: MaintenanceImage[]) => void;
  onPendingImagesChange?: (files: File[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

const MaintenanceImageUpload: React.FC<MaintenanceImageUploadProps> = ({
  maintenanceId,
  existingImages = [],
  onImagesChange,
  onPendingImagesChange,
  maxImages = 5,
  maxSizeMB = 10
}) => {
  const [images, setImages] = useState<MaintenanceImage[]>(existingImages);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    // Verificar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP, BMP).';
    }

    // Verificar tamanho
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB.`;
    }

    return null;
  }, [maxSizeMB]);

  const uploadImage = useCallback(async (file: File): Promise<MaintenanceImage> => {
    if (!maintenanceId) {
      throw new Error('ID da manutenção é obrigatório para upload');
    }

    // Validar arquivo
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    try {
      // Gerar caminho único
      const { data: filePath, error: pathError } = await supabase.rpc('generate_maintenance_image_path', {
        maintenance_id: maintenanceId,
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
        p_maintenance_id: maintenanceId,
        p_url: urlData.publicUrl,
        p_nome_arquivo: file.name,
        p_tipo: file.type,
        p_tamanho: file.size
      });

      if (dbError) {
        throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
      }

      // Criar objeto da imagem
      const newImage: MaintenanceImage = {
        id: imageData,
        maintenance_id: maintenanceId,
        url: urlData.publicUrl,
        nome_arquivo: file.name,
        tipo: file.type,
        tamanho: file.size,
        criado_em: new Date().toISOString()
      };

      return newImage;
    } catch (error) {
      console.error('Erro no upload da imagem:', error);
      throw error;
    }
  }, [maintenanceId, validateFile]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    
    // Verificar limite de imagens
    if (images.length + pendingFiles.length + filesArray.length > maxImages) {
      alert(`Máximo de ${maxImages} imagens permitidas.`);
      return;
    }

    // Se não temos ID da manutenção, armazenar arquivos pendentes
    if (!maintenanceId) {
      const updatedPendingFiles = [...pendingFiles, ...filesArray];
      setPendingFiles(updatedPendingFiles);
      onPendingImagesChange?.(updatedPendingFiles);
      return;
    }

    // Se temos ID, fazer upload imediatamente
    setUploading(true);

    try {
      const uploadPromises = filesArray.map(file => uploadImage(file));
      const newImages = await Promise.all(uploadPromises);
      
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
    } catch (error) {
      console.error('Erro ao fazer upload das imagens:', error);
      alert('Erro ao fazer upload das imagens. Tente novamente.');
    } finally {
      setUploading(false);
    }
  }, [images, pendingFiles, maxImages, maintenanceId, uploadImage, onPendingImagesChange, onImagesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeImage = async (imageId: string) => {
    try {
      // Remover do banco de dados
      const { error } = await supabase.rpc('remove_maintenance_image', {
        p_image_id: imageId
      });

      if (error) {
        throw new Error(`Erro ao remover imagem: ${error.message}`);
      }

      // Remover da lista local
      const updatedImages = images.filter(img => img.id !== imageId);
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      alert('Erro ao remover imagem. Tente novamente.');
    }
  };

  const removePendingFile = (index: number) => {
    const updatedPendingFiles = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(updatedPendingFiles);
    onPendingImagesChange?.(updatedPendingFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Imagens da Manutenção
        </label>
        <span className="text-xs text-gray-500">
          {images.length + pendingFiles.length}/{maxImages} imagens
        </span>
      </div>

      {/* Área de Upload */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading || (images.length + pendingFiles.length) >= maxImages}
        />
        
        <div className="space-y-2">
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600 hover:text-blue-500">
              Clique para fazer upload
            </span>{' '}
            ou arraste as imagens aqui
          </div>
          <p className="text-xs text-gray-500">
            PNG, JPG, GIF até {maxSizeMB}MB cada
          </p>
        </div>
      </div>

      {/* Lista de Arquivos Pendentes */}
      {pendingFiles.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Arquivos Selecionados (serão enviados após criar a manutenção):</h4>
          <div className="max-h-32 overflow-y-auto">
            <div className="space-y-2">
              {pendingFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <PhotoIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removePendingFile(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover arquivo"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Imagens */}
      {images.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Imagens da Manutenção:</h4>
          <div className="max-h-32 overflow-y-auto">
            <div className="space-y-2">
              {images.map((image) => (
                <div key={image.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <PhotoIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={image.nome_arquivo}>
                        {image.nome_arquivo}
                      </div>
                      <div className="text-xs text-gray-500">{formatFileSize(image.tamanho)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeImage(image.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover imagem"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
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

      {/* Aviso sobre limite */}
      {(images.length + pendingFiles.length) >= maxImages && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Limite de {maxImages} imagens atingido. Remova algumas imagens para adicionar novas.
          </p>
        </div>
      )}
    </div>
  );
};

export default MaintenanceImageUpload;

