import { cookies } from 'next/headers';

export async function getStoredUser() {
  try {
    const cookieStore = await cookies();
    // PENTING: Gunakan ?.get() untuk elak ralat jika cookieStore ialah null
    const userCookie = cookieStore?.get('user')?.value;
    if (!userCookie) return null;
    return JSON.parse(userCookie);
  } catch (e) {
    return null;
  }
}

export async function getToken() {
  try {
    const cookieStore = await cookies();
    return cookieStore?.get('ikmbToken')?.value || null;
  } catch (e) {
    return null;
  }
}

export function getDashboardPathForRole(role) {
  return role === 'admin' ? '/staff-dashboard' : '/student-dashboard';
}