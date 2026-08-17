export const SITE_ACCESS_COOKIE = "msi_manual_access";

const TOKEN_NAMESPACE = "msi-third-party-embed-manual:v1:";

export function getSiteAccessPassword() {
  return process.env.SITE_ACCESS_PASSWORD?.trim() ?? "";
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function createSiteAccessToken(password: string) {
  return digest(`${TOKEN_NAMESPACE}${password}`);
}

export async function passwordMatches(submitted: string, expected: string) {
  const [submittedHash, expectedHash] = await Promise.all([
    digest(`password:${submitted}`),
    digest(`password:${expected}`),
  ]);

  return safeEqual(submittedHash, expectedHash);
}

export async function isValidSiteAccessToken(
  token: string | undefined,
  password: string,
) {
  if (!token || !password) {
    return false;
  }

  return safeEqual(token, await createSiteAccessToken(password));
}
