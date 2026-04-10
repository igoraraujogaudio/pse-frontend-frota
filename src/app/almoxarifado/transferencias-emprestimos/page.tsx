'use client'

import { useState } from 'react'
import { ArrowLeftRight, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TransferenciasBasesContent } from '@/app/almoxarifado/transferencias/content'
import { EmprestimosTerceirosContent } from '@/app/almoxarifado/emprestimos-terceiros/content'

type Tab = 'transferencias' | 'emprestimos'

export default function TransferenciasEmprestimosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('transferencias')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('transferencias')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'transferencias'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Transferências Entre Bases
        </button>
        <button
          onClick={() => setActiveTab('emprestimos')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'emprestimos'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <Handshake className="h-4 w-4" />
          Empréstimos para Terceiros
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transferencias' && <TransferenciasBasesContent />}
      {activeTab === 'emprestimos' && <EmprestimosTerceirosContent />}
    </div>
  )
}
