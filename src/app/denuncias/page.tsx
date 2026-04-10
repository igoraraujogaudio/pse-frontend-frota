'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Shield, Upload, X, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import Image from 'next/image';

interface Base {
  id: string;
  nome: string;
  codigo: string;
}

interface PreviewFile {
  file: File;
  preview: string;
  id: string;
}

export default function DenunciasPage() {
  const [anonimo, setAnonimo] = useState(true);
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [baseId, setBaseId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [evidencias, setEvidencias] = useState<PreviewFile[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBases, setLoadingBases] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar bases disponíveis
  useEffect(() => {
    const loadBases = async () => {
      try {
        const response = await fetch('/api/bases');
        const data = await response.json();
        if (data.bases) {
          setBases(data.bases);
        }
      } catch (err) {
        console.error('Erro ao carregar bases:', err);
        setError('Erro ao carregar bases. Tente novamente.');
      } finally {
        setLoadingBases(false);
      }
    };

    loadBases();
  }, []);

  // Limpar formulário após sucesso
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setAnonimo(true);
        setEmail('');
        setMatricula('');
        setBaseId('');
        setDescricao('');
        setEvidencias([]);
        setSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: PreviewFile[] = [];

    files.forEach((file) => {
      // Validar tipo
      if (!file.type.startsWith('image/')) {
        setError('Apenas imagens são permitidas');
        return;
      }

      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`Arquivo ${file.name} é muito grande. Máximo: 10MB`);
        return;
      }

      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        newFiles.push({
          file,
          preview,
          id: Math.random().toString(36).substring(7)
        });
        
        if (newFiles.length === files.length) {
          setEvidencias(prev => [...prev, ...newFiles]);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeEvidencia = (id: string) => {
    setEvidencias(prev => prev.filter(e => e.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validações
    if (!baseId) {
      setError('Selecione uma base');
      setLoading(false);
      return;
    }

    if (!descricao.trim()) {
      setError('Descreva a denúncia');
      setLoading(false);
      return;
    }

    if (!anonimo) {
      if (!email.trim()) {
        setError('Email é obrigatório quando a denúncia não é anônima');
        setLoading(false);
        return;
      }
      if (!matricula.trim()) {
        setError('Matrícula é obrigatória quando a denúncia não é anônima');
        setLoading(false);
        return;
      }
    }

    try {
      // Criar FormData
      const formData = new FormData();
      formData.append('anonimo', anonimo.toString());
      if (!anonimo) {
        formData.append('email', email.trim());
        formData.append('matricula', matricula.trim());
      }
      formData.append('base_id', baseId);
      formData.append('descricao', descricao.trim());

      // Adicionar evidências
      evidencias.forEach((evidencia) => {
        formData.append('evidencias', evidencia.file);
      });

      // Enviar denúncia
      const response = await fetch('/api/denuncias', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar denúncia');
      }

      setSuccess(true);
      setError(null);
    } catch (err) {
      console.error('Erro ao enviar denúncia:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar denúncia. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
          {/* Logo centralizado no topo */}
        <div className="flex justify-center mb-8">
          <Image 
            src="/logo_pse.png" 
            alt="Logo PSE" 
            height={50} 
            width={163} 
            className="h-[50px] w-auto" 
            priority 
          />
        </div>

        {success ? (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-green-900 mb-2">
                  Denúncia Enviada com Sucesso!
                </h2>
                <p className="text-green-800 text-sm">
                  Sua denúncia foi recebida e será analisada pela equipe responsável.
                  Obrigado por contribuir para um ambiente melhor.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Alerta de erro */}
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {/* Opção Anônimo */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Tipo de Denúncia
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="anonimo"
                      checked={anonimo}
                      onChange={() => setAnonimo(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Anônima</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="anonimo"
                      checked={!anonimo}
                      onChange={() => setAnonimo(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Identificada</span>
                  </label>
                </div>
              </div>

              {/* Email e Matrícula (se não anônimo) */}
              {!anonimo && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      required={!anonimo}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="matricula" className="text-sm font-medium text-gray-700">
                      Matrícula <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="matricula"
                      type="text"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      placeholder="Sua matrícula"
                      required={!anonimo}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Seleção de Base */}
              <div className="space-y-2">
                <label htmlFor="base" className="text-sm font-medium text-gray-700">
                  Base <span className="text-red-500">*</span>
                </label>
                {loadingBases ? (
                  <div className="h-9 bg-gray-100 rounded-md animate-pulse" />
                ) : (
                  <Select value={baseId} onValueChange={setBaseId} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a base" />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map((base) => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.nome} {base.codigo && `(${base.codigo})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <label htmlFor="descricao" className="text-sm font-medium text-gray-700">
                  Descrição da Denúncia <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva detalhadamente a situação que você deseja denunciar..."
                  required
                  rows={6}
                  className="w-full resize-none"
                />
                <p className="text-xs text-gray-500">
                  Seja o mais detalhado possível. Inclua informações como data, horário, local e pessoas envolvidas.
                </p>
              </div>

              {/* Upload de Evidências */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Evidências (Fotos)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    id="evidencias"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="evidencias" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      Clique para adicionar fotos
                    </p>
                    <p className="text-xs text-gray-500">
                      Formatos: JPG, PNG, WEBP (máx. 10MB cada)
                    </p>
                  </label>
                </div>

                {/* Preview das evidências */}
                {evidencias.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {evidencias.map((evidencia) => (
                      <div key={evidencia.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                          <Image
                            src={evidencia.preview}
                            alt="Preview"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEvidencia(evidencia.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Enviar */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading || loadingBases}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Enviar Denúncia
                    </>
                  )}
                </Button>
              </div>

              {/* Aviso de Privacidade */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  {anonimo ? (
                    <>
                      <Shield className="h-3 w-3 inline mr-1" />
                      Sua denúncia será mantida em <strong>total anonimato</strong>. Nenhuma informação pessoal será coletada.
                    </>
                  ) : (
                    <>
                      Suas informações serão mantidas em <strong>sigilo</strong> e usadas apenas para contato, se necessário.
                    </>
                  )}
                </p>
              </div>
            </form>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-200 bg-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} PSE - Programa de Segurança Empresarial
          </p>
        </div>
      </footer>
    </div>
  );
}

