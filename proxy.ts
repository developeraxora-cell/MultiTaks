import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Protege todas las rutas excepto /login y assets. Sin sesión → /login.
 * Rutas /admin requieren rol admin. (Next 16: convención `proxy`, antes `middleware`.)
 */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith("/admin") && session.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluye /login, internos de Next y cualquier archivo con extensión (assets).
  matcher: ["/((?!login|_next|.*\\.).*)"],
};
