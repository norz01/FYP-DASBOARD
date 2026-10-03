import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const cookies = request.cookies;
  const userCookie = cookies?.get?.('user')?.value;
  
  let user = null;
  try {
    user = userCookie ? JSON.parse(userCookie) : null;
  } catch (e) {
    user = null;
  }

  const isLoginPage = pathname === '/' || pathname === '/login';

  if (isLoginPage) {
    if (user) {
      const isStaff = user.role === 'admin' || user.role === 'counselor';
      const dashboardUrl = isStaff ? '/staff-dashboard' : '/student-dashboard';
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return NextResponse.next();
  }

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const isStaff = user.role === 'admin' || user.role === 'counselor';

  // Staff Routes
  if (pathname.startsWith('/staff-dashboard') || pathname.startsWith('/student-profile')) {
    if (!isStaff) {
      return NextResponse.redirect(new URL('/student-dashboard', request.url));
    }
  }

  // Student Routes
  if (pathname.startsWith('/student-dashboard')) {
    if (isStaff) {
      return NextResponse.redirect(new URL('/staff-dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};