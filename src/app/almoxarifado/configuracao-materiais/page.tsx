'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Package, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

interface Material {
  id: string
  numero_material: string
  descricao_material: string
  unidade_medida: string
  conferir_portaria: boolean
  requer_patrimonio: boolean
}

export default function ConfiguracaoMateriaisPage() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [materiaisFiltrados, setMateriaisFiltrados] = useState<Material[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadMateriais()
  }, [])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setMateriaisFiltrados(materiais)
      return
    }

    const termo = searchTerm.toLowerCase()
    const filtrados = materiais.filter(m => 
      m.numero_material.toLowerCase().includes(termo) ||
      m.descricao_material.toLowerCase().includes(termo)
    )
    setMateriaisFiltrados(filtrados)
  }, [searchTerm, materiais])

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
      setMateriaisFiltrados(data || [])
    } catch (error) {
      console.error('Erro ao carregar materiais:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleConferirPortaria = async (materialId: string, currentValue: boolean) => {
    try {
      setUpdating(materialId)
      
      const response = await fetch('/api/materiais/configuracao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          conferirPortaria: !currentValue
        })
      })

      if (!response.ok) throw new Error('Erro ao atualizar')

      setMateriais(materiais.map(m => 
        m.id === materialId ? { ...m, conferir_portaria: !currentValue } : m
      ))
    } catch (error) {
      console.error('Erro ao atualizar material:', error)
      alert('Erro ao atualizar configuração do material')
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleRequerPatrimonio = async (materialId: string, currentValue: boolean) => {
    try {
      setUpdating(materialId)
      
      const response = await fetch('/api/materiais/configuracao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          requerPatrimonio: !currentValue
        })
      })

      if (!response.ok) throw new Error('Erro ao atualizar')

      setMateriais(materiais.map(m => 
        m.id === materialId ? { ...m, requer_patrimonio: !currentValue } : m
      ))
    } catch (error) {
      console.error('Erro ao atualizar material:', error)
      alert('Erro ao atualizar configuração do material')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <CardTitle>Configuração de Materiais</CardTitle>
          </div>
          <CardDescription>
            Configure quais materiais requerem patrimônio e quais devem ser conferidos na portaria (Contrato Niterói)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Conferir na Portaria:</strong> Se ativado, o material será verificado pela portaria na saída.<br />
              <strong>Requer Patrimônio:</strong> Se ativado, será necessário informar o número de patrimônio individual (ex: trafos).
            </AlertDescription>
          </Alert>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando materiais...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px]">Unidade</TableHead>
                    <TableHead className="w-[150px] text-center">Conferir Portaria</TableHead>
                    <TableHead className="w-[150px] text-center">Requer Patrimônio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiaisFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Nenhum material encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    materiaisFiltrados.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-mono text-sm">
                          {material.numero_material}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{material.descricao_material}</span>
                            {material.requer_patrimonio && (
                              <Badge variant="secondary" className="w-fit mt-1">
                                Item Individual
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {material.unidade_medida}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={material.conferir_portaria}
                              onCheckedChange={() => handleToggleConferirPortaria(material.id, material.conferir_portaria)}
                              disabled={updating === material.id}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={material.requer_patrimonio}
                              onCheckedChange={() => handleToggleRequerPatrimonio(material.id, material.requer_patrimonio)}
                              disabled={updating === material.id}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            Total: {materiaisFiltrados.length} materiais
            {searchTerm && ` (filtrados de ${materiais.length})`}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
