import { NextResponse, type NextRequest } from "next/server";
import {
  getSiteAccessPassword,
  isValidSiteAccessToken,
  SITE_ACCESS_COOKIE,
} from "./lib/site-access";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/site-access",
  "/favicon.svg",
  "/robots.txt",
]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const password = getSiteAccessPassword();
  const token = request.cookies.get(SITE_ACCESS_COOKIE)?.value;

  if (await isValidSiteAccessToken(token, password)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  if (!password) {
    loginUrl.searchParams.set("error", "config");
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
