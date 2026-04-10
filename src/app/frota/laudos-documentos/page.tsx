'use client'

import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { LaudosContent } from '@/app/frota/laudos/content'
import { FleetDocumentRulesContent } from '@/app/frota/regras-documentos/content'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'

const tabs = [
  { id: 'laudos', label: 'Laudos' },
  { id: 'regras', label: 'Regras de Documentos' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function LaudosDocumentosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.LAUDOS.VISUALIZAR_LAUDOS,
    ]}>
      <LaudosDocumentosContent />
    </ProtectedRoute>
  )
}

function LaudosDocumentosContent() {
  const [activeTab, setActiveTab] = useState<TabId>('laudos')

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
        {activeTab === 'laudos' && <LaudosContent />}
        {activeTab === 'regras' && <FleetDocumentRulesContent />}
      </Suspense>
    </div>
  )
}
