'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyIcon, UserIcon, QrCodeIcon, CheckIcon } from 'lucide-react';
import QRScanner from './QRScanner';

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
}

interface ChaveVeiculo {
  id: string;
  veiculo: {
    placa: string;
    modelo: string;
  };
  status: 'disponivel' | 'em_uso';
}

interface ControleChavesState {
  step: 'inicial' | 'colaborador' | 'chave' | 'confirmacao';
  colaborador: Colaborador | null;
  chave: ChaveVeiculo | null;
  acao: 'entrega' | 'retirada' | null;
  observacoes: string;
}

export default function ControleChaves() {
  const [state, setState] = useState<ControleChavesState>({
    step: 'inicial',
    colaborador: null,
    chave: null,
    acao: null,
    observacoes: ''
  });
  
  const [scannerActive, setScannerActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleColaboradorScan = async (qrData: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/portaria/colaborador/${qrData}`);
      const colaborador = await response.json();
      
      if (colaborador.error) {
        alert('Colaborador não encontrado');
        return;
      }

      setState(prev => ({
        ...prev,
        colaborador,
        step: 'chave'
      }));
      setScannerActive(null);
    } catch {
      alert('Erro ao buscar colaborador');
    } finally {
      setLoading(false);
    }
  };

  const handleChaveScan = async (qrData: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/portaria/chave/${qrData}`);
      const chave = await response.json();
      
      if (chave.error) {
        alert('Chave não encontrada');
        return;
      }

      // Determinar ação baseada no status atual da chave
      const acao = chave.status === 'disponivel' ? 'retirada' : 'entrega';

      setState(prev => ({
        ...prev,
        chave,
        acao,
        step: 'confirmacao'
      }));
      setScannerActive(null);
    } catch {
      alert('Erro ao buscar chave');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/portaria/chaves/movimentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: state.colaborador?.id,
          chave_id: state.chave?.id,
          acao: state.acao,
          observacoes: state.observacoes
        })
      });

      if (response.ok) {
        alert(`Chave ${state.acao === 'retirada' ? 'retirada' : 'entregue'} com sucesso!`);
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
      colaborador: null,
      chave: null,
      acao: null,
      observacoes: ''
    });
    setScannerActive(null);
  };

  return (
    <div className="space-y-6">
      {/* Scanner QR */}
      {scannerActive && (
        <QRScanner
          isActive={true}
          onClose={() => setScannerActive(null)}
          onScan={scannerActive === 'colaborador' ? handleColaboradorScan : handleChaveScan}
          title={scannerActive === 'colaborador' ? 'Ler QR do Colaborador' : 'Ler QR da Chave'}
          placeholder={scannerActive === 'colaborador' ? 'Matrícula do colaborador' : 'Código da chave'}
        />
      )}

      {/* Estado Inicial */}
      {state.step === 'inicial' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Controle de Chaves
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Inicie lendo o QR Code da matrícula do colaborador
            </p>
            <Button 
              onClick={() => setScannerActive('colaborador')}
              className="w-full"
              size="lg"
            >
              <QrCodeIcon className="h-5 w-5 mr-2" />
              Ler QR do Colaborador
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Colaborador Identificado */}
      {state.step === 'chave' && state.colaborador && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Colaborador Identificado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {state.colaborador.nome}</p>
                <p><strong>Matrícula:</strong> {state.colaborador.matricula}</p>
                <p><strong>Setor:</strong> {state.colaborador.setor}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximo Passo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Agora leia o QR Code da chave do veículo
              </p>
              <Button 
                onClick={() => setScannerActive('chave')}
                className="w-full"
                size="lg"
              >
                <QrCodeIcon className="h-5 w-5 mr-2" />
                Ler QR da Chave
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmação */}
      {state.step === 'confirmacao' && state.colaborador && state.chave && (
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
                <strong>Ação:</strong> {state.acao === 'retirada' ? 'RETIRADA' : 'ENTREGA'} de chave
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Colaborador</h4>
                <p>{state.colaborador.nome}</p>
                <p className="text-sm text-gray-600">{state.colaborador.matricula}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Veículo</h4>
                <p>{state.chave.veiculo.placa}</p>
                <p className="text-sm text-gray-600">{state.chave.veiculo.modelo}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Input
                id="observacoes"
                value={state.observacoes}
                onChange={(e) => setState(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Digite observações sobre a movimentação..."
              />
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