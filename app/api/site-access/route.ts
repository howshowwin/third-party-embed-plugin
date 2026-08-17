import { NextResponse, type NextRequest } from "next/server";
import {
  createSiteAccessToken,
  getSiteAccessPassword,
  passwordMatches,
  SITE_ACCESS_COOKIE,
} from "../../../lib/site-access";

function safeDestination(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value.startsWith("/login") || value.startsWith("/api/") ? "/" : value;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const submitted = formData.get("password");
  const password = getSiteAccessPassword();
  const destination = safeDestination(formData.get("next"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", destination);

  if (!password) {
    loginUrl.searchParams.set("error", "config");
    return NextResponse.redirect(loginUrl, 303);
  }

  if (typeof submitted !== "string" || !(await passwordMatches(submitted, password))) {
    loginUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set({
    name: SITE_ACCESS_COOKIE,
    value: await createSiteAccessToken(password),
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
