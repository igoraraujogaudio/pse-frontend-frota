'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { VehicleDocument } from '@/types';
import { useVehicleDocumentationData } from '@/hooks/useVehicleDocumentRules';
import { DocumentTextIcon, EyeIcon, ArrowUpTrayIcon, ShieldCheckIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AlertCircle, Clock } from 'lucide-react';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import PermissionGuard from '@/components/permissions/PermissionGuard';

interface DocumentUploadData {
  tipo: string;
  label: string;
  documento?: VehicleDocument;
}

interface VehicleDocumentSectionProps {
  vehicleId: string;
  documents: VehicleDocument[];
  isLoading: boolean;
  error: string | null;
  onUploadClick: (docType: DocumentUploadData) => void;
  onOSClick?: (documento: VehicleDocument) => void;
  isEditing?: boolean;
  onDateChange?: (documentId: string, newDate: string) => void;
  editableDocuments?: {[key: string]: string};
}

export function VehicleDocumentSection({ 
  vehicleId,
  documents, 
  isLoading, 
  error, 
  onUploadClick,
  onOSClick,
  isEditing = false,
  onDateChange,
  editableDocuments = {}
}: VehicleDocumentSectionProps) {
  // const [showOSModal, setShowOSModal] = useState<{ documento: VehicleDocument } | null>(null); // TODO: Implement OS modal
  const [showHistoryType, setShowHistoryType] = useState<{ tipo: string; label: string } | null>(null);

  // Verificar permissão para visualizar apólice e contrato de aluguel
  const { hasPermission } = useModularPermissions();
  const canViewApoliceContrato = hasPermission(PERMISSION_CODES.VEICULOS.VISUALIZAR_APOLICE_CONTRATO_ALUGUEL);

  // Usar o novo sistema de documentação baseado em regras
  const { 
    requiredDocuments, 
    compliance, 
    isLoading: rulesLoading, 
    error: rulesError 
  } = useVehicleDocumentationData(vehicleId);

  // Debug: Log dos dados recebidos
  console.log('VehicleDocumentSection Debug:', {
    vehicleId,
    requiredDocuments,
    compliance,
    rulesLoading,
    rulesError,
    shouldUseLegacySystem: !requiredDocuments || rulesError
  });

  // Se não há regras carregadas, usar sistema legado
  const shouldUseLegacySystem = !requiredDocuments || rulesError;

  // Função para obter tipos de documentos filtrados por permissão
  function getFilteredDocumentTypes() {
    const baseDocuments = [
      { key: 'crlv', label: 'CRLV' },
      { key: 'tacografo', label: 'Tacógrafo' },
      { key: 'fumaca', label: 'Fumaça' },
      { key: 'eletrico', label: 'Elétrico' },
      { key: 'acustico', label: 'Acústico' },
      { key: 'aet', label: 'AET' }
    ];

    // Documentos sensíveis que requerem permissão específica
    const sensitiveDocuments = [
      { key: 'apolice', label: 'Apólice' },
      { key: 'contrato_seguro', label: 'Contrato de Aluguel' }
    ];

    // Se tem permissão, incluir documentos sensíveis
    if (canViewApoliceContrato) {
      return [...baseDocuments, ...sensitiveDocuments];
    }

    // Caso contrário, apenas documentos básicos
    return baseDocuments;
  }

  // Helper: contar versões de um tipo de documento
  function getDocVersions(tipo: string): VehicleDocument[] {
    return (documents || [])
      .filter(d => d.tipo_documento === tipo)
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }

  // Componente do botão de histórico
  function HistoryButton({ tipo, label }: { tipo: string; label: string }) {
    const versions = getDocVersions(tipo);
    if (versions.length <= 1) return null;
    return (
      <button
        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        onClick={() => setShowHistoryType({ tipo, label })}
        title={`Ver histórico de ${label}`}
      >
        <ClockIcon className="h-4 w-4 mr-1" />
        Histórico ({versions.length})
      </button>
    );
  }

  // Modal de histórico
  function HistoryModal() {
    if (!showHistoryType) return null;
    const versions = getDocVersions(showHistoryType.tipo);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowHistoryType(null)}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold text-gray-900">Histórico - {showHistoryType.label}</h3>
            <button onClick={() => setShowHistoryType(null)} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3 flex flex-col gap-2">
            {versions.map((doc, idx) => (
              <div key={doc.id} className={`flex items-center justify-between px-3 py-2 rounded border ${idx === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {new Date(doc.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                    {idx === 0 && (
                      <Badge className="bg-blue-100 text-blue-700 font-semibold text-[10px] px-1.5 py-0">Atual</Badge>
                    )}
                  </div>
                  {doc.expira_em && (
                    <span className="text-xs text-gray-500">
                      Vencimento: {new Date(doc.expira_em).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {doc.url_arquivo && (
                  <a
                    href={doc.url_arquivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                  >
                    <EyeIcon className="h-4 w-4" />
                    Visualizar
                  </a>
                )}
              </div>
            ))}
            {versions.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum histórico encontrado.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || rulesLoading) {
    return <div className="text-gray-600">Carregando documentos...</div>;
  }

  if (error || (rulesError && !shouldUseLegacySystem)) {
    return <div className="text-red-600">Erro ao carregar documentos</div>;
  }

  // Usar novo sistema baseado em regras se disponível, mas com visual antigo
  if (!shouldUseLegacySystem && requiredDocuments && compliance && compliance.conformidade) {
    return (
      <>
      <ul className="flex flex-col gap-2">
        {compliance.conformidade.map((complianceItem) => {
          // Para laudos elétricos, buscar todos os documentos (com diferentes subtipos)
          if (complianceItem.documento_tipo === 'eletrico') {
            const docsEletricos = documents?.filter(d => d.tipo_documento === 'eletrico') || [];
            
            // Se não há laudos elétricos, mostrar como faltando
            if (docsEletricos.length === 0) {
              return (
                <li key={complianceItem.documento_tipo} className="flex items-center justify-between px-3 py-2 rounded border bg-gray-50 border-gray-200">
                  <div className="flex flex-col items-start gap-1 min-w-[110px]">
                    <div className="flex items-start gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-base text-gray-600">
                        {complianceItem.label}
                        {complianceItem.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </div>
                    <Badge className="bg-gray-200 text-gray-600 font-semibold gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Faltando
                    </Badge>
                  </div>
                  <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                    <button
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded ml-2 text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => onUploadClick({
                        tipo: complianceItem.documento_tipo,
                        label: complianceItem.label,
                        documento: undefined
                      })}
                    >
                      <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                      Cadastrar
                    </button>
                  </PermissionGuard>
                </li>
              );
            }

            // Mostrar cada laudo elétrico individualmente
            const docsElements = docsEletricos.map((doc) => {
              // Calcular informações de vencimento
              let vencimentoInfo = null;
              if (doc?.expira_em) {
                const hoje = new Date();
                const expira = new Date(doc.expira_em);
                hoje.setHours(0, 0, 0, 0);
                expira.setHours(0, 0, 0, 0);
                const diffMs = expira.getTime() - hoje.getTime();
                const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                
                if (diffDias < 0) {
                  vencimentoInfo = (
                    <Badge className="bg-red-100 text-red-700 font-semibold gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Vencido há {Math.abs(diffDias)} dia{Math.abs(diffDias) === 1 ? '' : 's'}
                    </Badge>
                  );
                } else if (diffDias <= 30) {
                  vencimentoInfo = (
                    <Badge className="bg-yellow-100 text-yellow-700 font-semibold gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Vence em {diffDias} dia{diffDias === 1 ? '' : 's'}
                    </Badge>
                  );
                } else {
                  vencimentoInfo = (
                    <Badge className="bg-green-100 text-green-700 font-semibold gap-1">
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      Válido por {diffDias} dia{diffDias === 1 ? '' : 's'}
                    </Badge>
                  );
                }
              }

              const subtipo = doc.subtipo_documento || 'geral';
              const subtipoLabels: { [key: string]: string } = {
                'lanca_isolada': 'Lança Isolada',
                'liner': 'Liner',
                'geral': 'Geral'
              };
              const subtipoColors: { [key: string]: string } = {
                'lanca_isolada': 'bg-blue-100 text-blue-800',
                'liner': 'bg-green-100 text-green-800',
                'geral': 'bg-gray-100 text-gray-800'
              };

              return (
                <li key={`${complianceItem.documento_tipo}-${doc.id}`} className="flex items-center justify-between px-3 py-2 rounded border bg-white border-gray-200">
                  <div className="flex flex-col items-start gap-1 min-w-[110px]">
                     <div className="flex items-start gap-2">
                       <DocumentTextIcon className="h-5 w-5" />
                       <div className="flex flex-col">
                         <span className="font-medium text-base">
                           {complianceItem.label}{complianceItem.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                         </span>
                         <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block w-fit ${subtipoColors[subtipo] || 'bg-gray-100 text-gray-800'}`}>
                           {subtipoLabels[subtipo] || subtipo}
                         </span>
                       </div>
                     </div>
                     {vencimentoInfo && (
                       <div className="flex items-center justify-between w-full">
                         <div>{vencimentoInfo}</div>
                         {doc?.expira_em && (
                           isEditing ? (
                             <input
                               type="date"
                               value={editableDocuments[doc.id] || doc.expira_em.split('T')[0]}
                               onChange={(e) => onDateChange && onDateChange(doc.id, e.target.value)}
                               className="text-xs font-bold border rounded px-1 py-0.5 w-24"
                             />
                           ) : (
                             <span className="text-xs text-gray-500 font-bold">
                               {new Date(doc.expira_em).toLocaleDateString('pt-BR')}
                             </span>
                           )
                         )}
                       </div>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-3 py-1">
                    <a
                      href={doc.url_arquivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                      title="Visualizar PDF"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Visualizar
                    </a>
                    <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                      <button
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => onUploadClick({
                          tipo: complianceItem.documento_tipo,
                          label: complianceItem.label,
                          documento: doc
                        })}
                      >
                        <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                        Atualizar
                      </button>
                    </PermissionGuard>
                  </div>
                </li>
              );
            });

            // Adicionar botão para criar novo laudo elétrico
            docsElements.push(
              <li key={`${complianceItem.documento_tipo}-add-new`} className="flex items-center justify-center px-3 py-2">
                <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                  <button
                    className="inline-flex items-center px-3 py-1 border border-green-600 text-sm font-medium rounded text-green-600 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    onClick={() => onUploadClick({
                      tipo: complianceItem.documento_tipo,
                      label: complianceItem.label,
                      documento: undefined // Sem documento = sempre criar novo
                    })}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                    Adicionar Novo Tipo - Laudo Elétrico
                  </button>
                </PermissionGuard>
              </li>
            );

            return docsElements;
          }

          // Para outros tipos de documento, manter lógica original
          const doc = documents?.find(d => d.tipo_documento === complianceItem.documento_tipo);
          
          // Calcular informações de vencimento no estilo antigo
          let vencimentoInfo = null;
          if (doc?.expira_em) {
            const hoje = new Date();
            const expira = new Date(doc.expira_em);
            hoje.setHours(0, 0, 0, 0);
            expira.setHours(0, 0, 0, 0);
            const diffMs = expira.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) {
              vencimentoInfo = (
                <Badge className="bg-red-100 text-red-700 font-semibold gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Vencido há {Math.abs(diffDias)} dia{Math.abs(diffDias) === 1 ? '' : 's'}
                </Badge>
              );
            } else if (diffDias <= 30) {
              vencimentoInfo = (
                <Badge className="bg-yellow-100 text-yellow-700 font-semibold gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Vence em {diffDias} dia{diffDias === 1 ? '' : 's'}
                </Badge>
              );
            } else {
              vencimentoInfo = (
                <Badge className="bg-green-100 text-green-700 font-semibold gap-1">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  Válido por {diffDias} dia{diffDias === 1 ? '' : 's'}
                </Badge>
              );
            }
          }

          const isMissing = !doc;
          
          return (
            <li key={complianceItem.documento_tipo} className={`flex items-center justify-between px-3 py-2 rounded border ${isMissing ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col items-start gap-1 min-w-[110px]">
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex items-start gap-2">
                    <DocumentTextIcon className={`h-5 w-5 ${isMissing ? 'text-gray-600' : ''}`} />
                    <span className={`font-medium text-base ${isMissing ? 'text-gray-600' : ''}`}>
                      {complianceItem.label}
                      {complianceItem.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                  {doc?.expira_em && (
                    isEditing ? (
                      <input
                        type="date"
                        value={editableDocuments[doc.id] || doc.expira_em.split('T')[0]}
                        onChange={(e) => onDateChange && onDateChange(doc.id, e.target.value)}
                        className="text-xs font-bold border rounded px-1 py-0.5 w-24"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">
                        {new Date(doc.expira_em).toLocaleDateString('pt-BR')}
                      </span>
                    )
                  )}
                </div>
                {vencimentoInfo && (
                  <div>{vencimentoInfo}</div>
                )}

              </div>
              
              <div className="flex items-center gap-2">
                {doc ? (
                  <>
                    <a
                      href={doc.url_arquivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                      title="Visualizar PDF"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Visualizar
                    </a>
                    {complianceItem.documento_tipo === 'acustico' && (
                      <button
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={() => {
                          if (onOSClick && doc) {
                            onOSClick(doc);
                          }
                        }}
                        title="Gerenciar OS do Laudo Acústico"
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        OS ({doc.os_laudos?.length || 0})
                      </button>
                    )}
                  </>
                ) : null}
                <HistoryButton tipo={complianceItem.documento_tipo} label={complianceItem.label} />
                <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                  <button
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded ml-2 text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => onUploadClick({
                      tipo: complianceItem.documento_tipo,
                      label: complianceItem.label,
                      documento: doc
                    })}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                    {doc ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </PermissionGuard>
              </div>
            </li>
          );
        })}
      </ul>
      <HistoryModal />
    </>
    );
  }

  // Sistema legado (fallback)
  const filteredDocumentTypes = getFilteredDocumentTypes();

  return (
    <>
    <ul className="flex flex-col gap-2">
        {filteredDocumentTypes.map(docType => {
          // Para laudos elétricos, buscar todos os documentos (com diferentes subtipos)
          if (docType.key === 'eletrico') {
            const docsEletricos = documents?.filter(d => d.tipo_documento === 'eletrico') || [];
            
            // Se não há laudos elétricos, mostrar como faltando
            if (docsEletricos.length === 0) {
              return (
                <li key={docType.key} className="flex items-center justify-between px-3 py-2 rounded border bg-gray-50 border-gray-200">
                  <div className="flex flex-col items-start gap-1 min-w-[110px]">
                    <div className="flex items-start gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-base text-gray-600">
                        {docType.label}
                        <span className="text-red-500 ml-1">*</span>
                      </span>
                    </div>
                    <Badge className="bg-gray-200 text-gray-600 font-semibold gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Faltando
                    </Badge>
                  </div>
                  <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                    <button
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded ml-2 text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => onUploadClick({
                        tipo: docType.key,
                        label: docType.label,
                        documento: undefined
                      })}
                    >
                      <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                      Cadastrar
                    </button>
                  </PermissionGuard>
                </li>
              );
            }

            // Mostrar cada laudo elétrico individualmente
            const docsElements = docsEletricos.map((doc) => {
              // Calcular informações de vencimento
              let vencimentoInfo = null;
              if (doc?.expira_em) {
                const hoje = new Date();
                const expira = new Date(doc.expira_em);
                hoje.setHours(0, 0, 0, 0);
                expira.setHours(0, 0, 0, 0);
                const diffMs = expira.getTime() - hoje.getTime();
                const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                
                if (diffDias < 0) {
                  vencimentoInfo = (
                    <Badge className="bg-red-100 text-red-700 font-semibold gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Vencido há {Math.abs(diffDias)} dia{Math.abs(diffDias) === 1 ? '' : 's'}
                    </Badge>
                  );
                } else if (diffDias <= 30) {
                  vencimentoInfo = (
                    <Badge className="bg-yellow-100 text-yellow-700 font-semibold gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Vence em {diffDias} dia{diffDias === 1 ? '' : 's'}
                    </Badge>
                  );
                } else {
                  vencimentoInfo = (
                    <Badge className="bg-green-100 text-green-700 font-semibold gap-1">
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      Válido por {diffDias} dia{diffDias === 1 ? '' : 's'}
                    </Badge>
                  );
                }
              }

              const subtipo = doc.subtipo_documento || 'geral';
              const subtipoLabels: { [key: string]: string } = {
                'lanca_isolada': 'Lança Isolada',
                'liner': 'Liner',
                'geral': 'Geral'
              };
              const subtipoColors: { [key: string]: string } = {
                'lanca_isolada': 'bg-blue-100 text-blue-800',
                'liner': 'bg-green-100 text-green-800',
                'geral': 'bg-gray-100 text-gray-800'
              };

              return (
                <li key={`${docType.key}-${doc.id}`} className="flex items-center justify-between px-3 py-2 rounded border bg-white border-gray-200">
                  <div className="flex flex-col items-start gap-1 min-w-[110px]">
                     <div className="flex items-start gap-2">
                       <DocumentTextIcon className="h-5 w-5" />
                       <div className="flex flex-col">
                         <span className="font-medium text-base">
                           {docType.label}<span className="text-red-500 ml-1">*</span>
                         </span>
                         <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block w-fit ${subtipoColors[subtipo] || 'bg-gray-100 text-gray-800'}`}>
                           {subtipoLabels[subtipo] || subtipo}
                         </span>
                       </div>
                     </div>
                     {vencimentoInfo && (
                       <div className="flex items-center justify-between w-full">
                         <div>{vencimentoInfo}</div>
                         {doc?.expira_em && (
                           isEditing ? (
                             <input
                               type="date"
                               value={editableDocuments[doc.id] || doc.expira_em.split('T')[0]}
                               onChange={(e) => onDateChange && onDateChange(doc.id, e.target.value)}
                               className="text-xs font-bold border rounded px-1 py-0.5 w-24"
                             />
                           ) : (
                             <span className="text-xs text-gray-500 font-bold">
                               {new Date(doc.expira_em).toLocaleDateString('pt-BR')}
                             </span>
                           )
                         )}
                       </div>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-3 py-1">
                    <a
                      href={doc.url_arquivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                      title="Visualizar PDF"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Visualizar
                    </a>
                    <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                      <button
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => onUploadClick({
                          tipo: docType.key,
                          label: docType.label,
                          documento: doc
                        })}
                      >
                        <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                        Atualizar
                      </button>
                    </PermissionGuard>
                  </div>
                </li>
              );
            });

            // Adicionar botão para criar novo laudo elétrico
            docsElements.push(
              <li key={`${docType.key}-add-new`} className="flex items-center justify-end px-3 py-2">
                <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                  <button
                    className="inline-flex items-center px-3 py-1 border border-green-600 text-sm font-medium rounded text-green-600 bg-white hover:bg-green-50"
                    onClick={() => onUploadClick({
                      tipo: docType.key,
                      label: docType.label,
                      documento: undefined
                    })}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                    Adicionar Novo Tipo - Laudo Elétrico
                  </button>
                </PermissionGuard>
              </li>
            );

            return docsElements;
          }

          // Para outros tipos de documento, manter lógica original
          const doc = documents?.find(d => d.tipo_documento === docType.key);
          
          // Calcular informações de vencimento no estilo antigo
          let vencimentoInfo = null;
          if (doc?.expira_em) {
            const hoje = new Date();
            const expira = new Date(doc.expira_em);
            hoje.setHours(0, 0, 0, 0);
            expira.setHours(0, 0, 0, 0);
            const diffMs = expira.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) {
              vencimentoInfo = (
                <Badge className="bg-red-100 text-red-700 font-semibold gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Vencido há {Math.abs(diffDias)} dia{Math.abs(diffDias) === 1 ? '' : 's'}
                </Badge>
              );
            } else if (diffDias <= 30) {
              vencimentoInfo = (
                <Badge className="bg-yellow-100 text-yellow-700 font-semibold gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Vence em {diffDias} dia{diffDias === 1 ? '' : 's'}
                </Badge>
              );
            } else {
              vencimentoInfo = (
                <Badge className="bg-green-100 text-green-700 font-semibold gap-1">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  Válido por {diffDias} dia{diffDias === 1 ? '' : 's'}
                </Badge>
              );
            }
          }

          const isMissing = !doc;
          
          return (
            <li key={docType.key} className={`flex items-center justify-between px-3 py-2 rounded border ${isMissing ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col items-start gap-1 min-w-[110px]">
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex items-start gap-2">
                    <DocumentTextIcon className={`h-5 w-5 ${isMissing ? 'text-gray-600' : ''}`} />
                    <span className={`font-medium text-base ${isMissing ? 'text-gray-600' : ''}`}>
                      {docType.label}
                    </span>
                  </div>
                  {doc?.expira_em && (
                    isEditing ? (
                      <input
                        type="date"
                        value={editableDocuments[doc.id] || doc.expira_em.split('T')[0]}
                        onChange={(e) => onDateChange && onDateChange(doc.id, e.target.value)}
                        className="text-xs font-bold border rounded px-1 py-0.5 w-24"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">
                        {new Date(doc.expira_em).toLocaleDateString('pt-BR')}
                      </span>
                    )
                  )}
                </div>
                {vencimentoInfo && (
                  <div>{vencimentoInfo}</div>
                )}
                {/* Mostrar sistema legado discretamente */}
                <div className="text-xs text-gray-400">
                  Sistema padrão
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {doc ? (
                  <>
                    <a
                      href={doc.url_arquivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                      title="Visualizar PDF"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Visualizar
                    </a>
                    {docType.key === 'acustico' && (
                      <button
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={() => {
                          if (onOSClick && doc) {
                            onOSClick(doc);
                          }
                        }}
                        title="Gerenciar OS do Laudo Acústico"
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        OS ({doc.os_laudos?.length || 0})
                      </button>
                    )}
                  </>
                ) : null}
                <HistoryButton tipo={docType.key} label={docType.label} />
                <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA}>
                  <button
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded ml-2 text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => onUploadClick({
                      tipo: docType.key,
                      label: docType.label,
                      documento: doc
                    })}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                    {doc ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </PermissionGuard>
              </div>
            </li>
          );
        })}
    </ul>
    <HistoryModal />
    </>
  );
}