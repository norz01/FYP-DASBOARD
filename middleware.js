import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Edge-compatible JWT library

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/' || pathname === '/login';

  // F-4: Verify the HttpOnly JWT at the edge instead of trusting the unsigned 'user' cookie
  const token = request.cookies.get('ikmbToken')?.value;
  let user = null;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        issuer: process.env.JWT_ISSUER || "tvetmara-backend",
        audience: process.env.JWT_AUDIENCE || "tvetmara-dashboard",
      });
      user = payload; // { email, role, studentId, mcp, pwdAt }
    } catch (e) {
      user = null;
    }
  }

  if (isLoginPage) {
    if (user) {
      if (user.mcp) {
        return NextResponse.redirect(new URL('/change-password', request.url));
      }
      const isStaff = user.role === 'admin' || user.role === 'counselor';
      const dashboardUrl = isStaff ? '/staff-dashboard' : '/student-dashboard';
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return NextResponse.next();
  }

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 🔐 Forced-change gate (UX layer; the backend enforces this authoritatively).
  // /change-password stays open to ALL authenticated users so it doubles as a
  // voluntary change-password page and an escape hatch for stale sessions.
  if (user.mcp && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
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