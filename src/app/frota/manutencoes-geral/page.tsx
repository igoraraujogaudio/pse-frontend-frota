'use client'

import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// STUB: Os content components de manutenções/preventiva/oficinas foram removidos
// porque pertenciam ao módulo legado que usava supabase diretamente.
// TODO: Reimplementar usando apiClient via proxy para o backend Rust.
// =============================================================================

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm">{description}</p>
      <p className="text-xs mt-2 text-gray-400">Módulo sendo migrado para o backend Rust (apiClient).</p>
    </div>
  )
}

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
        {activeTab === 'manutencoes' && <PlaceholderTab title="Manutenções" description="Gerencie solicitações de manutenção e acompanhe o status dos veículos." />}
        {activeTab === 'historico' && <PlaceholderTab title="Histórico de Manutenções" description="Veja todas as manutenções finalizadas ou canceladas." />}
        {activeTab === 'preventiva' && <PlaceholderTab title="Manutenção Preventiva" description="Sistema de manutenção preventiva por quilometragem." />}
        {activeTab === 'oficinas' && <PlaceholderTab title="Oficinas" description="Gerencie oficinas cadastradas." />}
      </Suspense>
    </div>
  )
}
