'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Smartphone, 
  CheckCircle, 
  ExternalLink,
  Shield,
  Download,
  Star,
  Users,
  Package,
  Globe,
  FileCheck
} from 'lucide-react'

export default function PlayStorePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        
        {/* Header */}
        <div className="text-center text-white space-y-4">
          <div className="flex items-center justify-center">
            <div className="bg-white rounded-full p-4 shadow-2xl">
              <Smartphone className="h-16 w-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">PSE Mobile</h1>
          <p className="text-green-100 text-xl">Disponível na Google Play Store</p>
          <Badge className="bg-white text-green-600 px-4 py-2 text-lg">
            <Star className="h-5 w-5 mr-2 fill-yellow-400 text-yellow-400" />
            Verificado pela Google Play
          </Badge>
        </div>

        {/* Informações do App */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Sobre o Aplicativo</h2>
            <p className="text-green-100">
              Sistema completo de gestão de frota, manutenções, almoxarifado e muito mais.
            </p>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Informações Técnicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                <Package className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-500">Package Name</p>
                  <p className="font-semibold text-gray-900">com.pse.app</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                <Globe className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-500">Versão Atual</p>
                  <p className="font-semibold text-gray-900">2.0.3</p>
                </div>
              </div>
            </div>

            {/* Status de Verificação */}
            <Alert className="border-green-200 bg-green-50">
              <Shield className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>App Verificado</strong> - Este aplicativo foi verificado e está disponível na Google Play Store.
                O arquivo de verificação está disponível em <code className="bg-green-100 px-2 py-1 rounded">/.well-known/assetlinks.json</code>
              </AlertDescription>
            </Alert>

            {/* Links Úteis */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileCheck className="h-5 w-5 mr-2 text-green-600" />
                Verificação da Play Store
              </h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-blue-900">
                  Para verificar a propriedade do app na Google Play Console, você precisa configurar o arquivo de verificação.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Arquivo de Verificação</p>
                      <p className="text-xs text-blue-700">
                        Acesse: <code className="bg-blue-100 px-1 py-0.5 rounded">/.well-known/assetlinks.json</code>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">SHA-256 Fingerprint</p>
                      <p className="text-xs text-blue-700">
                        Obtenha o SHA-256 do certificado de assinatura do app na Google Play Console
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Configuração Automática</p>
                      <p className="text-xs text-blue-700">
                        O arquivo já está configurado e acessível publicamente
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                asChild
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <a 
                  href="https://play.google.com/store/apps/details?id=com.pse.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Abrir na Play Store
                </a>
              </Button>
              
              <Button 
                asChild
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <a 
                  href="/.well-known/assetlinks.json" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <FileCheck className="h-5 w-5 mr-2" />
                  Ver Arquivo de Verificação
                </a>
              </Button>
            </div>

            {/* Informações Adicionais */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-600" />
                Recursos do Aplicativo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Gestão de Frota</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Controle de Manutenções</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Almoxarifado</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Checklist de Veículos</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Notificações Push</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Sincronização em Tempo Real</span>
                </div>
              </div>
            </div>

            {/* Link Alternativo para Download APK */}
            <div className="border-t pt-6">
              <Alert className="border-blue-200 bg-blue-50">
                <Download className="h-5 w-5 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Download Alternativo:</strong> Se preferir instalar diretamente via APK, 
                  acesse nossa <a href="/apk" className="underline font-semibold">página de download</a>.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white text-sm space-y-2">
          <p className="text-green-100">
            © {new Date().getFullYear()} PSE - Todos os direitos reservados
          </p>
          <p className="text-green-200 text-xs">
            Este aplicativo está disponível na Google Play Store e foi verificado pela Google.
          </p>
        </div>
      </div>
    </div>
  )
}




