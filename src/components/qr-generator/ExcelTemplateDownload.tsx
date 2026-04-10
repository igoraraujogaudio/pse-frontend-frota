'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ExcelTemplateDownload() {
  const [downloading, setDownloading] = useState(false)

  const downloadTemplate = async () => {
    setDownloading(true)
    
    try {
      // Criar dados de exemplo
      const templateData = [
        ['Nome', 'Matrícula', 'Cargo', 'Local'],
        ['João Silva', '001', 'Operador', 'Base Central'],
        ['Maria Santos', '002', 'Supervisor', 'Base Norte'],
        ['Pedro Costa', '003', 'Técnico', 'Base Sul'],
        ['Ana Oliveira', '004', 'Coordenador', 'Base Central'],
        ['Carlos Lima', '005', 'Operador', 'Base Norte']
      ]

      // Criar workbook
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(templateData)

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 20 }, // Nome
        { wch: 12 }, // Matrícula
        { wch: 15 }, // Cargo
        { wch: 15 }  // Local
      ]
      worksheet['!cols'] = columnWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Colaboradores')

      // Gerar e baixar o arquivo
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      link.download = 'template-colaboradores-qr-codes.xlsx'
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao gerar template:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      onClick={downloadTemplate}
      disabled={downloading}
      variant="outline"
      size="sm"
      className="w-full"
    >
      <Download className="w-4 h-4 mr-2" />
      {downloading ? 'Gerando...' : 'Baixar Template Excel'}
    </Button>
  )
}
