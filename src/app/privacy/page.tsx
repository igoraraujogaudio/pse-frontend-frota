'use client'

import React from 'react'
import { Shield, Lock, Eye, FileText, Mail, Building2, Globe } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 rounded-lg p-2">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PSE</h1>
                <p className="text-gray-600 text-sm">Projetos e Serviços de Engenharia</p>
              </div>
            </div>
            <Link 
              href="/site"
              className="text-blue-600 hover:text-blue-700 transition-colors flex items-center"
            >
              <Globe className="h-4 w-4 mr-2" />
              Voltar ao Site
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
          {/* Title Section */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 rounded-full p-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Política de Privacidade
            </h1>
            <p className="text-gray-600 text-lg">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {/* Introduction */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              1. Introdução
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              O PSE (Projetos e Serviços de Engenharia) está comprometido em proteger a privacidade 
              e a segurança dos dados dos nossos usuários. Esta Política de Privacidade descreve 
              como coletamos, usamos, armazenamos e protegemos suas informações pessoais quando você 
              utiliza nosso aplicativo móvel.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Ao utilizar o aplicativo PSE, você concorda com as práticas descritas nesta política. 
              Se você não concordar com esta política, por favor, não utilize nosso aplicativo.
            </p>
          </section>

          {/* Data Collection */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Eye className="h-6 w-6 mr-2 text-blue-600" />
              2. Informações que Coletamos
            </h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">
              2.1. Informações Fornecidas por Você
            </h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Dados de cadastro (nome, e-mail, matrícula, cargo)</li>
              <li>Credenciais de acesso (usuário e senha)</li>
              <li>Informações de perfil profissional</li>
              <li>Dados relacionados às suas atividades no sistema</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">
              2.2. Informações Coletadas Automaticamente
            </h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Dados de uso do aplicativo (logs de acesso, funcionalidades utilizadas)</li>
              <li>Informações do dispositivo (modelo, sistema operacional, versão do app)</li>
              <li>Dados de localização (quando necessário para funcionalidades específicas)</li>
              <li>Identificadores únicos do dispositivo</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">
              2.3. Informações de Terceiros
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Podemos receber informações sobre você de outras fontes, como seu empregador ou 
              organização que utiliza nossos serviços, para fins de autenticação e gerenciamento 
              de acesso.
            </p>
          </section>

          {/* Data Usage */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Lock className="h-6 w-6 mr-2 text-blue-600" />
              3. Como Utilizamos suas Informações
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Utilizamos as informações coletadas para os seguintes fins:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Fornecer, manter e melhorar nossos serviços</li>
              <li>Autenticar sua identidade e gerenciar seu acesso ao sistema</li>
              <li>Processar suas solicitações e transações</li>
              <li>Enviar notificações importantes sobre o serviço</li>
              <li>Garantir a segurança e prevenir fraudes</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Realizar análises e melhorias no aplicativo</li>
              <li>Fornecer suporte técnico quando necessário</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              4. Compartilhamento de Informações
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Não vendemos suas informações pessoais. Podemos compartilhar suas informações apenas 
              nas seguintes situações:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>
                <strong>Com sua organização:</strong> Seu empregador ou organização que utiliza 
                nossos serviços pode ter acesso às informações relacionadas ao seu uso do sistema 
                para fins de gestão e administração.
              </li>
              <li>
                <strong>Prestadores de serviços:</strong> Podemos compartilhar informações com 
                prestadores de serviços confiáveis que nos auxiliam na operação do aplicativo 
                (como hospedagem de dados, análise de segurança), sujeitos a acordos de confidencialidade.
              </li>
              <li>
                <strong>Obrigações legais:</strong> Podemos divulgar informações se exigido por lei, 
                ordem judicial ou processo legal.
              </li>
              <li>
                <strong>Proteção de direitos:</strong> Podemos compartilhar informações para proteger 
                nossos direitos, propriedade ou segurança, bem como a de nossos usuários.
              </li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              5. Segurança dos Dados
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger 
              suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Autenticação segura e controle de acesso</li>
              <li>Monitoramento regular de segurança</li>
              <li>Backups regulares dos dados</li>
              <li>Atualizações de segurança contínuas</li>
              <li>Treinamento de pessoal em práticas de segurança</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Embora façamos o nosso melhor para proteger suas informações, nenhum método de 
              transmissão pela internet ou armazenamento eletrônico é 100% seguro. Portanto, 
              não podemos garantir segurança absoluta.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              6. Retenção de Dados
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Mantemos suas informações pessoais apenas pelo tempo necessário para cumprir os 
              propósitos descritos nesta política, a menos que um período de retenção mais longo 
              seja exigido ou permitido por lei. Quando suas informações não forem mais necessárias, 
              as excluiremos de forma segura.
            </p>
          </section>

          {/* User Rights */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              7. Seus Direitos
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Você tem os seguintes direitos em relação às suas informações pessoais:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>
                <strong>Acesso:</strong> Você pode solicitar acesso às suas informações pessoais 
                que mantemos.
              </li>
              <li>
                <strong>Correção:</strong> Você pode solicitar a correção de informações incorretas 
                ou incompletas.
              </li>
              <li>
                <strong>Exclusão:</strong> Você pode solicitar a exclusão de suas informações, 
                sujeito a obrigações legais de retenção.
              </li>
              <li>
                <strong>Portabilidade:</strong> Você pode solicitar uma cópia de seus dados em 
                formato estruturado.
              </li>
              <li>
                <strong>Oposição:</strong> Você pode se opor ao processamento de suas informações 
                em certas circunstâncias.
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Para exercer esses direitos, entre em contato conosco através dos canais indicados 
              na seção de contato abaixo.
            </p>
          </section>

          {/* Children Privacy */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              8. Privacidade de Menores
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Nosso aplicativo não é direcionado a menores de 13 anos. Não coletamos intencionalmente 
              informações pessoais de menores de 13 anos. Se tomarmos conhecimento de que coletamos 
              informações de uma criança menor de 13 anos sem verificação do consentimento dos pais, 
              tomaremos medidas para excluir essas informações de nossos servidores.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              9. Alterações nesta Política
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre 
              quaisquer alterações publicando a nova política nesta página e atualizando a data de 
              &quot;Última atualização&quot; no topo desta política. Recomendamos que você revise esta política 
              periodicamente para se manter informado sobre como protegemos suas informações.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Mail className="h-6 w-6 mr-2 text-blue-600" />
              10. Contato
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Se você tiver dúvidas, preocupações ou solicitações relacionadas a esta Política de 
              Privacidade ou ao tratamento de suas informações pessoais, entre em contato conosco:
            </p>
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <p className="text-gray-800 font-semibold mb-2">PSE - Projetos e Serviços de Engenharia</p>
              <p className="text-gray-700">
                Para questões relacionadas à privacidade, entre em contato através do seu 
                administrador de sistema ou do suporte técnico da sua organização.
              </p>
            </div>
          </section>

          {/* Consent */}
          <section className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 text-center">
                Ao utilizar o aplicativo PSE, você reconhece que leu e compreendeu esta Política 
                de Privacidade e concorda com a coleta, uso e compartilhamento de suas informações 
                conforme descrito acima.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-gray-600 mb-2">
            © {new Date().getFullYear()} PSE - Projetos e Serviços de Engenharia
          </p>
          <p className="text-gray-500 text-sm">
            Todos os direitos reservados
          </p>
          <div className="mt-4 flex justify-center space-x-4 text-sm text-gray-600">
            <Link href="/site" className="hover:text-blue-600 transition-colors">
              Site Oficial
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-blue-600 transition-colors font-semibold">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

