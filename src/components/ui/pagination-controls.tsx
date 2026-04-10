"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

export function PaginationControls({ total, page, pageSize, onPageChange, onPageSizeChange, className }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = Math.min(page * pageSize, total)

  return (
    <div className={`flex flex-col md:flex-row items-center justify-between gap-3 pt-2 ${className || ''}`}>
      <div className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium">{startIndex}</span> - <span className="font-medium">{endIndex}</span> de <span className="font-medium">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Itens por página:</label>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(parseInt(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>Anterior</Button>
          <div className="text-xs mx-1">{page} / {totalPages}</div>
          <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Próxima</Button>
        </div>
      </div>
    </div>
  )
}


