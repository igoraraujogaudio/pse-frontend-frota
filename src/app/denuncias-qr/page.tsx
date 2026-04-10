'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import QRCode from 'qrcode';

const TARGET_URL = 'https://app.pse.srv.br/denuncias';
const LOGO_SRC = '/logo_pse.png';
const QR_SIZE = 800;
const LOGO_RATIO = 0.24; // 24% do lado do QR
const LOGO_PADDING = 0.08; // borda branca em torno do logo

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
}

export default function DenunciasQrPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      try {
        const qrBase64 = await QRCode.toDataURL(TARGET_URL, {
          errorCorrectionLevel: 'H',
          width: QR_SIZE,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });

        const [qrImage, logoImage] = await Promise.all([
          loadImage(qrBase64),
          loadImage(LOGO_SRC),
        ]);

        const canvas = document.createElement('canvas');
        canvas.width = qrImage.width;
        canvas.height = qrImage.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas não suportado');

        ctx.drawImage(qrImage, 0, 0);

        const logoSize = Math.round(qrImage.width * LOGO_RATIO);
        const pad = Math.round(logoSize * LOGO_PADDING);
        const x = Math.round((qrImage.width - logoSize) / 2);
        const y = Math.round((qrImage.height - logoSize) / 2);

        // fundo branco atrás do logo para manter contraste
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
        ctx.drawImage(logoImage, x, y, logoSize, logoSize);

        if (!cancelled) {
          setQrDataUrl(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao gerar QR');
        }
      }
    };

    generate();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">QR - Denúncias PSE</h1>
        <p className="text-gray-600 text-sm mt-1">{TARGET_URL}</p>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {qrDataUrl ? (
        <div className="flex flex-col items-center gap-3">
          <NextImage
            src={qrDataUrl}
            alt="QR Code Denúncias PSE"
            width={480}
            height={480}
            className="w-full max-w-[480px] shadow-lg border rounded-lg bg-white"
            unoptimized
          />
          <a
            href={qrDataUrl}
            download="denuncias-qr.png"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Baixar PNG
          </a>
        </div>
      ) : (
        <p className="text-gray-500">Gerando QR code...</p>
      )}
    </main>
  );
}

