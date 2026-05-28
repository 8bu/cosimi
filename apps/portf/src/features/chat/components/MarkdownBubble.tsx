import ReactMarkdown from "react-markdown";

interface Props {
  text: string;
}

/**
 * Render bot/user message text as a SIMPLE markdown subset:
 *   - paragraphs (blank-line separated)
 *   - bullet lists, ordered lists, blockquotes
 *   - h2, h3 (h1 reserved for chat header chrome)
 *   - inline: bold, italic, inline code, autolinked plain URLs
 *   - explicit `[label](url)` links → open in new tab
 *
 * NOT rendered (whitelist excludes):
 *   - images (no data exfiltration via tracking pixels)
 *   - raw HTML (react-markdown disables by default; explicit safety net)
 *   - h1 (visual hierarchy already owned by the chat surface)
 *   - tables, code fences (rarely useful in a 78%-max-width bubble)
 *
 * Author-side single `\n` newlines still render as visible line breaks
 * because the parent `.bubble` carries `white-space: pre-wrap`
 * (apps/portf/src/styles/layout.css). Markdown's blank-line paragraph
 * rule still applies for explicit `<p>` breaks.
 *
 * Links open in a new tab with `rel="noopener noreferrer"` to keep the
 * chat thread anchored when visitors follow external references.
 */
export function MarkdownBubble({ text }: Props) {
  return (
    <ReactMarkdown
      allowedElements={[
        "p",
        "strong",
        "em",
        "code",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "h2",
        "h3",
        "br",
      ]}
      unwrapDisallowed
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
