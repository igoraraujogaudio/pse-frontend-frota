'use client'

import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { FrotaEquipesContent } from '@/app/frota/equipes/content'
import { HistoricoAlocacoesContent } from '@/app/frota/equipes/historico/content'

const tabs = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'historico', label: 'Histórico' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function EquipesGeralPage() {
  const [activeTab, setActiveTab] = useState<TabId>('equipes')

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
        {activeTab === 'equipes' && <FrotaEquipesContent />}
        {activeTab === 'historico' && <HistoricoAlocacoesContent />}
      </Suspense>
    </div>
  )
}
