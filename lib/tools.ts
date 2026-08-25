export type ToolDocument = {
  slug: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  version: string;
  updatedAt: string;
  tags: string[];
};

export const toolDocuments: ToolDocument[] = [
  {
    slug: "product-feed",
    name: "MSI Product Feed",
    shortName: "Product Feed",
    category: "Content Automation",
    description:
      "依系列標籤取得 MSI Product API 資料，透過 HTML 模板更新既有產品區塊，並提供渲染前後生命週期掛鉤。",
    version: "v0.1",
    updatedAt: "2026-08-25",
    tags: ["Product API", "HTML Template", "Lifecycle"],
  },
  {
    slug: "third-party-embed",
    name: "Third-party Embed Control",
    shortName: "Privacy Embed",
    category: "Privacy & Compliance",
    description:
      "在訪客同意前封鎖第三方 iframe 與 JavaScript SDK，並管理載入、同步同意與撤回生命週期。",
    version: "v0.1",
    updatedAt: "2026-08-25",
    tags: ["GDPR", "iframe", "Third-party SDK"],
  },
];

export function getToolHref(tool: ToolDocument) {
  return `/tools/${tool.slug}`;
}
