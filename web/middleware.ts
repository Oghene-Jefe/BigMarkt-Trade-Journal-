import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  if (pathname.startsWith("/@")) {
    const slug = pathname.slice(2);
    if (slug && slug.length > 0) {
      url.pathname = "/" + slug;
      return NextResponse.rewrite(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
