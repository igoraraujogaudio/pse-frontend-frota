'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import PermissionGuard from '@/components/PermissionGuard'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, QrCode, Car, User, Copy, Check, Building2, Printer, FileSpreadsheet, Archive, Upload } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import ExcelQRGenerator from '@/components/qr-generator/ExcelQRGenerator'

interface Vehicle {
  id: string
  placa: string
  modelo: string
  marca_equipamento: string
  contrato_id?: string
  local?: {
    nome: string
  } | {
    nome: string
  }[]
}

interface User {
  id: string
  nome: string
  matricula: string
  cargo: string
  status?: string
  contrato_id?: string
  local?: {
    nome: string
  }
}

interface Location {
  id: string
  nome: string
}

interface BulkQRCode {
  vehicle: Vehicle
  qrCodeUrl: string
  qrCodeData: string
}

interface BulkUserQRCode {
  user: User
  qrCodeUrl: string
  qrCodeData: string
}

export default function QRGeneratorPage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [qrCodeData, setQrCodeData] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Estados para geração em massa
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [bulkQRCodes, setBulkQRCodes] = useState<BulkQRCode[]>([])
  const [generatingBulk, setGeneratingBulk] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  // Estados para geração em massa de colaboradores
  const [selectedLocationIdUsers] = useState<string>('')
  // const setSelectedLocationIdUsers = () => {}; // TODO: Implement location-based user filtering
  const [bulkUserQRCodes, setBulkUserQRCodes] = useState<BulkUserQRCode[]>([])
  // const [generatingBulkUsers, setGeneratingBulkUsers] = useState(false) // Unused
  // const [bulkUsersProgress, setBulkUsersProgress] = useState(0) // Unused
  // const [downloadingZipUsers, setDownloadingZipUsers] = useState(false) // Unused
  // const [zipProgressUsers, setZipProgressUsers] = useState(0) // Unused

  // Verificação de permissão removida - agora usando PermissionGuard

  // Estados para veículos
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState<string>('')

  // Estados para colaboradores
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [userSearchTerm, setUserSearchTerm] = useState<string>('')
  
  // Estados para controlar visibilidade das listas
  const [showVehicleList, setShowVehicleList] = useState(false)
  const [showUserList, setShowUserList] = useState(false)

  // Filtros para busca
  const filteredVehicles = vehicles.filter(vehicle => {
    // Se um veículo está selecionado, sempre incluí-lo nos resultados
    if (selectedVehicle && vehicle.id === selectedVehicle) {
      return true
    }
    
    // Caso contrário, aplicar filtro de busca
    return vehicle.placa.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
           vehicle.modelo.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
           vehicle.marca_equipamento.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
  })
  .sort((a, b) => {
    // Colocar o veículo selecionado sempre primeiro
    if (a.id === selectedVehicle) return -1
    if (b.id === selectedVehicle) return 1
    return 0
  })
  .slice(0, 10) // Limitar a 10 resultados

  const filteredUsers = users.filter(user => {
    // Se um usuário está selecionado, sempre incluí-lo nos resultados
    if (selectedUser && user.id === selectedUser) {
      return true
    }
    
    // Caso contrário, aplicar filtro de busca
    if (!userSearchTerm.trim()) return false

    const searchLower = userSearchTerm.toLowerCase().trim()
    const nomeMatch = user.nome?.toLowerCase().includes(searchLower)
    const matriculaMatch = user.matricula?.toString().toLowerCase().includes(searchLower)
    const cargoMatch = user.cargo?.toLowerCase().includes(searchLower)

    return nomeMatch || matriculaMatch || cargoMatch
  })
  .sort((a, b) => {
    // Colocar o usuário selecionado sempre primeiro
    if (a.id === selectedUser) return -1
    if (b.id === selectedUser) return 1
    return 0
  })
  .slice(0, 50) // Limitar a 50 resultados para melhor performance

  const loadData = useCallback(async () => {
    try {
      // Teste de conectividade básica com Supabase
      console.log('Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('contratos')
        .select('id, nome')
        .limit(1)

      if (testError) {
        console.error('Supabase connection test failed:', testError)
        return
      } else {
        console.log('Supabase connection OK, test data:', testData)
      }

      // Obter locais do usuário logado para filtrar dados
      const currentUser = user
      let userContratoIds: string[] = []

      if (currentUser) {
        console.log('Current user:', currentUser.nome, 'Level:', currentUser.nivel_acesso)

        // Verificar se é admin/gestor global
        const userRole = currentUser.nivel_acesso?.toLowerCase()
        const isGlobalAdmin = ['admin', 'manager', 'fleet_manager'].includes(userRole || '')

        if (!isGlobalAdmin) {
          // Se não for admin global, buscar contratos do usuário
          const { data: userContracts, error: contratosError } = await supabase
            .from('usuario_contratos')
            .select('contrato_id')
            .eq('usuario_id', currentUser.id)

          if (contratosError) {
            console.error('Error loading user contracts:', contratosError)
            userContratoIds = []
          } else {
            userContratoIds = userContracts?.map(uc => uc.contrato_id) || []
          }

          console.log('User contrato IDs for filtering:', userContratoIds)
          console.log('Is global admin:', isGlobalAdmin)
        } else {
          console.log('User is global admin - no location filtering')
        }
      } else {
        console.log('No current user found')
      }

      // Carregar contratos disponíveis
      let contratosQuery = supabase
        .from('contratos')
        .select('id, nome')
        .order('nome')

      if (userContratoIds.length > 0) {
        contratosQuery = contratosQuery.in('id', userContratoIds)
      }

      const { data: contratosData } = await contratosQuery
      setLocations((contratosData || []).map(c => ({ id: c.id, nome: c.nome })))

      // Carregar veículos com filtro por local se necessário
      let vehiclesQuery = supabase
        .from('veiculos')
        .select(`
          id, placa, modelo, marca_equipamento, contrato_id,
          contrato:contratos(nome)
        `)
        .order('placa')

      if (userContratoIds.length > 0) {
        vehiclesQuery = vehiclesQuery.in('contrato_id', userContratoIds)
      }

      const { data: vehiclesData } = await vehiclesQuery

      // Carregar usuários reais do banco - apenas dados reais, sem fallback
      let usersData: User[] = []

      try {
        // Primeiro, vamos verificar se a tabela usuarios existe e tem dados
        console.log('Checking usuarios table...')

        // Tentar query mais simples primeiro
        console.log('Trying basic query without filters...')
        const { data: basicUsers, error: basicError } = await supabase
          .from('usuarios')
          .select('id, nome, matricula, cargo, status')
          .eq('status', 'ativo')

        if (basicError) {
          console.error('Basic query failed:', basicError)
          console.error('Basic error details:', JSON.stringify(basicError, null, 2))
          usersData = []
        } else {
          console.log('Basic query worked! Found users:', basicUsers?.length || 0)
          if (basicUsers && basicUsers.length > 0) {
            console.log('Sample user from basic query:', basicUsers[0])
            console.log('Available statuses in DB:', [...new Set(basicUsers.map(u => u.status))])

            // Agora aplicar filtros se necessário
            let filteredUsers = basicUsers

            // Filtrar por contratos se não for admin global
            if (userContratoIds.length > 0) {
              console.log('Applying contrato filter:', userContratoIds)
              const { data: locationFilteredUsers, error: locationError } = await supabase
                .from('usuarios')
                .select('id, nome, matricula, cargo, status, contrato_id')
                .in('contrato_id', userContratoIds)
                .eq('status', 'ativo')

              if (!locationError && locationFilteredUsers) {
                filteredUsers = locationFilteredUsers
                console.log('After location filter:', filteredUsers.length)
              }
            }

            usersData = filteredUsers
          } else {
            console.log('No users found in basic query')
            usersData = []
          }
        }

        const { data: realUsers, error } = { data: usersData, error: basicError }

        if (error) {
          console.error('Error loading users from database:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))

          // Tentar query mais simples para debug
          console.log('Trying simpler query...')
          const { data: simpleUsers, error: simpleError } = await supabase
            .from('usuarios')
            .select('id, nome, matricula')
            .limit(5)

          if (simpleError) {
            console.error('Simple query also failed:', simpleError)
          } else {
            console.log('Simple query worked, found users:', simpleUsers?.length || 0)
            if (simpleUsers && simpleUsers.length > 0) {
              console.log('Sample from simple query:', simpleUsers[0])
            }
          }

          usersData = []
        } else {
          usersData = realUsers || []
          console.log('Successfully loaded real users:', usersData.length)
          if (usersData.length > 0) {
            console.log('Sample user loaded:', usersData[0])
            console.log('User fields available:', Object.keys(usersData[0]))
          } else {
            console.log('No users found')

            // Verificar se existem usuários sem filtro de status
            const { data: allUsers, error: allError } = await supabase
              .from('usuarios')
              .select('id, nome, matricula, status')
              .limit(5)

            if (!allError && allUsers) {
              console.log('Total users in table (any status):', allUsers.length)
              if (allUsers.length > 0) {
                console.log('Sample user (any status):', allUsers[0])
                console.log('Available statuses:', [...new Set(allUsers.map(u => u.status))])
              }
            }
          }
        }
      } catch (error) {
        console.error('Exception loading users:', error)
        usersData = []
      }

      setVehicles(vehiclesData || [])
      setUsers(usersData || [])

      console.log('Loaded vehicles:', vehiclesData?.length)
      console.log('Loaded users:', usersData?.length)
      if (usersData && usersData.length > 0) {
        console.log('Sample user:', usersData[0])
        console.log('User fields:', Object.keys(usersData[0]))
      } else {
        console.log('No users loaded or empty array')
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Esconder listas quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.vehicle-search-container') && !target.closest('.user-search-container')) {
        setShowVehicleList(false)
        setShowUserList(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const generateQRCode = async (data: string) => {
    try {
      setLoading(true)
      setQrCodeData(data)

      // Gerar QR Code
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setQrCodeUrl(qrCodeDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    } finally {
      setLoading(false)
    }
  }

  // Função para gerar QR code com placa sobreposta
  const generateQRCodeWithPlate = async (data: string, placa: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Iniciando geração de QR code com placa: ${placa}`)
        
        // Primeiro, gerar o QR code base usando a biblioteca qrcode
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

          console.log('QR code base gerado, criando canvas para adicionar placa...')

          // Criar uma nova imagem com o QR code
          const img = new (globalThis as any).Image()
          img.crossOrigin = 'anonymous'
          
          // Criar uma nova imagem para o logo PSE
          const logoImg = new (globalThis as any).Image()
          logoImg.crossOrigin = 'anonymous'
          
          let qrCodeLoaded = false
          let logoLoaded = false
          
          const processCanvas = () => {
            if (!qrCodeLoaded || !logoLoaded) return
            
            try {
              // Criar canvas para desenhar o QR code com a placa e logo
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                reject(new Error('Não foi possível obter contexto do canvas'))
                return
              }

              // Configurar dimensões do canvas com proporção 3:4 para área de corte
              const canvasWidth = 600  // 3 unidades
              const canvasHeight = 800 // 4 unidades (proporção 3:4)
              const qrSize = 500
              const logoHeight = 140
              const plateHeight = 160
              
              canvas.width = canvasWidth
              canvas.height = canvasHeight
              
              console.log(`Canvas criado com proporção 3:4: ${canvas.width}x${canvas.height}`)

              // Preencher todo o canvas com branco
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, canvasWidth, canvasHeight)

              // Calcular posições centralizadas
              const marginX = (canvasWidth - qrSize) / 2 // Margem horizontal para centralizar
              
              // Adicionar borda separadora superior
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(marginX, logoHeight)
              ctx.lineTo(marginX + qrSize, logoHeight)
              ctx.stroke()

              // Adicionar o logo PSE centralizado acima do QR code
              const logoWidth = 260 // Largura do logo (aumentada em 30%: 200 + 60)
              const logoHeight_img = 110 // Altura do logo ajustada
              const logoX = (canvasWidth - logoWidth) / 2
              const logoY = (logoHeight - logoHeight_img) / 2
              
              // Desenhar o logo
              ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight_img)
              
              console.log(`Logo PSE adicionado acima do QR code (${logoWidth}x${logoHeight_img})`)

              // Desenhar o QR code no canvas (centralizado horizontalmente, abaixo do logo)
              ctx.drawImage(img, marginX, logoHeight, qrSize, qrSize)

              // Adicionar borda separadora inferior
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(marginX, logoHeight + qrSize)
              ctx.lineTo(marginX + qrSize, logoHeight + qrSize)
              ctx.stroke()

              // Adicionar a PLACA (não o modelo) em negrito e caixa alta
              ctx.fillStyle = '#000000'
              ctx.font = 'bold 90px Arial, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              
              // Centralizar a PLACA na área designada
              const plateY = logoHeight + qrSize + (plateHeight / 2)
              ctx.fillText(placa.toUpperCase(), canvasWidth / 2, plateY)
              
              console.log(`Placa "${placa.toUpperCase()}" adicionada ao canvas`)

              // Adicionar borda de corte 3x4 ao redor do canvas
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 3
              ctx.strokeRect(0, 0, canvasWidth, canvasHeight)
              
              // Adicionar marcas de corte nos cantos (opcional)
              const markLength = 20
              ctx.lineWidth = 2
              // Canto superior esquerdo
              ctx.beginPath()
              ctx.moveTo(0, markLength)
              ctx.lineTo(0, 0)
              ctx.lineTo(markLength, 0)
              ctx.stroke()
              // Canto superior direito
              ctx.beginPath()
              ctx.moveTo(canvasWidth - markLength, 0)
              ctx.lineTo(canvasWidth, 0)
              ctx.lineTo(canvasWidth, markLength)
              ctx.stroke()
              // Canto inferior esquerdo
              ctx.beginPath()
              ctx.moveTo(0, canvasHeight - markLength)
              ctx.lineTo(0, canvasHeight)
              ctx.lineTo(markLength, canvasHeight)
              ctx.stroke()
              // Canto inferior direito
              ctx.beginPath()
              ctx.moveTo(canvasWidth - markLength, canvasHeight)
              ctx.lineTo(canvasWidth, canvasHeight)
              ctx.lineTo(canvasWidth, canvasHeight - markLength)
              ctx.stroke()
              
              console.log('Borda de corte 3x4 e marcas de corte adicionadas')

              // Converter canvas para data URL
              const dataUrl = canvas.toDataURL('image/png')
              console.log(`Canvas convertido para data URL, tamanho: ${dataUrl.length}`)
              console.log(`Data URL válida: ${dataUrl.startsWith('data:image/png')}`)
              
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

          img.onload = () => {
            console.log('QR code carregado com sucesso')
            qrCodeLoaded = true
            processCanvas()
          }

          img.onerror = (imgError: string | Event) => {
            console.error('Erro ao carregar imagem do QR code:', imgError)
            reject(new Error('Falha ao carregar imagem do QR code'))
          }

          logoImg.onload = () => {
            console.log('Logo PSE carregado com sucesso')
            logoLoaded = true
            processCanvas()
          }

          logoImg.onerror = (logoError: string | Event) => {
            console.error('Erro ao carregar logo PSE:', logoError)
            // Se falhar ao carregar o logo, continuar sem ele
            console.log('Continuando sem o logo PSE...')
            logoLoaded = true
            processCanvas()
          }

          // Definir as fontes das imagens
          img.src = qrDataUrl
          logoImg.src = '/logo_pse.png'
        })
      } catch (error) {
        console.error('Erro na função generateQRCodeWithPlate:', error)
        reject(error)
      }
    })
  }

  // Função para gerar QR code com matrícula sobreposta (sem logo)
  const generateQRCodeWithMatricula = async (data: string, matricula: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Iniciando geração de QR code com matrícula: ${matricula}`)
        
        // Primeiro, gerar o QR code base usando a biblioteca qrcode
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

          console.log('QR code base gerado, criando canvas para adicionar matrícula...')

          // Criar uma nova imagem com o QR code
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          
          let qrCodeLoaded = false
          
          const processCanvas = () => {
            if (!qrCodeLoaded) return
            
            try {
              // Criar canvas para desenhar o QR code com a matrícula
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                reject(new Error('Não foi possível obter contexto do canvas'))
                return
              }

              // Configurar dimensões do canvas
              const qrSize = 500
              const matriculaHeight = 150
              const totalHeight = qrSize + matriculaHeight
              canvas.width = qrSize
              canvas.height = totalHeight
              
              console.log(`Canvas criado: ${canvas.width}x${canvas.height}`)

              // Desenhar o QR code no canvas (no topo)
              ctx.drawImage(img, 0, 0, qrSize, qrSize)

              // Adicionar fundo branco para a área da matrícula
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, qrSize, qrSize, matriculaHeight)

              // Adicionar borda separadora superior
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 5
              ctx.beginPath()
              ctx.moveTo(0, qrSize)
              ctx.lineTo(qrSize, qrSize)
              ctx.stroke()

              // Adicionar a MATRÍCULA em negrito e caixa alta
              ctx.fillStyle = '#000000'
              ctx.font = 'bold 90px Arial, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              
              // Centralizar a MATRÍCULA na área designada
              const matriculaY = qrSize + (matriculaHeight / 2)
              ctx.fillText(matricula.toUpperCase(), qrSize / 2, matriculaY)
              
              console.log(`Matrícula "${matricula.toUpperCase()}" adicionada ao canvas`)

              // Converter canvas para data URL
              const dataUrl = canvas.toDataURL('image/png')
              console.log(`Canvas convertido para data URL, tamanho: ${dataUrl.length}`)
              console.log(`Data URL válida: ${dataUrl.startsWith('data:image/png')}`)
              
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

          img.onload = () => {
            console.log('QR code carregado com sucesso')
            qrCodeLoaded = true
            processCanvas()
          }

          img.onerror = (imgError: string | Event) => {
            console.error('Erro ao carregar imagem do QR code:', imgError)
            reject(new Error('Falha ao carregar imagem do QR code'))
          }

          // Definir a fonte da imagem
          img.src = qrDataUrl
        })
      } catch (error) {
        console.error('Erro na função generateQRCodeWithMatricula:', error)
        reject(error)
      }
    })
  }

  // Função para gerar QR codes em massa para todos os veículos de um local
  const generateBulkQRCodes = async () => {
    if (!selectedLocationId) return

    try {
      setGeneratingBulk(true)
      setBulkProgress(0)
      setBulkQRCodes([])

      // Filtrar veículos do contrato selecionado
      const locationVehicles = vehicles.filter(v => String((v as any).contrato_id) === selectedLocationId)
      
      if (locationVehicles.length === 0) {
        alert('Nenhum veículo encontrado para este local')
        return
      }

      const qrCodes: BulkQRCode[] = []
      
      for (let i = 0; i < locationVehicles.length; i++) {
        const vehicle = locationVehicles[i]
        const data = `VEHICLE:${vehicle.placa}:${vehicle.id}`
        
        console.log(`Gerando QR code para veículo: ${vehicle.placa} (ID: ${vehicle.id})`)
        
        try {
          // Gerar QR code com placa sobreposta
          const qrCodeDataUrl = await generateQRCodeWithPlate(data, vehicle.placa)
          console.log(`QR code gerado com sucesso para ${vehicle.placa}`)
          console.log(`URL gerada: ${qrCodeDataUrl.substring(0, 100)}...`)
          console.log(`Tamanho da URL: ${qrCodeDataUrl.length} caracteres`)

          qrCodes.push({
            vehicle,
            qrCodeUrl: qrCodeDataUrl,
            qrCodeData: data
          })

          // Atualizar progresso
          setBulkProgress(Math.round(((i + 1) / locationVehicles.length) * 100))
          setBulkQRCodes([...qrCodes])
        } catch (error) {
          console.error(`Erro ao gerar QR code para ${vehicle.placa}:`, error)
        }
      }

      setGeneratingBulk(false)
      setBulkProgress(100)
    } catch (error) {
      console.error('Erro ao gerar QR codes em massa:', error)
      setGeneratingBulk(false)
    }
  }

  // Função para gerar QR codes em massa para todos os colaboradores de um local - TODO: Implement bulk user QR generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const generateBulkUserQRCodes = async () => {
    if (!selectedLocationIdUsers) return

    try {
      // setGeneratingBulkUsers(true) // Commented out as state is not used
      // setBulkUsersProgress(0) // Commented out as state is not used
      setBulkUserQRCodes([])

      console.log('Buscando colaboradores para o local:', selectedLocationIdUsers)

      // Primeiro tentar filtrar usuários já carregados na memória
      let locationUsers = users.filter(user => {
        // Verificar se o usuário tem o contrato_id correspondente
        return user.contrato_id && String(user.contrato_id) === selectedLocationIdUsers
      })
      
      console.log(`Usuários encontrados na memória: ${locationUsers.length}`)

      // Se não encontrou usuários na memória, buscar diretamente do banco
      if (locationUsers.length === 0) {
        console.log('Buscando usuários diretamente do banco de dados...')
        
        try {
          // Buscar usuários através da tabela usuario_contratos (relacionamento many-to-many)
          const { data: userIds, error: userIdsError } = await supabase
            .from('usuario_contratos')
            .select('usuario_id')
            .eq('contrato_id', selectedLocationIdUsers)

          if (!userIdsError && userIds && userIds.length > 0) {
            const ids = userIds.map(uc => uc.usuario_id)
            console.log(`Encontrados ${ids.length} IDs de usuários na tabela usuario_contratos`)
            
            const { data: usersFromIds, error: usersFromIdsError } = await supabase
              .from('usuarios')
              .select('id, nome, matricula, cargo, status')
              .in('id', ids)
              .eq('status', 'ativo')

            if (!usersFromIdsError && usersFromIds) {
              locationUsers = usersFromIds
              console.log(`Busca por IDs encontrou ${locationUsers.length} colaboradores ativos`)
            }
          } else {
            // Fallback: buscar usuários com contrato_id direto
            console.log('Tentando busca direta por contrato_id...')
            const { data: directUsers, error: directError } = await supabase
              .from('usuarios')
              .select('id, nome, matricula, cargo, status, contrato_id')
              .eq('contrato_id', selectedLocationIdUsers)
              .eq('status', 'ativo')

            if (!directError && directUsers) {
              locationUsers = directUsers
              console.log(`Busca direta encontrou ${locationUsers.length} colaboradores`)
            }
          }
        } catch (dbError) {
          console.error('Erro ao buscar usuários do banco:', dbError)
        }
      }
      
      if (locationUsers.length === 0) {
        const locationName = locations.find(l => l.id === selectedLocationIdUsers)?.nome || 'Local selecionado'
        alert(`Nenhum colaborador encontrado para o local "${locationName}". Verifique se há colaboradores ativos associados a este local.`)
        // setGeneratingBulkUsers(false) // Commented out as state is not used
        return
      }

      // Filtrar usuários que têm matrícula e nome válidos
      const validUsers = locationUsers.filter(user => {
        const hasMatricula = user.matricula && user.matricula.toString().trim() !== ''
        const hasNome = user.nome && user.nome.trim() !== ''
        return hasMatricula && hasNome
      })

      if (validUsers.length === 0) {
        alert('Nenhum colaborador válido encontrado (todos devem ter nome e matrícula)')
        // setGeneratingBulkUsers(false) // Commented out as state is not used
        return
      }

      console.log(`Gerando QR codes para ${validUsers.length} colaboradores válidos`)
      // const locationName = locations.find(l => l.id === selectedLocationIdUsers)?.nome || 'Local selecionado' // Unused

      const qrCodes: BulkUserQRCode[] = []
      
      for (let i = 0; i < validUsers.length; i++) {
        const user = validUsers[i]
        const data = `USER:${user.matricula}:${user.id}:${user.nome}`
        
        console.log(`Gerando QR code para colaborador: ${user.nome} (Matrícula: ${user.matricula})`)
        
        try {
          // Gerar QR code com matrícula sobreposta (sem logo)
          const qrCodeDataUrl = await generateQRCodeWithMatricula(data, user.matricula)
          console.log(`QR code gerado com sucesso para ${user.nome}`)
          console.log(`URL gerada: ${qrCodeDataUrl.substring(0, 100)}...`)
          console.log(`Tamanho da URL: ${qrCodeDataUrl.length} caracteres`)

          qrCodes.push({
            user,
            qrCodeUrl: qrCodeDataUrl,
            qrCodeData: data
          })

          // Atualizar progresso
          // setBulkUsersProgress(Math.round(((i + 1) / validUsers.length) * 100)) // Commented out as state is not used
          setBulkUserQRCodes([...qrCodes])
        } catch (error) {
          console.error(`Erro ao gerar QR code para ${user.nome}:`, error)
        }
      }

      // setGeneratingBulkUsers(false) // Commented out as state is not used
      // setBulkUsersProgress(100) // Commented out as state is not used
    } catch (error) {
      console.error('Erro ao gerar QR codes em massa para colaboradores:', error)
      // setGeneratingBulkUsers(false) // Commented out as state is not used
    }
  }

  // Função para baixar todos os QR codes em um arquivo ZIP
  const downloadBulkQRCodes = async () => {
    if (bulkQRCodes.length === 0) return

    try {
      setDownloadingZip(true)
      setZipProgress(0)
      const zip = new JSZip()
      
      // Adicionar cada QR code ao ZIP
      for (let i = 0; i < bulkQRCodes.length; i++) {
        const qrCode = bulkQRCodes[i]
        try {
          // Converter data URL diretamente para blob (sem usar fetch)
          const base64Data = qrCode.qrCodeUrl.split(',')[1]
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j)
          }
          
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'image/png' })
          
          // Adicionar ao ZIP com nome organizado
          const fileName = `qr-${qrCode.vehicle.placa}-${qrCode.vehicle.id}.png`
          zip.file(fileName, blob)
          
          console.log(`Adicionando ao ZIP: ${fileName} - Tamanho: ${blob.size} bytes`)
          console.log(`QR code URL contém placa: ${qrCode.qrCodeUrl.includes('data:image/png') ? 'SIM' : 'NÃO'}`)
          
          // Atualizar progresso
          setZipProgress(Math.round(((i + 1) / bulkQRCodes.length) * 100))
        } catch (error) {
          console.error(`Erro ao processar QR code para ${qrCode.vehicle.placa}:`, error)
        }
      }
      
      // Gerar e baixar o ZIP
      setZipProgress(95) // Indicar que está gerando o arquivo
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setZipProgress(100)
      
      const link = document.createElement('a')
      link.download = `qr-codes-${locations.find(l => l.id === selectedLocationId)?.nome || 'local'}-${Date.now()}.zip`
      link.href = URL.createObjectURL(zipBlob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao baixar QR codes em ZIP:', error)
      alert('Erro ao gerar arquivo ZIP. Tente novamente.')
    } finally {
      setDownloadingZip(false)
      setZipProgress(0)
    }
  }

  // Função para baixar todos os QR codes em um arquivo ZIP para colaboradores - TODO: Implement bulk user download
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const downloadBulkUserQRCodes = async () => {
    if (bulkUserQRCodes.length === 0) return

    try {
      // setDownloadingZipUsers(true) // Commented out as state is not used
      // setZipProgressUsers(0) // Commented out as state is not used
      const zip = new JSZip()
      
      // Adicionar cada QR code ao ZIP
      for (let i = 0; i < bulkUserQRCodes.length; i++) {
        const qrCode = bulkUserQRCodes[i]
        try {
          // Converter data URL diretamente para blob (sem usar fetch)
          const base64Data = qrCode.qrCodeUrl.split(',')[1]
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j)
          }
          
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'image/png' })
          
          // Adicionar ao ZIP com nome organizado
          const fileName = `qr-user-${qrCode.user.matricula}-${qrCode.user.id}.png`
          zip.file(fileName, blob)
          
          console.log(`Adicionando ao ZIP: ${fileName} - Tamanho: ${blob.size} bytes`)
          console.log(`QR code URL contém matrícula: ${qrCode.qrCodeUrl.includes('data:image/png') ? 'SIM' : 'NÃO'}`)
          
          // Atualizar progresso
          // setZipProgressUsers(Math.round(((i + 1) / bulkUserQRCodes.length) * 100)) // Commented out as state is not used
        } catch (error) {
          console.error(`Erro ao processar QR code para ${qrCode.user.nome}:`, error)
        }
      }
      
      // Gerar e baixar o ZIP
      // setZipProgressUsers(95) // Indicar que está gerando o arquivo // Commented out as state is not used
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      // setZipProgressUsers(100) // Commented out as state is not used
      
      const link = document.createElement('a')
      link.download = `qr-codes-users-${locations.find(l => l.id === selectedLocationIdUsers)?.nome || 'local'}-${Date.now()}.zip`
      link.href = URL.createObjectURL(zipBlob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao baixar QR codes em ZIP para colaboradores:', error)
      alert('Erro ao gerar arquivo ZIP. Tente novamente.')
    } finally {
      // setDownloadingZipUsers(false) // Commented out as state is not used
      // setZipProgressUsers(0) // Commented out as state is not used
    }
  }

  // Função para gerar e baixar planilha Excel com os códigos QR
  const generateExcelSpreadsheet = () => {
    if (bulkQRCodes.length === 0) return

    try {
      // Preparar dados para a planilha
      const worksheetData = [
        ['Placa', 'Modelo', 'Marca', 'Contrato', 'Código QR', 'ID do Veículo', 'Data de Geração']
      ]

      bulkQRCodes.forEach((qrCode) => {
        const locationName = locations.find(l => l.id === (qrCode.vehicle as any).contrato_id)?.nome || 'N/A'
        worksheetData.push([
          qrCode.vehicle.placa,
          qrCode.vehicle.modelo,
          qrCode.vehicle.marca_equipamento,
          locationName,
          qrCode.qrCodeData,
          qrCode.vehicle.id,
          new Date().toLocaleString('pt-BR')
        ])
      })

      // Criar workbook e worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 12 }, // Placa
        { wch: 20 }, // Modelo
        { wch: 20 }, // Marca
        { wch: 25 }, // Local
        { wch: 35 }, // Código QR
        { wch: 15 }, // ID do Veículo
        { wch: 20 }  // Data de Geração
      ]
      worksheet['!cols'] = columnWidths

      // Adicionar worksheet ao workbook
      const locationName = locations.find(l => l.id === selectedLocationId)?.nome || 'Local'
      XLSX.utils.book_append_sheet(workbook, worksheet, `QR Codes - ${locationName}`)

      // Gerar e baixar o arquivo Excel
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      link.download = `qr-codes-${locationName}-${Date.now()}.xlsx`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao gerar planilha Excel:', error)
      alert('Erro ao gerar planilha Excel. Tente novamente.')
    }
  }

  // Função para gerar e baixar planilha Excel com os códigos QR para colaboradores - TODO: Implement Excel generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const generateExcelSpreadsheetUsers = () => {
    if (bulkUserQRCodes.length === 0) return

    try {
      // Preparar dados para a planilha
      const worksheetData = [
        ['Nome', 'Matrícula', 'Local', 'Código QR', 'ID do Usuário', 'Data de Geração']
      ]

      bulkUserQRCodes.forEach((qrCode) => {
        const locationName = locations.find(l => l.id === (qrCode.user as any).contrato_id)?.nome || 'N/A'
        worksheetData.push([
          qrCode.user.nome,
          qrCode.user.matricula,
          locationName,
          qrCode.qrCodeData,
          qrCode.user.id,
          new Date().toLocaleString('pt-BR')
        ])
      })

      // Criar workbook e worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 15 }, // Nome
        { wch: 15 }, // Matrícula
        { wch: 25 }, // Local
        { wch: 35 }, // Código QR
        { wch: 15 }, // ID do Usuário
        { wch: 20 }  // Data de Geração
      ]
      worksheet['!cols'] = columnWidths

      // Adicionar worksheet ao workbook
      const locationName = locations.find(l => l.id === selectedLocationIdUsers)?.nome || 'Local'
      XLSX.utils.book_append_sheet(workbook, worksheet, `QR Codes - Usuários - ${locationName}`)

      // Gerar e baixar o arquivo Excel
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      link.download = `qr-codes-users-${locationName}-${Date.now()}.xlsx`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Erro ao gerar planilha Excel para colaboradores:', error)
      alert('Erro ao gerar planilha Excel. Tente novamente.')
    }
  }

  // Função para imprimir todos os QR codes
  const printBulkQRCodes = () => {
    if (bulkQRCodes.length === 0) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const locationName = locations.find(l => l.id === selectedLocationId)?.nome || 'Local'
      
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Codes - ${locationName}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body { 
                font-family: Arial, sans-serif;
                margin: 20px;
                background: #f5f5f5;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                background: white;
                padding: 20px;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 30px;
                margin-top: 20px;
                justify-items: center;
              }
              .qr-item {
                text-align: center;
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                page-break-inside: avoid;
              }
              .qr-code {
                margin-bottom: 10px;
                display: inline-block;
              }
              .qr-code img {
                width: 225px;  /* 3 unidades */
                height: 300px; /* 4 unidades - proporção 3:4 */
                border: 1px solid #ddd;
                display: block;
              }
              .vehicle-info {
                font-size: 12px;
                color: #666;
                margin-top: 10px;
              }
              .placa {
                font-weight: bold;
                font-size: 16px;
                color: #333;
                margin-bottom: 5px;
              }
              @media print {
                body {
                  background: white;
                  margin: 10mm;
                }
                .qr-grid {
                  grid-template-columns: repeat(3, 1fr);
                  gap: 5mm;
                }
                .qr-item {
                  box-shadow: none;
                  border: 1px solid #ddd;
                  page-break-inside: avoid;
                  padding: 5mm;
                }
                .qr-code img {
                  width: 3cm !important;   /* Exatamente 3 centímetros */
                  height: 4cm !important;  /* Exatamente 4 centímetros */
                  border: 1px solid #000;
                }
                .vehicle-info {
                  font-size: 10px;
                  margin-top: 3mm;
                }
                .header {
                  box-shadow: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>QR Codes dos Veículos - 3cm × 4cm</h1>
              <h2>${locationName}</h2>
              <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
              <p>Total de veículos: ${bulkQRCodes.length}</p>
            </div>
            <div class="qr-grid">
              ${bulkQRCodes.map(qrCode => `
                <div class="qr-item">
                  <div class="qr-code">
                    <img src="${qrCode.qrCodeUrl}" alt="QR Code ${qrCode.vehicle.placa}" />
                  </div>
                  <div class="vehicle-info">
                    ${qrCode.vehicle.marca_equipamento} ${qrCode.vehicle.modelo}
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

  // Função para imprimir todos os QR codes para colaboradores - TODO: Implement bulk printing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const printBulkUserQRCodes = () => {
    if (bulkUserQRCodes.length === 0) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const locationName = locations.find(l => l.id === selectedLocationIdUsers)?.nome || 'Local'
      
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Codes - ${locationName}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body { 
                font-family: Arial, sans-serif;
                margin: 20px;
                background: #f5f5f5;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                background: white;
                padding: 20px;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 30px;
                margin-top: 20px;
                justify-items: center;
              }
              .qr-item {
                text-align: center;
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                page-break-inside: avoid;
              }
              .qr-code {
                margin-bottom: 10px;
                display: inline-block;
              }
              .qr-code img {
                width: 225px;  /* 3 unidades */
                height: 300px; /* 4 unidades - proporção 3:4 */
                border: 1px solid #ddd;
                display: block;
              }
              .vehicle-info {
                font-size: 12px;
                color: #666;
                margin-top: 10px;
              }
              .placa {
                font-weight: bold;
                font-size: 16px;
                color: #333;
                margin-bottom: 5px;
              }
              @media print {
                body {
                  background: white;
                  margin: 10mm;
                }
                .qr-grid {
                  grid-template-columns: repeat(3, 1fr);
                  gap: 5mm;
                }
                .qr-item {
                  box-shadow: none;
                  border: 1px solid #ddd;
                  page-break-inside: avoid;
                  padding: 5mm;
                }
                .qr-code img {
                  width: 3cm !important;   /* Exatamente 3 centímetros */
                  height: 4cm !important;  /* Exatamente 4 centímetros */
                  border: 1px solid #000;
                }
                .vehicle-info {
                  font-size: 10px;
                  margin-top: 3mm;
                }
                .header {
                  box-shadow: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>QR Codes dos Colaboradores - 3cm × 4cm</h1>
              <h2>${locationName}</h2>
              <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
              <p>Total de colaboradores: ${bulkUserQRCodes.length}</p>
            </div>
            <div class="qr-grid">
              ${bulkUserQRCodes.map(qrCode => `
                <div class="qr-item">
                  <div class="qr-code">
                    <img src="${qrCode.qrCodeUrl}" alt="QR Code ${qrCode.user.nome}" />
                  </div>
                  <div class="vehicle-info">
                    ${qrCode.user.nome} - ${qrCode.user.matricula}
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

  const handleVehicleQRGeneration = () => {
    if (selectedVehicle) {
      const vehicle = vehicles.find(v => v.id === selectedVehicle)
      if (vehicle) {
        const data = `VEHICLE:${vehicle.placa}:${vehicle.id}`
        console.log(`Gerando QR code individual para veículo: ${vehicle.placa}`)
        
        // Gerar QR code com placa sobreposta para veículos
        generateQRCodeWithPlate(data, vehicle.placa).then(qrCodeUrl => {
          console.log(`QR code individual gerado com sucesso para ${vehicle.placa}`)
          setQrCodeUrl(qrCodeUrl)
          setQrCodeData(data)
        }).catch(error => {
          console.error('Erro ao gerar QR code com placa:', error)
          // Fallback para geração normal
          generateQRCode(data)
        })
      }
    }
  }

  const handleUserQRGeneration = () => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser)
      if (user) {
        const data = `USER:${user.matricula}:${user.id}:${user.nome}`
        generateQRCode(data)
      }
    }
  }

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a')
      link.download = `qr-code-${Date.now()}.png`
      link.href = qrCodeUrl
      link.click()
    }
  }

  const copyQRData = async () => {
    if (qrCodeData) {
      await navigator.clipboard.writeText(qrCodeData)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Função de debug para testar geração de QR code
  const testQRCodeGeneration = async () => {
    try {
      console.log('=== TESTE DE GERAÇÃO DE QR CODE ===')
      
      // Teste 1: QR code simples
      const testData = 'TEST:ABC123:12345'
      console.log('Teste 1: Gerando QR code simples...')
      const simpleQR = await QRCode.toDataURL(testData, { width: 200 })
      console.log('QR code simples gerado:', simpleQR.substring(0, 100))
      console.log('É válido:', simpleQR.startsWith('data:image/png'))
      
      // Teste 2: QR code com placa
      console.log('Teste 2: Gerando QR code com placa...')
      const plateQR = await generateQRCodeWithPlate(testData, 'ABC123')
      console.log('QR code com placa gerado:', plateQR.substring(0, 100))
      console.log('É válido:', plateQR.startsWith('data:image/png'))
      
      // Teste 3: Verificar se as imagens carregam
      const testImg = new window.Image()
      testImg.onload = () => console.log('Teste 3: Imagem carregada com sucesso')
      testImg.onerror = () => console.log('Teste 3: Erro ao carregar imagem')
      testImg.src = plateQR
      
      console.log('=== FIM DO TESTE ===')
    } catch (error) {
      console.error('Erro no teste:', error)
    }
  }

  const testQRCodeWithPlate = async () => {
    try {
      console.log('=== TESTE DE GERAÇÃO DE QR CODE COM PLACA ===')
      const testData = 'TEST:PLACA123:12345'
      console.log('Teste 1: Gerando QR code com placa...')
      const plateQR = await generateQRCodeWithPlate(testData, 'ABC123')
      console.log('QR code com placa gerado:', plateQR.substring(0, 100))
      console.log('É válido:', plateQR.startsWith('data:image/png'))

      const testImg = new window.Image()
      testImg.onload = () => console.log('Teste 2: Imagem carregada com sucesso')
      testImg.onerror = () => console.log('Teste 2: Erro ao carregar imagem')
      testImg.src = plateQR

      console.log('=== FIM DO TESTE ===')
    } catch (error) {
      console.error('Erro no teste:', error)
    }
  }

  const printQRCode = () => {
    if (qrCodeUrl) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code</title>
              <style>
                body { 
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  min-height: 100vh; 
                  margin: 0; 
                  font-family: Arial, sans-serif;
                }
                .qr-container {
                  text-align: center;
                  padding: 20px;
                }
                .qr-info {
                  margin-top: 20px;
                  font-size: 14px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div class="qr-container">
                <img src="${qrCodeUrl}" alt="QR Code" />
                <div class="qr-info">
                  <p><strong>Dados:</strong> ${qrCodeData}</p>
                  <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  return (
    <PermissionGuard 
      requiredPermissions={[PERMISSION_CODES.QR_GENERATOR.GERAR_QR_CODE]}
      fallbackMessage="Você não tem permissão para acessar o gerador de QR Code."
    >
      <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gerador de QR Codes</h1>
        <p className="text-gray-600">
          Gere QR Codes para veículos e colaboradores para facilitar a identificação no sistema
        </p>
        <div className="mt-4">
          <Button 
            onClick={testQRCodeGeneration} 
            variant="outline" 
            size="sm"
            className="text-xs"
          >
            🧪 Testar Geração de QR Code
          </Button>
          <Button 
            onClick={testQRCodeWithPlate} 
            variant="outline" 
            size="sm"
            className="text-xs ml-2"
          >
            🧪 Testar Geração de QR Code com Placa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Geração de QR Codes */}
        <div>
          <Tabs defaultValue="vehicles" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vehicles" className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Veículos
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Colaboradores
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Em Massa
              </TabsTrigger>
              <TabsTrigger value="excel" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Excel
              </TabsTrigger>
            </TabsList>

            {/* Tab Veículos */}
            <TabsContent value="vehicles">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    QR Code para Veículos
                  </CardTitle>
                  <CardDescription>
                    Busque e selecione um veículo existente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="vehicle-search">Buscar Veículo Existente</Label>
                    {selectedVehicle && (
                      <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <div className="text-sm text-green-800">
                          ✓ Veículo selecionado: {vehicles.find(v => v.id === selectedVehicle)?.placa}
                        </div>
                      </div>
                    )}
                    <div className="relative vehicle-search-container">
                      <Input
                        id="vehicle-search"
                        placeholder="Digite a placa para buscar (ex: ABC1234)..."
                        value={vehicleSearchTerm}
                        onChange={(e) => {
                          setVehicleSearchTerm(e.target.value)
                          // Se o usuário limpar o campo, também limpar a seleção
                          if (!e.target.value.trim()) {
                            setSelectedVehicle('')
                            setShowVehicleList(false)
                          } else {
                            setShowVehicleList(true)
                          }
                        }}
                        onFocus={() => {
                          if (vehicleSearchTerm.trim()) {
                            setShowVehicleList(true)
                          }
                        }}
                        onClick={() => {
                          if (vehicleSearchTerm.trim()) {
                            setShowVehicleList(true)
                          }
                        }}
                        className="uppercase"
                      />
                      {showVehicleList && vehicleSearchTerm && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredVehicles.length > 0 ? (
                            filteredVehicles.map((vehicle) => {
                              const isSelected = vehicle.id === selectedVehicle
                              return (
                                <button
                                  key={vehicle.id}
                                  type="button"
                                  className={`w-full px-4 py-2 text-left border-b border-gray-100 last:border-b-0 ${
                                    isSelected 
                                      ? 'bg-blue-50 border-blue-200 text-blue-900' 
                                      : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => {
                                    setSelectedVehicle(vehicle.id)
                                    setVehicleSearchTerm(`${vehicle.placa} - ${vehicle.marca_equipamento} ${vehicle.modelo}`)
                                    setShowVehicleList(false)
                                  }}
                                >
                                  <div className="font-medium">{vehicle.placa}</div>
                                  <div className="text-sm text-gray-600">
                                    {vehicle.marca_equipamento} {vehicle.modelo}
                                    {vehicle.local && ` • ${Array.isArray(vehicle.local) ? vehicle.local[0]?.nome : vehicle.local.nome}`}
                                  </div>
                                  {isSelected && (
                                    <div className="text-xs text-blue-600 mt-1">✓ Selecionado</div>
                                  )}
                                </button>
                              )
                            })
                          ) : !selectedVehicle ? (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              {vehicles.length === 0 ? 'Nenhum veículo disponível' : 'Nenhum veículo encontrado'}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleVehicleQRGeneration}
                      disabled={!selectedVehicle}
                      className="flex-1"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Gerar QR Code do Veículo
                    </Button>
                    {selectedVehicle && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedVehicle('')
                          setVehicleSearchTerm('')
                          setShowVehicleList(false)
                        }}
                        className="px-3"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Colaboradores */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    QR Code para Colaboradores
                  </CardTitle>
                  <CardDescription>
                    Busque e selecione um colaborador existente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="user-search">Buscar Colaborador Existente</Label>
                    {selectedUser && (
                      <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <div className="text-sm text-green-800">
                          ✓ Colaborador selecionado: {users.find(u => u.id === selectedUser)?.nome}
                        </div>
                      </div>
                    )}
                    <div className="relative user-search-container">
                      <Input
                        id="user-search"
                        placeholder="Digite nome, matrícula ou cargo para buscar..."
                        value={userSearchTerm}
                        onChange={(e) => {
                          setUserSearchTerm(e.target.value)
                          // Se o usuário limpar o campo, também limpar a seleção
                          if (!e.target.value.trim()) {
                            setSelectedUser('')
                            setShowUserList(false)
                          } else {
                            setShowUserList(true)
                          }
                        }}
                        onFocus={() => {
                          if (userSearchTerm.trim()) {
                            setShowUserList(true)
                          }
                        }}
                        onClick={() => {
                          if (userSearchTerm.trim()) {
                            setShowUserList(true)
                          }
                        }}
                      />
                      {showUserList && userSearchTerm && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => {
                              const isSelected = user.id === selectedUser
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  className={`w-full px-4 py-2 text-left border-b border-gray-100 last:border-b-0 ${
                                    isSelected 
                                      ? 'bg-blue-50 border-blue-200 text-blue-900' 
                                      : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => {
                                    setSelectedUser(user.id)
                                    setUserSearchTerm(`${user.nome} - ${user.matricula}`)
                                    setShowUserList(false)
                                  }}
                                >
                                  <div className="font-medium">{user.nome}</div>
                                  <div className="text-sm text-gray-600">
                                    Matrícula: {user.matricula} • {user.cargo}
                                    {user.local && ` • ${user.local.nome}`}
                                  </div>
                                  {isSelected && (
                                    <div className="text-xs text-blue-600 mt-1">✓ Selecionado</div>
                                  )}
                                </button>
                              )
                            })
                          ) : !selectedUser ? (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              {users.length === 0 ? 'Nenhum colaborador disponível' : 'Nenhum colaborador encontrado'}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleUserQRGeneration}
                      disabled={!selectedUser}
                      className="flex-1"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Gerar QR Code do Colaborador
                    </Button>
                    {selectedUser && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedUser('')
                          setUserSearchTerm('')
                          setShowUserList(false)
                        }}
                        className="px-3"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Geração em Massa */}
            <TabsContent value="bulk">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Geração em Massa de QR Codes
                  </CardTitle>
                  <CardDescription>
                    Gere QR codes para todos os veículos de um local específico. Cada QR code inclui a placa do veículo em destaque. Baixe uma planilha Excel com os códigos e todas as imagens em um arquivo ZIP.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="location-select">Selecionar Local</Label>
                    <select
                      id="location-select"
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione um local</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedLocationId && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm text-blue-800">
                        <strong>Local selecionado:</strong> {locations.find(l => l.id === selectedLocationId)?.nome}
                      </div>
                      <div className="text-sm text-blue-600 mt-1">
                        <strong>Total de veículos:</strong> {vehicles.filter(v => String((v as any).contrato_id) === selectedLocationId).length}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={generateBulkQRCodes}
                      disabled={!selectedLocationId || generatingBulk}
                      className="flex-1"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {generatingBulk ? 'Gerando...' : 'Gerar Todos os QR Codes'}
                    </Button>
                    {selectedLocationId && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedLocationId('')
                          setBulkQRCodes([])
                          setBulkProgress(0)
                        }}
                        className="px-3"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>

                  {/* Barra de Progresso */}
                  {generatingBulk && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${bulkProgress}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Barra de Progresso para Download ZIP */}
                  {downloadingZip && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${zipProgress}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Resultados da Geração em Massa */}
                  {bulkQRCodes.length > 0 && (
                    <div className="space-y-4">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="text-sm text-green-800">
                          ✓ <strong>{bulkQRCodes.length} QR codes</strong> gerados com sucesso!
                        </div>
                        <div className="text-sm text-green-700 mt-1">
                          Agora você pode baixar uma planilha Excel com todos os códigos ou todas as imagens em um arquivo ZIP.
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <Button 
                          onClick={generateExcelSpreadsheet} 
                          variant="outline"
                          className="w-full"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Planilha Excel
                        </Button>
                        <Button 
                          onClick={downloadBulkQRCodes} 
                          disabled={downloadingZip}
                          variant="outline"
                          className="w-full"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          {downloadingZip ? 'Gerando ZIP...' : 'Imagens ZIP'}
                        </Button>
                        <Button 
                          onClick={printBulkQRCodes} 
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
                          {bulkQRCodes.slice(0, 9).map((qrCode, index) => (
                            <div key={index} className="text-center">
                              <Image 
                                src={qrCode.qrCodeUrl} 
                                alt={`QR ${qrCode.vehicle.placa}`}
                                width={96}
                                height={192}
                                className="mx-auto border rounded"
                                style={{ objectFit: 'contain' }}
                              />
                              <div className="text-xs text-gray-600 mt-1">
                                {qrCode.vehicle.placa}
                              </div>
                            </div>
                          ))}
                          {bulkQRCodes.length > 9 && (
                            <div className="text-center text-gray-500 text-xs">
                              +{bulkQRCodes.length - 9} mais...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Excel */}
            <TabsContent value="excel">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Geração de QR Codes via Excel
                  </CardTitle>
                  <CardDescription>
                    Faça upload de um arquivo Excel com dados dos colaboradores para gerar QR codes em massa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelQRGenerator />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Visualização do QR Code */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>QR Code Gerado</CardTitle>
              <CardDescription>
                Visualize, baixe ou imprima o QR Code gerado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : qrCodeUrl ? (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        className="w-80 h-[32rem]" 
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  </div>

                  {/* Dados do QR Code */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Dados do QR Code:</p>
                        <p className="text-sm text-gray-600 font-mono break-all">{qrCodeData}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyQRData}
                        className="ml-2"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={downloadQRCode} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Baixar PNG
                    </Button>
                    <Button onClick={printQRCode} variant="outline">
                      <QrCode className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button>
                  </div>

                  {/* Informações de uso */}
                  <Alert>
                    <QrCode className="h-4 w-4" />
                    <AlertDescription>
                      Este QR Code pode ser usado no aplicativo móvel para identificação rápida.
                      Cole em veículos ou crachás para facilitar o acesso ao sistema.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <QrCode className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-center">
                    Selecione um item e clique em &ldquo;Gerar QR Code&rdquo; para visualizar
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Instruções de uso */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como usar os QR Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Car className="w-4 h-4" />
                QR Codes de Veículos
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Cole no para-brisa ou painel do veículo</li>
                <li>• Placa do veículo visível abaixo do QR code</li>
                <li>• Supervisores podem escanear para buscar o veículo</li>
                <li>• Acesso rápido aos detalhes e criação de manutenções</li>
                <li>• Formato: VEHICLE:PLACA:ID</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                QR Codes de Colaboradores
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Adicione ao crachá ou cartão do colaborador</li>
                <li>• Identificação rápida no sistema de portaria</li>
                <li>• Controle de acesso e registro de atividades</li>
                <li>• Formato: USER:MATRICULA:ID:NOME</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Geração em Massa
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Gere QR codes para todos os veículos de um local</li>
                <li>• Cada QR code inclui a placa do veículo em destaque</li>
                <li>• Baixe planilha Excel com códigos e informações</li>
                <li>• Baixe todas as imagens em arquivo ZIP organizado</li>
                <li>• Imprima em lote para distribuição</li>
                <li>• Ideal para implementação em massa no sistema</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Excel
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Faça upload de arquivo Excel com dados dos colaboradores</li>
                <li>• Colunas obrigatórias: Nome e Matrícula</li>
                <li>• Colunas opcionais: Cargo e Local</li>
                <li>• Geração automática de QR codes para todos os registros</li>
                <li>• Download em ZIP com imagens ou Excel com códigos</li>
                <li>• Ideal para importação em massa de colaboradores</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </PermissionGuard>
  )
}