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
import { Search } from 'lucide-react'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

interface Funcionario {
  id: string
  nome: string
  cargo?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (funcionario: Funcionario) => void
}

export default function SelecaoFuncionarioDialog({ open, onClose, onSelect }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<Funcionario[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadFuncionarios()
    }
  }, [open])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFuncionariosFiltrados(funcionarios)
      return
    }

    const termo = searchTerm.toLowerCase()
    const filtrados = funcionarios.filter(f =>
      f.nome.toLowerCase().includes(termo) ||
      (f.cargo && f.cargo.toLowerCase().includes(termo))
    )
    setFuncionariosFiltrados(filtrados)
  }, [searchTerm, funcionarios])

  const loadFuncionarios = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, cargo')
        .eq('contrato_id', CONTRATO_NITEROI_ID)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      setFuncionarios(data || [])
      setFuncionariosFiltrados(data || [])
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Responsável</DialogTitle>
          <DialogDescription>
            Escolha o funcionário responsável pelo recebimento dos materiais
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-2" style={{ maxHeight: 'calc(85vh - 200px)' }}>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Carregando funcionários...</div>
            ) : funcionariosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhum funcionário encontrado</div>
            ) : (
              funcionariosFiltrados.map((funcionario) => (
                <Button
                  key={funcionario.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => onSelect(funcionario)}
                >
                  <div className="flex flex-col items-start w-full">
                    <span className="font-medium">{funcionario.nome}</span>
                    {funcionario.cargo && (
                      <span className="text-xs text-gray-500 mt-1">{funcionario.cargo}</span>
                    )}
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
