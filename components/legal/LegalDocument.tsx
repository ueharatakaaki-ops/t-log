import type { ReactNode } from "react";

/**
 * 利用規約・プライバシーポリシーは、見出し(#/##)・番号付き/箇条書きリスト・
 * **強調**・---区切り・【】プレースホルダー、という限られた構文だけを使う
 * シンプルなMarkdown文字列として管理している（lib/legal/*-content.ts）。
 * この用途に特化した最小限のパーサーで表示する（汎用Markdownライブラリを
 * 追加するほどの複雑さではないため）。
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*.+?\*\*|【[^】]*】)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("【") && part.endsWith("】")) {
      return (
        <mark key={key} className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-800">
          {part}
        </mark>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function LegalDocument({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push(<hr key={key++} className="my-6 border-slate-200" />);
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="mb-4 text-xl font-bold text-[#0F2537]">
          {renderInline(line.slice(2), `h1-${key}`)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="mb-2 mt-6 text-base font-bold text-[#0F2537]">
          {renderInline(line.slice(3), `h2-${key}`)}
        </h2>
      );
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="mb-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ol-${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="mb-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ul-${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    blocks.push(
      <p key={key++} className="mb-3 text-sm leading-relaxed text-slate-700">
        {renderInline(line, `p-${key}`)}
      </p>
    );
    i++;
  }

  return <div>{blocks}</div>;
}
