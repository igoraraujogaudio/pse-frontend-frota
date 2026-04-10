'use client';

import { useState } from 'react';
import { Package, CheckCircle, XCircle, Loader2, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SolicitacaoItem } from '@/types';
import type { InventarioFuncionario, InventarioEquipe } from '@/types/almoxarifado';

interface DeliveryConfirmationScreenProps {
  solicitacao: SolicitacaoItem;
  inventarioItems: (InventarioFuncionario | InventarioEquipe)[];
  itensEntregues: Array<{
    item_id: string;
    item_nome: string;
    quantidade: number;
  }>;
  biometricConfirmed: boolean;
  biometricData?: {
    template: string;
    quality: number;
    image_base64?: string;
    isNewRegistration: boolean;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeliveryConfirmationScreen({
  solicitacao,
  inventarioItems,
  itensEntregues,
  biometricConfirmed,
  biometricData,
  onConfirm,
  onCancel,
}: DeliveryConfirmationScreenProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  // Agrupar itens do inventário por categoria
  const inventarioPorCategoria = inventarioItems.reduce((acc, item) => {
    const categoria = (item as { item_estoque?: { categoria?: string }; categoria?: string }).item_estoque?.categoria || 
                     (item as { item_estoque?: { categoria?: string }; categoria?: string }).categoria || 
                     'Outros';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(item);
    return acc;
  }, {} as Record<string, typeof inventarioItems>);

  return (
    <div className="w-full space-y-6">

        {/* Informações do Destinatário */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Destinatário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {solicitacao.destinatario_equipe ? (
                  <span className="text-2xl">🏢</span>
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {solicitacao.destinatario_equipe?.nome || solicitacao.destinatario?.nome || 'Destinatário não informado'}
                </div>
                {solicitacao.destinatario?.matricula && (
                  <div className="text-sm text-gray-600">
                    Matrícula: {solicitacao.destinatario.matricula}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmação Biométrica */}
        {biometricConfirmed && (
          <Card className="mb-6 border-green-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-green-600" />
                Confirmação Biométrica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-semibold text-green-900">
                    {biometricData?.isNewRegistration ? 'Digital cadastrada e validada' : 'Digital validada com sucesso'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Qualidade: {biometricData?.quality || 0}/100
                  </div>
                </div>
              </div>
              {biometricData?.image_base64 && (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${biometricData.image_base64}`}
                    alt="Digital capturada"
                    className="max-w-xs h-auto border border-gray-300 rounded shadow-md"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Itens do Inventário Atual */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Inventário Atual do Destinatário</CardTitle>
          </CardHeader>
          <CardContent>
            {inventarioItems.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(inventarioPorCategoria).map(([categoria, itens]) => (
                  <div key={categoria} className="border-b pb-4 last:border-b-0">
                    <div className="font-semibold text-gray-900 mb-2">
                      {categoria === 'epi' ? '🦺 EPI' : 
                       categoria === 'ferramental' ? '🔧 Ferramental' :
                       categoria === 'consumivel' ? '📦 Consumível' :
                       categoria}
                      <span className="text-sm text-gray-500 ml-2">({itens.length} {itens.length === 1 ? 'item' : 'itens'})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {itens.map((item) => {
                        const itemEstoque = (item as InventarioFuncionario & { item_estoque?: { nome?: string; codigo?: string } }).item_estoque || 
                                           (item as InventarioEquipe & { item_estoque?: { nome?: string; codigo?: string } }).item_estoque;
                        const quantidade = (item as InventarioFuncionario).quantidade || (item as InventarioEquipe).quantidade_total || 0;
                        return (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">
                                  {itemEstoque?.nome || 'Item'}
                                </div>
                                {itemEstoque?.codigo && (
                                  <div className="text-xs text-gray-500">
                                    Código: {itemEstoque.codigo}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-blue-600">{quantidade}</div>
                                <div className="text-xs text-gray-500">quantidade</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum item no inventário</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Itens Confirmados para Entrega */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Itens Confirmados para Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {itensEntregues.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {item.item_nome}
                      </div>
                      <div className="text-sm text-gray-600">
                        Item ID: {item.item_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {item.quantidade}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.quantidade === 1 ? 'unidade' : 'unidades'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Total de itens no inventário</div>
                <div className="text-2xl font-bold text-blue-600">{inventarioItems.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Itens sendo entregues</div>
                <div className="text-2xl font-bold text-green-600">{itensEntregues.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={confirming}
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming || !biometricConfirmed}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {confirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Entrega
              </>
            )}
          </Button>
        </div>
      </div>
  );
}

