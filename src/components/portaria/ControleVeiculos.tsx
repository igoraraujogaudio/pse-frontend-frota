'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CarIcon, QrCodeIcon, AlertTriangleIcon, CheckIcon, ArrowRightIcon, ArrowLeftIcon } from 'lucide-react';
import QRScanner from './QRScanner';

interface VeiculoPortaria {
  id: string;
  placa: string;
  modelo: string;
  marca?: string;
  tipo: 'frota' | 'particular';
  status?: 'entrada' | 'saida' | 'em_uso' | 'disponivel'; // Para veículos da frota
  proxima_acao?: 'entrada' | 'saida'; // Para carros particulares
  quilometragem_atual: number;
  ultima_quilometragem?: number;
}

interface AlertaVeiculo {
  id: string;
  tipo: string;
  descricao: string;
  vencimento?: string;
  severidade: 'alta' | 'media';
}

interface ControleVeiculosState {
  step: 'inicial' | 'quilometragem' | 'confirmacao';
  veiculo: VeiculoPortaria | null;
  acao: 'entrada' | 'saida' | null;
  quilometragem: string;
  observacoes: string;
  alertas: AlertaVeiculo[];
  bloqueioChecklist: {
    bloqueado: boolean;
    motivo: string | null;
    tipo_bloqueio: string | null;
  } | null;
}

// Função para obter todos os tipos de documentos (sem restrições)
function getFilteredDocumentTypes() {
  // Retornar todos os tipos de documentos, incluindo apólices e contratos de aluguel
  return ['crlv', 'tacografo', 'fumaca', 'eletrico', 'acustico', 'aet', 'apolice', 'contrato_seguro'];
}

