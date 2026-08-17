import type { Metadata } from "next";
import "./globals.css";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (productionHost ? `https://${productionHost}` : "http://localhost:3000");
const title = "MSI Privacy Embed Control 使用手冊";
const description =
  "供網站建置與內容維護人員使用的第三方 iframe、HTML、CSS 與 JavaScript 同意控制整合手冊。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title,
    description,
    type: "website",
    images: [
      {
        url: "/og-guide.png",
        width: 1200,
        height: 630,
        alt: "MSI Privacy Embed Control 第三方嵌入工具使用手冊",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-guide.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
