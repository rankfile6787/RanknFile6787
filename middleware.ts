import { NextResponse, type NextRequest } from "next/server";

const publicSiteOrigin = "https://www.rankandfile6787.com";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl.clone();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const isApiRoute = url.pathname.startsWith("/api");

  if (host.startsWith("admin.") && !isApiRoute && url.pathname === "/") {
    url.pathname = `/admin${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  if (host.startsWith("admin.") && !isApiRoute && !url.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL(`${url.pathname}${url.search}`, publicSiteOrigin));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
