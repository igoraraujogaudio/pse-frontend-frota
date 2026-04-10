'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ConfiguracaoBloqueio {
  id: string
  contrato_id: string
  contrato: {
    id: string
    nome: string
    codigo: string
  }
  bloquear_sem_checklist: boolean
  bloquear_checklist_rejeitado: boolean
  dias_apos_apresentacao: number
  ativo: boolean
}

interface Contrato {
  id: string
  nome: string
  codigo: string
  status: string
}

export default function ConfiguracaoBloqueioChecklistPage() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoBloqueio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [contratosRes, configRes] = await Promise.all([
        fetch('/api/admin/contracts'),
        fetch('/api/admin/configuracao-bloqueio-checklist')
      ])

      if (contratosRes.ok) {
        const contratosData = await contratosRes.json()
        setContratos(contratosData.contracts || [])
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        setConfiguracoes(configData.configuracoes || [])
      }
    } catch {
      notify('Erro ao carregar configurações', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAtivo = async (configId: string, ativo: boolean) => {
    try {
      setSaving(configId)
      const response = await fetch(`/api/admin/configuracao-bloqueio-checklist/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo })
      })

      if (response.ok) {
        notify('Configuração atualizada com sucesso', 'success')
        loadData()
      } else {
        notify('Erro ao atualizar configuração', 'error')
      }
    } catch {
      notify('Erro ao atualizar configuração', 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleUpdateConfig = async (configId: string, updates: Partial<ConfiguracaoBloqueio>) => {
    try {
      setSaving(configId)
      const response = await fetch(`/api/admin/configuracao-bloqueio-checklist/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        notify('Configuração atualizada com sucesso', 'success')
        loadData()
      } else {
        notify('Erro ao atualizar configuração', 'error')
      }
    } catch {
      notify('Erro ao atualizar configuração', 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleCreateConfig = async (contratoId: string) => {
    try {
      setSaving(contratoId)
      const response = await fetch('/api/admin/configuracao-bloqueio-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrato_id: contratoId,
          bloquear_sem_checklist: true,
          bloquear_checklist_rejeitado: true,
          dias_apos_apresentacao: 1,
          ativo: true
        })
      })

      if (response.ok) {
        notify('Configuração criada com sucesso', 'success')
        loadData()
      } else {
        notify('Erro ao criar configuração', 'error')
      }
    } catch {
      notify('Erro ao criar configuração', 'error')
    } finally {
      setSaving(null)
    }
  }

  const getConfiguracaoPorContrato = (contratoId: string) => {
    return configuracoes.find(c => c.contrato_id === contratoId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuração de Bloqueio por Checklist</h1>
        <p className="text-gray-600">
          Configure o bloqueio de veículos na portaria por contrato quando checklist não for realizado ou for rejeitado
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong> Quando ativado, veículos da frota não poderão sair da portaria se:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Não tiverem checklist realizado após apresentação de equipe</li>
            <li>Tiverem checklist rejeitado</li>
          </ul>
          <p className="mt-2 text-sm">A entrada sempre é permitida, apenas a saída é bloqueada.</p>
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {contratos.filter(c => c.status === 'ativo').map((contrato) => {
          const config = getConfiguracaoPorContrato(contrato.id)
          const isSaving = saving === contrato.id

          return (
            <Card key={contrato.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {contrato.nome}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">Código: {contrato.codigo}</p>
                  </div>
                  {config ? (
                    <Badge className={config.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {config.ativo ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </>
                      )}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">
                      Não configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {config ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Ativar Bloqueio</Label>
                        <p className="text-sm text-gray-500">Habilita o bloqueio de veículos para este contrato</p>
                      </div>
                      <Switch
                        checked={config.ativo}
                        onCheckedChange={(checked) => handleToggleAtivo(config.id, checked)}
                        disabled={isSaving}
                      />
                    </div>

                    {config.ativo && (
                      <>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <Label>Bloquear sem Checklist</Label>
                            <p className="text-sm text-gray-500">Bloqueia veículos que não realizaram checklist após apresentação</p>
                          </div>
                          <Switch
                            checked={config.bloquear_sem_checklist}
                            onCheckedChange={(checked) => handleUpdateConfig(config.id, { bloquear_sem_checklist: checked })}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <Label>Bloquear Checklist Rejeitado</Label>
                            <p className="text-sm text-gray-500">Bloqueia veículos com checklist rejeitado</p>
                          </div>
                          <Switch
                            checked={config.bloquear_checklist_rejeitado}
                            onCheckedChange={(checked) => handleUpdateConfig(config.id, { bloquear_checklist_rejeitado: checked })}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="pt-2 border-t">
                          <Label htmlFor={`dias-${config.id}`}>Dias após Apresentação</Label>
                          <p className="text-sm text-gray-500 mb-2">
                            Quantos dias após a apresentação da equipe o checklist deve ser realizado
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`dias-${config.id}`}
                              type="number"
                              min="1"
                              max="7"
                              value={config.dias_apos_apresentacao}
                              onChange={(e) => {
                                const value = parseInt(e.target.value)
                                if (value >= 1 && value <= 7) {
                                  handleUpdateConfig(config.id, { dias_apos_apresentacao: value })
                                }
                              }}
                              className="w-20"
                              disabled={isSaving}
                            />
                            <span className="text-sm text-gray-500">dias</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-4">Nenhuma configuração criada para este contrato</p>
                    <Button
                      onClick={() => handleCreateConfig(contrato.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Criar Configuração
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}



