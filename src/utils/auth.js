const STORAGE_KEY = 'ikmbCurrentUser';

export function getStoredUser() {
  try {
    const rawUser = localStorage.getItem(STORAGE_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function storeUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('ikmbToken');
}

export function getToken() {
  return localStorage.getItem('ikmbToken');
}

export function getDashboardPathForRole(role) {
  return role === 'admin' ? '/staff-dashboard' : '/student-dashboard';
}
