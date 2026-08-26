import type { Metadata } from "next";
import { SiteI18nProvider } from "../components/site-i18n";
import { SITE_LOCALE_STORAGE_KEY } from "../lib/site-i18n";
import "./globals.css";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (productionHost ? `https://${productionHost}` : "http://localhost:3000");
const title = "MSI Web Tools 文件中心";
const description =
  "MSI Web Tools 的內部使用手冊與互動 Demo 文件中心。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: { title, description, type: "website", images: [] },
  twitter: {
    card: "summary",
    title,
    description,
    images: [],
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem(${JSON.stringify(SITE_LOCALE_STORAGE_KEY)});if(l==="en"){document.documentElement.dataset.siteLocale="en";document.documentElement.lang="en"}else{document.documentElement.dataset.siteLocale="zh-TW"}}catch(e){document.documentElement.dataset.siteLocale="zh-TW"}`,
          }}
        />
      </head>
      <body><SiteI18nProvider>{children}</SiteI18nProvider></body>
    </html>
  );
}
