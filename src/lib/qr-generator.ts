import QRCode from 'qrcode';

/**
 * Gera um QR code simples (para uso no servidor)
 * @param data - Dados para o QR code
 * @param placa - Placa do veículo (para referência)
 * @returns Promise<string> - Data URL do QR code gerado
 */
export async function generateQRCodeWithPlate(data: string, placa: string): Promise<string> {
  try {
    console.log(`Gerando QR code para placa: ${placa}`);
    
    // Gerar o QR code simples (sem sobreposição de texto no servidor)
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: 500,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log('QR code gerado com sucesso');
    return qrDataUrl;

  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    throw error;
  }
}

/**
 * Gera um QR code simples sem sobreposição
 * @param data - Dados para o QR code
 * @returns Promise<string> - Data URL do QR code gerado
 */
export async function generateSimpleQRCode(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(data, {
      width: 500,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error, qrDataUrl) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(qrDataUrl);
    });
  });
}

