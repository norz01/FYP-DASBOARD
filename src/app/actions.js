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

  // Logik redirect: flagged accounts go straight to the change-password gate
  const isStaff = data.user.role === 'admin' || data.user.role === 'counselor';
  const dashboardUrl = data.mustChangePassword
    ? '/change-password'
    : (isStaff ? '/staff-dashboard' : '/student-dashboard');

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

export async function changePasswordAction(prevState, formData) {
  if (!(formData instanceof FormData)) {
    formData = prevState;
  }

  const currentPassword = formData.get('currentPassword');
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');

  if (newPassword !== confirmPassword) {
    return { error: 'Pengesahan kata laluan tidak sepadan.' };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('ikmbToken')?.value;
  if (!token) return { error: 'Sesi tidak sah. Sila log masuk semula.' };

  let data;
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    data = await res.json();
    if (!res.ok) return { error: data.message || 'Gagal menukar kata laluan.' };
  } catch (error) {
    console.error("Network Error:", error);
    return { error: 'Gagal menyambung ke pelayan. Pastikan backend berjalan.' };
  }

  // Rotate both cookies with the fresh token (mcp claim now false)
  cookieStore.set('user', JSON.stringify(data.user), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400,
    path: '/',
  });
  cookieStore.set('ikmbToken', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400,
    path: '/',
    sameSite: 'lax',
  });

  const isStaff = data.user.role === 'admin' || data.user.role === 'counselor';
  redirect(isStaff ? '/staff-dashboard' : '/student-dashboard');
}