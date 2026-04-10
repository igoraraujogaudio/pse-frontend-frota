'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  UserPlusIcon,
  UserMinusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

// ============================================================================
// COMPONENTE DE RESUMO DE FUNCIONÁRIOS DEMITIDOS
// ============================================================================

interface FuncionariosDemitidosSummaryProps {
  totalDemitidos: number;
  reativaveis: number;
  reativados: number;
  demissoesUltimos30Dias: number;
}

export default function FuncionariosDemitidosSummary({ 
  totalDemitidos, 
  reativaveis, 
  reativados, 
  demissoesUltimos30Dias 
}: FuncionariosDemitidosSummaryProps) {
  const [modalReativacao, setModalReativacao] = useState<{
    aberto: boolean;
    observacoes: string;
  }>({
    aberto: false,
    observacoes: ''
  });
  
  const [loadingReativacao, setLoadingReativacao] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const reativarTodosReativaveis = async () => {
    try {
      setLoadingReativacao(true);
      setMessage(null);

      // Buscar funcionários reativáveis
      const response = await fetch('/api/users/dismissed?apenas_reativaveis=true&limit=1000');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar funcionários reativáveis');
      }

      const funcionariosReativaveis = data.data || [];
      
      if (funcionariosReativaveis.length === 0) {
        setMessage({ type: 'error', text: 'Nenhum funcionário reativável encontrado' });
        return;
      }

      // Reativar cada funcionário
      let sucessos = 0;
      let erros = 0;

      for (const funcionario of funcionariosReativaveis) {
        try {
          const reativacaoResponse = await fetch('/api/users/dismiss', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: funcionario.usuario_id,
              observacoes_reativacao: modalReativacao.observacoes || 'Reativação em massa'
            })
          });

          if (reativacaoResponse.ok) {
            sucessos++;
          } else {
            erros++;
          }
        } catch {
          erros++;
        }
      }

      if (sucessos > 0) {
        setMessage({ 
          type: 'success', 
          text: `${sucessos} funcionário(s) reativado(s) com sucesso${erros > 0 ? `, ${erros} erro(s)` : ''}` 
        });
      } else {
        setMessage({ type: 'error', text: 'Erro ao reativar funcionários' });
      }

      // Fechar modal
      setModalReativacao({
        aberto: false,
        observacoes: ''
      });

    } catch (error) {
      console.error('Erro na reativação em massa:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Erro ao reativar funcionários' 
      });
    } finally {
      setLoadingReativacao(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserMinusIcon className="h-5 w-5 text-red-600" />
          Funcionários Demitidos
        </CardTitle>
        <CardDescription>
          Resumo dos funcionários demitidos e opções de reativação
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mensagens */}
        {message && (
          <Alert className={`mb-4 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'error' && <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />}
              {message.type === 'success' && <CheckCircleIcon className="h-4 w-4 text-green-600" />}
              <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                {message.text}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalDemitidos}</div>
            <div className="text-sm text-gray-600">Total Demitidos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{reativaveis}</div>
            <div className="text-sm text-gray-600">Reativáveis</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{reativados}</div>
            <div className="text-sm text-gray-600">Reativados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{demissoesUltimos30Dias}</div>
            <div className="text-sm text-gray-600">Últimos 30 dias</div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-3">
          <Link href="/users/dismissed">
            <Button variant="outline" className="w-full sm:w-auto">
              <UserMinusIcon className="h-4 w-4 mr-2" />
              Ver Todos Demitidos
            </Button>
          </Link>

          {reativaveis > 0 && (
            <Button
              variant="outline"
              onClick={() => setModalReativacao({ aberto: true, observacoes: '' })}
              className="w-full sm:w-auto text-green-600 border-green-600 hover:bg-green-50"
            >
              <UserPlusIcon className="h-4 w-4 mr-2" />
              Reativar Todos ({reativaveis})
            </Button>
          )}
        </div>

        {/* Avisos */}
        {reativaveis > 0 && (
          <Alert className="mt-4 border-yellow-200 bg-yellow-50">
            <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Atenção:</strong> Existem {reativaveis} funcionário(s) que podem ser reativados. 
              Use a opção &quot;Reativar Todos&quot; com cuidado e apenas quando necessário.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Modal de Reativação em Massa */}
      <Dialog open={modalReativacao.aberto} onOpenChange={(open) => 
        setModalReativacao(prev => ({ ...prev, aberto: open }))
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <UserPlusIcon className="h-5 w-5" />
              Reativar Todos os Funcionários
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reativar todos os {reativaveis} funcionário(s) reativáveis?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="observacoes_reativacao_massa">Observações da Reativação</Label>
              <Textarea
                id="observacoes_reativacao_massa"
                placeholder="Motivo da reativação em massa..."
                value={modalReativacao.observacoes}
                onChange={(e) => setModalReativacao(prev => ({ 
                  ...prev, 
                  observacoes: e.target.value 
                }))}
                rows={3}
              />
            </div>

            <Alert className="border-yellow-200 bg-yellow-50">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Atenção:</strong> Esta ação irá reativar todos os {reativaveis} funcionário(s) reativáveis. 
                Certifique-se de que esta ação é necessária antes de prosseguir.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalReativacao({
                aberto: false,
                observacoes: ''
              })}
              disabled={loadingReativacao}
            >
              Cancelar
            </Button>
            <Button
              onClick={reativarTodosReativaveis}
              disabled={loadingReativacao}
              className="bg-green-600 hover:bg-green-700"
            >
              {loadingReativacao ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Reativando...
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Reativar Todos ({reativaveis})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
