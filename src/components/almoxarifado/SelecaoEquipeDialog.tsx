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

interface Equipe {
  id: string
  nome: string
  operacao?: string
  placa_veiculo?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (equipe: Equipe, needsVehicle: boolean) => void
}

export default function SelecaoEquipeDialog({ open, onClose, onSelect }: Props) {
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [equipesFiltradas, setEquipesFiltradas] = useState<Equipe[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadEquipes()
    }
  }, [open])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setEquipesFiltradas(equipes)
      return
    }

    const termo = searchTerm.toLowerCase()
    const filtradas = equipes.filter(e =>
      e.nome.toLowerCase().includes(termo) ||
      (e.operacao && e.operacao.toLowerCase().includes(termo)) ||
      (e.placa_veiculo && e.placa_veiculo.toLowerCase().includes(termo))
    )
    setEquipesFiltradas(filtradas)
  }, [searchTerm, equipes])

  const loadEquipes = async () => {
    try {
      setLoading(true)

      // Buscar equipes
      const { data: equipesData, error: equipesError } = await supabase
        .from('equipes')
        .select('id, nome, operacao, status, contrato_id, prefixo')
        .eq('contrato_id', CONTRATO_NITEROI_ID)
        .eq('status', 'active')
        .order('nome')

      if (equipesError) throw equipesError

      // Buscar veículos associados
      const equipesComVeiculos: Equipe[] = await Promise.all(
        (equipesData || []).map(async (equipe): Promise<Equipe> => {
          const { data: veiculoData } = await supabase
            .from('equipe_veiculos')
            .select('veiculos:veiculo_id(placa)')
            .eq('equipe_id', equipe.id)
            .limit(1)
            .maybeSingle()

          const placa = (veiculoData as { veiculos: { placa: string } } | null)?.veiculos?.placa

          return {
            id: equipe.id,
            nome: equipe.nome,
            operacao: equipe.operacao,
            placa_veiculo: placa
          }
        })
      )

      setEquipes(equipesComVeiculos)
      setEquipesFiltradas(equipesComVeiculos)
    } catch (error) {
      console.error('Erro ao carregar equipes:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Equipe</DialogTitle>
          <DialogDescription>
            Escolha a equipe que receberá os materiais
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar equipe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-2" style={{ maxHeight: 'calc(85vh - 200px)' }}>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Carregando equipes...</div>
            ) : equipesFiltradas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhuma equipe encontrada</div>
            ) : (
              equipesFiltradas.map((equipe) => (
                <Button
                  key={equipe.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => onSelect(equipe, !equipe.placa_veiculo)}
                >
                  <div className="flex flex-col items-start w-full">
                    <span className="font-medium">{equipe.nome}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {equipe.placa_veiculo ? (
                        <div className="flex items-center gap-1 text-xs text-blue-600">
                          <Car className="h-3 w-3" />
                          <span>{equipe.placa_veiculo}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Sem veículo definido</span>
                      )}
                      {equipe.operacao && (
                        <span className="text-xs text-gray-500">• {equipe.operacao}</span>
                      )}
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
