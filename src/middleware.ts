import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) {
    if (token) return NextResponse.redirect(new URL("/trustee-dashboard", req.url));
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = token.role as string;

  if (pathname.startsWith("/monitor-portal") && role !== "INDEPENDENT_MONITOR") {
    return NextResponse.redirect(new URL("/trustee-dashboard", req.url));
  }

  if (pathname.startsWith("/trustee-dashboard") && role === "INDEPENDENT_MONITOR") {
    return NextResponse.redirect(new URL("/monitor-portal", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/trustee-dashboard/:path*", "/monitor-portal/:path*", "/login"],
};
