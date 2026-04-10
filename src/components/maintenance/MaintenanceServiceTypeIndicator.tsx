import React from 'react'
import { WrenchScrewdriverIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { Maintenance } from '@/types'

interface MaintenanceServiceTypeIndicatorProps {
  maintenance: Maintenance
  size?: 'sm' | 'md' | 'lg'
}

export default function MaintenanceServiceTypeIndicator({ 
  maintenance, 
  size = 'sm' 
}: MaintenanceServiceTypeIndicatorProps) {
  const isInternal = maintenance.tipo_servico === 'interno'
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]} ${
      isInternal 
        ? 'bg-green-100 text-green-700 border border-green-200' 
        : 'bg-blue-100 text-blue-700 border border-blue-200'
    }`}>
      {isInternal ? (
        <WrenchScrewdriverIcon className={`${iconSizes[size]} text-green-600`} />
      ) : (
        <BuildingOfficeIcon className={`${iconSizes[size]} text-blue-600`} />
      )}
      <span>
        {isInternal ? 'Interno' : 'Externo'}
      </span>
    </div>
  )
}
