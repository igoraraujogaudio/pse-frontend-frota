'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraIcon, XIcon } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  isActive: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
}

export default function QRScanner({ onScan, isActive, onClose, title, placeholder }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setError(null);
    } catch {
      setError('Erro ao acessar a câmera. Use a entrada manual.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  if (!isActive) return null;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CameraIcon className="h-5 w-5" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Camera View */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-2 border-white/50 rounded-lg">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-red-500 rounded-lg"></div>
          </div>
        </div>

        {/* Manual Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Ou digite manualmente:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button onClick={handleManualSubmit} disabled={!manualInput.trim()}>
              Confirmar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}