import Link from "next/link";
import type { ReactNode } from "react";
import { newTabProps } from "@/components/ui/newTab";
import { localizePath, type Locale } from "@/i18n/config";

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

// Splits the source into headings, paragraphs, and lists; anything else is plain paragraph text.
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    if (list) blocks.push({ kind: "list", ...list });
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);

    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length === 3 ? 3 : 2, text: heading[2] });
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }

  flush();
  return blocks;
}

const inlinePattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

// Only secure web links and site paths become links; anything else stays plain text.
function safeHref(href: string): { internal: boolean } | null {
  if (/^https:\/\/[^\s]+$/i.test(href)) return { internal: false };
  if (/^\/(?!\/)[^\s]*$/.test(href)) return { internal: true };
  return null;
}

function renderInline(text: string, context: RenderContext, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (match[1]) {
      nodes.push(
        <code key={key} className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(token.slice(2, -2), context, key)}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), context, key)}</em>);
    } else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
      const safe = safeHref(href);
      const linkClasses = "font-medium text-accent underline wrap-anywhere hover:text-accent-strong";
      if (!safe) {
        nodes.push(label);
      } else if (safe.internal) {
        nodes.push(
          <Link key={key} href={localizePath(context.locale, href)} className={linkClasses}>
            {label}
          </Link>,
        );
      } else {
        nodes.push(
          <a key={key} href={href} {...newTabProps} className={linkClasses}>
            {label}
            <span className="sr-only"> {context.newTabLabel}</span>
          </a>,
        );
      }
    }

    last = start + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface RenderContext {
  locale: Locale;
  newTabLabel: string;
}

/** Renders the forum's safe Markdown subset: ## and ### headings, paragraphs, - and 1. lists,
 *  **bold**, *italic*, `code`, and [links](…) to https:// addresses or site paths. It builds React
 *  elements only, never raw HTML, so post text can't inject markup. Used by posts and the editor.
**/
export function Markdown({ source, locale, newTabLabel }: { source: string; locale: Locale; newTabLabel: string }) {
  const context = { locale, newTabLabel };

  return (
    <div className="flex flex-col gap-4 leading-relaxed text-muted wrap-anywhere">
      {parseBlocks(source).map((block, index) => {
        const key = `b${index}`;
        if (block.kind === "heading") {
          return block.level === 2 ? (
            <h2 key={key} className="mt-4 font-display text-2xl font-semibold text-foreground">
              {renderInline(block.text, context, key)}
            </h2>
          ) : (
            <h3 key={key} className="mt-2 font-display text-xl font-semibold text-foreground">
              {renderInline(block.text, context, key)}
            </h3>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key} className={`flex flex-col gap-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-subtle`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, context, `${key}-${itemIndex}`)}</li>
              ))}
            </List>
          );
        }
        return <p key={key}>{renderInline(block.text, context, key)}</p>;
      })}
    </div>
  );
}
