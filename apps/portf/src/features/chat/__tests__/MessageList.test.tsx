import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MessageList } from "@/features/chat/components/MessageList";
import type { ChatMessage } from "@/features/chat/types";

const u = (id: string, text: string): ChatMessage => ({
  kind: "user",
  id,
  text,
  createdAt: 0,
});
const b = (id: string, text: string): ChatMessage => ({
  kind: "bot",
  id,
  text,
  status: "settled",
  meta: null,
  noMatch: false,
  artifactSlug: null,
  createdAt: 0,
});

describe("MessageList", () => {
  beforeEach(() => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollTo = scrollSpy as unknown as Element["scrollTo"];
  });

  it("renders messages in order", () => {
    const { container } = render(
      <MessageList messages={[u("u1", "first"), b("b1", "second"), u("u2", "third")]} />,
    );
    const bubbles = Array.from(container.querySelectorAll(".bubble"));
    expect(bubbles.map((el) => el.textContent)).toEqual(["first", "second", "third"]);
  });

  it("calls scrollTo on message change", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollTo = scrollSpy as unknown as Element["scrollTo"];
    // MessageList's effect targets .closest('.chat-pane'); wrap so it resolves.
    const Wrap = ({ msgs }: { msgs: ChatMessage[] }) => (
      <div className="chat-pane">
        <MessageList messages={msgs} />
      </div>
    );
    const { rerender } = render(<Wrap msgs={[u("u1", "a")]} />);
    rerender(<Wrap msgs={[u("u1", "a"), b("b1", "b")]} />);
    expect(scrollSpy).toHaveBeenCalled();
  });
});
