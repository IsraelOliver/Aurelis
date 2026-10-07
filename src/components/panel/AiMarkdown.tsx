import { Fragment, type ReactNode } from "react";

/**
 * Safe Markdown subset for SMILEY answers: paragraphs, headings (as
 * labels), bullet / numbered lists, fenced code, bold, italic, inline code.
 * Built as React elements from plain text: no HTML is ever interpreted, no
 * links or images are created.
 */

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**") && part.length > 4) || (part.startsWith("__") && part.endsWith("__") && part.length > 4))
      return <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="rounded bg-base px-1 py-px font-mono text-[11.5px] text-cyan">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "h"; text: string }
  | { type: "ul" | "ol"; items: { text: string; depth: number; n?: number }[] }
  | { type: "code"; lines: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or end while streaming)
      blocks.push({ type: "code", lines: code });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "h", text: heading[1] });
      i++;
      continue;
    }
    const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      const items: { text: string; depth: number; n?: number }[] = [];
      while (i < lines.length) {
        const b = /^(\s*)[-*•]\s+(.*)$/.exec(lines[i]);
        const n = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(lines[i]);
        if (type === "ul" && b) items.push({ text: b[2], depth: b[1].length >= 2 ? 1 : 0 });
        else if (type === "ol" && n) items.push({ text: n[3], depth: n[1].length >= 2 ? 1 : 0, n: Number(n[2]) });
        else if ((type === "ol" && b && b[1].length >= 2) || (type === "ul" && n && n[1].length >= 2))
          items.push({ text: (b ? b[2] : n![3]), depth: 1 });
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1].text += ` ${lines[i].trim()}`;
        else break;
        i++;
      }
      blocks.push({ type, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|[-*•]\s|\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ type: "p", lines: para });
  }
  return blocks;
}

export default function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 break-words text-[12.5px] leading-relaxed text-fg [overflow-wrap:anywhere] max-lg:text-[13.5px]">
      {parseBlocks(text).map((block, i) => {
        if (block.type === "h")
          return <p key={i} className="mt-1 text-[10.5px] font-semibold tracking-[0.18em] text-fg-muted">{inline(block.text.toUpperCase())}</p>;
        if (block.type === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded border border-line bg-base px-2.5 py-2 font-mono text-[11px] text-fg-muted">
              {block.lines.join("\n")}
            </pre>
          );
        if (block.type === "p")
          return (
            <p key={i}>
              {block.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        const List = block.type;
        return (
          <List key={i} className="flex flex-col gap-1">
            {block.items.map((item, j) => (
              <li key={j} className={`flex gap-2 ${item.depth ? "pl-4" : ""}`}>
                <span className="shrink-0 font-mono text-[11px] text-cyan" aria-hidden="true">
                  {block.type === "ol" && !item.depth ? `${item.n ?? j + 1}.` : "·"}
                </span>
                <span className="min-w-0">{inline(item.text)}</span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
