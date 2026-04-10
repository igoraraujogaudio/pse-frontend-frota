import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const MDM_CONFIG = {
  baseUrl: 'https://api.cloud4mobile.com.br',
  consumerKey: 'M2I4NzcxNGItMjNkOS00YjZjLWIxODMtY2RkMWRiODhhNTM1',
  consumerSecret: 'ZmQ2YTBmYTYtY2E4Ny00YzFkLWI2YmYtMTUxYzJiYjUwNDgx'
};

class C4MAuth {
  constructor(private consumerKey: string, private consumerSecret: string) {}

  createSignature(nonce: string, timestamp: number, verb: string, url: string): string {
    const baseString = `${this.consumerSecret}${this.consumerKey}${nonce}${timestamp}1.0${verb}${url}`;
    
    const hmac = crypto.createHmac('sha256', this.consumerSecret);
    hmac.update(baseString);
    const signature = hmac.digest('base64');
    
    return signature;
  }

  authorizationHeaderValue(verb: string, url: string): string {
    const nonce = Math.random().toString();
    const timestamp = Math.floor(Date.now() / 1000);
    const normalizedUrl = url.toUpperCase();
    const httpMethod = verb.toUpperCase();
    
    const signature = this.createSignature(nonce, timestamp, httpMethod, normalizedUrl);
    
    const tokenObject = {
      consumer_key: this.consumerKey,
      nonce,
      timestamp,
      version: '1.0',
      signature
    };
    
    const token = Buffer.from(JSON.stringify(tokenObject)).toString('base64');
    
    return `Bearer ${token}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceIds } = await request.json();

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json(
        { error: 'deviceIds array is required' },
        { status: 400 }
      );
    }

    const auth = new C4MAuth(MDM_CONFIG.consumerKey, MDM_CONFIG.consumerSecret);

    // Fazer todas as requisições em paralelo e coletar resultados
    const locationPromises = deviceIds.map(async (deviceId: number) => {
      try {
        const path = `/devices/${deviceId}/lastlocation`;
        const url = `${MDM_CONFIG.baseUrl}${path}`;
        const authHeader = auth.authorizationHeaderValue('GET', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.coordinate) {
            return { deviceId: deviceId.toString(), data };
          }
        }
      } catch {
        // Ignorar erros individuais
      }
      return null;
    });

    // Aguardar todas as requisições e construir objeto de resultados
    const results = await Promise.allSettled(locationPromises);
    const locations: Record<string, {
      coordinate: { latitude: number; longitude: number };
      accuracy?: number;
      speed?: number;
      bearing?: number;
      deviceDate?: { date: string };
      receivedDate?: { date: string };
    }> = {};
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        locations[result.value.deviceId] = result.value.data;
      }
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error in batch locations route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

