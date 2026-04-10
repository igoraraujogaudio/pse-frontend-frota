'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, X, FileText, Image, AlertCircle } from 'lucide-react';

interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  signedUrl?: string;
}

interface FileUploadComponentProps {
  orderId: string;
  fileType: 'damage' | 'document';
  title: string;
  description: string;
  existingFiles?: FileInfo[];
  onFilesChange?: (files: FileInfo[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  orderId,
  fileType,
  title,
  description,
  existingFiles = [],
  onFilesChange,
  maxFiles = 10,
  disabled = false
}) => {
  const [files, setFiles] = useState<FileInfo[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bucketName = fileType === 'damage' ? 'discount-orders-damages' : 'discount-orders-documents';
  
  const allowedTypes = useMemo(() => fileType === 'damage' 
    ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], [fileType]);

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `Tipo de arquivo não permitido: ${file.type}`;
    }
    if (file.size > 52428800) { // 50MB
      return 'Arquivo muito grande. Máximo: 50MB';
    }
    return null;
  }, [allowedTypes]);

  const uploadFile = useCallback(async (file: File): Promise<FileInfo> => {
    console.log('Iniciando upload do arquivo:', file.name);
    
    try {
      // 1. Gerar caminho único
      console.log('Gerando caminho único para:', file.name);
      const { data: filePath, error: pathError } = await supabase.rpc('generate_discount_order_file_path', {
        order_id: orderId,
        file_type: fileType,
        original_filename: file.name
      });

      if (pathError) {
        console.error('Erro ao gerar caminho:', pathError);
        throw new Error(`Erro ao gerar caminho: ${pathError.message}`);
      }

      console.log('Caminho gerado:', filePath);

      // 2. Upload para storage
      console.log('Fazendo upload para storage, bucket:', bucketName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erro no upload para storage:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      console.log('Upload para storage concluído:', uploadData);

      // 3. Criar informação do arquivo
      const fileInfo: FileInfo = {
        name: file.name,
        url: uploadData.path,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString()
      };

      console.log('Informações do arquivo criadas:', fileInfo);

      // 4. Adicionar à ordem no banco
      console.log('Adicionando arquivo ao banco de dados');
      const { error: dbError } = await supabase.rpc('add_file_to_discount_order', {
        order_id: orderId,
        file_type: fileType,
        file_info: fileInfo
      });

      if (dbError) {
        console.error('Erro ao salvar no banco:', dbError);
        throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
      }

      console.log('Arquivo adicionado ao banco com sucesso');
      return fileInfo;
    } catch (error) {
      console.error('Erro completo no upload:', error);
      throw error;
    }
  }, [orderId, fileType, bucketName]);

  const handleFileSelect = useCallback(async (selectedFiles: FileList) => {
    console.log('handleFileSelect chamado com:', selectedFiles.length, 'arquivos');
    if (disabled) {
      console.log('Componente desabilitado, retornando');
      return;
    }
    
    setError(null);
    setUploading(true);

    try {
      const filesToUpload = Array.from(selectedFiles);
      console.log('Arquivos para upload:', filesToUpload.map(f => ({ name: f.name, size: f.size, type: f.type })));
      
      // Validar limite de arquivos
      if (files.length + filesToUpload.length > maxFiles) {
        throw new Error(`Máximo de ${maxFiles} arquivos permitidos`);
      }

      // Validar cada arquivo
      for (const file of filesToUpload) {
        const validationError = validateFile(file);
        if (validationError) {
          throw new Error(validationError);
        }
      }

      console.log('Iniciando upload de', filesToUpload.length, 'arquivos');
      // Upload dos arquivos
      const uploadPromises = filesToUpload.map(uploadFile);
      const uploadedFiles = await Promise.all(uploadPromises);

      console.log('Upload concluído:', uploadedFiles);
      // Atualizar estado
      const newFiles = [...files, ...uploadedFiles];
      setFiles(newFiles);
      onFilesChange?.(newFiles);

    } catch (err) {
      console.error('Erro no upload:', err);
      setError(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }, [files, maxFiles, disabled, onFilesChange, uploadFile, validateFile]);

  const handleRemoveFile = async (fileToRemove: FileInfo) => {
    if (disabled) return;

    try {
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([fileToRemove.url]);

      if (storageError) throw new Error(`Erro ao remover do storage: ${storageError.message}`);

      // Remover do banco
      const { error: dbError } = await supabase.rpc('remove_file_from_discount_order', {
        order_id: orderId,
        file_type: fileType,
        file_url: fileToRemove.url
      });

      if (dbError) throw new Error(`Erro ao remover do banco: ${dbError.message}`);

      // Atualizar estado
      const newFiles = files.filter(f => f.url !== fileToRemove.url);
      setFiles(newFiles);
      onFilesChange?.(newFiles);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover arquivo');
    }
  };

  const getSignedUrl = async (file: FileInfo): Promise<string> => {
    if (file.signedUrl) return file.signedUrl;

    const { data: signedUrl, error } = await supabase.rpc('get_discount_order_file_url', {
      bucket_name: bucketName,
      file_path: file.url,
      expires_in: 3600
    });

    if (error) throw new Error(`Erro ao gerar URL: ${error.message}`);
    return signedUrl;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" aria-label="Imagem" />;
    return <FileText className="w-4 h-4" aria-label="Documento" />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
          disabled || uploading 
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
            : 'border-gray-300 bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm'
        }`}
        onClick={() => {
          if (!disabled && !uploading) {
            document.getElementById(`file-upload-${fileType}`)?.click();
          }
        }}
      >
        <div className="text-center">
          <Upload className={`mx-auto h-12 w-12 ${
            disabled || uploading ? 'text-gray-300' : 'text-gray-400'
          }`} />
          <div className="mt-4">
            <span className={`mt-2 block text-sm font-medium ${
              disabled || uploading ? 'text-gray-400' : 'text-gray-900'
            }`}>
              {uploading ? 'Enviando...' : 'Clique para selecionar arquivos'}
            </span>
            <span className={`mt-1 block text-xs ${
              disabled || uploading ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {fileType === 'damage' ? 'JPG, PNG, WebP, PDF' : 'JPG, PNG, WebP, PDF, DOC, DOCX'} até 50MB
            </span>
            {!disabled && !uploading && (
              <span className="mt-2 block text-xs text-blue-600 font-medium">
                Clique em qualquer lugar desta área
              </span>
            )}
          </div>
        </div>
        <input
          id={`file-upload-${fileType}`}
          name={`file-upload-${fileType}`}
          type="file"
          className="sr-only"
          multiple
          accept={allowedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          disabled={disabled || uploading}
        />
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Arquivos ({files.length}/{maxFiles})
          </h4>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file.type)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      try {
                        const url = await getSignedUrl(file);
                        window.open(url, '_blank');
                      } catch {
                        setError('Erro ao abrir arquivo');
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Ver
                  </button>
                  {!disabled && (
                    <button
                      onClick={() => handleRemoveFile(file)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadComponent;