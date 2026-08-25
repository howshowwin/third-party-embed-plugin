import Image from "next/image";
import Link from "next/link";
import { getToolHref, toolDocuments } from "../lib/tools";

export default function ToolsHub() {
  return (
    <main className="tools-hub">
      <header className="tools-hub__header">
        <div className="tools-hub__brand">
          <span className="tools-hub__logo">
            <Image src="/msi-logo.png" alt="MSI" width={155} height={65} priority />
          </span>
          <span>
            <strong>MSI Web Tools</strong>
            <small>INTERNAL DOCUMENTATION</small>
          </span>
        </div>
        <span className="tools-hub__count">{toolDocuments.length} 個工具</span>
      </header>

      <section className="tools-hub__intro" aria-labelledby="tools-title">
        <p>DOCUMENT CENTER</p>
        <h1 id="tools-title">工具文件</h1>
        <span>選擇要查看的工具，進入完整使用手冊與 Demo。</span>
      </section>

      <section className="tools-grid" aria-label="工具文件清單">
        {toolDocuments.map((tool, index) => (
          <Link className="tool-card" href={getToolHref(tool)} key={tool.slug}>
            <div className="tool-card__topline">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{tool.category}</span>
            </div>
            <div className="tool-card__body">
              <p>{tool.shortName}</p>
              <h2>{tool.name}</h2>
              <span>{tool.description}</span>
            </div>
            <ul className="tool-card__tags" aria-label="分類標籤">
              {tool.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
            <footer>
              <span>{tool.version} · 更新於 {tool.updatedAt}</span>
              <strong>查看文件 <i aria-hidden="true">→</i></strong>
            </footer>
          </Link>
        ))}
      </section>
    </main>
  );
}
