'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function loginAction(prevState, formData) {
  // Handle React 19 useActionState signature
  if (!(formData instanceof FormData)) {
    formData = prevState;
  }

  const email = formData.get('email');
  const password = formData.get('password');

  let data;
  // 1. HANYA letak network fetch dalam try/catch
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    data = await res.json();
    if (!res.ok) return { error: data.message || 'Login gagal.' };
  } catch (error) {
    console.error("Network Error:", error);
    return { error: 'Gagal menyambung ke pelayan. Pastikan backend berjalan.' };
  }

  // 2. Set cookies (boleh letak luar try/catch)
  const cookieStore = await cookies();
  if (cookieStore) {
    cookieStore.set('user', JSON.stringify(data.user), {
      httpOnly: false, 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 86400, 
      path: '/'
    });
    cookieStore.set('ikmbToken', data.token, {
      httpOnly: false, 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 86400, 
      path: '/'
    });
  }

  const dashboardUrl = data.user.role === 'admin' ? '/staff-dashboard' : '/student-dashboard';
  
  // 3. PENTING: redirect() WAJIB berada di LUAR try/catch!
  // Jika ia di dalam catch, Next.js akan menyangka ia adalah ralat sistem.
  redirect(dashboardUrl);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  if (cookieStore) {
    cookieStore.delete('user');
    cookieStore.delete('ikmbToken');
  }
  redirect('/');
}