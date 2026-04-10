'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { 
  Smartphone, 
  Package, 
  Car, 
  Wrench, 
  Users,
  Shield,
  CheckCircle,
  Download,
  ExternalLink,
  Globe,
  Building2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SitePage() {
  const router = useRouter()

  const handlePlayStoreClick = () => {
    router.push('/play-store')
  }

  const handleApkClick = () => {
    router.push('/apk')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" style={{ position: 'relative', zIndex: 1 }}>
      <style jsx global>{`
        /* Garantir que botões sejam clicáveis */
        button {
          pointer-events: auto !important;
          cursor: pointer !important;
          position: relative;
          z-index: 10;
        }
        a {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        /* Remover qualquer overlay que possa estar bloqueando */
        body > *:not(script):not(style) {
          pointer-events: auto !important;
        }
      `}</style>
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-lg p-2">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">PSE</h1>
                <p className="text-blue-100 text-sm">Programa de Segurança Empresarial</p>
              </div>
            </div>
            <Badge className="bg-white text-blue-600 px-4 py-2">
              <Globe className="h-4 w-4 mr-2" />
              Site Oficial
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-center">
            <div className="bg-white rounded-full p-6 shadow-2xl">
              <Smartphone className="h-20 w-20 text-blue-600" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Sistema PSE Mobile
          </h1>
          
          <p className="text-xl text-blue-100 mb-8">
            Solução completa de gestão empresarial para frota, manutenções, almoxarifado e muito mais
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={handlePlayStoreClick}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-semibold transition-all bg-white text-blue-600 hover:bg-blue-50 h-12 px-6 shadow-sm cursor-pointer"
              style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
            >
              <ExternalLink className="h-5 w-5" />
              Ver na Play Store
            </button>
            
            <button
              type="button"
              onClick={handleApkClick}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-semibold transition-all border-2 border-white text-white hover:bg-white/10 h-12 px-6 shadow-sm cursor-pointer"
              style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
            >
              <Download className="h-5 w-5" />
              Download APK
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white/5 backdrop-blur-sm py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Funcionalidades Principais
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="bg-white rounded-lg p-3 w-fit mb-4">
                <Car className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Gestão de Frota</h3>
              <p className="text-blue-100 text-sm">
                Controle completo de veículos, alocação de equipes e operações
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="bg-white rounded-lg p-3 w-fit mb-4">
                <Wrench className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Manutenções</h3>
              <p className="text-blue-100 text-sm">
                Sistema completo de manutenções preventivas e corretivas
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="bg-white rounded-lg p-3 w-fit mb-4">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Almoxarifado</h3>
              <p className="text-blue-100 text-sm">
                Gestão de estoque, EPIs e materiais com controle completo
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="bg-white rounded-lg p-3 w-fit mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Equipes</h3>
              <p className="text-blue-100 text-sm">
                Gerenciamento de equipes e colaboradores
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* App Info Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Sobre o Aplicativo
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <p className="text-blue-200 text-sm">Package Name</p>
              <p className="text-white font-semibold text-lg">com.pse.app</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-blue-200 text-sm">Versão Atual</p>
              <p className="text-white font-semibold text-lg">2.0.3</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-blue-200 text-sm">Plataforma</p>
              <p className="text-white font-semibold text-lg">Android</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-blue-200 text-sm">Status</p>
              <Badge className="bg-green-500 text-white">
                <CheckCircle className="h-4 w-4 mr-1" />
                Verificado
              </Badge>
            </div>
          </div>

          <div className="border-t border-white/20 pt-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Segurança e Verificação
            </h3>
            <p className="text-blue-100 mb-4">
              O aplicativo PSE Mobile está disponível na Google Play Store e foi verificado pela Google.
              Todos os dados são protegidos e o aplicativo segue as melhores práticas de segurança.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlayStoreClick}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border-2 border-white text-white hover:bg-white/10 h-10 px-6 cursor-pointer"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              >
                Ver Página da Play Store
              </button>
              <a 
                href="/.well-known/assetlinks.json" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border-2 border-white text-white hover:bg-white/10 h-10 px-6 cursor-pointer"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              >
                Arquivo de Verificação
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-sm border-t border-white/10 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-blue-100 mb-2">
            © {new Date().getFullYear()} PSE - Programa de Segurança Empresarial
          </p>
          <p className="text-blue-200 text-sm">
            Todos os direitos reservados
          </p>
          <div className="mt-4 flex justify-center space-x-4 text-sm text-blue-200">
            <Link href="/play-store" className="hover:text-white transition-colors">
              Play Store
            </Link>
            <span>•</span>
            <Link href="/apk" className="hover:text-white transition-colors">
              Download APK
            </Link>
            <span>•</span>
            <a href="/.well-known/assetlinks.json" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Verificação
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}




