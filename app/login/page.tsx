import type { Metadata } from "next";
import { SiteLanguageSwitcher } from "../../components/site-i18n";

export const metadata: Metadata = {
  title: "登入｜MSI Privacy Embed Control",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configurationError = params.error === "config";
  const invalidPassword = params.error === "invalid";

  return (
    <main className="access-page">
      <form className="access-form" action="/api/site-access" method="post">
        <SiteLanguageSwitcher className="access-language-switcher" />
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <input
          name="password"
          type="password"
          aria-label="存取密碼"
          placeholder="請輸入密碼"
          autoComplete="current-password"
          required
          aria-describedby={invalidPassword || configurationError ? "access-error" : undefined}
        />
        <button type="submit" disabled={configurationError}>確定</button>

        {invalidPassword ? (
          <p className="access-error" id="access-error" role="alert">
            密碼不正確
          </p>
        ) : null}

        {configurationError ? (
          <p className="access-error" id="access-error" role="alert">
            網站尚未設定存取密碼
          </p>
        ) : null}
      </form>
    </main>
  );
}
