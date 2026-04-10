'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  PlusIcon, 
  QrCodeIcon,
  TrashIcon,
  TruckIcon,
  PencilIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { CarroParticular, CarroParticularForm } from '@/types/carro-particular';
import { carrosParticularesService } from '@/services/carrosParticularesService';
import { supabase } from '@/lib/supabase';
import { SelectFuncionario } from '@/components/ui/SelectFuncionario';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useAuth } from '@/contexts/AuthContext';

export function CarrosParticularesContent() {
  const { hasPermission } = useModularPermissions();
  const { user, loading: authLoading } = useAuth();
  const [carros, setCarros] = useState<CarroParticular[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [carroSelecionado, setCarroSelecionado] = useState<CarroParticular | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [formData, setFormData] = useState<CarroParticularForm>({
    placa: '',
    funcionario_id: ''
  });

  // Verificar se o usuário tem permissão para gerenciar carros particulares
  const canManageCars = hasPermission(PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA);

  // Helper function to get auth headers
  const getAuthHeaders = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Erro ao obter sessão:', error);
        throw error;
      }
      
      if (!session) {
        console.error('Nenhuma sessão encontrada');
        throw new Error('Nenhuma sessão encontrada');
      }
      
      if (!session.access_token) {
        console.error('Token de acesso não encontrado na sessão');
        throw new Error('Token de acesso não encontrado');
      }
      
      console.log('Sessão obtida com sucesso:', { 
        hasToken: !!session.access_token,
        tokenLength: session.access_token?.length 
      });
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
      
      return headers;
    } catch (error) {
      console.error('Erro ao obter headers de autenticação:', error);
      throw error;
    }
  }, []);

  // Carregar carros do funcionário
  const carregarCarros = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Iniciando carregamento de carros...');
      
      const headers = await getAuthHeaders();
      console.log('Headers obtidos:', { 
        hasAuth: !!headers.Authorization,
        authLength: headers.Authorization?.length 
      });
      
      const response = await fetch('/api/carros-particulares', {
        headers
      });
      
      console.log('Resposta da API:', { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });
      
      const data = await response.json();
      console.log('Dados recebidos:', data);
      
      if (response.ok) {
        setCarros(data.carros);
        console.log('Carros carregados com sucesso:', data.carros?.length);
      } else {
        console.error('Erro na resposta da API:', data);
        toast.error(data.error || 'Erro ao carregar carros');
      }
    } catch (error) {
      console.error('Erro ao carregar carros:', error);
      toast.error('Erro ao carregar carros');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (user) {
      carregarCarros();
    }
  }, [user, carregarCarros]);

  // Abrir dialog para cadastrar novo carro
  const handleNovoCarro = () => {
    setFormData({ placa: '', funcionario_id: '' });
    setIsEditing(false);
    setCarroSelecionado(null);
    setShowDialog(true);
  };

  // Abrir dialog para editar carro
  const handleEditarCarro = (carro: CarroParticular) => {
    setFormData({ 
      placa: carro.placa, 
      funcionario_id: carro.funcionario_id 
    });
    setIsEditing(true);
    setCarroSelecionado(carro);
    setShowDialog(true);
  };

  // Salvar carro (criar ou editar)
  const handleSalvar = async () => {
    if (!formData.placa.trim()) {
      toast.error('Placa é obrigatória');
      return;
    }

    if (!formData.funcionario_id) {
      toast.error('Funcionário é obrigatório');
      return;
    }

    if (!carrosParticularesService.validarPlaca(formData.placa)) {
      toast.error('Formato de placa inválido');
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const url = isEditing 
        ? `/api/carros-particulares/${carroSelecionado?.id}`
        : '/api/carros-particulares';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          placa: carrosParticularesService.formatarPlaca(formData.placa),
          funcionario_id: formData.funcionario_id
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(isEditing ? 'Carro atualizado com sucesso!' : 'Carro cadastrado com sucesso!');
        setFormData({ placa: '', funcionario_id: '' });
        setShowDialog(false);
        setIsEditing(false);
        setCarroSelecionado(null);
        carregarCarros();
      } else {
        toast.error(data.error || `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} carro`);
      }
    } catch (error) {
      console.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} carro:`, error);
      toast.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} carro`);
    }
  };

  // Função para gerar QR code com placa sobreposta (igual à página de QR generator)
  const generateQRCodeWithPlate = async (data: string, placa: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Iniciando geração de QR code com placa: ${placa}`)
        
        // Primeiro, gerar o QR code base usando a biblioteca qrcode
        QRCode.toDataURL(data, {
          width: 500,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }, (error, qrDataUrl) => {
          if (error) {
            console.error('Erro ao gerar QR code base:', error)
            reject(error)
            return
          }

          if (!qrDataUrl || !qrDataUrl.startsWith('data:image/png')) {
            console.error('QR code base inválido gerado:', qrDataUrl)
            reject(new Error('QR code base inválido'))
            return
          }

          console.log('QR code base gerado, criando canvas para adicionar placa...')

          // Criar uma nova imagem com o QR code
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          
          // Criar uma nova imagem para o logo PSE
          const logoImg = new window.Image()
          logoImg.crossOrigin = 'anonymous'
          
          let qrCodeLoaded = false
          let logoLoaded = false
          
          const processCanvas = () => {
            if (!qrCodeLoaded || !logoLoaded) return
            
            try {
              // Criar canvas para desenhar o QR code com a placa e logo
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                reject(new Error('Não foi possível obter contexto do canvas'))
                return
              }

              // Configurar dimensões do canvas com proporção 3:4 para área de corte
              const canvasWidth = 600  // 3 unidades
              const canvasHeight = 800 // 4 unidades (proporção 3:4)
              const qrSize = 500
              const logoHeight = 140
              const plateHeight = 160
              
              canvas.width = canvasWidth
              canvas.height = canvasHeight
              
              console.log(`Canvas criado com proporção 3:4: ${canvas.width}x${canvas.height}`)

              // Preencher todo o canvas com branco
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, canvasWidth, canvasHeight)

              // Calcular posições centralizadas
              const marginX = (canvasWidth - qrSize) / 2 // Margem horizontal para centralizar
              
              // Adicionar borda separadora superior
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(marginX, logoHeight)
              ctx.lineTo(marginX + qrSize, logoHeight)
              ctx.stroke()

              // Adicionar o logo PSE centralizado acima do QR code
              const logoWidth = 260 // Largura do logo (aumentada em 30%: 200 + 60)
              const logoHeight_img = 110 // Altura do logo ajustada
              const logoX = (canvasWidth - logoWidth) / 2
              const logoY = (logoHeight - logoHeight_img) / 2
              
              // Desenhar o logo
              ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight_img)
              
              console.log(`Logo PSE adicionado acima do QR code (${logoWidth}x${logoHeight_img})`)

              // Desenhar o QR code no canvas (centralizado horizontalmente, abaixo do logo)
              ctx.drawImage(img, marginX, logoHeight, qrSize, qrSize)

              // Adicionar borda separadora inferior
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(marginX, logoHeight + qrSize)
              ctx.lineTo(marginX + qrSize, logoHeight + qrSize)
              ctx.stroke()

              // Adicionar a PLACA (não o modelo) em negrito e caixa alta
              ctx.fillStyle = '#000000'
              ctx.font = 'bold 90px Arial, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              
              // Centralizar a PLACA na área designada
              const plateY = logoHeight + qrSize + (plateHeight / 2)
              ctx.fillText(placa.toUpperCase(), canvasWidth / 2, plateY)
              
              console.log(`Placa "${placa.toUpperCase()}" adicionada ao canvas`)

              // Adicionar borda de corte 3x4 ao redor do canvas
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 3
              ctx.strokeRect(0, 0, canvasWidth, canvasHeight)
              
              // Adicionar marcas de corte nos cantos (opcional)
              const markLength = 20
              ctx.lineWidth = 2
              // Canto superior esquerdo
              ctx.beginPath()
              ctx.moveTo(0, markLength)
              ctx.lineTo(0, 0)
              ctx.lineTo(markLength, 0)
              ctx.stroke()
              // Canto superior direito
              ctx.beginPath()
              ctx.moveTo(canvasWidth - markLength, 0)
              ctx.lineTo(canvasWidth, 0)
              ctx.lineTo(canvasWidth, markLength)
              ctx.stroke()
              // Canto inferior esquerdo
              ctx.beginPath()
              ctx.moveTo(0, canvasHeight - markLength)
              ctx.lineTo(0, canvasHeight)
              ctx.lineTo(markLength, canvasHeight)
              ctx.stroke()
              // Canto inferior direito
              ctx.beginPath()
              ctx.moveTo(canvasWidth - markLength, canvasHeight)
              ctx.lineTo(canvasWidth, canvasHeight)
              ctx.lineTo(canvasWidth, canvasHeight - markLength)
              ctx.stroke()
              
              console.log('Borda de corte 3x4 e marcas de corte adicionadas')

              // Converter canvas para data URL
              const dataUrl = canvas.toDataURL('image/png')
              console.log(`Canvas convertido para data URL, tamanho: ${dataUrl.length}`)
              console.log(`Data URL válida: ${dataUrl.startsWith('data:image/png')}`)
              
              if (dataUrl && dataUrl.startsWith('data:image/png')) {
                resolve(dataUrl)
              } else {
                reject(new Error('Falha ao converter canvas para data URL'))
              }
            } catch (canvasError) {
              console.error('Erro ao processar canvas:', canvasError)
              reject(canvasError)
            }
          }

          img.onload = () => {
            console.log('QR code carregado com sucesso')
            qrCodeLoaded = true
            processCanvas()
          }

          img.onerror = (imgError: string | Event) => {
            console.error('Erro ao carregar imagem do QR code:', imgError)
            reject(new Error('Falha ao carregar imagem do QR code'))
          }

          logoImg.onload = () => {
            console.log('Logo PSE carregado com sucesso')
            logoLoaded = true
            processCanvas()
          }

          logoImg.onerror = (logoError: string | Event) => {
            console.error('Erro ao carregar logo PSE:', logoError)
            // Se falhar ao carregar o logo, continuar sem ele
            console.log('Continuando sem o logo PSE...')
            logoLoaded = true
            processCanvas()
          }

          // Definir as fontes das imagens
          img.src = qrDataUrl
          logoImg.src = '/logo_pse.png'
        })
      } catch (error) {
        console.error('Erro na função generateQRCodeWithPlate:', error)
        reject(error)
      }
    })
  }

  // Gerar QR code
  const handleGerarQR = async (carro: CarroParticular) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/carros-particulares/${carro.id}/qr-code`, {
        headers
      });
      const data = await response.json();

      if (response.ok) {
        setQrCodeData(data.qr_data);
        
        // Gerar QR code com logo e placa usando a função local
        const qrCodeWithPlate = await generateQRCodeWithPlate(data.qr_data, carro.placa);
        setQrCodeImage(qrCodeWithPlate);
        
        setCarroSelecionado(carro);
        setShowQRDialog(true);
      } else {
        toast.error(data.error || 'Erro ao gerar QR code');
      }
    } catch (error) {
      console.error('Erro ao gerar QR code:', error);
      toast.error('Erro ao gerar QR code');
    }
  };

  // Desativar carro
  const handleDesativar = async (carro: CarroParticular) => {
    if (!confirm(`Tem certeza que deseja desativar o carro ${carro.placa}?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/carros-particulares/${carro.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        toast.success('Carro desativado com sucesso!');
        carregarCarros();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao desativar carro');
      }
    } catch (error) {
      console.error('Erro ao desativar carro:', error);
      toast.error('Erro ao desativar carro');
    }
  };

  // Copiar QR code para clipboard
  const copiarQRCode = () => {
    navigator.clipboard.writeText(qrCodeData);
    toast.success('Código QR copiado para a área de transferência!');
  };

  // Baixar imagem do QR code
  const baixarQRCode = () => {
    if (qrCodeImage && carroSelecionado) {
      const link = document.createElement('a');
      link.download = `qr-code-${carroSelecionado.placa}-${Date.now()}.png`;
      link.href = qrCodeImage;
      link.click();
      toast.success('Imagem do QR code baixada com sucesso!');
    }
  };

  // Gerar QR codes em bulk para todos os carros
  const handleGerarBulkQRCodes = async () => {
    if (carros.length === 0) {
      toast.error('Nenhum carro encontrado para gerar QR codes');
      return;
    }

    try {
      setGeneratingBulk(true);
      setBulkProgress(0);
      
      const qrCodes: Array<{
        carro: CarroParticular;
        qrData: string;
        qrImage: string;
      }> = [];

      for (let i = 0; i < carros.length; i++) {
        const carro = carros[i];
        
        try {
          // Gerar dados do QR code
          const qrData = `PRIVATE:${carro.placa}:${carro.id}`;
          
          // Gerar QR code com logo e placa
          const qrImage = await generateQRCodeWithPlate(qrData, carro.placa);
          
          qrCodes.push({
            carro,
            qrData,
            qrImage
          });
          
          // Atualizar progresso
          const progress = Math.round(((i + 1) / carros.length) * 100);
          setBulkProgress(progress);
          
        } catch (error) {
          console.error(`Erro ao gerar QR code para ${carro.placa}:`, error);
          toast.error(`Erro ao gerar QR code para ${carro.placa}`);
        }
      }

      if (qrCodes.length > 0) {
        // Baixar todos os QR codes como ZIP
        await downloadBulkQRCodes(qrCodes);
        toast.success(`${qrCodes.length} QR codes gerados e baixados com sucesso!`);
      } else {
        toast.error('Nenhum QR code foi gerado com sucesso');
      }
      
    } catch (error) {
      console.error('Erro ao gerar QR codes em bulk:', error);
      toast.error('Erro ao gerar QR codes em bulk');
    } finally {
      setGeneratingBulk(false);
      setBulkProgress(0);
    }
  };

  // Baixar QR codes em bulk como ZIP
  const downloadBulkQRCodes = async (qrCodes: Array<{
    carro: CarroParticular;
    qrData: string;
    qrImage: string;
  }>) => {
    try {
      // Importar JSZip dinamicamente
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Adicionar cada QR code ao ZIP
      qrCodes.forEach(({ carro, qrImage }) => {
        // Converter data URL para blob
        const base64Data = qrImage.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        // Adicionar ao ZIP
        zip.file(`qr-code-${carro.placa}.png`, bytes);
      });

      // Gerar e baixar o ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `qr-codes-carros-particulares-${Date.now()}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      
      // Limpar URL
      setTimeout(() => URL.revokeObjectURL(link.href), 100);
      
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error);
      throw error;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>{authLoading ? 'Verificando autenticação...' : 'Carregando carros...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se o usuário tem permissão para acessar a página
  if (!canManageCars) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">
              Você não tem permissão para gerenciar carros particulares.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Entre em contato com o administrador para solicitar acesso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Carros Particulares</h1>
          <p className="text-gray-600 mt-2">
            Gerencie quais carros particulares pertencem a quais funcionários
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleGerarBulkQRCodes} 
            disabled={generatingBulk || carros.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            {generatingBulk ? `Gerando... ${bulkProgress}%` : 'Gerar QR Codes'}
          </Button>
          <Button onClick={handleNovoCarro} className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Cadastrar Carro
          </Button>
        </div>
      </div>

      {/* Lista de carros */}
      {carros.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <TruckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum carro cadastrado
            </h3>
            <p className="text-gray-600 mb-4">
              Cadastre seu primeiro carro particular para gerar QR codes de acesso
            </p>
            <Button onClick={handleNovoCarro}>
              Cadastrar Primeiro Carro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {carros.map((carro) => (
            <Card key={carro.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{carro.placa}</CardTitle>
                    <CardDescription>
                      {carro.funcionario ? (
                        <div>
                          <div className="font-medium">{carro.funcionario.nome}</div>
                          <div className="text-sm text-gray-500">
                            {carro.funcionario.matricula} • {carro.funcionario.email}
                          </div>
                        </div>
                      ) : (
                        'Funcionário não vinculado'
                      )}
                    </CardDescription>
                    <div className="text-xs text-gray-400 mt-1">
                      Cadastrado em {new Date(carro.criado_em).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="secondary">Ativo</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGerarQR(carro)}
                    className="flex-1"
                  >
                    <QrCodeIcon className="h-4 w-4 mr-2" />
                    QR Code
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditarCarro(carro)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDesativar(carro)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para cadastrar/editar carro */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Carro Particular' : 'Cadastrar Carro Particular'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize as informações do carro' 
                : 'Informe a placa e o funcionário para cadastrar o carro no sistema'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="placa">Placa do Veículo</Label>
              <Input
                id="placa"
                placeholder="Ex: ABC1234"
                value={formData.placa}
                onChange={(e) => setFormData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                maxLength={7}
              />
              <p className="text-sm text-gray-500 mt-1">
                Formato: ABC1234 ou ABC1D23
              </p>
            </div>
            <SelectFuncionario
              value={formData.funcionario_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, funcionario_id: value }))}
              placeholder="Selecione o funcionário responsável pelo carro"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar}>
              {isEditing ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para exibir QR code */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {carroSelecionado?.placa}</DialogTitle>
            <DialogDescription>
              Use este QR code na portaria para controle de acesso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrCodeImage && (
              <div className="text-center">
                <Image 
                  src={qrCodeImage} 
                  alt={`QR Code ${carroSelecionado?.placa}`}
                  width={300}
                  height={300}
                  className="mx-auto max-w-[300px] h-auto rounded-lg border"
                />
              </div>
            )}
            <div className="text-center">
              <div className="bg-gray-100 p-4 rounded-lg mb-4">
                <p className="font-mono text-sm break-all">{qrCodeData}</p>
              </div>
              <p className="text-sm text-gray-600">
                Formato: PRIVATE:PLACA:ID
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={copiarQRCode}>
              Copiar Código
            </Button>
            {qrCodeImage && (
              <Button variant="outline" onClick={baixarQRCode}>
                Baixar Imagem
              </Button>
            )}
            <Button onClick={() => setShowQRDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

