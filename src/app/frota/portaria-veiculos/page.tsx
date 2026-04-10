'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ConsultaPortariaContent } from '@/app/portaria/consulta/content'
import { CarrosParticularesContent } from '@/app/carros-particulares/content'

const tabs = [
  { id: 'portaria', label: 'Consulta de Portaria' },
  { id: 'carros', label: 'Carros Particulares' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function PortariaVeiculosPage() {
  const [activeTab, setActiveTab] = useState<TabId>('portaria')

  return (
    <div>
      <div className="mb-2">
        <nav className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((tab) => (
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
      {activeTab === 'portaria' && <ConsultaPortariaContent />}
      {activeTab === 'carros' && <CarrosParticularesContent />}
    </div>
  )
}
