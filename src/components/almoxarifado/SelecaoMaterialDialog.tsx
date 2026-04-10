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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, PlusCircle } from 'lucide-react'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

interface Material {
  id: string
  numero_material: string
  descricao_material: string
  unidade_medida: string
  conferir_portaria?: boolean
  requer_patrimonio?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (material: Material) => void
  materiaisJaSelecionados: string[]
}

export default function SelecaoMaterialDialog({ 
  open, 
  onClose, 
  onSelect, 
  materiaisJaSelecionados 
}: Props) {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadMateriais()
    }
  }, [open])

  const loadMateriais = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('lista_materiais')
        .select('id, numero_material, descricao_material, unidade_medida, conferir_portaria, requer_patrimonio')
        .eq('contrato_id', CONTRATO_NITEROI_ID)
        .order('numero_material')

      if (error) throw error

      setMateriais(data || [])
    } catch (error) {
      console.error('Erro ao carregar materiais:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Material</DialogTitle>
          <DialogDescription>
            Escolha o material para adicionar à saída
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-2 pr-2" style={{ maxHeight: 'calc(85vh - 150px)' }}>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando materiais...</div>
          ) : materiais.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhum material encontrado</div>
          ) : (
            materiais.map((material) => {
              const jaSelecionado = materiaisJaSelecionados.includes(material.id)

              return (
                <Button
                  key={material.id}
                  variant="outline"
                  className={`w-full justify-start h-auto py-3 ${jaSelecionado ? 'opacity-50' : ''}`}
                  onClick={() => !jaSelecionado && onSelect(material)}
                  disabled={jaSelecionado}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col items-start flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-mono">
                          {material.numero_material}
                        </span>
                        {material.requer_patrimonio && (
                          <Badge variant="secondary" className="text-xs">
                            Patrimônio
                          </Badge>
                        )}
                        {!material.conferir_portaria && (
                          <Badge variant="outline" className="text-xs">
                            Não conferir portaria
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium mt-1">{material.descricao_material}</span>
                      <span className="text-xs text-gray-500 mt-1">{material.unidade_medida}</span>
                    </div>
                    {jaSelecionado ? (
                      <CheckCircle className="h-5 w-5 text-green-600 ml-2 flex-shrink-0" />
                    ) : (
                      <PlusCircle className="h-5 w-5 text-blue-600 ml-2 flex-shrink-0" />
                    )}
                  </div>
                </Button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
