'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Package, Users, User, Plus, Trash2, CheckCircle, Building2, Loader2 } from 'lucide-react'
import SelecaoEquipeDialog from '@/components/almoxarifado/SelecaoEquipeDialog'
import SelecaoVeiculoDialog from '@/components/almoxarifado/SelecaoVeiculoDialog'
import SelecaoFuncionarioDialog from '@/components/almoxarifado/SelecaoFuncionarioDialog'
import SelecaoMaterialDialog from '@/components/almoxarifado/SelecaoMaterialDialog'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

interface Equipe {
  id: string
  nome: string
  placa_veiculo?: string
}

interface Funcionario {
  id: string
  nome: string
  cargo?: string
}

interface Material {
  id: string
  numero_material: string
  descricao_material: string
  unidade_medida: string
  conferir_portaria?: boolean
  requer_patrimonio?: boolean
}

interface MaterialSelecionado extends Material {
  quantidade: number
  patrimonios?: string[]
}

export default function SaidaMaterialPage() {
  const [equipe, setEquipe] = useState<Equipe | null>(null)
  const [responsavel, setResponsavel] = useState<Funcionario | null>(null)
  const [materiaisSelecionados, setMateriaisSelecionados] = useState<MaterialSelecionado[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEquipeDialog, setShowEquipeDialog] = useState(false)
  const [showVeiculoDialog, setShowVeiculoDialog] = useState(false)
  const [showFuncionarioDialog, setShowFuncionarioDialog] = useState(false)
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [veiculoPlaca, setVeiculoPlaca] = useState<string | null>(null)
  const [baseOrigem, setBaseOrigem] = useState<{ id: string; nome: string; codigo: string } | null>(null)
  const [basesDisponiveis, setBasesDisponiveis] = useState<{ id: string; nome: string; codigo: string }[]>([])
  const [loadingBases, setLoadingBases] = useState(true)

  // Get current user from usuarios table
  useEffect(() => {
    const loadUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', authData.user.email)
          .single()
        
        setUserId(userData?.id || null)
      }
    }
    loadUser()
  }, [])

  // Carregar bases disponíveis
  useEffect(() => {
    const loadBases = async () => {
      try {
        setLoadingBases(true)
        const { data, error } = await supabase
          .from('bases')
          .select('id, nome, codigo')
          .eq('contrato_id', CONTRATO_NITEROI_ID)
          .eq('ativa', true)
          .order('nome')

        if (error) throw error
        setBasesDisponiveis(data || [])
      } catch (error) {
        console.error('Erro ao carregar bases:', error)
      } finally {
        setLoadingBases(false)
      }
    }
    loadBases()
  }, [])

  const handleAddMaterial = (material: Material) => {
    const jaAdicionado = materiaisSelecionados.find(m => m.id === material.id)
    if (jaAdicionado) {
      alert('Este material já foi adicionado')
      return
    }

    setMateriaisSelecionados([
      ...materiaisSelecionados,
      { ...material, quantidade: 1 }
    ])
    setShowMaterialDialog(false)
  }

  const handleRemoveMaterial = (materialId: string) => {
    setMateriaisSelecionados(materiaisSelecionados.filter(m => m.id !== materialId))
  }

  const handleUpdateQuantidade = (materialId: string, quantidade: number) => {
    if (quantidade <= 0) {
      handleRemoveMaterial(materialId)
      return
    }

    setMateriaisSelecionados(
      materiaisSelecionados.map(m =>
        m.id === materialId ? { ...m, quantidade } : m
      )
    )
  }

  const handleUpdatePatrimonioArray = (materialId: string, index: number, patrimonio: string) => {
    setMateriaisSelecionados(
      materiaisSelecionados.map(m => {
        if (m.id === materialId) {
          const patrimonios = [...(m.patrimonios || [])]
          patrimonios[index] = patrimonio
          return { ...m, patrimonios }
        }
        return m
      })
    )
  }

  const handleRegistrarSaida = async () => {
    if (!equipe) {
      alert('Selecione a equipe')
      return
    }

    if (!responsavel) {
      alert('Selecione o responsável pelo recebimento')
      return
    }

    if (materiaisSelecionados.length === 0) {
      alert('Adicione pelo menos um material')
      return
    }

    if (!baseOrigem) {
      alert('Selecione a base de origem do material')
      return
    }

    // Validar patrimônio para itens que requerem
    const itemSemPatrimonio = materiaisSelecionados.find(m => {
      if (!m.requer_patrimonio) return false
      const qtd = Math.floor(m.quantidade)
      const patrimonios = m.patrimonios || []
      return patrimonios.length < qtd || patrimonios.some(p => !p || p.trim() === '')
    })
    if (itemSemPatrimonio) {
      alert(`Informe todos os patrimônios para: ${itemSemPatrimonio.descricao_material}`)
      return
    }

    if (!userId) {
      alert('Usuário não autenticado')
      return
    }

    try {
      setLoading(true)

      const itens = materiaisSelecionados.flatMap(m => {
        if (m.requer_patrimonio) {
          // Criar um item para cada patrimônio
          return (m.patrimonios || []).map(patrimonio => ({
            materialId: m.id,
            quantidade: 1,
            unidadeMedida: m.unidade_medida,
            patrimonio
          }))
        } else {
          // Item normal com quantidade
          return [{
            materialId: m.id,
            quantidade: m.quantidade,
            unidadeMedida: m.unidade_medida
          }]
        }
      })

      const response = await fetch('/api/saida-materiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId: CONTRATO_NITEROI_ID,
          equipeId: equipe.id,
          responsavelId: responsavel.id,
          entreguePor: userId,
          observacoes,
          veiculoPlaca: veiculoPlaca,
          baseOrigem: baseOrigem.id,
          itens
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao registrar saída')
      }

      alert('Saída de material registrada com sucesso!')
      
      // Limpar formulário
      setEquipe(null)
      setResponsavel(null)
      setMateriaisSelecionados([])
      setObservacoes('')
      setBaseOrigem(null)
    } catch (error) {
      console.error('Erro ao registrar saída:', error)
      alert('Erro ao registrar saída de material')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <CardTitle>Saída de Material</CardTitle>
          </div>
          <CardDescription>
            Registrar entrega de materiais para equipes (Contrato Niterói)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base de Origem */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Base de Origem *
            </Label>
            <p className="text-sm text-muted-foreground">
              Selecione de qual base o material será retirado
            </p>
            {loadingBases ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando bases...</span>
              </div>
            ) : basesDisponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma base disponível</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {basesDisponiveis.map((base) => (
                  <button
                    key={base.id}
                    type="button"
                    onClick={() => setBaseOrigem(base)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                      baseOrigem?.id === base.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      baseOrigem?.id === base.id ? 'border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {baseOrigem?.id === base.id && (
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <div className={`font-medium ${
                        baseOrigem?.id === base.id ? 'text-primary' : ''
                      }`}>{base.nome}</div>
                      <div className="text-xs text-muted-foreground">{base.codigo}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Equipe */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipe *
            </Label>
            <Button
              variant={equipe ? "outline" : "secondary"}
              className="w-full justify-start"
              onClick={() => setShowEquipeDialog(true)}
            >
              {equipe ? (
                <div className="flex flex-col items-start">
                  <span className="font-medium">{equipe.nome}</span>
                  {veiculoPlaca && (
                    <span className="text-xs text-gray-500">Veículo: {veiculoPlaca}</span>
                  )}
                </div>
              ) : (
                'Selecionar Equipe'
              )}
            </Button>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Responsável pelo Recebimento *
            </Label>
            <Button
              variant={responsavel ? "outline" : "secondary"}
              className="w-full justify-start"
              onClick={() => setShowFuncionarioDialog(true)}
            >
              {responsavel ? (
                <div className="flex flex-col items-start">
                  <span className="font-medium">{responsavel.nome}</span>
                  {responsavel.cargo && (
                    <span className="text-xs text-gray-500">{responsavel.cargo}</span>
                  )}
                </div>
              ) : (
                'Selecionar Responsável'
              )}
            </Button>
          </div>

          {/* Materiais */}
          <div className="space-y-2">
            <Label>Materiais *</Label>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowMaterialDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Material
            </Button>

            {materiaisSelecionados.length > 0 && (
              <div className="space-y-3 mt-4">
                {materiaisSelecionados.map((material) => (
                  <Card key={material.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm text-gray-600">{material.numero_material}</div>
                          <div className="font-medium">{material.descricao_material}</div>
                          {material.requer_patrimonio && (
                            <Badge variant="secondary" className="mt-1">Item Individual</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMaterial(material.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantidade(material.id, material.quantidade - 1)}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={material.quantidade}
                            onChange={(e) => handleUpdateQuantidade(material.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-center"
                          />
                          <span className="text-sm text-gray-600">{material.unidade_medida}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantidade(material.id, material.quantidade + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      {material.requer_patrimonio && (
                        <div className="space-y-2 mt-3">
                          <Label>Patrimônios * ({material.quantidade} {material.quantidade === 1 ? 'item' : 'itens'})</Label>
                          {Array.from({ length: Math.floor(material.quantidade) }).map((_, index) => (
                            <Input
                              key={index}
                              placeholder={`Patrimônio ${index + 1}`}
                              value={material.patrimonios?.[index] || ''}
                              onChange={(e) => handleUpdatePatrimonioArray(material.id, index, e.target.value)}
                              className="mb-2"
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Observações Gerais */}
          <div className="space-y-2">
            <Label>Observações Gerais</Label>
            <Textarea
              placeholder="Observações sobre a entrega..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Botão Registrar */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleRegistrarSaida}
            disabled={loading}
          >
            {loading ? (
              'Registrando...'
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Registrar Entrega
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SelecaoEquipeDialog
        open={showEquipeDialog}
        onClose={() => setShowEquipeDialog(false)}
        onSelect={(equipe, needsVehicle) => {
          setEquipe(equipe)
          setShowEquipeDialog(false)
          if (needsVehicle) {
            setShowVeiculoDialog(true)
          } else {
            setVeiculoPlaca(equipe.placa_veiculo || null)
          }
        }}
      />

      <SelecaoVeiculoDialog
        open={showVeiculoDialog}
        onClose={() => setShowVeiculoDialog(false)}
        onSelect={(veiculo) => {
          setVeiculoPlaca(veiculo.placa)
          setShowVeiculoDialog(false)
        }}
        equipeNome={equipe?.nome}
      />

      <SelecaoFuncionarioDialog
        open={showFuncionarioDialog}
        onClose={() => setShowFuncionarioDialog(false)}
        onSelect={(funcionario) => {
          setResponsavel(funcionario)
          setShowFuncionarioDialog(false)
        }}
      />

      <SelecaoMaterialDialog
        open={showMaterialDialog}
        onClose={() => setShowMaterialDialog(false)}
        onSelect={handleAddMaterial}
        materiaisJaSelecionados={materiaisSelecionados.map(m => m.id)}
      />
    </div>
  )
}
