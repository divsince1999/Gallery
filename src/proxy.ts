import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // If accessing a dashboard route without a valid token, redirect to login
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return response;
    }
  }

  // Allow the request through; prevent browser from caching protected pages
  const response = NextResponse.next();
  if (pathname.startsWith("/dashboard")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
