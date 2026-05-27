import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useThreadsStore } from "@/store/threads";

export interface ComposerHandle {
  /** Reserved for Task 10 (chip-driven typing animation). */
  runChipAnimation: (text: string) => void;
}

/**
 * V2 composer.
 *
 * Real <input> inside the design's `.input-row` wrapper. The decorative
 * `.input-row-cursor` blink CSS from the design source is intentionally
 * unused — the real text caret takes its place — but the rule stays in
 * `portfolio.css` for future decorative use.
 *
 * Auto-focuses on mount (one less keystroke to start typing). On mobile
 * this pops the keyboard immediately; revisit in Phase E if real-device
 * feedback complains.
 *
 * Phase D submit flow: mints a thread id, navigates to `/chat/$threadId`
 * with `initialPrompt` on history state. No API call, no SSE — those land
 * in Phase E.
 */
export const Composer = forwardRef<ComposerHandle>(function Composer(_, ref) {
  const navigate = useNavigate();
  const create = useThreadsStore((s) => s.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    runChipAnimation: (_text: string) => {
      // Task 10 implements the animation. Stubbed here so HomePane can wire
      // the ref without a TypeScript error.
    },
  }));

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = create();
    // Route /chat/$threadId is registered in Task 13; cast until routeTree
    // includes it so typecheck stays green across the task sequence.
    navigate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        to: "/chat/$threadId",
        params: { threadId: id },
        state: { initialPrompt: trimmed },
      } as any,
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="input-row"
    >
      <input
        ref={inputRef}
        type="text"
        className="input-row-mono"
        style={{
          background: "transparent",
          border: 0,
          outline: "none",
          flex: 1,
        }}
        placeholder="Type a question, or pick one below…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <span className="kbd" style={{ marginRight: 4 }}>
        ⏎
      </span>
      <button type="submit" className="send-btn" aria-label="Send">
        ↑
      </button>
    </form>
  );
});
