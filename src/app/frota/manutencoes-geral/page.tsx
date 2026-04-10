'use client'

import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { ManutencoesContent } from '@/app/manutencoes/content'
import { MaintenanceHistoryContent } from '@/app/manutencoes/historico/content'
import { PreventivaContent } from '@/app/preventiva/content'
import { OficinasContent } from '@/app/manutencoes/oficinas/content'

const tabs = [
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'historico', label: 'Histórico' },
  { id: 'preventiva', label: 'Preventiva' },
  { id: 'oficinas', label: 'Oficinas' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function ManutencoesGeralPage() {
  const [activeTab, setActiveTab] = useState<TabId>('manutencoes')

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
        {activeTab === 'manutencoes' && <ManutencoesContent />}
        {activeTab === 'historico' && <MaintenanceHistoryContent />}
        {activeTab === 'preventiva' && <PreventivaContent />}
        {activeTab === 'oficinas' && <OficinasContent />}
      </Suspense>
    </div>
  )
}
