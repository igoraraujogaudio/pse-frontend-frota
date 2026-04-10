"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as XLSX from 'xlsx';
import type { Vehicle } from '@/types';
// import { locationService } from "@/services/locationService";
import { vehicleService } from "@/services/vehicleService";
import { contratoService } from "@/services/contratoService";
import { useNotification } from "@/contexts/NotificationContext";
import { TruckIcon, DocumentTextIcon, ArrowUpTrayIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

// Função para obter todos os tipos de documentos (sem restrições)
function getFilteredDocumentTypes() {
  // Retornar todos os tipos de documentos, incluindo apólices e contratos de aluguel
  return [
    { key: "crlv", label: "CRLV" },
    { key: "tacografo", label: "Tacógrafo" },
    { key: "fumaca", label: "Fumaça" },
    { key: "aet", label: "AET" },
    { key: "eletrico", label: "Elétrico" },
    { key: "acustico", label: "Acústico" },
    { key: "apolice", label: "Apólice" },
    { key: "contrato_seguro", label: "Contrato de Aluguel" }
  ];
}

export default function VehicleCreatePage() {
  const router = useRouter();
  const { notify } = useNotification();
  
  // Obter tipos de documentos filtrados baseado no nível de acesso
  const filteredDocumentTypes = getFilteredDocumentTypes();

  // Locais removidos

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: contratoService.getContratos
  });



  // Estados do formulário
  const initialEquipamentos: Record<string, boolean> = {
    giroflex: false,
    camera: false,
    tracker: false,
  };

  const [newVehicle, setNewVehicle] = useState<Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'>>({
    placa: "",
    modelo: "",
    tipo_modelo: "",
    ano_fabricacao: 0,
    ano_modelo: 0,
    renavam: "",
    chassis: "",
    status: "disponivel",
    
    contrato_id: null,
    base_id: null,
    marca_equipamento: "",
    tipo_combustivel: "",
    quilometragem_atual: 0,
    numero_crlv: "",
    versao: "",
    tipo_veiculo: "",
    valor_aluguel: 0,
    propriedade: "",
    condicao: "",
    equipamentos: initialEquipamentos,
    rastreador: "",
    supervisor_id: null,
    ultima_manutencao: null,
    proxima_manutencao: null,
    equipe_id: null,
    operacao_combustivel: "",
    prefixo_fixo: "",
    quilometragem_preventiva: null,
    intervalo_preventiva: 10000,
    proxima_preventiva_km: null,
    alerta_preventiva_km: 1000,
  });

  const [savingVehicle, setSavingVehicle] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [documentUploads, setDocumentUploads] = useState<{ [key: string]: { file: File | null; expira_em: string } }>({});

  // Estados para upload em massa
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [excelPreview, setExcelPreview] = useState<Record<string, unknown>[]>([]);
  const [selectedBulkContrato, setSelectedBulkContrato] = useState<string>("");

  // Gerar array de anos
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: (currentYear + 1) - 2000 + 1 }, (_, i) => 2000 + i);

  // Função para processar arquivo Excel
  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        setExcelData(jsonData);
        setExcelPreview(jsonData.slice(0, 5));
        notify(`${jsonData.length} veículos encontrados no arquivo Excel`, "success");
      } catch (error) {
        console.error('Erro ao processar Excel:', error);
        notify("Erro ao processar arquivo Excel", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Função para mapear condição em português para inglês
  const mapCondicaoToEnglish = (condicao: string): string => {
    const mapping: { [key: string]: string } = {
      'Novo': 'new',
      'novo': 'new',
      'NOVO': 'new',
      'Usado': 'used',
      'usado': 'used',
      'USADO': 'used',
      'Manutenção': 'maintenance',
      'manutencao': 'maintenance',
      'MANUTENÇÃO': 'maintenance',
      'MANUTENCAO': 'maintenance'
    };
    return mapping[condicao] || condicao;
  };

  // Função helper para converter valores de forma segura
  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };

  // Função para mapear dados do Excel para o formato do veículo
  const mapExcelToVehicle = (excelRow: Record<string, unknown>): Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'> => {
    const condicaoOriginal = safeString(excelRow.condicao || excelRow.Condição || "");

    return {
      placa: safeString(excelRow.placa || excelRow.Placa || ""),
      modelo: safeString(excelRow.modelo || excelRow.Modelo || ""),
      tipo_modelo: safeString(excelRow.tipo_modelo || excelRow['Tipo Modelo'] || ""),
      ano_fabricacao: Number(excelRow.ano_fabricacao || excelRow['Ano Fabricação'] || 0),
      ano_modelo: Number(excelRow.ano_modelo || excelRow['Ano Modelo'] || 0),
      renavam: safeString(excelRow.renavam || excelRow.Renavam || ""),
      chassis: safeString(excelRow.chassis || excelRow.Chassis || ""),
      status: "disponivel",
      
      contrato_id: selectedBulkContrato || null, // Nova estrutura - obrigatório
      base_id: null, // Nova estrutura - localização física
      marca_equipamento: safeString(excelRow.marca_equipamento || excelRow['Marca Equipamento'] || ""),
      tipo_combustivel: safeString(excelRow.tipo_combustivel || excelRow['Tipo Combustível'] || ""),
      quilometragem_atual: Number(excelRow.quilometragem_atual || excelRow['Quilometragem Atual'] || 0),
      numero_crlv: safeString(excelRow.numero_crlv || excelRow['Número CRLV'] || ""),
      versao: safeString(excelRow.versao || excelRow.Versão || ""),
      tipo_veiculo: safeString(excelRow.tipo_veiculo || excelRow['Tipo Veículo'] || ""),
      valor_aluguel: Number(excelRow.valor_aluguel || excelRow['Valor Aluguel'] || 0),
      propriedade: safeString(excelRow.propriedade || excelRow.Propriedade || ""),
      condicao: mapCondicaoToEnglish(condicaoOriginal),
      equipamentos: {
        giroflex: false,
        camera: false,
        tracker: false,
      },
      rastreador: safeString(excelRow.rastreador || excelRow.Rastreador || ""),
      supervisor_id: null,
      ultima_manutencao: null,
      proxima_manutencao: null,
      equipe_id: null,
      operacao_combustivel: safeString(excelRow.operacao_combustivel || excelRow['Operação Combustível'] || ""),
      prefixo_fixo: safeString(excelRow.prefixo_fixo || excelRow['Prefixo Fixo'] || ""),
      quilometragem_preventiva: null,
      intervalo_preventiva: 10000,
      proxima_preventiva_km: null,
      alerta_preventiva_km: 1000,
    };
  };

  // Mutation para upload em massa
  const bulkCreateMutation = useMutation({
    mutationFn: async (vehicles: Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'>[]) => {
      const results = [];
      for (const vehicle of vehicles) {
        try {
          const created = await vehicleService.create(vehicle);
          results.push({ success: true, vehicle: created, placa: vehicle.placa });
        } catch (error) {
          results.push({ success: false, error, placa: vehicle.placa });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        notify(`${successful} veículos cadastrados com sucesso!`, "success");
      } else {
        notify(`${successful} veículos cadastrados, ${failed} falharam.`, "warning");
      }

      setExcelData([]);
      setExcelPreview([]);
      setSelectedBulkContrato("");
      setShowBulkUpload(false);
      router.push("/dashboard");
    },
    onError: (error) => {
      console.error("Erro no upload em massa:", error);
      notify("Erro no upload em massa de veículos", "error");
    },
  });

  // Função para processar upload em massa
  const handleBulkUpload = () => {
    if (excelData.length === 0) {
      notify("Nenhum dado para processar", "error");
      return;
    }

    if (!selectedBulkContrato) {
      notify("Selecione um contrato para os veículos", "error");
      return;
    }

    setBulkUploading(true);
    const vehicles = excelData.map(mapExcelToVehicle);
    bulkCreateMutation.mutate(vehicles, {
      onSettled: () => setBulkUploading(false)
    });
  };

  // Função para baixar template Excel
  const downloadTemplate = () => {
    const templateData = [
      {
        placa: "ABC-1234",
        modelo: "Strada",
        tipo_modelo: "PICK-UP",
        ano_fabricacao: 2023,
        ano_modelo: 2023,
        renavam: "12345678901",
        chassis: "9BD12345678901234",
        marca_equipamento: "Fiat",
        tipo_combustivel: "Flex",
        quilometragem_atual: 0,
        numero_crlv: "123456789",
        versao: "Working",
        tipo_veiculo: "Utilitário",
        valor_aluguel: 1500.00,
        propriedade: "Próprio",
        condicao: "Novo",
        operacao_combustivel: "Flex",
        rastreador: "GPS123456"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Veículos");

    // Definir largura das colunas
    const colWidths = [
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 18 }, { wch: 15 }
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, "template-veiculos.xlsx");
    notify("Template Excel baixado com sucesso!", "success");
  };

  // Mutation para criar veículo individual
  const createVehicleMutation = useMutation({
    mutationFn: async (payload: Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'>) => {
      return await vehicleService.create(payload);
    },
    onSuccess: async (created) => {
      try {
        setUploadingDocuments(true);

        const documentsToUpload = filteredDocumentTypes.filter(docType =>
          documentUploads[docType.key]?.file
        );

        if (documentsToUpload.length > 0) {
          notify(`Enviando ${documentsToUpload.length} documento(s)...`, "info");

          const uploadResults = await Promise.allSettled(
            documentsToUpload.map(async (docType) => {
              const doc = documentUploads[docType.key];
              if (doc && doc.file) {
                await vehicleService.uploadDocument(doc.file, String(created.id), docType.key);
                return { success: true, docType: docType.label };
              }
              return { success: false, docType: docType.label };
            })
          );

          const successful = uploadResults.filter(result =>
            result.status === 'fulfilled' && result.value.success
          ).length;

          const failed = uploadResults.length - successful;

          if (failed === 0) {
            notify(`Veículo cadastrado com sucesso! ${successful} documento(s) enviado(s).`, "success");
          } else {
            notify(`Veículo cadastrado! ${successful} documento(s) enviado(s), ${failed} falharam.`, "warning");
          }
        } else {
          notify("Veículo cadastrado com sucesso!", "success");
        }

        router.push("/dashboard");
      } catch (error) {
        console.error("Erro no upload de documentos:", error);
        notify("Veículo criado, mas houve erro no upload de alguns documentos", "warning");
        router.push("/dashboard");
      } finally {
        setUploadingDocuments(false);
      }
    },
    onError: (error) => {
      console.error("Erro ao criar veículo:", error);
      notify("Erro ao cadastrar veículo", "error");
    },
  });
  return (
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <TruckIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-blue-900">Adicionar Veículo</h1>
              <p className="text-gray-600 mt-1">Preencha os dados do veículo e anexe os documentos obrigatórios.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            className="flex items-center gap-2"
          >
            <TableCellsIcon className="h-4 w-4" />
            {showBulkUpload ? 'Cadastro Individual' : 'Upload em Massa'}
          </Button>
        </div>

        {/* Card de Upload em Massa */}
        {showBulkUpload && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableCellsIcon className="h-5 w-5" />
                Upload em Massa via Excel
              </CardTitle>
              <CardDescription>
                Faça upload de um arquivo Excel (.xlsx) com os dados dos veículos para cadastro em massa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seletor de Contrato para Upload em Massa */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-red-600">Contrato dos Veículos *</Label>
                <Select onValueChange={value => setSelectedBulkContrato(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o contrato para todos os veículos" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.map((contrato: { id: string; nome: string; codigo: string }) => (
                      <SelectItem key={contrato.id} value={contrato.id}>
                        {contrato.nome} ({contrato.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Todos os veículos do Excel serão cadastrados neste contrato
                </p>
              </div>


              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Arquivo Excel</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="text-xs"
                  >
                    Baixar Template
                  </Button>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleExcelUpload(file);
                    }
                  }}
                />
                <p className="text-xs text-gray-500">
                  O arquivo deve conter as colunas: placa, modelo, tipo_modelo, ano_fabricacao, ano_modelo, etc.
                  <br />
                  <strong>Dica:</strong> Baixe o template acima para ter o formato correto.
                  <br />
                  <strong>Condição:</strong> Use &quot;Novo&quot;, &quot;Usado&quot; ou &quot;Manutenção&quot; em português.
                </p>
              </div>

              {excelPreview.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview dos Dados ({excelData.length} registros)</Label>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Placa</th>
                          <th className="px-3 py-2 text-left">Modelo</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Ano Fab.</th>
                          <th className="px-3 py-2 text-left">Condição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{safeString(row.placa || row.Placa) || '-'}</td>
                            <td className="px-3 py-2">{safeString(row.modelo || row.Modelo) || '-'}</td>
                            <td className="px-3 py-2">{safeString(row.tipo_modelo || row['Tipo Modelo']) || '-'}</td>
                            <td className="px-3 py-2">{safeString(row.ano_fabricacao || row['Ano Fabricação']) || '-'}</td>
                            <td className="px-3 py-2">{safeString(row.condicao || row.Condição) || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {excelData.length > 5 && (
                    <p className="text-xs text-gray-500">
                      Mostrando 5 de {excelData.length} registros
                    </p>
                  )}
                </div>
              )}

              {excelData.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkUpload}
                    disabled={bulkUploading || !selectedBulkContrato}
                    className="flex items-center gap-2"
                  >
                    {bulkUploading ? 'Processando...' : `Cadastrar ${excelData.length} Veículos`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setExcelData([]);
                      setExcelPreview([]);
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {!showBulkUpload && (
          <form className="space-y-8" onSubmit={async (e) => {
            e.preventDefault();

            const equipamentos = {
              giroflex: !!newVehicle.equipamentos.giroflex,
              camera: !!newVehicle.equipamentos.camera,
              tracker: !!newVehicle.equipamentos.tracker,
            };

            const payload: Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'> = {
              ...newVehicle,
              
              equipe_id: newVehicle.equipe_id ?? null,
              supervisor_id: newVehicle.supervisor_id ?? null,
              ultima_manutencao: newVehicle.ultima_manutencao ?? null,
              proxima_manutencao: newVehicle.proxima_manutencao ?? null,
              valor_aluguel: newVehicle.valor_aluguel ?? 0,
              quilometragem_atual: newVehicle.quilometragem_atual ?? 0,
              equipamentos,
              operacao_combustivel: newVehicle.operacao_combustivel,
            };

            // Corrigir campos vazios para null
            ['equipe_id', 'supervisor_id', 'ultima_manutencao', 'proxima_manutencao'].forEach(field => {
              if ((payload as Record<string, unknown>)[field] === "") {
                (payload as Record<string, unknown>)[field] = null;
              }
            });

            setSavingVehicle(true);
            createVehicleMutation.mutate(payload, {
              onSettled: () => setSavingVehicle(false)
            });
          }}>
            {/* GRID PRINCIPAL - 3 colunas horizontais */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CARD UNIFICADO: Dados + Especificações */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5" />
                    Dados do Veículo & Especificações
                  </CardTitle>
                  <CardDescription>
                    Preencha as informações básicas e especificações técnicas do veículo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Identificação */}
                  <div>
                    <h3 className="text-base font-semibold text-blue-700 mb-4">Identificação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="placa" className="text-sm font-medium">Placa *</Label>
                        <Input
                          id="placa"
                          placeholder="ABC-1234"
                          value={newVehicle.placa}
                          onChange={e => setNewVehicle(v => ({ ...v, placa: e.target.value.toUpperCase() }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="modelo" className="text-sm font-medium">Modelo *</Label>
                        <Input
                          id="modelo"
                          placeholder="Ex: Strada"
                          value={newVehicle.modelo}
                          onChange={e => setNewVehicle(v => ({ ...v, modelo: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="versao" className="text-sm font-medium">Versão</Label>
                        <Input
                          id="versao"
                          placeholder="Ex: Working"
                          value={newVehicle.versao}
                          onChange={e => setNewVehicle(v => ({ ...v, versao: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Ano Fabricação</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ ...v, ano_fabricacao: Number(value) }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Ano" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...yearOptions].reverse().map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Ano Modelo</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ ...v, ano_modelo: Number(value) }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Ano" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="renavam" className="text-sm font-medium">Renavam</Label>
                        <Input
                          id="renavam"
                          placeholder="00000000000"
                          value={newVehicle.renavam}
                          onChange={e => setNewVehicle(v => ({ ...v, renavam: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chassis" className="text-sm font-medium">Chassi</Label>
                        <Input
                          id="chassis"
                          placeholder="17 dígitos"
                          value={newVehicle.chassis}
                          onChange={e => setNewVehicle(v => ({ ...v, chassis: e.target.value.toUpperCase() }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numero_crlv" className="text-sm font-medium">Número CRLV</Label>
                        <Input
                          id="numero_crlv"
                          placeholder="000000000"
                          value={newVehicle.numero_crlv}
                          onChange={e => setNewVehicle(v => ({ ...v, numero_crlv: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Características */}
                  <div>
                    <h3 className="text-base font-semibold text-blue-700 mb-4">Características</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tipo_veiculo" className="text-sm font-medium">Tipo de Veículo</Label>
                        <Input
                          id="tipo_veiculo"
                          placeholder="Ex: Utilitário"
                          value={newVehicle.tipo_veiculo}
                          onChange={e => setNewVehicle(v => ({ ...v, tipo_veiculo: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marca_equipamento" className="text-sm font-medium">Marca Equipamento</Label>
                        <Input
                          id="marca_equipamento"
                          placeholder="Ex: Fiat"
                          value={newVehicle.marca_equipamento}
                          onChange={e => setNewVehicle(v => ({ ...v, marca_equipamento: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quilometragem_atual" className="text-sm font-medium">Quilometragem Atual</Label>
                        <Input
                          id="quilometragem_atual"
                          type="number"
                          placeholder="0"
                          value={newVehicle.quilometragem_atual}
                          onChange={e => setNewVehicle(v => ({ ...v, quilometragem_atual: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Financeiro */}
                  <div>
                    <h3 className="text-base font-semibold text-blue-700 mb-4">Financeiro</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="valor_aluguel" className="text-sm font-medium">Valor Aluguel (R$)</Label>
                        <Input
                          id="valor_aluguel"
                          type="number"
                          placeholder="0.00"
                          value={newVehicle.valor_aluguel ?? 0}
                          onChange={e => setNewVehicle(v => ({ ...v, valor_aluguel: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo/Operação Combustível</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ 
                          ...v, 
                          tipo_combustivel: value,
                          operacao_combustivel: value 
                        }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gasolina">Gasolina</SelectItem>
                            <SelectItem value="Etanol">Etanol</SelectItem>
                            <SelectItem value="Diesel">Diesel</SelectItem>
                            <SelectItem value="Flex">Flex</SelectItem>
                            <SelectItem value="GNV">GNV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Propriedade</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ ...v, propriedade: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Próprio">Próprio</SelectItem>
                            <SelectItem value="Alugado">Alugado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Condição</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ ...v, condicao: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Novo</SelectItem>
                            <SelectItem value="used">Usado</SelectItem>
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Localização */}
                  <div>
                    <h3 className="text-base font-semibold text-blue-700 mb-4">Localização</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-red-600">Contrato (Obrigatório) *</Label>
                        <Select onValueChange={value => setNewVehicle(v => ({ ...v, contrato_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um contrato" />
                          </SelectTrigger>
                          <SelectContent>
                            {contratos.map((contrato: { id: string; nome: string; codigo: string }) => (
                              <SelectItem key={contrato.id} value={contrato.id}>
                                {contrato.nome} ({contrato.codigo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    </div>
                  </div>

                  {/* Equipamentos */}
                  <div>
                    <h3 className="text-base font-semibold text-blue-700 mb-4">Equipamentos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="giroflex"
                          checked={!!newVehicle.equipamentos.giroflex}
                          onCheckedChange={checked => setNewVehicle(v => ({
                            ...v,
                            equipamentos: { ...v.equipamentos, giroflex: !!checked }
                          }))}
                        />
                        <Label htmlFor="giroflex" className="text-sm font-medium">Giroflex</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="camera"
                          checked={!!newVehicle.equipamentos.camera}
                          onCheckedChange={checked => setNewVehicle(v => ({
                            ...v,
                            equipamentos: { ...v.equipamentos, camera: !!checked }
                          }))}
                        />
                        <Label htmlFor="camera" className="text-sm font-medium">Câmera</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tracker"
                          checked={!!newVehicle.equipamentos.tracker}
                          onCheckedChange={checked => setNewVehicle(v => ({
                            ...v,
                            equipamentos: { ...v.equipamentos, tracker: !!checked }
                          }))}
                        />
                        <Label htmlFor="tracker" className="text-sm font-medium">Rastreador</Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CARD DE DOCUMENTOS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5" />
                    Documentos
                  </CardTitle>
                  <CardDescription>
                    Anexe os documentos obrigatórios do veículo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredDocumentTypes.map(docType => (
                      <div key={docType.key} className="space-y-2">
                        <Label className="text-sm font-medium">{docType.label}</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ArrowUpTrayIcon className="h-4 w-4 text-gray-400" />
                            <input
                              type="file"
                              accept="application/pdf"
                              className="flex-1 text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setDocumentUploads(d => ({
                                  ...d,
                                  [docType.key]: {
                                    ...d[docType.key],
                                    file
                                  }
                                }));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Data de Validade</Label>
                            <Input
                              type="date"
                              className="mt-1"
                              value={documentUploads[docType.key]?.expira_em || ""}
                              onChange={e => setDocumentUploads(d => ({
                                ...d,
                                [docType.key]: {
                                  ...d[docType.key],
                                  expira_em: e.target.value
                                }
                              }))}
                            />
                          </div>
                          {documentUploads[docType.key]?.file && (
                            <div className="text-xs text-green-600 flex items-center gap-1">
                              <DocumentTextIcon className="h-3 w-3" />
                              {documentUploads[docType.key]?.file?.name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-4 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={savingVehicle}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingVehicle || uploadingDocuments}
              >
                {savingVehicle ? "Salvando veículo..." :
                  uploadingDocuments ? "Enviando documentos..." :
                    "Salvar Veículo"}
              </Button>
            </div>
          </form>
        )}
    </div>
  );
}