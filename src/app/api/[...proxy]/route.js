import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

async function proxyRequest(request, { params }) {
  const { proxy } = await params;
  const path = Array.isArray(proxy) ? proxy.join('/') : proxy;
  
  const url = `${BACKEND_URL}/api/${path}${request.nextUrl.search}`;
  
  const cookieStore = await cookies();
  const token = cookieStore.get('ikmbToken')?.value;

  const headers = new Headers(request.headers);
  headers.delete('host'); 
  headers.delete('connection');
  headers.delete('content-length'); // Biar fetch kira semula
  
  // 🔒 SUNTIK TOKEN: Proxy ambil cookie HttpOnly dan letak dalam header Authorization
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const options = {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : undefined,
  };

  try {
    const backendRes = await fetch(url, options);
    
    const resHeaders = new Headers(backendRes.headers);
    resHeaders.delete('transfer-encoding');
    
    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ message: 'Proxy connection failed' }, { status: 500 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;