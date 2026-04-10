'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Car } from 'lucide-react'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

interface Veiculo {
  id: string
  placa: string
  modelo: string
  tipo_modelo?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (veiculo: Veiculo) => void
  equipeNome?: string
}

export default function SelecaoVeiculoDialog({ open, onClose, onSelect, equipeNome }: Props) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [veiculosFiltrados, setVeiculosFiltrados] = useState<Veiculo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadVeiculos()
    }
  }, [open])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setVeiculosFiltrados(veiculos)
      return
    }

    const termo = searchTerm.toLowerCase()
    const filtrados = veiculos.filter(v =>
      v.placa.toLowerCase().includes(termo) ||
      v.modelo.toLowerCase().includes(termo) ||
      (v.tipo_modelo && v.tipo_modelo.toLowerCase().includes(termo))
    )
    setVeiculosFiltrados(filtrados)
  }, [searchTerm, veiculos])

  const loadVeiculos = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, tipo_modelo')
        .eq('contrato_id', CONTRATO_NITEROI_ID)
        .order('placa')

      if (error) throw error

      setVeiculos(data || [])
      setVeiculosFiltrados(data || [])
    } catch (error) {
      console.error('Erro ao carregar veículos:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Veículo</DialogTitle>
          <DialogDescription>
            {equipeNome 
              ? `A equipe "${equipeNome}" não possui veículo associado. Selecione um veículo.`
              : 'Escolha o veículo para esta saída de material'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por placa, modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-2" style={{ maxHeight: 'calc(85vh - 200px)' }}>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Carregando veículos...</div>
            ) : veiculosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhum veículo encontrado</div>
            ) : (
              veiculosFiltrados.map((veiculo) => (
                <Button
                  key={veiculo.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => onSelect(veiculo)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Car className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="flex flex-col items-start flex-1">
                      <span className="font-medium text-lg">{veiculo.placa}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-600">{veiculo.modelo}</span>
                        {veiculo.tipo_modelo && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-500">{veiculo.tipo_modelo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
