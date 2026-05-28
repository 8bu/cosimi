import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { MarkdownBubble } from "@/features/chat/components/MarkdownBubble";

afterEach(() => {
  cleanup();
});

describe("<MarkdownBubble>", () => {
  it("renders bold as <strong>", () => {
    const { container } = render(<MarkdownBubble text="**WegoPro** is great" />);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("WegoPro");
  });

  it("renders italic as <em>", () => {
    const { container } = render(<MarkdownBubble text="*emphasis*" />);
    expect(container.querySelector("em")?.textContent).toBe("emphasis");
  });

  it("renders inline code as <code>", () => {
    const { container } = render(<MarkdownBubble text="run `pnpm dev`" />);
    expect(container.querySelector("code")?.textContent).toBe("pnpm dev");
  });

  it("renders explicit link with target=_blank + rel=noopener", () => {
    const { container } = render(<MarkdownBubble text="[WegoPro](https://wegopro.com)" />);
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://wegopro.com");
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
    expect(a.textContent).toBe("WegoPro");
  });

  it("renders bullet list as <ul><li>", () => {
    const { container } = render(<MarkdownBubble text={"- a\n- b\n- c"} />);
    const items = container.querySelectorAll("ul li");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toBe("a");
  });

  it("renders blockquote", () => {
    const { container } = render(<MarkdownBubble text="> quoted" />);
    expect(container.querySelector("blockquote")?.textContent?.trim()).toBe("quoted");
  });

  it("renders h2 and h3", () => {
    const { container } = render(<MarkdownBubble text={"## heading 2\n\n### heading 3"} />);
    expect(container.querySelector("h2")?.textContent).toBe("heading 2");
    expect(container.querySelector("h3")?.textContent).toBe("heading 3");
  });

  it("strips raw HTML script tags (XSS safety)", () => {
    const { container } = render(
      <MarkdownBubble text={"<script>alert('xss')</script>safe text"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    // The textual "safe text" still renders
    expect(container.textContent).toContain("safe text");
  });

  it("strips img tags (no images allowed)", () => {
    const { container } = render(<MarkdownBubble text={"![alt](https://evil.example/x.png)"} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("does NOT render h1 (chrome owns it)", () => {
    const { container } = render(<MarkdownBubble text="# big heading" />);
    expect(container.querySelector("h1")).toBeNull();
  });

  it("preserves plain text without markdown syntax", () => {
    const { container } = render(<MarkdownBubble text="just plain text" />);
    expect(container.textContent).toBe("just plain text");
  });

  it("renders multiple paragraphs", () => {
    const { container } = render(<MarkdownBubble text={"para one\n\npara two"} />);
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0]?.textContent).toBe("para one");
    expect(ps[1]?.textContent).toBe("para two");
  });
});
