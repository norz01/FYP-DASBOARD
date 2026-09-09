import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // 1. Baca cookie 'user' - defensive check for cookies object
  const cookies = request.cookies;
  const userCookie = cookies?.get?.('user')?.value;
  let user = null;
  try {
    user = userCookie ? JSON.parse(userCookie) : null;
  } catch (e) {
    user = null;
  }

  const isLoginPage = pathname === '/' || pathname === '/login';

  // 2. Handle Public Route (Login Page)
  if (isLoginPage) {
    if (user) {
      // Jika sudah login, halau ke dashboard masing-masing
      const dashboardUrl = user.role === 'admin' ? '/staff-dashboard' : '/student-dashboard';
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return NextResponse.next();
  }

  // 3. Handle Protected Routes (Jika belum login, halau ke '/')
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4. Role-Based Access Control
  if (pathname.startsWith('/staff-dashboard') || pathname.startsWith('/student-profile')) {
    if (user.role !== 'admin') {
      return NextResponse.redirect(new URL('/student-dashboard', request.url));
    }
  }

  if (pathname.startsWith('/student-dashboard')) {
    if (user.role !== 'user') {
      return NextResponse.redirect(new URL('/staff-dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Tentukan route mana yang perlu dijaga oleh middleware ini
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};