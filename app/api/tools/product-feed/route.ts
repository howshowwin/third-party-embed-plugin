import { NextResponse, type NextRequest } from "next/server";
import {
  getSiteAccessPassword,
  isValidSiteAccessToken,
  SITE_ACCESS_COOKIE,
} from "../../../../lib/site-access";

const COUNTRY_PATTERN = /^[a-z0-9-]+$/;
const PRODUCT_LINE_PATTERN = /^[a-z0-9-]+$/i;
const VALID_SORTS = new Set(["default", "date"]);
const MAX_IDS = 50;
const MAX_PAGE_SIZE = 999;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { status: { code: status, response: message }, result: null },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const password = getSiteAccessPassword();
  const token = request.cookies.get(SITE_ACCESS_COOKIE)?.value;

  if (!password || !(await isValidSiteAccessToken(token, password))) {
    return errorResponse("Unauthorized", 401);
  }

  const search = request.nextUrl.searchParams;
  const endpoint = search.get("endpoint");
  const country = (search.get("country") ?? "").trim().toLowerCase();
  const productLine = (search.get("product_line") ?? "").trim().toLowerCase();

  if (endpoint !== "tags" && endpoint !== "products") {
    return errorResponse("endpoint must be tags or products", 400);
  }
  if (!country || !COUNTRY_PATTERN.test(country)) {
    return errorResponse("Invalid MSI country code", 400);
  }
  if (!PRODUCT_LINE_PATTERN.test(productLine)) {
    return errorResponse("Invalid product_line", 400);
  }

  const apiUrl = new URL(
    endpoint === "tags"
      ? "/api/v1/product/getProductTagList"
      : "/api/v1/product/getProductList",
    `https://${country}.msi.com`,
  );
  apiUrl.searchParams.set("product_line", productLine);

  if (endpoint === "products") {
    const pageNumber = positiveInteger(search.get("page_number"), 1);
    const pageSize = positiveInteger(search.get("page_size"), 99);
    const sort = (search.get("sort") ?? "default").toLowerCase();
    const ids = search.getAll("id[]");

    if (!pageNumber || !pageSize || pageSize > MAX_PAGE_SIZE) {
      return errorResponse("Invalid pagination", 400);
    }
    if (!VALID_SORTS.has(sort)) {
      return errorResponse("sort must be default or date", 400);
    }
    if (ids.length === 0 || ids.length > MAX_IDS) {
      return errorResponse(`id[] must contain 1 to ${MAX_IDS} values`, 400);
    }

    for (const id of ids) {
      if (!/^\d+$/.test(id) || Number(id) < 1) {
        return errorResponse("Invalid product tag ID", 400);
      }
    }

    apiUrl.searchParams.set("page_number", String(pageNumber));
    apiUrl.searchParams.set("page_size", String(pageSize));
    apiUrl.searchParams.set("sort", sort);
    ids.forEach((id) => apiUrl.searchParams.append("id[]", id));
  }

  try {
    const upstream = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return errorResponse(`MSI API returned HTTP ${upstream.status}`, 502);
    }

    const payload = await upstream.json();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("Unable to reach the MSI product API", 502);
  }
}
