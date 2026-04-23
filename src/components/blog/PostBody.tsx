import React from "react";

/**
 * Tiny markdown-subset renderer. Avoids pulling in a full parser for
 * posts that only need paragraphs, h2/h3, bullet lists, bold, and links.
 * If a future post needs richer formatting, swap this for `react-markdown`.
 */
export default function PostBody({ body }: { body: string }) {
  const blocks = splitBlocks(body);
  return (
    <div className="space-y-5 text-base leading-relaxed text-ink-900">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function splitBlocks(body: string): Block[] {
  const lines = body.split(/\n/);
  const blocks: Block[] = [];
  let buf: string[] = [];
  let ulBuf: string[] = [];
  let olBuf: string[] = [];

  const flushPara = () => {
    if (buf.length) {
      blocks.push({ kind: "p", text: buf.join(" ").trim() });
      buf = [];
    }
  };
  const flushUl = () => {
    if (ulBuf.length) {
      blocks.push({ kind: "ul", items: [...ulBuf] });
      ulBuf = [];
    }
  };
  const flushOl = () => {
    if (olBuf.length) {
      blocks.push({ kind: "ol", items: [...olBuf] });
      olBuf = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushUl();
    flushOl();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("### ")) {
      flushAll();
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      continue;
    }
    // Ordered list: "1. text", "2. text", ...
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushPara();
      flushUl();
      olBuf.push(olMatch[2].trim());
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      flushOl();
      ulBuf.push(line.slice(2).trim());
      continue;
    }
    flushUl();
    flushOl();
    buf.push(line.trim());
  }
  flushAll();
  return blocks;
}

function renderBlock(b: Block, key: number) {
  switch (b.kind) {
    case "h2":
      return (
        <h2
          key={key}
          className="font-display text-3xl text-ink-900 mt-10 mb-2"
          style={{ fontWeight: 400, letterSpacing: "-0.015em" }}
        >
          {renderInline(b.text)}
        </h2>
      );
    case "h3":
      return (
        <h3
          key={key}
          className="font-semibold text-xl text-ink-900 mt-6 mb-1"
        >
          {renderInline(b.text)}
        </h3>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc pl-6 space-y-2 text-ink-900">
          {b.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal pl-6 space-y-2 text-ink-900">
          {b.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "p":
      return (
        <p key={key} className="text-ink-900">
          {renderInline(b.text)}
        </p>
      );
  }
}

/**
 * Inline formatting: **bold**, [text](url). Processes a single line.
 * Safe-ish: only inserts anchor tags, not arbitrary HTML.
 */
function renderInline(text: string): React.ReactNode {
  // First tokenize by link and bold spans.
  const tokens: Array<{ type: "text" | "bold" | "link"; value: string; href?: string }> = [];
  let i = 0;
  while (i < text.length) {
    const restBold = text.slice(i).match(/^\*\*([^*]+)\*\*/);
    if (restBold) {
      tokens.push({ type: "bold", value: restBold[1] });
      i += restBold[0].length;
      continue;
    }
    const restLink = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (restLink) {
      tokens.push({ type: "link", value: restLink[1], href: restLink[2] });
      i += restLink[0].length;
      continue;
    }
    // Plain char until next token start
    const nextSpecial = text.slice(i).search(/\*\*|\[[^\]]+\]\(/);
    if (nextSpecial === -1) {
      tokens.push({ type: "text", value: text.slice(i) });
      break;
    }
    tokens.push({ type: "text", value: text.slice(i, i + nextSpecial) });
    i += nextSpecial;
  }

  return (
    <>
      {tokens.map((t, idx) => {
        if (t.type === "bold") return <strong key={idx}>{t.value}</strong>;
        if (t.type === "link")
          return (
            <a
              key={idx}
              href={t.href}
              className="text-plum-500 hover:text-plum-600 underline underline-offset-2"
              target={t.href?.startsWith("http") ? "_blank" : undefined}
              rel={t.href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {t.value}
            </a>
          );
        return <React.Fragment key={idx}>{t.value}</React.Fragment>;
      })}
    </>
  );
}
