'use client'

import { useState } from 'react'
import { FileInput, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CadastroNFContent } from '@/app/almoxarifado/cadastro-nf/content'
import { NotasFiscaisContent } from '@/app/almoxarifado/notas-fiscais/content'

const tabs = [
  { id: 'entrada' as const, label: 'Entrada de Materiais', icon: FileInput },
  { id: 'historico' as const, label: 'Histórico de Entradas', icon: Receipt },
]

type Tab = (typeof tabs)[number]['id']

export default function EntradaMateriaisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('entrada')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'entrada' && <CadastroNFContent />}
      {activeTab === 'historico' && <NotasFiscaisContent />}
    </div>
  )
}
