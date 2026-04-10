import React, { useState, useEffect } from 'react';
import { Maintenance, MaintenanceImage, Workshop, Vehicle } from '@/types';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, PhotoIcon, DocumentTextIcon, BuildingOfficeIcon, TruckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WorkshopSelector from '@/components/WorkshopSelector';
import { workshopService } from '@/services/workshopService';
import { vehicleService } from '@/services/vehicleService';
import { useAuth } from '@/contexts/AuthContext';

interface MaintenanceEditModalProps {
  maintenance: Maintenance;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedMaintenance: Partial<Maintenance>) => Promise<void>;
}

const MaintenanceEditModalNew: React.FC<MaintenanceEditModalProps> = ({
  maintenance,
  isOpen,
  onClose,
  onSave
}) => {
  const { userContratoIds } = useAuth();
  const [formData, setFormData] = useState({
    veiculo_id: maintenance.veiculo_id || '',
    tipo: maintenance.tipo || 'corrective',
    descricao: maintenance.descricao || '',
    prioridade: maintenance.prioridade || 'normal',
    custo_estimado: maintenance.custo_estimado?.toString() || '',
    location: maintenance.location || '',
    estimated_completion: maintenance.estimated_completion || '',
    motivo_cancelamento: maintenance.motivo_cancelamento || '',
    numero_orcamento: maintenance.numero_orcamento || '',
    numero_cotacao: maintenance.numero_cotacao || '',
    numero_pedido: maintenance.numero_pedido || '',
    numero_nf: maintenance.numero_nf || '',
    nf_vencimento: maintenance.nf_vencimento || '',
    observacoes: maintenance.observacoes || '',
    oficina_id: maintenance.oficina_id || ''
  });

  const [servicos, setServicos] = useState<Array<{ nome: string; valor?: number }>>(
    Array.isArray(maintenance.servicos) ? maintenance.servicos as Array<{ nome: string; valor?: number }> : []
  );

  const [images, setImages] = useState<MaintenanceImage[]>(maintenance.imagens || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setNfArquivo] = useState<File | null>(null);
  const [uploadingNf, setUploadingNf] = useState(false);
  const [currentNfUrl, setCurrentNfUrl] = useState<string | null>(maintenance.nf_arquivo || null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');

  // Carregar oficinas e veículos
  useEffect(() => {
    const loadData = async () => {
      setLoadingWorkshops(true);
      setLoadingVehicles(true);
      try {
        const [workshopsData, vehiclesData] = await Promise.all([
          workshopService.getAll(),
          vehicleService.getAll()
        ]);
        
        // Filtrar oficinas pelos contratos do usuário
        let workshopsFiltradas = workshopsData;
        if (userContratoIds && userContratoIds.length > 0) {
          workshopsFiltradas = workshopsData.filter(workshop => 
            workshop.contrato_id && userContratoIds.includes(workshop.contrato_id)
          );
        }
        
        setWorkshops(workshopsFiltradas);
        setVehicles(vehiclesData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoadingWorkshops(false);
        setLoadingVehicles(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, userContratoIds]);

  // Atualizar formData quando maintenance mudar
  useEffect(() => {
    setFormData({
      veiculo_id: maintenance.veiculo_id || '',
      tipo: maintenance.tipo || 'corrective',
      descricao: maintenance.descricao || '',
      prioridade: maintenance.prioridade || 'normal',
      custo_estimado: maintenance.custo_estimado?.toString() || '',
      location: maintenance.location || '',
      estimated_completion: maintenance.estimated_completion || '',
      motivo_cancelamento: maintenance.motivo_cancelamento || '',
      numero_orcamento: maintenance.numero_orcamento || '',
      numero_cotacao: maintenance.numero_cotacao || '',
      numero_pedido: maintenance.numero_pedido || '',
      numero_nf: maintenance.numero_nf || '',
      nf_vencimento: maintenance.nf_vencimento || '',
      observacoes: maintenance.observacoes || '',
      oficina_id: maintenance.oficina_id || ''
    });
    setServicos(Array.isArray(maintenance.servicos) ? maintenance.servicos as Array<{ nome: string; valor?: number }> : []);
    setImages(maintenance.imagens || []);
    setCurrentNfUrl(maintenance.nf_arquivo || null);
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

    if (!maintenance.id) {
      alert('Erro: ID da manutenção não encontrado.');
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
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

  const handleNfUpload = async (file: File) => {
    if (!maintenance.id) {
      alert('Erro: ID da manutenção não encontrado.');
      return;
    }

    setUploadingNf(true);
    try {
      // Validar arquivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Tipo de arquivo não permitido: ${file.name}`);
      }

      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSizeBytes) {
        throw new Error(`Arquivo muito grande: ${file.name}`);
      }

      // Gerar caminho único
      const { data: filePath, error: pathError } = await supabase.rpc('generate_maintenance_nf_path', {
        maintenance_id: maintenance.id,
        original_filename: file.name
      });

      if (pathError) {
        throw new Error(`Erro ao gerar caminho: ${pathError.message}`);
      }

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('manutencoes-nfs')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('manutencoes-nfs')
        .getPublicUrl(filePath);

      // Atualizar manutenção com URL da NF
      const { error: updateError } = await supabase
        .from('maintenances')
        .update({ nf_arquivo: urlData.publicUrl })
        .eq('id', maintenance.id);

      if (updateError) {
        throw new Error(`Erro ao salvar URL da NF: ${updateError.message}`);
      }

      // Atualizar formData
      setFormData(prev => ({
        ...prev,
        nf_arquivo: urlData.publicUrl
      }));

      // Atualizar estado local para mostrar NF imediatamente
      setCurrentNfUrl(urlData.publicUrl);
      setNfArquivo(null);
      alert('NF enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da NF:', error);
      alert('Erro ao fazer upload da NF. Tente novamente.');
    } finally {
      setUploadingNf(false);
    }
  };

  const handleRemoveNf = async () => {
    if (!maintenance.id) {
      alert('Erro: ID da manutenção não encontrado.');
      return;
    }

    try {
      // Remover arquivo do storage se existir
      if (maintenance.nf_arquivo) {
        const filePath = maintenance.nf_arquivo.split('/').pop();
        if (filePath) {
          await supabase.storage
            .from('manutencoes-nfs')
            .remove([filePath]);
        }
      }

      // Atualizar manutenção removendo URL da NF
      const { error: updateError } = await supabase
        .from('maintenances')
        .update({ nf_arquivo: null })
        .eq('id', maintenance.id);

      if (updateError) {
        throw new Error(`Erro ao remover NF: ${updateError.message}`);
      }

      // Atualizar formData
      setFormData(prev => ({
        ...prev,
        nf_arquivo: ''
      }));

      // Atualizar estado local para remover NF imediatamente
      setCurrentNfUrl(null);
      alert('NF removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover NF:', error);
      alert('Erro ao remover NF. Tente novamente.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvar todos os campos editáveis (exceto responsáveis e horários)
      await onSave({
        veiculo_id: formData.veiculo_id,
        tipo: formData.tipo as 'preventive' | 'corrective' | 'emergency',
        descricao: formData.descricao,
        prioridade: formData.prioridade as 'low' | 'normal' | 'high' | 'urgent' | 'baixa' | 'alta' | 'urgente',
        custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : undefined,
        servicos: servicos.length > 0 ? servicos : undefined,
        location: formData.location || undefined,
        estimated_completion: formData.estimated_completion || undefined,
        motivo_cancelamento: formData.motivo_cancelamento || undefined,
        numero_orcamento: formData.numero_orcamento || undefined,
        numero_cotacao: formData.numero_cotacao || undefined,
        numero_pedido: formData.numero_pedido || undefined,
        numero_nf: formData.numero_nf || undefined,
        nf_vencimento: formData.nf_vencimento || undefined,
        observacoes: formData.observacoes || undefined,
        oficina_id: formData.oficina_id || undefined
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 animate-in fade-in duration-300 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
              <DocumentTextIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Editar Manutenção</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 p-0 hover:bg-gray-100/80 rounded-lg"
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="flex-1 overflow-y-auto">
          <form id="editar-manutencao-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6 space-y-6">
            {/* Seleção de Veículo */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Veículo
              </Label>
              <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-xl bg-gray-50">
                {formData.veiculo_id ? (
                  <>
                    <TruckIcon className="h-5 w-5 text-gray-400" />
                    <span className="flex-1 text-sm">
                      {vehicles.find(v => v.id.toString() === formData.veiculo_id)?.placa || maintenance.veiculo?.placa || 'Veículo não encontrado'}
                      {vehicles.find(v => v.id.toString() === formData.veiculo_id) && 
                        ` - ${vehicles.find(v => v.id.toString() === formData.veiculo_id)?.modelo}`
                      }
                    </span>
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">Nenhum veículo selecionado</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVehicleSelector(!showVehicleSelector)}
                  disabled={saving || loadingVehicles}
                  className="rounded-lg"
                >
                  {formData.veiculo_id ? 'Alterar' : 'Selecionar'}
                </Button>
              </div>

              {/* Lista de veículos (dropdown simples) */}
              {showVehicleSelector && (
                <div className="border border-gray-300 rounded-xl bg-white shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
                    <Input
                      type="text"
                      placeholder="Buscar veículo por placa ou modelo..."
                      value={vehicleSearchTerm}
                      onChange={(e) => setVehicleSearchTerm(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    {vehicles
                      .filter(v => 
                        !vehicleSearchTerm || 
                        v.placa?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                        v.modelo?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                        v.marca_equipamento?.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
                      )
                      .map((vehicle) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => {
                            handleInputChange('veiculo_id', vehicle.id.toString());
                            setShowVehicleSelector(false);
                            setVehicleSearchTerm('');
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                            formData.veiculo_id === vehicle.id.toString() ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="font-medium text-sm text-gray-900">{vehicle.placa}</div>
                          <div className="text-xs text-gray-500">
                            {vehicle.marca_equipamento} {vehicle.modelo}
                          </div>
                        </button>
                      ))}
                    {vehicles.filter(v => 
                      !vehicleSearchTerm || 
                      v.placa?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                      v.modelo?.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        Nenhum veículo encontrado
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tipo de Manutenção */}
            <div className="space-y-3">
              <Label htmlFor="tipo" className="text-sm font-medium text-gray-900">
                Tipo de Manutenção
              </Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => handleInputChange('tipo', value)}
                disabled={saving}
              >
                <SelectTrigger className="h-11 rounded-xl border-gray-300">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventiva</SelectItem>
                  <SelectItem value="corrective">Corretiva</SelectItem>
                  <SelectItem value="emergency">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-3">
              <Label htmlFor="descricao" className="text-sm font-medium text-gray-900">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o problema ou serviço necessário..."
                value={formData.descricao}
                onChange={(e) => handleInputChange('descricao', e.target.value)}
                disabled={saving}
                rows={3}
                className="rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            {/* Prioridade e Custo Estimado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="prioridade" className="text-sm font-medium text-gray-900">
                  Prioridade
                </Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value) => handleInputChange('prioridade', value)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-11 rounded-xl border-gray-300">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="custo_estimado" className="text-sm font-medium text-gray-900">
                  Custo Estimado (R$)
                </Label>
                <Input
                  id="custo_estimado"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.custo_estimado}
                  onChange={(e) => handleInputChange('custo_estimado', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Localização e Data de Conclusão Estimada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="location" className="text-sm font-medium text-gray-900">
                  Localização
                </Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Ex: Oficina Central, Pátio A..."
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="estimated_completion" className="text-sm font-medium text-gray-900">
                  Conclusão Estimada
                </Label>
                <Input
                  id="estimated_completion"
                  type="date"
                  value={formData.estimated_completion}
                  onChange={(e) => handleInputChange('estimated_completion', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Motivo do Cancelamento (se aplicável) */}
            {(maintenance.status === 'cancelled' || maintenance.status === 'cancelada') && (
              <div className="space-y-3">
                <Label htmlFor="motivo_cancelamento" className="text-sm font-medium text-gray-900">
                  Motivo do Cancelamento
                </Label>
                <Textarea
                  id="motivo_cancelamento"
                  placeholder="Descreva o motivo do cancelamento..."
                  value={formData.motivo_cancelamento}
                  onChange={(e) => handleInputChange('motivo_cancelamento', e.target.value)}
                  disabled={saving}
                  rows={2}
                  className="rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            )}

            {/* Seleção de Oficina */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Oficina
              </Label>
              <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-xl bg-gray-50">
                {formData.oficina_id ? (
                  <>
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                    <span className="flex-1 text-sm">
                      {workshops.find(w => w.id === formData.oficina_id)?.nome || 'Oficina não encontrada'}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">Nenhuma oficina selecionada</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorkshopSelector(true)}
                  disabled={saving || loadingWorkshops}
                  className="rounded-lg"
                >
                  {formData.oficina_id ? 'Alterar' : 'Selecionar'}
                </Button>
              </div>
            </div>

            {/* Serviços/Itens do Orçamento */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Serviços/Itens do Orçamento
              </Label>
              <div className="border border-gray-300 rounded-xl p-4 space-y-3">
                {servicos.map((servico, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Nome do serviço/item"
                        value={servico.nome}
                        onChange={(e) => {
                          const novosServicos = [...servicos];
                          novosServicos[index].nome = e.target.value;
                          setServicos(novosServicos);
                        }}
                        disabled={saving}
                        className="h-10 rounded-lg border-gray-300"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valor (R$)"
                        value={servico.valor || ''}
                        onChange={(e) => {
                          const novosServicos = [...servicos];
                          novosServicos[index].valor = e.target.value ? parseFloat(e.target.value) : undefined;
                          setServicos(novosServicos);
                        }}
                        disabled={saving}
                        className="h-10 rounded-lg border-gray-300"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const novosServicos = servicos.filter((_, i) => i !== index);
                        setServicos(novosServicos);
                      }}
                      disabled={saving}
                      className="h-10 px-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setServicos([...servicos, { nome: '', valor: undefined }])}
                  disabled={saving}
                  className="w-full rounded-lg border-dashed"
                >
                  + Adicionar Serviço/Item
                </Button>
                {servicos.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      Total dos Serviços: R$ {servicos.reduce((acc, s) => acc + (s.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Campos de Documentos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="numero_orcamento" className="text-sm font-medium text-gray-900">
                  Número do Orçamento
                </Label>
                <Input
                  id="numero_orcamento"
                  type="text"
                  placeholder="Ex: ORC-2024-001"
                  value={formData.numero_orcamento}
                  onChange={(e) => handleInputChange('numero_orcamento', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="numero_cotacao" className="text-sm font-medium text-gray-900">
                  Número da Cotação
                </Label>
                <Input
                  id="numero_cotacao"
                  type="text"
                  placeholder="Ex: COT-2024-001"
                  value={formData.numero_cotacao}
                  onChange={(e) => handleInputChange('numero_cotacao', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="numero_pedido" className="text-sm font-medium text-gray-900">
                  Número do Pedido
                </Label>
                <Input
                  id="numero_pedido"
                  type="text"
                  placeholder="Ex: PED-2024-001"
                  value={formData.numero_pedido}
                  onChange={(e) => handleInputChange('numero_pedido', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="numero_nf" className="text-sm font-medium text-gray-900">
                  Número da NF
                </Label>
                <Input
                  id="numero_nf"
                  type="text"
                  placeholder="Ex: NF-2024-001"
                  value={formData.numero_nf}
                  onChange={(e) => handleInputChange('numero_nf', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label htmlFor="nf_vencimento" className="text-sm font-medium text-gray-900">
                  Vencimento da NF
                </Label>
                <Input
                  id="nf_vencimento"
                  type="date"
                  value={formData.nf_vencimento}
                  onChange={(e) => handleInputChange('nf_vencimento', e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Upload da NF */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Arquivo da Nota Fiscal
              </Label>
              
              {/* NF atual */}
              {currentNfUrl && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        NF atual
                      </div>
                      <a 
                        href={currentNfUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Visualizar arquivo
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveNf}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover NF"
                    disabled={saving}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Área de Upload */}
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-colors hover:border-gray-400">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNfArquivo(file);
                      handleNfUpload(file);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingNf || saving}
                />
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="text-sm text-gray-600 mb-2">
                  Clique para enviar a Nota Fiscal
                </div>
                <div className="text-xs text-gray-500">
                  PDF, JPG, PNG até 10MB
                </div>
              </div>

              {/* Status de Upload */}
              {uploadingNf && (
                <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">Enviando NF...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Campo de Observações */}
            <div className="space-y-3">
              <Label htmlFor="observacoes" className="text-sm font-medium text-gray-900">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais..."
                value={formData.observacoes}
                onChange={(e) => handleInputChange('observacoes', e.target.value)}
                disabled={saving}
                rows={3}
                className="rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            {/* Upload de Imagens */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Imagens da Manutenção
              </Label>
              
              {/* Área de Upload */}
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-colors hover:border-gray-400">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading || saving}
                />
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="text-sm text-gray-600 mb-2">
                  Clique para adicionar imagens ou arraste aqui
                </div>
                <div className="text-xs text-gray-500">
                  PNG, JPG, GIF até 10MB cada
                </div>
              </div>

              {/* Lista de Imagens */}
              {images.length > 0 && (
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
                        onClick={() => handleRemoveImage(image.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover imagem"
                        disabled={saving}
                      >
                        <XMarkIcon className="h-4 w-4" />
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
          </form>
        </div>

        {/* Footer do Modal */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200/50 bg-gray-50/50 rounded-b-3xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border-gray-300 hover:bg-gray-50/80"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="editar-manutencao-form"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 shadow-lg"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Seletor de Oficina */}
      {showWorkshopSelector && (
        <WorkshopSelector
          workshops={workshops}
          selectedWorkshopId={formData.oficina_id}
          onSelectWorkshop={(workshopId) => {
            setFormData(prev => ({ ...prev, oficina_id: workshopId }));
            setShowWorkshopSelector(false);
          }}
          onClose={() => setShowWorkshopSelector(false)}
        />
      )}
    </div>
  );
};

export default MaintenanceEditModalNew;