export default function ControleVeiculos() {
  const [state, setState] = useState<ControleVeiculosState>({
    step: 'inicial',
    veiculo: null,
    acao: null,
    quilometragem: '',
    observacoes: '',
    alertas: [],
    bloqueioChecklist: null
  });
  
  const [scannerActive, setScannerActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVeiculoScan = async (qrData: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/portaria/veiculo/qr/${qrData}`);
      const data = await response.json();
      
      if (data.error) {
        alert('Veículo não encontrado');
        return;
      }

      // Determinar ação baseada no tipo de veículo
      let acao: 'entrada' | 'saida';
      
      if (data.veiculo.tipo === 'frota') {
        // Para veículos da frota, usar o status
        acao = data.veiculo.status === 'em_uso' ? 'entrada' : 'saida';
      } else {
        // Para carros particulares, usar a próxima ação sugerida pela função do banco
        acao = data.veiculo.proxima_acao || 'entrada';
      }

      // Filtrar alertas baseado no nível de acesso (por padrão, apenas tipos básicos)
      const allowedDocumentTypes = getFilteredDocumentTypes();
      const filteredAlertas = data.alertas?.filter((alerta: AlertaVeiculo) => {
        // Verificar se o tipo do documento está na lista permitida
        const documentType = alerta.descricao.split(' ')[0].toLowerCase();
        return allowedDocumentTypes.includes(documentType);
      }) || [];

      // Verificar bloqueio por checklist (apenas para veículos da frota)
      let bloqueioChecklist = null;
      if (data.veiculo.tipo === 'frota' && data.veiculo.id) {
        try {
          const bloqueioResponse = await fetch(`/api/portaria/veiculo/${data.veiculo.id}/bloqueio-checklist`);
          if (bloqueioResponse.ok) {
            const bloqueioData = await bloqueioResponse.json();
            bloqueioChecklist = bloqueioData;
          }
        } catch (error) {
          console.error('Erro ao verificar bloqueio:', error);
        }
      }

      setState(prev => ({
        ...prev,
        veiculo: data.veiculo,
        acao,
        alertas: filteredAlertas,
        bloqueioChecklist,
        step: 'quilometragem'
      }));
      setScannerActive(false);
    } catch {
      alert('Erro ao buscar veículo');
    } finally {
      setLoading(false);
    }
  };

  const handleProximoPasso = () => {
    if (!state.quilometragem.trim()) {
      alert('Por favor, informe a quilometragem');
      return;
    }

    // Verificar bloqueio antes de permitir saída
    if (state.acao === 'saida' && state.bloqueioChecklist?.bloqueado) {
      alert(`Veículo bloqueado para saída: ${state.bloqueioChecklist.motivo || 'Checklist não realizado ou rejeitado'}`);
      return;
    }

    setState(prev => ({ ...prev, step: 'confirmacao' }));
  };

  const handleConfirmar = async () => {
    // Verificar bloqueio novamente antes de confirmar saída
    if (state.acao === 'saida' && state.veiculo?.tipo === 'frota' && state.veiculo.id) {
      try {
        const bloqueioResponse = await fetch(`/api/portaria/veiculo/${state.veiculo.id}/bloqueio-checklist`);
        if (bloqueioResponse.ok) {
          const bloqueioData = await bloqueioResponse.json();
          if (bloqueioData.bloqueado) {
            alert(`Veículo bloqueado para saída: ${bloqueioData.motivo || 'Checklist não realizado ou rejeitado'}`);
            return;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar bloqueio:', error);
      }
    }

    setLoading(true);
    try {
      // Determinar qual campo usar baseado no tipo de veículo
      const movimentacaoData = {
        acao: state.acao,
        quilometragem: parseInt(state.quilometragem),
        observacoes: state.observacoes
      };

      // Adicionar o ID correto baseado no tipo de veículo
      if (state.veiculo?.tipo === 'particular') {
        (movimentacaoData as Record<string, unknown>).carro_particular_id = state.veiculo.id;
      } else {
        (movimentacaoData as Record<string, unknown>).veiculo_id = state.veiculo?.id;
      }

      const response = await fetch('/api/portaria/veiculos/movimentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movimentacaoData)
      });

      if (response.ok) {
        alert(`${state.acao === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
        resetState();
      } else {
        alert('Erro ao processar movimentação');
      }
    } catch {
      alert('Erro ao processar movimentação');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setState({
      step: 'inicial',
      veiculo: null,
      acao: null,
      quilometragem: '',
      observacoes: '',
      alertas: [],
      bloqueioChecklist: null
    });
    setScannerActive(false);
  };

  const getAcaoIcon = (acao: string) => {
    return acao === 'entrada' ? <ArrowLeftIcon className="h-4 w-4" /> : <ArrowRightIcon className="h-4 w-4" />;
  };

  const getAcaoColor = (acao: string) => {
    return acao === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-6">
      {/* Scanner QR */}
      {scannerActive && (
        <QRScanner
          isActive={true}
          onClose={() => setScannerActive(false)}
          onScan={handleVeiculoScan}
          title="Ler QR do Veículo"
          placeholder="Placa do veículo"
        />
      )}

      {/* Estado Inicial */}
      {state.step === 'inicial' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarIcon className="h-5 w-5" />
              Controle de Entrada/Saída
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Leia o QR Code do veículo para registrar entrada ou saída
            </p>
            <Button 
              onClick={() => setScannerActive(true)}
              className="w-full"
              size="lg"
            >
              <QrCodeIcon className="h-5 w-5 mr-2" />
              Ler QR do Veículo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quilometragem */}
      {state.step === 'quilometragem' && state.veiculo && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CarIcon className="h-5 w-5" />
                Veículo Identificado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold">{state.veiculo.placa}</p>
                  <p className="text-gray-600">{state.veiculo.modelo} - {state.veiculo.marca}</p>
                </div>
                <Badge className={getAcaoColor(state.acao!)}>
                  {getAcaoIcon(state.acao!)}
                  {state.acao === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                </Badge>
              </div>

              {/* Alerta de Bloqueio por Checklist */}
              {state.bloqueioChecklist?.bloqueado && state.acao === 'saida' && (
                <Alert className="border-red-200 bg-red-50 mb-4">
                  <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>🚫 Veículo Bloqueado para Saída</strong>
                    <p className="mt-1">{state.bloqueioChecklist.motivo}</p>
                    <p className="text-sm mt-2">
                      {state.bloqueioChecklist.tipo_bloqueio === 'sem_checklist' 
                        ? 'Realize o checklist veicular antes de liberar o veículo.'
                        : 'O checklist foi rejeitado. Verifique e libere o checklist antes de permitir a saída.'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Alertas de Laudos */}
              {state.alertas.length > 0 && (
                <div className="space-y-2 mb-4">
                  {state.alertas.map((alerta, index) => (
                    <Alert key={index} className="border-orange-200 bg-orange-50">
                      <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>{alerta.tipo}:</strong> {alerta.descricao}
                        {alerta.vencimento && (
                          <span className="block text-sm">
                            Vencimento: {new Date(alerta.vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações da Movimentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="quilometragem">Quilometragem Atual *</Label>
                <Input
                  id="quilometragem"
                  type="number"
                  value={state.quilometragem}
                  onChange={(e) => setState(prev => ({ ...prev, quilometragem: e.target.value }))}
                  placeholder="Digite a quilometragem atual"
                  className="text-lg"
                />
                {state.veiculo.ultima_quilometragem && (
                  <p className="text-sm text-gray-600 mt-1">
                    Última quilometragem registrada: {state.veiculo.ultima_quilometragem.toLocaleString()} km
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="observacoes">Observações (opcional)</Label>
                <Input
                  id="observacoes"
                  value={state.observacoes}
                  onChange={(e) => setState(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações sobre o veículo ou movimentação..."
                />
              </div>

              <Button 
                onClick={handleProximoPasso}
                className="w-full"
                disabled={!state.quilometragem.trim() || (state.acao === 'saida' && state.bloqueioChecklist?.bloqueado)}
              >
                {state.acao === 'saida' && state.bloqueioChecklist?.bloqueado 
                  ? 'Veículo Bloqueado' 
                  : 'Continuar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmação */}
      {state.step === 'confirmacao' && state.veiculo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckIcon className="h-5 w-5" />
              Confirmar Movimentação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Ação:</strong> {state.acao === 'entrada' ? 'ENTRADA' : 'SAÍDA'} do veículo
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Veículo:</span>
                <span>{state.veiculo.placa} - {state.veiculo.modelo}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Quilometragem:</span>
                <span>{parseInt(state.quilometragem).toLocaleString()} km</span>
              </div>
              {state.observacoes && (
                <div className="flex justify-between">
                  <span className="font-medium">Observações:</span>
                  <span className="text-right max-w-xs">{state.observacoes}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleConfirmar}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Processando...' : 'Confirmar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={resetState}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}