'use client'

import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { DisponibilidadeRotaContent } from '@/app/disponibilidade-frota/content'
import { HistoricoContent } from '@/app/disponibilidade-frota-historico/content'
import { NotificacoesContent } from '@/app/disponibilidade-frota-notificacoes/content'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'

const tabs = [
  { id: 'disponibilidade', label: 'Disponibilidade' },
  { id: 'historico', label: 'Histórico' },
  { id: 'notificacoes', label: 'Notificações' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function DisponibilidadeGeralPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <DisponibilidadeGeralContent />
    </ProtectedRoute>
  )
}

function DisponibilidadeGeralContent() {
  const [activeTab, setActiveTab] = useState<TabId>('disponibilidade')

  return (
    <div>
      <div className="mb-2">
        <nav className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <Suspense fallback={<div>Carregando...</div>}>
        {activeTab === 'disponibilidade' && <DisponibilidadeRotaContent />}
        {activeTab === 'historico' && <HistoricoContent />}
        {activeTab === 'notificacoes' && <NotificacoesContent />}
      </Suspense>
    </div>
  )
}
