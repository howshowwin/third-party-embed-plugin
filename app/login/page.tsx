import type { Metadata } from "next";

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
      <section className="access-card" aria-labelledby="access-title">
        <div className="access-mark" aria-hidden="true">MSI</div>
        <p className="access-eyebrow">INTERNAL DOCUMENTATION</p>
        <h1 id="access-title">第三方嵌入工具手冊</h1>
        <p className="access-description">
          此頁面僅供授權人員使用。請輸入存取密碼後繼續。
        </p>

        <form className="access-form" action="/api/site-access" method="post">
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <label htmlFor="site-password">存取密碼</label>
          <input
            id="site-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby={invalidPassword || configurationError ? "access-error" : undefined}
          />

          {invalidPassword ? (
            <p className="access-error" id="access-error" role="alert">
              密碼不正確，請重新輸入。
            </p>
          ) : null}

          {configurationError ? (
            <p className="access-error" id="access-error" role="alert">
              網站尚未設定 SITE_ACCESS_PASSWORD，請聯絡管理者。
            </p>
          ) : null}

          <button type="submit" disabled={configurationError}>進入手冊</button>
        </form>
      </section>
    </main>
  );
}
