"use client"

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package, User, AlertCircle, Info } from 'lucide-react'

interface EstoqueInsuficienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinueAnyway: () => void
  onCancel: () => void
  itemNome: string
  quantidadeDisponivel: number
  quantidadeSolicitada: number
  solicitanteNome?: string
}

export function EstoqueInsuficienteDialog({
  open,
  onOpenChange,
  onContinueAnyway,
  onCancel,
  itemNome,
  quantidadeDisponivel,
  quantidadeSolicitada,
  solicitanteNome
}: EstoqueInsuficienteDialogProps) {
  const deficit = quantidadeSolicitada - quantidadeDisponivel

  const handleContinueAnyway = () => {
    if (window.confirm(
      `Tem certeza que deseja continuar com a entrega mesmo sem estoque suficiente?\n\nEsta ação pode causar estoque negativo.`
    )) {
      onOpenChange(false)
      onContinueAnyway()
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Estoque Insuficiente</DialogTitle>
              <DialogDescription>
                Não há estoque suficiente para esta entrega
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alerta Principal */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> A quantidade solicitada excede o estoque disponível.
            </AlertDescription>
          </Alert>

          {/* Detalhes da Solicitação */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Item:</span>
              </div>
              <span className="font-semibold text-gray-900">{itemNome}</span>
            </div>

            {solicitanteNome && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Para:</span>
                </div>
                <span className="font-semibold text-gray-900">{solicitanteNome}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Quantidade Solicitada:</span>
              <Badge variant="destructive" className="font-semibold">
                {quantidadeSolicitada}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Quantidade Disponível:</span>
              <Badge 
                variant={quantidadeDisponivel > 0 ? "secondary" : "destructive"} 
                className="font-semibold"
              >
                {quantidadeDisponivel}
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-red-200 bg-red-50 -m-4 mt-2 p-4 rounded-b-lg">
              <span className="text-sm font-semibold text-red-700">Déficit:</span>
              <Badge variant="destructive" className="font-bold">
                {deficit} unidades
              </Badge>
            </div>
          </div>

          {/* Aviso sobre Consequências */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Você pode continuar com a entrega, mas isso pode causar estoque negativo no sistema.
            </AlertDescription>
          </Alert>
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 sm:flex-none"
          >
            Cancelar Entrega
          </Button>
          <Button
            variant="default"
            onClick={handleContinueAnyway}
            className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700"
          >
            Continuar Mesmo Assim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


