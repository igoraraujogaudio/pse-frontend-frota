import React, { useRef, useState } from 'react';
import { TruckIcon, DocumentTextIcon, ArrowUpTrayIcon, CalendarIcon } from '@heroicons/react/24/outline';
import type { Vehicle } from '@/types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface VehicleDocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  tipoDocumento: string;
  documentId?: string | null;
  onUploadSuccess?: () => void;
  documentTypeLabel?: string;
}

const documentTypeLabels: { [key: string]: string } = {
  'crlv': 'CRLV',
  'acustico': 'Laudo ACÚSTICO',
  'eletrico': 'Laudo ELÉTRICO',
  'tacografo': 'Laudo TACÓGRAFO',
  'aet': 'AET',
  'fumaca': 'Laudo de FUMAÇA',
  'apolice': 'APÓLICE',
  'contrato_seguro': 'CONTRATO DE ALUGUEL'
};

const SUBTIPOS_LAUDO_ELETRICO = [
  { value: 'lanca_isolada', label: 'Lança Isolada', color: 'bg-blue-100 text-blue-800' },
  { value: 'liner', label: 'Liner', color: 'bg-green-100 text-green-800' },
  { value: 'geral', label: 'Geral', color: 'bg-gray-100 text-gray-800' }
];

export function VehicleDocumentUploadModal({
  open,
  onClose,
  vehicle,
  tipoDocumento,
  documentId,
  onUploadSuccess,
  documentTypeLabel
}: VehicleDocumentUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [subtipoLaudoEletrico, setSubtipoLaudoEletrico] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0] || !newExpirationDate) {
      alert('Selecione um arquivo e uma data de validade');
      return;
    }

    // Para laudos elétricos, verificar se subtipo foi selecionado
    if (tipoDocumento === 'eletrico' && !subtipoLaudoEletrico) {
      alert('Selecione um subtipo para o laudo elétrico');
      return;
    }

    try {
      setUploading(true);
      const file = fileInputRef.current.files[0];

      // Criar FormData para enviar para a API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('vehicleId', vehicle.id.toString());
      formData.append('tipoDocumento', tipoDocumento);
      formData.append('expiraEm', newExpirationDate);
      if (tipoDocumento === 'eletrico' && subtipoLaudoEletrico) {
        formData.append('subtipoDocumento', subtipoLaudoEletrico);
        console.log('🔍 Modal enviando subtipo:', subtipoLaudoEletrico);
      }
      if (documentId) {
        formData.append('documentId', documentId);
      }

      console.log('🔍 Modal - Dados do upload:', {
        tipoDocumento,
        subtipoLaudoEletrico,
        vehicleId: vehicle.id,
        fileName: file.name
      });

      // Enviar para a API route
      const response = await fetch('/api/vehicle-documents', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro no upload');
      }

      alert(result.message);
      if (onUploadSuccess) onUploadSuccess();
      onClose();

    } catch (error) {
      console.error('Erro detalhado no upload:', error);
      alert(`Erro ao fazer upload do arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl max-w-md w-full p-8 border border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold focus:outline-none"
          aria-label="Fechar"
        >
          ×
        </button>
        <div className="mb-6 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-blue-700 text-base font-semibold">
            <TruckIcon className="h-5 w-5" />
            {vehicle?.placa}
            <span className="text-gray-400">•</span>
            <span className="text-gray-700 font-normal">{vehicle?.modelo} {vehicle?.tipo_modelo ? `- ${vehicle.tipo_modelo}` : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700 text-sm mt-1">
            <DocumentTextIcon className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{documentTypeLabel || documentTypeLabels[tipoDocumento] || tipoDocumento}</span>
          </div>
        </div>
        <div className="mb-4 flex justify-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100">
            <ArrowUpTrayIcon className="h-7 w-7 text-blue-600" />
          </div>
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center">{documentId ? 'Atualizar Documento' : 'Cadastrar Documento'}</h3>
        <p className="text-gray-500 text-sm mb-6 text-center">Selecione um arquivo PDF e defina a data de validade do laudo.</p>
        <form className="space-y-5" onSubmit={handleUpload}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF</label>
            <input
              type="file"
              ref={fileInputRef}
              className="block w-full text-sm text-gray-700 bg-white/70 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
              accept=".pdf"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
            <div className="flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 transition">
              <CalendarIcon className="h-5 w-5 text-blue-500" />
              <input
                type="date"
                value={newExpirationDate}
                onChange={e => setNewExpirationDate(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-gray-700 text-sm placeholder-gray-400"
                required
              />
            </div>
          </div>
          {tipoDocumento === 'eletrico' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtipo do Laudo Elétrico *
              </label>
              <Select value={subtipoLaudoEletrico} onValueChange={setSubtipoLaudoEletrico}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o subtipo do laudo elétrico" />
                </SelectTrigger>
                <SelectContent>
                  {SUBTIPOS_LAUDO_ELETRICO.map((subtipo) => (
                    <SelectItem key={subtipo.value} value={subtipo.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={subtipo.color}>{subtipo.label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Para veículos como cestos duplos, você pode ter múltiplos laudos elétricos com diferentes tipos e datas de vencimento.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-sm font-medium text-gray-700 bg-white/80 border border-gray-300 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            >
              {uploading ? 'Enviando...' : (documentId ? 'Atualizar' : 'Cadastrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 