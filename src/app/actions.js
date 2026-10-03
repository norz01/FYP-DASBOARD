'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function loginAction(prevState, formData) {
  if (!(formData instanceof FormData)) {
    formData = prevState;
  }

  const email = formData.get('email');
  const password = formData.get('password');

  let data;
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

  const cookieStore = await cookies();
  if (cookieStore) {
    // Cookie 'user' kekal httpOnly: false supaya UI & Middleware boleh baca nama/role
    cookieStore.set('user', JSON.stringify(data.user), {
      httpOnly: false, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 86400,
      path: '/'
    });

    // 🔒 UPGRADE: JWT Token kini HttpOnly (Kebal dari XSS)
    cookieStore.set('ikmbToken', data.token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 86400,
      path: '/',
      sameSite: 'lax'
    });
  }

  // Logik redirect: Admin & Counselor ke Staff Dashboard
  const isStaff = data.user.role === 'admin' || data.user.role === 'counselor';
  const dashboardUrl = isStaff ? '/staff-dashboard' : '/student-dashboard';

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