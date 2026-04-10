'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  FileSpreadsheet, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  Archive,
  Printer,
  Eye,
  EyeOff
} from 'lucide-react'
import ExcelTemplateDownload from './ExcelTemplateDownload'
import QRCode from 'qrcode'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

interface ExcelRow {
  nome: string
  matricula: string
  cargo?: string | undefined
  local?: string | undefined
  [key: string]: string | number | undefined
}

interface GeneratedQRCode {
  row: ExcelRow
  qrCodeUrl: string
  qrCodeData: string
  fileName: string
}

interface ExcelQRGeneratorProps {
  onClose?: () => void
}

export default function ExcelQRGenerator({ }: ExcelQRGeneratorProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [file, setFile] = useState<File | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [generatedQRCodes, setGeneratedQRCodes] = useState<GeneratedQRCode[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>('')
  const [previewData, setPreviewData] = useState(false)
  const [validRows, setValidRows] = useState<ExcelRow[]>([])

  // Função para gerar QR code com matrícula sobreposta
  const generateQRCodeWithMatricula = async (data: string, matricula: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Iniciando geração de QR code com matrícula: ${matricula}`)
        
        QRCode.toDataURL(data, {
          width: 500,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }, (error, qrDataUrl) => {
          if (error) {
            console.error('Erro ao gerar QR code base:', error)
            reject(error)
            return
          }

          if (!qrDataUrl || !qrDataUrl.startsWith('data:image/png')) {
            console.error('QR code base inválido gerado:', qrDataUrl)
            reject(new Error('QR code base inválido'))
            return
          }

          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                reject(new Error('Não foi possível obter contexto do canvas'))
                return
              }

              const qrSize = 500
              const matriculaHeight = 150
              const totalHeight = qrSize + matriculaHeight
              canvas.width = qrSize
              canvas.height = totalHeight

              // Desenhar o QR code
              ctx.drawImage(img, 0, 0, qrSize, qrSize)

              // Adicionar fundo branco para a área da matrícula
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, qrSize, qrSize, matriculaHeight)

              // Adicionar borda separadora
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(0, qrSize)
              ctx.lineTo(qrSize, qrSize)
              ctx.stroke()

              // Adicionar a matrícula
              ctx.fillStyle = '#000000'
              ctx.font = 'bold 90px Arial, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              
              const matriculaY = qrSize + (matriculaHeight / 2)
              ctx.fillText(matricula.toUpperCase(), qrSize / 2, matriculaY)

              const dataUrl = canvas.toDataURL('image/png')
              
              if (dataUrl && dataUrl.startsWith('data:image/png')) {
                resolve(dataUrl)
              } else {
                reject(new Error('Falha ao converter canvas para data URL'))
              }
            } catch (canvasError) {
              console.error('Erro ao processar canvas:', canvasError)
              reject(canvasError)
            }
          }

          img.onerror = () => {
            reject(new Error('Falha ao carregar imagem do QR code'))
          }

          img.src = qrDataUrl
        })
      } catch (error) {
        console.error('Erro na função generateQRCodeWithMatricula:', error)
        reject(error)
      }
    })
  }

  // Função para processar arquivo Excel
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setError('')
    setLoading(true)

    try {
      const data = await uploadedFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][]

      if (jsonData.length < 2) {
        throw new Error('O arquivo deve ter pelo menos um cabeçalho e uma linha de dados')
      }

      // Primeira linha são os cabeçalhos
      const headers = jsonData[0].map((h: string | number) => String(h).toLowerCase().trim())
      const dataRows = jsonData.slice(1)

      // Mapear colunas para campos esperados
      const nomeIndex = headers.findIndex(h => 
        h.includes('nome') || h.includes('name') || h.includes('colaborador')
      )
      const matriculaIndex = headers.findIndex(h => 
        h.includes('matricula') || h.includes('matrícula') || h.includes('id') || h.includes('codigo')
      )
      const cargoIndex = headers.findIndex(h => 
        h.includes('cargo') || h.includes('funcao') || h.includes('função') || h.includes('position')
      )
      const localIndex = headers.findIndex(h => 
        h.includes('local') || h.includes('base') || h.includes('filial') || h.includes('location')
      )

      if (nomeIndex === -1 || matriculaIndex === -1) {
        throw new Error('O arquivo deve conter colunas "Nome" e "Matrícula" (ou equivalentes)')
      }

      // Converter dados para formato esperado
      const processedData: ExcelRow[] = dataRows
        .filter(row => row && row.length > 0) // Filtrar linhas vazias
        .map((row, index) => ({
          nome: String(row[nomeIndex] || '').trim(),
          matricula: String(row[matriculaIndex] || '').trim(),
          cargo: cargoIndex !== -1 ? String(row[cargoIndex] || '').trim() : '',
          local: localIndex !== -1 ? String(row[localIndex] || '').trim() : '',
          rowIndex: index + 2 // +2 porque começamos do índice 1 e pulamos o cabeçalho
        }))
        .filter(row => row.nome && row.matricula) // Filtrar linhas com dados válidos

      if (processedData.length === 0) {
        throw new Error('Nenhuma linha válida encontrada. Verifique se há dados nas colunas Nome e Matrícula.')
      }

      setExcelData(processedData)
      setValidRows(processedData)
      setPreviewData(true)

    } catch (err) {
      console.error('Erro ao processar arquivo:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo Excel')
    } finally {
      setLoading(false)
    }
  }, [])

  // Função para gerar QR codes em massa
  const generateBulkQRCodes = async () => {
    if (validRows.length === 0) return

    setGenerating(true)
    setProgress(0)
    setGeneratedQRCodes([])

    try {
      const qrCodes: GeneratedQRCode[] = []

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const data = `USER:${row.matricula}:${row.nome}:${row.cargo || ''}`
        
        try {
          const qrCodeDataUrl = await generateQRCodeWithMatricula(data, row.matricula)
          
          qrCodes.push({
            row,
            qrCodeUrl: qrCodeDataUrl,
            qrCodeData: data,
            fileName: `qr-${row.matricula}-${row.nome.replace(/[^a-zA-Z0-9]/g, '_')}.png`
          })

          setProgress(Math.round(((i + 1) / validRows.length) * 100))
          setGeneratedQRCodes([...qrCodes])
        } catch (error) {
          console.error(`Erro ao gerar QR code para ${row.nome}:`, error)
        }
      }

      setGenerating(false)
      setProgress(100)
    } catch (error) {
      console.error('Erro ao gerar QR codes em massa:', error)
      setGenerating(false)
    }
  }

  // Função para baixar QR codes em ZIP
  const downloadQRCodesZip = async () => {
    if (generatedQRCodes.length === 0) return

    setDownloadingZip(true)
    const zip = new JSZip()
    
    try {
      for (let i = 0; i < generatedQRCodes.length; i++) {
        const qrCode = generatedQRCodes[i]
        
        const base64Data = qrCode.qrCodeUrl.split(',')[1]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/png' })
        
        zip.file(qrCode.fileName, blob)
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      
      const link = document.createElement('a')
      link.download = `qr-codes-colaboradores-${Date.now()}.zip`
      link.href = URL.createObjectURL(zipBlob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error)
      setError('Erro ao gerar arquivo ZIP')
    } finally {
      setDownloadingZip(false)
    }
  }

  // Função para baixar planilha Excel com QR codes
  const downloadExcelWithQRCodes = async () => {
    if (generatedQRCodes.length === 0) return

    setDownloadingExcel(true)

    try {
      const worksheetData = [
        ['Nome', 'Matrícula', 'Cargo', 'Local', 'Código QR', 'Data de Geração']
      ]

      generatedQRCodes.forEach((qrCode) => {
        worksheetData.push([
          qrCode.row.nome,
          qrCode.row.matricula,
          qrCode.row.cargo || '',
          qrCode.row.local || '',
          qrCode.qrCodeData,
          new Date().toLocaleString('pt-BR')
        ])
      })

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      const columnWidths = [
        { wch: 20 }, // Nome
        { wch: 15 }, // Matrícula
        { wch: 20 }, // Cargo
        { wch: 25 }, // Local
        { wch: 40 }, // Código QR
        { wch: 20 }  // Data de Geração
      ]
      worksheet['!cols'] = columnWidths

      XLSX.utils.book_append_sheet(workbook, worksheet, 'QR Codes Colaboradores')

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      link.download = `qr-codes-colaboradores-${Date.now()}.xlsx`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao gerar Excel:', error)
      setError('Erro ao gerar planilha Excel')
    } finally {
      setDownloadingExcel(false)
    }
  }

  // Função para imprimir QR codes
  const printQRCodes = () => {
    if (generatedQRCodes.length === 0) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Codes dos Colaboradores</title>
            <style>
              body { 
                font-family: Arial, sans-serif;
                margin: 20px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 20px;
                margin-top: 20px;
              }
              .qr-item {
                text-align: center;
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 8px;
              }
              .qr-code {
                margin-bottom: 10px;
              }
              .user-info {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
              }
              .matricula {
                font-weight: bold;
                font-size: 16px;
                color: #333;
                margin-bottom: 5px;
              }
              @media print {
                .qr-grid {
                  grid-template-columns: repeat(3, 1fr);
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>QR Codes dos Colaboradores</h1>
              <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
              <p>Total de colaboradores: ${generatedQRCodes.length}</p>
            </div>
            <div class="qr-grid">
              ${generatedQRCodes.map(qrCode => `
                <div class="qr-item">
                  <div class="qr-code">
                    <img src="${qrCode.qrCodeUrl}" alt="QR Code ${qrCode.row.nome}" style="width: 180px; height: 330px;" />
                  </div>
                  <div class="user-info">
                    <div class="matricula">${qrCode.row.matricula}</div>
                    ${qrCode.row.nome}
                    ${qrCode.row.cargo ? `<br/>${qrCode.row.cargo}` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Função para limpar dados
  const clearData = () => {
    setFile(null)
    setExcelData([])
    setGeneratedQRCodes([])
    setValidRows([])
    setPreviewData(false)
    setError('')
    setProgress(0)
  }

  return (
    <div className="space-y-6">
      {/* Upload do arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload do Arquivo Excel
          </CardTitle>
          <CardDescription>
            Faça upload de um arquivo Excel (.xlsx) com os dados dos colaboradores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="excel-file">Arquivo Excel</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Template de Exemplo</Label>
            <ExcelTemplateDownload />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Processando arquivo...
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Instruções */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado do Excel:</strong><br/>
              • Coluna com &quot;Nome&quot; (ou &quot;Name&quot;, &quot;Colaborador&quot;)<br/>
              • Coluna com &quot;Matrícula&quot; (ou &quot;Matrícula&quot;, &quot;ID&quot;, &quot;Código&quot;)<br/>
              • Coluna com &quot;Cargo&quot; (opcional)<br/>
              • Coluna com &quot;Local&quot; (opcional)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Preview dos dados */}
      {previewData && validRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Preview dos Dados
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewData(!previewData)}
              >
                {previewData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </CardTitle>
            <CardDescription>
              {validRows.length} colaboradores encontrados no arquivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewData && (
              <div className="max-h-60 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {validRows.slice(0, 12).map((row, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-gray-50">
                      <div className="font-medium">{row.nome}</div>
                      <div className="text-sm text-gray-600">Matrícula: {row.matricula}</div>
                      {row.cargo && <div className="text-sm text-gray-600">Cargo: {row.cargo}</div>}
                      {row.local && <div className="text-sm text-gray-600">Local: {row.local}</div>}
                    </div>
                  ))}
                </div>
                {validRows.length > 12 && (
                  <div className="text-center text-gray-500 mt-4">
                    +{validRows.length - 12} colaboradores adicionais...
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Geração de QR Codes */}
      {validRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Geração de QR Codes
            </CardTitle>
            <CardDescription>
              Gere QR codes para todos os colaboradores do arquivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={generateBulkQRCodes}
                disabled={generating || validRows.length === 0}
                className="flex-1"
              >
                <QrCode className="w-4 h-4 mr-2" />
                {generating ? 'Gerando...' : `Gerar ${validRows.length} QR Codes`}
              </Button>
              <Button
                variant="outline"
                onClick={clearData}
                className="px-3"
              >
                Limpar
              </Button>
            </div>

            {/* Barra de progresso */}
            {generating && (
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* Resultados */}
            {generatedQRCodes.length > 0 && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    ✓ <strong>{generatedQRCodes.length} QR codes</strong> gerados com sucesso!
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-4">
                  <Button 
                    onClick={downloadExcelWithQRCodes} 
                    disabled={downloadingExcel}
                    variant="outline"
                    className="w-full"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {downloadingExcel ? 'Gerando...' : 'Planilha Excel'}
                  </Button>
                  <Button 
                    onClick={downloadQRCodesZip} 
                    disabled={downloadingZip}
                    variant="outline"
                    className="w-full"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {downloadingZip ? 'Gerando ZIP...' : 'Imagens ZIP'}
                  </Button>
                  <Button 
                    onClick={printQRCodes} 
                    variant="outline"
                    className="w-full"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir Todos
                  </Button>
                </div>

                {/* Preview dos QR Codes */}
                <div className="max-h-60 overflow-y-auto">
                  <h4 className="font-medium mb-2">Preview dos QR Codes:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {generatedQRCodes.slice(0, 9).map((qrCode, index) => (
                      <div key={index} className="text-center">
                        <Image 
                          src={qrCode.qrCodeUrl} 
                          alt={`QR ${qrCode.row.matricula}`}
                          width={96}
                          height={192}
                          className="mx-auto border rounded"
                          style={{ objectFit: 'contain' }}
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          {qrCode.row.matricula}
                        </div>
                      </div>
                    ))}
                    {generatedQRCodes.length > 9 && (
                      <div className="text-center text-gray-500 text-xs">
                        +{generatedQRCodes.length - 9} mais...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
