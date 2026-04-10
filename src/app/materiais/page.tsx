'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MateriaisService } from '@/services/materiaisService';
import { Material, BulkMaterialImport } from '@/types/materiais';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Upload, FileText, Trash2, Search, Download } from 'lucide-react';

export default function MateriaisPage() {
  useAuth();
  
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('listagem');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadMateriais();
  }, []);

  const loadMateriais = async () => {
    try {
      setLoading(true);
      const data = await MateriaisService.getAll();
      setMateriais(data);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    } finally {
      setLoading(false);
    }
  };

  const sanitizeText = (text: string): string => {
    return text
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  };

  const parseTextData = (text: string): BulkMaterialImport[] => {
    // Sanitize the entire text first
    const cleanText = sanitizeText(text);
    const lines = cleanText.split('\n');
    const materiaisToImport: BulkMaterialImport[] = [];

    for (const line of lines) {
      if (!line.trim()) continue; // Skip empty lines
      
      const [numeroMaterial, descricaoMaterial, unidadeMedida, numeroMaterialAntigo] = line.split('\t');
      
      if (numeroMaterial && descricaoMaterial && unidadeMedida) {
        materiaisToImport.push({
          numeroMaterial: sanitizeText(numeroMaterial),
          descricaoMaterial: sanitizeText(descricaoMaterial).replace(/^"|"$/g, ''),
          unidadeMedida: sanitizeText(unidadeMedida),
          numeroMaterialAntigo: numeroMaterialAntigo ? sanitizeText(numeroMaterialAntigo) : undefined
        });
      }
    }

    return materiaisToImport;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      setImporting(true);
      setImportResult(null);

      // Read file with proper encoding handling
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let text = decoder.decode(arrayBuffer);
      
      // Try alternative encoding if needed
      if (!text || text.includes('�')) {
        const decoder2 = new TextDecoder('windows-1252', { fatal: false });
        text = decoder2.decode(arrayBuffer);
      }

      const materiaisToImport = parseTextData(text);

      if (materiaisToImport.length === 0) {
        alert('Nenhum material válido encontrado no arquivo.\n\nVerifique se o arquivo está no formato correto:\n- Colunas separadas por TAB\n- 4 colunas: Material, Descrição, UM, Nº Antigo');
        return;
      }

      const result = await MateriaisService.bulkCreate(materiaisToImport);
      setImportResult(result);
      setSelectedFile(null);
      loadMateriais();
      
      alert(`Importação concluída!\n${result.success} materiais importados com sucesso.`);
    } catch (error: unknown) {
      console.error('Erro ao importar arquivo:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`Erro ao importar arquivo.\n\nDetalhes: ${errorMsg}\n\nDica: Salve o Excel como "Texto (Separado por tabulações) .txt" e tente novamente.`);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      alert('Cole os dados dos materiais para importar');
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);

      const materiaisToImport = parseTextData(bulkText);

      if (materiaisToImport.length === 0) {
        alert('Nenhum material válido encontrado. Verifique o formato dos dados.');
        return;
      }

      const result = await MateriaisService.bulkCreate(materiaisToImport);
      setImportResult(result);
      setBulkText('');
      loadMateriais();
      
      alert(`Importação concluída!\n${result.success} materiais importados com sucesso.`);
    } catch (error) {
      console.error('Erro ao importar materiais:', error);
      alert('Erro ao importar materiais. Verifique o formato dos dados e tente novamente.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este material?')) return;
    
    try {
      await MateriaisService.delete(id);
      loadMateriais();
    } catch (error) {
      console.error('Erro ao excluir material:', error);
      alert('Erro ao excluir material. Tente novamente.');
    }
  };

  const handleExportTemplate = () => {
    const template = `Material\tTexto breve de material\tUM básica\tNº material antigo
176010024\tARMACAO PESADA 4 POLOS 3/16"\tUN\t
177180009\tASPERSOR SPRAY ESCAM IRRIG 4" 1804 INO\tUN\t`;
    
    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_materiais.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMateriais = materiais.filter(material =>
    material?.descricaoMaterial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material?.numeroMaterial?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-8 w-8" />
          Gestão de Materiais
        </h1>
        <p className="text-gray-600 mt-2">Catálogo de materiais para orçamento de obras</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="listagem" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Listagem
          </TabsTrigger>
          <TabsTrigger value="importacao" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importação em Massa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listagem">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Materiais Cadastrados</CardTitle>
                  <CardDescription>
                    {filteredMateriais.length} material(is) encontrado(s)
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por código ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Carregando materiais...</p>
                </div>
              ) : filteredMateriais.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum material encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Código Antigo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMateriais.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-mono font-medium">{material.numeroMaterial}</TableCell>
                          <TableCell className="max-w-md">{material.descricaoMaterial}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{material.unidadeMedida}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-500">
                            {material.numeroMaterialAntigo || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(material.id!)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacao">
          <Card>
            <CardHeader>
              <CardTitle>Importação em Massa</CardTitle>
              <CardDescription>
                Cole os dados dos materiais no formato de tabela (colunas separadas por TAB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Formato esperado:</h4>
                <p className="text-sm text-blue-800 mb-2">
                  Cole os dados com 4 colunas separadas por TAB (copie diretamente do Excel):
                </p>
                <div className="bg-white rounded p-3 font-mono text-xs overflow-x-auto">
                  <div>Material &nbsp;&nbsp;&nbsp; Texto breve de material &nbsp;&nbsp;&nbsp; UM básica &nbsp;&nbsp;&nbsp; Nº material antigo</div>
                  <div>176010024 &nbsp; ARMACAO PESADA 4 POLOS 3/16&quot; &nbsp; UN &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportTemplate}
                  className="mt-3"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fileUpload">Ou faça upload de arquivo Excel/CSV:</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                  <input
                    id="fileUpload"
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    disabled={importing}
                    className="hidden"
                  />
                  <label htmlFor="fileUpload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Formatos aceitos: Excel (.xlsx, .xls), CSV (.csv), TXT (.txt)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkText">Cole os dados aqui:</Label>
                <Textarea
                  id="bulkText"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Cole aqui os dados copiados do Excel ou arquivo de texto..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">✅ Importação concluída!</h4>
                  <p className="text-sm text-green-800">
                    {importResult.success} materiais importados com sucesso
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setBulkText('')}
                  disabled={importing}
                >
                  Limpar
                </Button>
                <Button
                  onClick={handleBulkImport}
                  disabled={importing || !bulkText.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Materiais
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
