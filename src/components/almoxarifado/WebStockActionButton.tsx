import React from 'react'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'

type PermissionKey = 'canCreateNewItem' | 'canEditStock' | 'canEditItemQuantity' | 'canEditItemData' | 'canDeleteItem'

interface WebStockActionButtonProps {
  action: 'create' | 'edit' | 'editQuantity' | 'editData' | 'delete'
  onClick: () => void
  className?: string
  disabled?: boolean
  showIcon?: boolean
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
}

const actionConfig = {
  create: {
    permission: 'canCreateNewItem',
    icon: 'fas fa-plus-circle',
    text: 'Criar Item',
    defaultVariant: 'primary' as const,
    defaultColor: 'bg-blue-600 hover:bg-blue-700'
  },
  edit: {
    permission: 'canEditStock',
    icon: 'fas fa-edit',
    text: 'Editar',
    defaultVariant: 'secondary' as const,
    defaultColor: 'bg-orange-600 hover:bg-orange-700'
  },
  editQuantity: {
    permission: 'canEditItemQuantity',
    icon: 'fas fa-calculator',
    text: 'Editar Quantidade',
    defaultVariant: 'success' as const,
    defaultColor: 'bg-green-600 hover:bg-green-700'
  },
  editData: {
    permission: 'canEditItemData',
    icon: 'fas fa-file-alt',
    text: 'Editar Dados',
    defaultVariant: 'primary' as const,
    defaultColor: 'bg-blue-600 hover:bg-blue-700'
  },
  delete: {
    permission: 'canDeleteItem',
    icon: 'fas fa-trash',
    text: 'Excluir',
    defaultVariant: 'danger' as const,
    defaultColor: 'bg-red-600 hover:bg-red-700'
  }
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
}

const variantClasses = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white'
}

export const WebStockActionButton: React.FC<WebStockActionButtonProps> = ({
  action,
  onClick,
  className = '',
  disabled = false,
  showIcon = true,
  children,
  variant,
  size = 'md'
}) => {
  const permissions = useWebAlmoxarifadoPermissions()
  const config = actionConfig[action]
  
  // Verificar se o usuário tem permissão para esta ação
  const hasPermission = permissions[config.permission as PermissionKey]()
  
  // Se não tem permissão, não renderiza o botão
  if (!hasPermission) {
    return null
  }

  const colorClass = variant ? variantClasses[variant] : config.defaultColor
  const sizeClass = sizeClasses[size]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center border border-transparent font-medium rounded-md
        transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        ${colorClass}
        ${sizeClass}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {showIcon && (
        <i className={`${config.icon} mr-2`}></i>
      )}
      {children || config.text}
    </button>
  )
}

export default WebStockActionButton
