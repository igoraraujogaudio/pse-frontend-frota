'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button'; // TODO: Add action buttons
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { useVehicleDocumentationData, documentRulesUtils } from '@/hooks/useVehicleDocumentRules'; // TODO: Implement vehicle documentation data
import { CheckCircle, AlertTriangle, XCircle, Eye } from 'lucide-react';

interface VehicleCompliancePreviewProps {
  // Dados da regra sendo criada/editada para preview
  rulePreview?: {
    tipo_veiculo?: string[]; // CORRIGIDO: agora é array para múltiplos tipos
    prefixo_placa?: string;
    prefixos_placa?: string[]; // múltiplos prefixos
    placa_especifica?: string;
    contrato_id?: string;
    documentos_obrigatorios: string[];
    documentos_opcionais: string[];
  };
}

// Tipos de documento com labels
const DOCUMENT_LABELS: { [key: string]: string } = {
  'crlv': 'CRLV',
  'tacografo': 'Laudo Tacógrafo',
  'fumaca': 'Laudo de Fumaça',
  'eletrico': 'Laudo Elétrico',
  'acustico': 'Laudo Acústico',
  'aet': 'AET',
  'apolice': 'Apólice',
  'contrato_seguro': 'Contrato de Aluguel'
};

export function VehicleCompliancePreview({ rulePreview }: VehicleCompliancePreviewProps) {
  const [testVehicle, setTestVehicle] = useState({
    placa: '',
    tipo_veiculo: '',
    contrato_id: '',
    id: ''
  });
  // const [showPreview, setShowPreview] = useState(false); // TODO: Implement preview toggle

  // Se há uma regra em preview, simular como ela afetaria veículos
  const getPreviewDocuments = () => {
    if (!rulePreview || !testVehicle.placa) return [];

    // Verificar se a regra se aplicaria ao veículo de teste
    const ruleApplies = 
      (rulePreview.placa_especifica && rulePreview.placa_especifica === testVehicle.placa) ||
      (rulePreview.contrato_id && rulePreview.contrato_id === testVehicle.contrato_id) ||
      (rulePreview.tipo_veiculo && rulePreview.tipo_veiculo.includes(testVehicle.tipo_veiculo)) || // CORRIGIDO: usar includes para array
      (rulePreview.prefixos_placa && rulePreview.prefixos_placa.some(prefix => testVehicle.placa.startsWith(prefix))) ||
      (rulePreview.prefixo_placa && testVehicle.placa.startsWith(rulePreview.prefixo_placa));

    if (!ruleApplies) return [];

    // Combinar documentos obrigatórios e opcionais
    const documents = [
      ...rulePreview.documentos_obrigatorios.map(doc => ({
        tipo: doc,
        label: DOCUMENT_LABELS[doc] || doc,
        obrigatorio: true,
        origem: rulePreview.placa_especifica ? 'Placa Específica' :
               rulePreview.contrato_id ? 'Contrato Específico' :
               rulePreview.tipo_veiculo ? 'Tipo de Veículo' :
               rulePreview.prefixos_placa ? 'Múltiplos Prefixos de Placa' : 'Prefixo de Placa'
      })),
      ...rulePreview.documentos_opcionais.map(doc => ({
        tipo: doc,
        label: DOCUMENT_LABELS[doc] || doc,
        obrigatorio: false,
        origem: rulePreview.placa_especifica ? 'Placa Específica' :
               rulePreview.contrato_id ? 'Contrato Específico' :
               rulePreview.tipo_veiculo ? 'Tipo de Veículo' :
               rulePreview.prefixos_placa ? 'Múltiplos Prefixos de Placa' : 'Prefixo de Placa'
      }))
    ];

    return documents;
  };

  const previewDocuments = getPreviewDocuments();

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Preview da Regra
        </CardTitle>
        <CardDescription>
          Teste como esta regra afetará os documentos de um veículo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campos de teste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="test-placa">Placa do Veículo (teste)</Label>
            <Input
              id="test-placa"
              placeholder="Ex: ABC-1234"
              value={testVehicle.placa}
              onChange={(e) => setTestVehicle({
                ...testVehicle,
                placa: e.target.value.toUpperCase()
              })}
            />
          </div>
          <div>
            <Label htmlFor="test-tipo">Tipo do Veículo (teste)</Label>
            <Select
              value={testVehicle.tipo_veiculo}
              onValueChange={(value) => setTestVehicle({
                ...testVehicle,
                tipo_veiculo: value
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Passeio">Passeio</SelectItem>
                <SelectItem value="Caminhão">Caminhão</SelectItem>
                <SelectItem value="Utilitário">Utilitário</SelectItem>
                <SelectItem value="Moto">Moto</SelectItem>
                <SelectItem value="Van">Van</SelectItem>
                <SelectItem value="Ônibus">Ônibus</SelectItem>
                <SelectItem value="Caminhonete">Caminhonete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="test-contrato">Contrato (teste)</Label>
            <Input
              id="test-contrato"
              placeholder="UUID do contrato"
              value={testVehicle.contrato_id}
              onChange={(e) => setTestVehicle({
                ...testVehicle,
                contrato_id: e.target.value
              })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Para testar regras por contrato, cole o UUID do contrato
            </p>
          </div>
        </div>

        {/* Resultado do preview */}
        {testVehicle.placa && rulePreview && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">
              Resultado para veículo {testVehicle.placa} ({testVehicle.tipo_veiculo || 'Tipo não definido'})
            </h4>
            
            {previewDocuments.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-gray-600">
                  Esta regra não se aplicaria a este veículo
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700">
                    Regra aplicável! Origem: {previewDocuments[0]?.origem}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Documentos Obrigatórios */}
                  <div>
                    <h5 className="font-medium text-red-700 mb-2">
                      Documentos Obrigatórios ({previewDocuments.filter(d => d.obrigatorio).length})
                    </h5>
                    <div className="space-y-2">
                      {previewDocuments.filter(d => d.obrigatorio).map(doc => (
                        <div key={doc.tipo} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm">{doc.label}</span>
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Documentos Opcionais */}
                  <div>
                    <h5 className="font-medium text-blue-700 mb-2">
                      Documentos Opcionais ({previewDocuments.filter(d => !d.obrigatorio).length})
                    </h5>
                    <div className="space-y-2">
                      {previewDocuments.filter(d => !d.obrigatorio).map(doc => (
                        <div key={doc.tipo} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">{doc.label}</span>
                          <Badge variant="outline" className="text-xs">
                            Opcional
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> CRLV é sempre obrigatório para todos os veículos, 
                    mesmo que não esteja explicitamente na lista de documentos obrigatórios desta regra.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!rulePreview && (
          <div className="text-center text-gray-500 py-8">
            <p>Configure uma regra acima para ver o preview</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
